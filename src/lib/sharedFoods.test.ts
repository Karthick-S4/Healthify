import { describe, expect, it } from 'vitest';
import { allFoods } from './foods';
import { parseFoodList } from './parseFood';
import { emptyShared, freshData, normalizeBook } from './storage';
import { liftFoods, mergeBooks } from './sync';
import type { FoodHit } from './parseFood';
import type { Food, ProfileBook } from '../types';

function book(updatedAt: string, shared = emptyShared(), profiles: ProfileBook['profiles'] = []): ProfileBook {
  return { version: 1, updatedAt, removedProfileIds: [], profiles, shared };
}

function kcalOf(query: string, foods: Food[]): number {
  return (parseFoodList(query, foods).items[0] as FoodHit).kcal;
}

const vadai: Food = { id: 'f1', name: 'Vadai', group: 'Yours', aliases: ['vadai'], kcalPer100g: 300, pieceGrams: 40, pieceLabel: 'serving', source: 'custom' };

describe('shared food corrections', () => {
  it('every profile sees a correction made once', () => {
    const shared = { ...emptyShared(), tweaks: { maggi: { kcalPer100g: 571.4, pieceGrams: 70, updatedAt: '2026-11-05T10:00:00Z' } } };
    expect(kcalOf('1 maggi', allFoods(freshData()))).toBe(322);
    expect(kcalOf('1 maggi', allFoods(freshData(), shared))).toBe(400);
  });

  it('keeps the latest correction from either device', () => {
    const phone = book('2026-11-05T10:00:00Z', { ...emptyShared(), tweaks: { maggi: { kcalPer100g: 500, updatedAt: '2026-11-05T10:00:00Z' } } });
    const laptop = book('2026-11-05T09:00:00Z', { ...emptyShared(), tweaks: { maggi: { kcalPer100g: 450, updatedAt: '2026-11-05T11:00:00Z' } }, foods: [vadai] });
    const merged = mergeBooks(phone, laptop);
    expect(merged.shared.tweaks.maggi.kcalPer100g).toBe(450);
    expect(merged.shared.foods.map((food) => food.id)).toEqual(['f1']);
    expect(normalizeBook(JSON.parse(JSON.stringify(merged))).shared).toEqual(merged.shared);
  });

  it('a reset brings back the built-in value everywhere', () => {
    const data = { ...freshData(), tweaks: { maggi: { kcalPer100g: 600 } } };
    const reset = { ...emptyShared(), tweaks: { maggi: { updatedAt: '2026-11-05T12:00:00Z' } } };
    expect(kcalOf('1 maggi', allFoods(data))).toBe(420);
    expect(kcalOf('1 maggi', allFoods(data, reset))).toBe(322);
  });

  it('moves foods and corrections a profile already had into the shared list once', () => {
    const data = { ...freshData(), customFoods: [vadai], tweaks: { maggi: { kcalPer100g: 500 } } };
    const start = book('2026-11-01T00:00:00Z', emptyShared(), [{ id: 'p', name: 'Priya', updatedAt: '2026-11-01T00:00:00Z', data }]);
    const lifted = liftFoods(start, '2026-11-05T00:00:00Z');
    expect(lifted.shared.foods.map((food) => food.id)).toEqual(['f1']);
    expect(lifted.shared.tweaks.maggi.kcalPer100g).toBe(500);
    expect(liftFoods(lifted)).toBe(lifted);
  });
});
