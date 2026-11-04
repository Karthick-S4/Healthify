import { describe, expect, it } from 'vitest';
import { freshData, normalizeBook } from './storage';
import { mergeBooks } from './sync';
import type { ProfileBook, ProfileRecord } from '../types';

function profile(id: string, name: string, updatedAt: string, logs: ProfileRecord['data']['logs'] = [], removed: string[] = []): ProfileRecord {
  const data = freshData();
  data.logs = logs;
  data.removedLogIds = removed;
  return { id, name, updatedAt, data };
}

function book(profiles: ProfileRecord[], removedProfileIds: string[] = [], updatedAt = '2026-11-04T00:00:00.000Z'): ProfileBook {
  return { version: 1, updatedAt, profiles, removedProfileIds };
}

const apple = {
  id: 'meal-1',
  date: '2026-11-04',
  title: 'Apple',
  grams: 150,
  kcal: 78,
  outside: false,
  createdAt: '2026-11-04T01:00:00.000Z',
};

describe('mergeBooks', () => {
  it('keeps meals logged on either device', () => {
    const idli = { ...apple, id: 'meal-2', title: 'Idli', kcal: 175 };
    const merged = mergeBooks(book([profile('a', 'Priya', '2026-11-04T01:00:00.000Z', [apple])]), book([profile('a', 'Priya', '2026-11-04T02:00:00.000Z', [idli])]));
    expect(merged.profiles[0]?.data.logs.map((log) => log.title).sort()).toEqual(['Apple', 'Idli']);
  });

  it('keeps a deleted meal deleted and a removed profile removed', () => {
    const phone = book([profile('a', 'Priya', '2026-11-04T02:00:00.000Z', [], ['meal-1'])], ['gone']);
    const tablet = book([
      profile('a', 'Priya', '2026-11-04T01:00:00.000Z', [apple]),
      profile('gone', 'Old', '2026-11-04T01:00:00.000Z', [apple]),
    ]);
    const merged = mergeBooks(tablet, phone);
    expect(merged.profiles.map((item) => item.id)).toEqual(['a']);
    expect(merged.profiles[0]?.data.logs).toEqual([]);
  });

  it('uses the newer calories when the same meal was edited', () => {
    const edited = { ...apple, kcal: 90 };
    const merged = mergeBooks(
      book([profile('a', 'Priya', '2026-11-04T01:00:00.000Z', [apple])]),
      book([profile('a', 'Priya', '2026-11-04T03:00:00.000Z', [edited])]),
    );
    expect(merged.profiles[0]?.data.logs[0]?.kcal).toBe(90);
  });

  it('joins profiles with the same name made on different devices', () => {
    const idli = { ...apple, id: 'meal-2', title: 'Idli', kcal: 175 };
    const laptop = book([profile('b-laptop', 'Priya', '2026-11-04T01:00:00.000Z', [apple])]);
    const phone = book([profile('a-phone', 'priya', '2026-11-04T02:00:00.000Z', [idli])]);
    const merged = mergeBooks(laptop, phone);
    expect(merged.profiles).toHaveLength(1);
    expect(merged.profiles[0]?.id).toBe('a-phone');
    expect(merged.profiles[0]?.data.logs.map((log) => log.title).sort()).toEqual(['Apple', 'Idli']);
    expect(merged.removedProfileIds).toContain('b-laptop');
    expect(mergeBooks(phone, laptop).profiles[0]?.id).toBe('a-phone');
  });

  it('drops a profile record that has no name', () => {
    expect(normalizeBook({ version: 1, profiles: [{ id: 'x' }, { id: 'ok', name: 'Priya', data: freshData() }] }).profiles).toHaveLength(1);
  });
});
