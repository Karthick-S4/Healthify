import { describe, expect, it } from 'vitest';
import { BUILT_IN_FOODS } from '../data/foods';
import { parseFoodList } from './parseFood';
import { matchFood } from './foods';

const foods = BUILT_IN_FOODS;

describe('food aliases', () => {
  it('does not reuse an alias', () => {
    const seen = new Map<string, string>();
    for (const food of foods) {
      for (const alias of food.aliases) {
        const previous = seen.get(alias);
        if (previous) throw new Error(`${alias} is on ${previous} and ${food.id}`);
        seen.set(alias, food.id);
      }
    }
  });
});

describe('parseFoodList', () => {
  it('tracks counted idli and weighed apple', () => {
    const idli = parseFoodList('3 idlies', foods);
    const apple = parseFoodList('apple 150g', foods);
    expect(idli.outside).toBe(false);
    expect(idli.items[0]).toMatchObject({ kind: 'food', title: '3 Idli', grams: 120, kcal: 175 });
    expect(apple.items[0]).toMatchObject({ kind: 'food', title: 'Apple, 150 g', grams: 150, kcal: 78 });
  });

  it('accepts weight before the food and a bare gram amount', () => {
    expect(parseFoodList('150g apple', foods).items[0]).toMatchObject({ kcal: 78 });
    expect(parseFoodList('apple 150', foods).items[0]).toMatchObject({ kcal: 78 });
  });

  it('asks for grams when the weight was left out', () => {
    const parsed = parseFoodList('apple g', foods);
    expect(parsed.items[0]).toMatchObject({ kind: 'need-grams', food: { id: 'apple' } });
  });

  it('splits a meal and flags restaurant words', () => {
    const parsed = parseFoodList('3 idli with ghee ate out', foods);
    expect(parsed.outside).toBe(true);
    expect(parsed.items.map((item) => (item.kind === 'food' ? item.title : item.kind))).toEqual(['3 Idli', '1 Ghee']);
  });

  it('reads a glass of milk', () => {
    expect(parseFoodList('1 glass milk', foods).items[0]).toMatchObject({ kind: 'food', food: { id: 'milk' }, grams: 200 });
    expect(parseFoodList('2 glasses of milk', foods).items[0]).toMatchObject({ kind: 'food', grams: 400 });
  });

  it('keeps multi-word foods together', () => {
    const parsed = parseFoodList('2 masala dosa, 1 bowl curd rice', foods);
    expect(parsed.items.map((item) => (item.kind === 'food' ? item.food.id : item.kind))).toEqual([
      'masala-dosa',
      'curd-rice',
    ]);
  });

  it('recognises idly and a short apple prefix, and leaves idle alone', () => {
    expect(matchFood('idly', foods)?.id).toBe('idli');
    expect(matchFood('appl', foods)?.id).toBe('apple');
    expect(matchFood('idle', foods)).toBeNull();
    expect(parseFoodList('dragon fruit', foods).items[0]?.kind).toBe('unknown');
  });
});
