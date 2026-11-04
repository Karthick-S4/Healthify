import { describe, expect, it } from 'vitest';
import { BUILT_IN_FOODS } from '../data/foods';
import { closeFoods, matchFood, searchFoods } from './foods';

const foods = BUILT_IN_FOODS;
const idFor = (name: string) => matchFood(name, foods)?.id ?? null;

describe('spelling-tolerant food matching', () => {
  it.each([
    ['chicken biriyani', 'chicken-biryani'],
    ['chiken briyani', 'chicken-biryani'],
    ['veg biriyani', 'veg-biryani'],
    ['thosai', 'dosa'],
    ['dosai', 'dosa'],
    ['idly', 'idli'],
    ['dhal', 'dal'],
    ['daal', 'dal'],
    ['uppuma', 'upma'],
    ['wada', 'vada'],
    ['sambhar', 'sambar'],
    ['panner', 'paneer'],
    ['appel', 'apple'],
    ['porotta', 'parotta'],
    ['khichadi', 'khichdi'],
    ['butter chiken', 'butter-chicken'],
    ['gulaab jamoon', 'gulab-jamun'],
    ['alu parata', 'aloo-paratha'],
    ['chai', 'tea'],
    ['filter kaapi', 'coffee'],
  ])('%s -> %s', (name, id) => {
    expect(idFor(name)).toBe(id);
  });

  it('offers every biryani instead of guessing one', () => {
    expect(idFor('biriyani')).toBeNull();
    const ids = closeFoods('briyani', foods, 4, 'any').map((food) => food.id);
    expect(ids).toEqual(expect.arrayContaining(['veg-biryani', 'chicken-biryani', 'mutton-biryani', 'egg-biryani']));
  });

  it('finds foods in search whichever way they are spelt', () => {
    for (const query of ['biryani', 'biriyani', 'briyani']) {
      expect(searchFoods(query, foods).map((food) => food.id)).toContain('chicken-biryani');
    }
    expect(searchFoods('chap', foods)[0]?.id).toBe('roti');
    expect(searchFoods('panner', foods)[0]?.id).toBe('paneer');
  });
});
