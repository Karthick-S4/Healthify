import { describe, expect, it } from 'vitest';
import { applyHealthFiles, healthFileTime, healthNumber, readHealthFile } from './appleHealth';
import { freshData, normalizeBook } from './storage';

const WATCH = 'Niv’s Apple Watch';
const PHONE = 'Niv’s iPhone';

function steps(value: string, start: string, end: string, src = WATCH) {
  return { k: 'steps', v: value, u: 'count', s: `2026-11-05T${start}:00+05:30`, e: `2026-11-05T${end}:00+05:30`, src };
}

function walk(start: string, end: string, n = 'Outdoor Walk') {
  return { k: 'workout', v: '', u: '', s: `2026-11-05T${start}:00+05:30`, e: `2026-11-05T${end}:00+05:30`, src: WATCH, n };
}

function bookWith(name: string) {
  return normalizeBook({
    version: 1,
    updatedAt: '2026-11-05T00:00:00.000Z',
    profiles: [{ id: 'p1', name, updatedAt: '2026-11-05T00:00:00.000Z', data: freshData() }],
    removedProfileIds: [],
  });
}

describe('apple health import', () => {
  it('reads numbers written the way the phone shows them', () => {
    expect(healthNumber('1,234')).toBe(1234);
    expect(healthNumber('12,5')).toBe(12.5);
    expect(healthNumber('1.234,5')).toBe(1234.5);
    expect(healthNumber('35.2 kcal')).toBe(35.2);
    expect(healthNumber('')).toBeNull();
  });

  it('drops repeated samples and does not count phone and watch twice', () => {
    const result = readHealthFile({
      profile: 'Niv',
      samples: [
        steps('500', '07:00', '07:10'),
        steps('500', '07:00', '07:10'),
        steps('300', '07:10', '07:20'),
        steps('760', '07:00', '07:20', PHONE),
        steps('200', '20:00', '20:10', PHONE),
      ],
    });
    expect(result.days['2026-11-05'].steps).toBe(1000);
  });

  it('adds up calories, converting kilojoules, and minutes', () => {
    const result = readHealthFile({
      profile: 'Niv',
      samples: [
        { k: 'energy', v: '41.84', u: 'kJ', s: '2026-11-05T07:00:00+05:30', e: '2026-11-05T07:05:00+05:30', src: WATCH },
        { k: 'Active Energy', v: '20', u: 'kcal', s: '2026-11-05T08:00:00+05:30', e: '2026-11-05T08:05:00+05:30', src: WATCH },
        { k: 'exercise', v: '12', u: 'min', s: '2026-11-05T07:00:00+05:30', e: '2026-11-05T07:12:00+05:30', src: WATCH },
        { k: 'stand', v: '300', u: 's', s: '2026-11-05T09:00:00+05:30', e: '2026-11-05T09:05:00+05:30', src: WATCH },
      ],
    });
    expect(result.days['2026-11-05']).toEqual({ steps: 0, activeKcal: 30, exerciseMin: 12, standMin: 5 });
  });

  it('counts only the steps inside each walk', () => {
    const result = readHealthFile({
      profile: 'Niv',
      samples: [walk('07:00', '07:30'), walk('07:00', '07:30'), steps('1200', '06:50', '07:10'), steps('2000', '07:10', '07:30'), steps('900', '12:00', '12:10')],
    });
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]).toMatchObject({ name: 'Outdoor Walk', minutes: 30, steps: 2600 });
    expect(result.days['2026-11-05'].steps).toBe(4100);
  });

  it('adds walks to the right profile once and keeps the biggest totals', () => {
    const file = { name: '20261105-210000.json', body: { profile: 'niv', samples: [walk('07:00', '07:30'), steps('2000', '07:00', '07:30')] } };
    const later = { name: '20261105-230000.json', body: { profile: 'Niv', samples: [walk('07:00', '07:30'), steps('2000', '07:00', '07:30'), steps('800', '18:00', '18:10')] } };
    const first = applyHealthFiles(bookWith('Niv'), [file], '2026-11-05T15:30:00.000Z').book;
    const again = applyHealthFiles(first, [file, later], '2026-11-05T17:30:00.000Z').book;
    const data = again.profiles[0].data;
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0]).toMatchObject({ name: 'Outdoor Walk', minutes: 30, steps: 2000, source: 'apple' });
    expect(data.health['2026-11-05'].steps).toBe(2800);
    expect(data.healthFiles).toEqual([file.name, later.name]);
  });

  it('adds up every value in a plain text Shortcut result', () => {
    const text = [
      'Profile: Niv',
      'Today’s Health Data:',
      'Steps (Walking): 43',
      '36',
      '46',
      '115',
      'Active Calories: 3.839',
      '0',
      'Stand Time: ',
      '15',
      '40',
      '0',
    ].join('\n');
    const result = readHealthFile(text, '20261105-184900.txt');
    expect(result.profile).toBe('Niv');
    expect(result.days).toEqual({ '2026-11-05': { steps: 240, activeKcal: 4, exerciseMin: 0, standMin: 55 } });
  });

  it('imports her uploaded text file into a profile that starts with the given name', () => {
    const body = "Profile: Niv\nToday's Health Data:\nSteps: 43\n36\n46\n115\nActive Calories: 3.839\n0\nStand Time: ";
    const out = applyHealthFiles(bookWith('Nivetha'), [{ name: '20261105-191406', body }], '2026-11-05T13:44:00.000Z');
    expect(out.unmatched).toEqual([]);
    expect(out.book.profiles[0].data.health['2026-11-05']).toMatchObject({ steps: 240, activeKcal: 4, standMin: 0 });
    expect(out.book.profiles[0].data.healthFiles).toEqual(['20261105-191406']);
  });

  it('keeps the latest file of the day, even when its numbers are lower', () => {
    const morning = { name: '20261105-091500', body: 'Profile: Niv\nSteps: 900\nActive Calories: 80\nStand Time: 30' };
    const evening = { name: '20261105-211500.txt', body: 'Profile: Niv\nSteps: 400\nActive Calories: 50\nStand Time: 20' };
    const later = applyHealthFiles(bookWith('Niv'), [morning, evening], '2026-11-05T16:00:00.000Z').book;
    expect(later.profiles[0].data.health['2026-11-05']).toMatchObject({ steps: 400, activeKcal: 50, standMin: 20 });
    expect(healthFileTime('20261105-211500.txt')).toBe(new Date(2026, 10, 5, 21, 15, 0).toISOString());

    const stale = applyHealthFiles(later, [{ name: '20261105-120000', body: 'Profile: Niv\nSteps: 5000' }], '2026-11-05T16:05:00.000Z').book;
    expect(stale.profiles[0].data.health['2026-11-05'].steps).toBe(400);
  });

  it('keeps steps as numbers only and never turns them into an activity', () => {
    const night = { name: '20261106-000200', body: 'Profile: Niv\nDate: 2026-11-05\nSteps: 2400\n1800\nActive Calories: 120' };
    const today = { name: '20261106-130000', body: 'Profile: Niv\nSteps: 3500' };
    const data = applyHealthFiles(bookWith('Niv'), [night, today], '2026-11-06T08:00:00.000Z').book.profiles[0].data;
    expect(data.health['2026-11-05'].steps).toBe(4200);
    expect(data.health['2026-11-06'].steps).toBe(3500);
    expect(data.activities).toEqual([]);
  });

  it('takes the profile and day from the file name when the text has none', () => {
    const result = readHealthFile('Steps: 1,200\n300\nExercise Minutes: 12\n8', 'Niv-20261104-2100.txt');
    expect(result.profile).toBe('Niv');
    expect(result.days).toEqual({ '2026-11-04': { steps: 1500, activeKcal: 0, exerciseMin: 20, standMin: 0 } });
  });

  it('does not bring back a walk she deleted, and reports unknown profiles', () => {
    const book = bookWith('Niv');
    const removed = { ...book, profiles: book.profiles.map((profile) => ({ ...profile, data: { ...profile.data, removedLogIds: [`apple-${new Date('2026-11-05T07:00:00+05:30').toISOString()}`] } })) };
    const out = applyHealthFiles(removed, [
      { name: 'a.json', body: { profile: 'Niv', samples: [walk('07:00', '07:30')] } },
      { name: 'b.json', body: { profile: 'Somebody', samples: [walk('09:00', '09:30')] } },
      { name: 'c.json', body: null },
    ]);
    expect(out.book.profiles[0].data.activities).toHaveLength(0);
    expect(out.unmatched).toEqual(['b.json', 'c.json']);
  });
});
