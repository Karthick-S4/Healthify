import { describe, expect, it } from 'vitest';
import { emptyShared, freshData, normalizeBook } from './storage';
import { activityDay, activityStreak, cheatInWeek, homeDay, homeStreak, onTargetStreak, weekMarks, withCheat } from './streaks';
import { mergeBooks } from './sync';
import type { ActivityEntry, CheatDay, LogEntry, ProfileBook } from '../types';

function meal(date: string, kcal: number, outside = false): LogEntry {
  return { id: `${date}-${kcal}-${outside}`, date, title: 'Meal', grams: 100, kcal, outside, createdAt: `${date}T08:00:00.000Z` };
}

function move(date: string): ActivityEntry {
  return { id: `move-${date}`, date, name: 'Walking', minutes: 20, createdAt: `${date}T06:00:00.000Z` };
}

function cheatDay(id: string, date: string): CheatDay {
  return { id, date, createdAt: `${date}T07:00:00.000Z` };
}

const target = () => 1500;

describe('cheat day', () => {
  it('keeps the on-target streak when today goes over', () => {
    const logs = [meal('2026-11-02', 1200), meal('2026-11-03', 1400), meal('2026-11-04', 3000)];
    expect(onTargetStreak(logs, '2026-11-04', target)).toMatchObject({ days: 0, today: 'over' });
    expect(onTargetStreak(logs, '2026-11-04', target, new Set(['2026-11-04']))).toMatchObject({ days: 2, today: 'cheat' });
  });

  it('carries the streak over a past cheat day without counting it', () => {
    const logs = [meal('2026-11-01', 1200), meal('2026-11-02', 2800, true), meal('2026-11-03', 1400)];
    const cheat = new Set(['2026-11-02']);
    expect(onTargetStreak(logs, '2026-11-04', target, cheat).days).toBe(2);
    expect(homeStreak(logs, '2026-11-04', cheat)).toEqual({ days: 2, brokeToday: false });
  });

  it('does not break home meals when eating out on the cheat day', () => {
    const logs = [meal('2026-11-03', 1200), meal('2026-11-04', 900, true)];
    expect(homeStreak(logs, '2026-11-04').brokeToday).toBe(true);
    expect(homeStreak(logs, '2026-11-04', new Set(['2026-11-04']))).toEqual({ days: 1, brokeToday: false });
  });

  it('still counts a cheat day that would have kept the streak anyway', () => {
    const logs = [meal('2026-11-02', 1200), meal('2026-11-03', 900)];
    expect(homeStreak(logs, '2026-11-04', new Set(['2026-11-03']))).toEqual({ days: 2, brokeToday: false });
    expect(onTargetStreak([meal('2026-11-02', 1000), meal('2026-11-03', 1200)], '2026-11-04', target, new Set(['2026-11-03'])).days).toBe(2);
  });

  it('bridges a rest day in the activity streak', () => {
    const list = [move('2026-11-01'), move('2026-11-03'), move('2026-11-04')];
    expect(activityStreak(list, '2026-11-04').days).toBe(2);
    expect(activityStreak(list, '2026-11-04', new Set(['2026-11-02'])).days).toBe(3);
  });

  it('shows the cheat mark in the week', () => {
    const logs = [meal('2026-11-02', 900, true)];
    const marks = weekMarks('2026-11-04', withCheat(new Set(['2026-11-02']), (iso) => homeDay(logs, iso)), 'skipped');
    expect(marks[0].mark).toBe('cheat');
    const moves = weekMarks('2026-11-04', withCheat(new Set(['2026-11-03']), (iso) => activityDay([], iso)), 'skipped');
    expect(moves[1].mark).toBe('cheat');
  });

  it('allows one per Monday to Sunday week', () => {
    const entries = [cheatDay('c1', '2026-11-02')];
    expect(cheatInWeek(entries, '2026-11-08')).toBe('2026-11-02');
    expect(cheatInWeek(entries, '2026-11-09')).toBeNull();
  });

  it('syncs a cheat day to other devices and syncs turning it off', () => {
    const phone = freshData();
    phone.cheatDays = [cheatDay('c1', '2026-11-04')];
    const laptop = freshData();
    const book = (data: typeof phone, updatedAt: string): ProfileBook => ({
      version: 1,
      updatedAt,
      removedProfileIds: [],
      shared: emptyShared(),
      profiles: [{ id: 'p', name: 'Priya', updatedAt, data }],
    });
    const merged = mergeBooks(book(phone, '2026-11-04T03:00:00.000Z'), book(laptop, '2026-11-04T09:00:00.000Z')).profiles[0].data;
    expect(merged.cheatDays.map((entry) => entry.date)).toEqual(['2026-11-04']);

    const off = { ...merged, cheatDays: [], removedLogIds: ['c1'] };
    const again = mergeBooks(book(phone, '2026-11-04T03:00:00.000Z'), book(off, '2026-11-04T10:00:00.000Z')).profiles[0].data;
    expect(again.cheatDays).toHaveLength(0);

    const saved = normalizeBook({ version: 1, profiles: [{ id: 'p', name: 'Priya', updatedAt: 'x', data: merged }] });
    expect(saved.profiles[0].data.cheatDays).toHaveLength(1);
  });
});
