import { describe, expect, it } from 'vitest';
import { BUILT_IN_FOODS } from '../data/foods';
import { freshData, normalizeBook } from './storage';
import { previewIdea, suggestMeals } from './suggestions';
import { mergeBooks } from './sync';
import type { AppData, ProfileBook } from '../types';

const base = { foods: BUILT_IN_FOODS, logs: [], today: '2026-11-05', room: 1200, hour: 13, light: false };

function book(data: AppData, updatedAt: string): ProfileBook {
  return { version: 1, updatedAt, removedProfileIds: [], profiles: [{ id: 'p', name: 'Priya', updatedAt, data }] };
}

describe('meal ideas', () => {
  it('never suggests an idea she hid', () => {
    const shown = suggestMeals(base).map((idea) => idea.title);
    expect(shown.length).toBeGreaterThan(0);
    const hidden = new Set(shown.map((title) => title.toLowerCase()));
    const again = suggestMeals({ ...base, hidden }).map((idea) => idea.title);
    expect(again.some((title) => hidden.has(title.toLowerCase()))).toBe(false);
  });

  it('shows her own ideas first', () => {
    const custom = [{ id: 'i1', title: 'Tofu chapati lunch', query: '2 chapati, tofu curry', slot: 'midday' as const, createdAt: 'x' }];
    const ideas = suggestMeals({ ...base, custom });
    expect(ideas[0]).toMatchObject({ title: 'Tofu chapati lunch', kind: 'yours', customId: 'i1' });
  });

  it('flags foods Healthify does not know', () => {
    expect(previewIdea('2 chapati, zzqx', BUILT_IN_FOODS)?.unknown).toEqual(['zzqx']);
    expect(previewIdea('2 chapati, tofu curry', BUILT_IN_FOODS)?.unknown).toEqual([]);
  });

  it('syncs added, hidden and deleted ideas', () => {
    const phone = freshData();
    phone.customIdeas = [{ id: 'i1', title: 'Tofu chapati lunch', query: '2 chapati, tofu curry', slot: 'midday', createdAt: 'x' }];
    phone.hiddenIdeas = [{ id: 'h1', key: 'lemon rice', createdAt: 'x' }];
    const merged = mergeBooks(book(phone, '2026-11-05T03:00:00.000Z'), book(freshData(), '2026-11-05T09:00:00.000Z')).profiles[0].data;
    expect(merged.customIdeas.map((idea) => idea.id)).toEqual(['i1']);
    expect(merged.hiddenIdeas.map((entry) => entry.key)).toEqual(['lemon rice']);

    const deleted = { ...merged, customIdeas: [], removedLogIds: ['i1'] };
    const again = mergeBooks(book(phone, '2026-11-05T03:00:00.000Z'), book(deleted, '2026-11-05T10:00:00.000Z')).profiles[0].data;
    expect(again.customIdeas).toHaveLength(0);
    expect(normalizeBook({ version: 1, profiles: [{ id: 'p', name: 'Priya', updatedAt: 'x', data: merged }] }).profiles[0].data.hiddenIdeas).toHaveLength(1);
  });
});
