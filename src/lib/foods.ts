import { BUILT_IN_FOODS } from '../data/foods';
import type { AppData, Food } from '../types';

const SPECIAL_SINGULAR: Record<string, string> = {
  idlies: 'idli',
  idlis: 'idli',
  idly: 'idli',
  iddli: 'idli',
  iddaly: 'idli',
  dosai: 'dosa',
  dosas: 'dosa',
  chapatis: 'chapati',
  chappati: 'chapati',
  chapathi: 'chapati',
  rotis: 'roti',
  puris: 'puri',
  eggs: 'egg',
};

function singularToken(word: string): string {
  if (SPECIAL_SINGULAR[word]) return SPECIAL_SINGULAR[word];
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function nameVariants(input: string): string[] {
  const basic = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!basic) return [];
  const folded = basic.split(' ').map(singularToken).join(' ');
  return folded === basic ? [basic] : [basic, folded];
}

export function matchFood(name: string, foods: Food[]): Food | null {
  const wants = new Set(nameVariants(name));
  if (wants.size === 0) return null;

  let best: { food: Food; score: number } | null = null;
  for (const food of foods) {
    for (const alias of food.aliases) {
      const variants = nameVariants(alias);
      if (!variants.some((variant) => wants.has(variant))) continue;
      if (!best || alias.length > best.score) best = { food, score: alias.length };
    }
  }
  if (best) return best.food;

  const probes = [...wants].filter((want) => want.length >= 4);
  if (probes.length === 0) return null;
  const hits = foods.filter((food) =>
    food.aliases.some((alias) => nameVariants(alias).some((variant) => probes.some((probe) => variant.startsWith(probe)))),
  );
  const unique = [...new Map(hits.map((food) => [food.id, food])).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function allFoods(data: Pick<AppData, 'customFoods' | 'tweaks'>): Food[] {
  const built = BUILT_IN_FOODS.map((food) => {
    const tweak = data.tweaks[food.id];
    return tweak ? { ...food, ...tweak } : food;
  });
  return [...data.customFoods, ...built];
}

export function kcalFor(food: Food, grams: number): number {
  return Math.max(0, Math.round((food.kcalPer100g * grams) / 100));
}
