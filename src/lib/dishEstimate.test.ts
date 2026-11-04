import { describe, expect, it } from 'vitest';
import { BUILT_IN_FOODS } from '../data/foods';
import { estimateDish, ingredientVariants } from './dishEstimate';
import { matchFood } from './foods';
import { caloriesFromIndian } from './indianFoods';
import { caloriesFromOpenFoodFacts } from './lookupFood';

describe('dish estimate', () => {
  it('estimates a vegetable fry from the vegetable and the oil', () => {
    const hit = estimateDish('beetroot poriyal');
    expect(hit?.kcalPer100g).toBe(Math.round(43 * 1.1 + 63));
    expect(hit?.detail).toContain('beetroot');
  });

  it('understands Tamil and Hindi names', () => {
    expect(estimateDish('vazhakkai varuval')?.detail).toContain('raw banana');
    expect(estimateDish('lauki sabzi')?.detail).toContain('bottle gourd');
    expect(estimateDish('kovakkai fry')?.detail).toContain('ivy gourd');
  });

  it('keeps curries lighter than fries and deep fried heavier', () => {
    const curry = estimateDish('mushroom curry')!.kcalPer100g;
    const fry = estimateDish('mushroom fry')!.kcalPer100g;
    const deep = estimateDish('mushroom 65')!.kcalPer100g;
    expect(curry).toBeLessThan(fry);
    expect(fry).toBeLessThan(deep);
  });

  it('needs both a food and a cooking style', () => {
    expect(estimateDish('potato')).toBeNull();
    expect(estimateDish('dragon fruit smoothie')).toBeNull();
  });

  it('tries other names in the Indian recipe list', () => {
    expect(caloriesFromIndian('alu methi')).toBeNull();
    const found = ingredientVariants('alu methi').map((variant) => caloriesFromIndian(variant)).find(Boolean);
    expect(found?.name).toBe('Potato fenugreek');
  });

  it('has potato fry and other everyday sides built in', () => {
    expect(matchFood('potato fry', BUILT_IN_FOODS)?.id).toBe('potato-fry');
    expect(matchFood('aloo fry', BUILT_IN_FOODS)?.id).toBe('potato-fry');
    expect(matchFood('vendakkai poriyal', BUILT_IN_FOODS)?.id).toBe('bhindi-fry');
    expect(matchFood('chicken 65', BUILT_IN_FOODS)?.id).toBe('chicken-fry');
  });
});

describe('Open Food Facts', () => {
  it('reads calories per 100 g from matching products', () => {
    const payload = {
      products: [
        { product_name: 'Good Day cashew cookies', nutriments: { 'energy-kcal_100g': 500 } },
        { product_name: 'Good Day butter cookies', nutriments: { 'energy-kcal_100g': 480 } },
        { product_name: 'Orange juice', nutriments: { 'energy-kcal_100g': 45 } },
      ],
    };
    const hit = caloriesFromOpenFoodFacts(payload, 'good day cookies');
    expect(hit?.kcalPer100g).toBe(490);
    expect(hit?.source).toBe('Open Food Facts');
  });

  it('ignores listings without calories', () => {
    expect(caloriesFromOpenFoodFacts({ products: [{ product_name: 'Mystery snack', nutriments: {} }] }, 'mystery snack')).toBeNull();
  });
});
