import { describe, expect, it } from 'vitest';
import { emptyShared, freshData, normalizeBook } from './storage';
import { activityDay, activityStreak, homeDay, weekMarks } from './streaks';
import { mergeBooks } from './sync';
import type { ActivityEntry, LogEntry, ProfileBook } from '../types';

function move(id: string, date: string, minutes = 20): ActivityEntry {
  return { id, date, name: 'Walking', minutes, createdAt: `${date}T06:00:00.000Z` };
}

function meal(id: string, date: string, outside: boolean): LogEntry {
  return { id, date, title: 'Meal', grams: 100, kcal: 200, outside, createdAt: `${date}T08:00:00.000Z` };
}

describe('activity streak', () => {
  it('counts back from today when today has activity', () => {
    const list = [move('a', '2026-11-04'), move('b', '2026-11-03'), move('c', '2026-11-02'), move('d', '2026-10-30')];
    expect(activityStreak(list, '2026-11-04')).toEqual({ days: 3, doneToday: true });
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    const list = [move('b', '2026-11-03'), move('c', '2026-11-02')];
    expect(activityStreak(list, '2026-11-04')).toEqual({ days: 2, doneToday: false });
  });

});

describe('week marks', () => {
  it('marks Monday to Sunday with done, missed, open and future days', () => {
    const list = [move('a', '2026-11-02')];
    const marks = weekMarks('2026-11-04', (iso) => activityDay(list, iso)).map((item) => item.mark);
    expect(marks).toEqual(['done', 'missed', 'open', 'future', 'future', 'future', 'future']);
  });

  it('shows an earlier week when asked', () => {
    const list = [move('a', '2026-10-27')];
    const marks = weekMarks('2026-11-04', (iso) => activityDay(list, iso), 'missed', '2026-10-28');
    expect(marks[0].iso).toBe('2026-10-26');
    expect(marks.map((item) => item.mark)).toEqual(['missed', 'done', 'missed', 'missed', 'missed', 'missed', 'missed']);
  });

  it('shows days without meals as skipped for home meals', () => {
    const logs = [meal('a', '2026-11-02', false), meal('b', '2026-11-04', true)];
    const marks = weekMarks('2026-11-04', (iso) => homeDay(logs, iso), 'skipped').map((item) => item.mark);
    expect(marks.slice(0, 3)).toEqual(['done', 'skipped', 'missed']);
  });
});

describe('body and activity sync', () => {
  it('keeps entries from both devices and drops deleted ones', () => {
    const left = freshData();
    left.weights = [{ id: 'w1', date: '2026-11-01', kg: 60, createdAt: '2026-11-01T06:00:00.000Z' }];
    left.activities = [move('a', '2026-11-03')];
    const right = freshData();
    right.measures = [{ id: 'm1', date: '2026-11-02', part: 'Waist', cm: 72, createdAt: '2026-11-02T06:00:00.000Z' }];
    right.removedLogIds = ['a'];
    const book = (data: typeof left, updatedAt: string): ProfileBook => ({
      version: 1,
      updatedAt,
      removedProfileIds: [],
      shared: emptyShared(),
      profiles: [{ id: 'p', name: 'Priya', updatedAt, data }],
    });
    const merged = mergeBooks(book(left, '2026-11-04T01:00:00.000Z'), book(right, '2026-11-04T02:00:00.000Z')).profiles[0].data;
    expect(merged.weights.map((entry) => entry.id)).toEqual(['w1']);
    expect(merged.measures.map((entry) => entry.id)).toEqual(['m1']);
    expect(merged.activities).toHaveLength(0);
  });

  it('ignores broken entries in saved data', () => {
    const data = { ...freshData(), weights: [{ id: 'w', date: '2026-11-01', kg: -1, createdAt: 'x' }], activities: [{ id: 'a', date: 'nope', name: 'Yoga', minutes: 30 }] };
    const profiles = normalizeBook({ version: 1, profiles: [{ id: 'p', name: 'Priya', updatedAt: '2026-11-04T00:00:00.000Z', data }] }).profiles;
    expect(profiles[0].data.weights).toHaveLength(0);
    expect(profiles[0].data.activities).toHaveLength(0);
  });
});
