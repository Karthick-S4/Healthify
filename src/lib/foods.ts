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
  if (unique.length === 1) return unique[0];

  let fuzzy: Food | null = null;
  let fuzzyDistance = 99;
  let fuzzyTie = false;
  for (const food of foods) {
    for (const alias of food.aliases) {
      for (const variant of nameVariants(alias)) {
        for (const want of wants) {
          const max = want.length >= 8 ? 2 : want.length >= 5 ? 1 : 0;
          if (max === 0) continue;
          const distance = levenshtein(want, variant, max);
          if (distance > max) continue;
          if (fuzzy && fuzzy.id !== food.id && distance === fuzzyDistance) fuzzyTie = true;
          if (!fuzzy || distance < fuzzyDistance) {
            fuzzy = food;
            fuzzyDistance = distance;
            fuzzyTie = false;
          }
        }
      }
    }
  }
  return fuzzy && !fuzzyTie ? fuzzy : null;
}

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + cost);
      next[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = next;
  }
  return previous[b.length];
}

function dictionaryWords(foods: Food[]): string[] {
  const words = new Set<string>();
  for (const food of foods) {
    for (const alias of food.aliases) {
      for (const word of alias.split(' ')) {
        if (word.length >= 5) words.add(word);
      }
    }
  }
  return [...words];
}

function correctToken(token: string, words: string[]): string {
  if (token.length < 5 || words.includes(token)) return token;
  const max = token.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestDistance = max + 1;
  let ambiguous = false;
  for (const word of words) {
    const distance = levenshtein(token, word, max);
    if (distance > max) continue;
    if (distance < bestDistance) {
      best = word;
      bestDistance = distance;
      ambiguous = false;
    } else if (distance === bestDistance) ambiguous = true;
  }
  return best && !ambiguous ? best : token;
}

export function correctQuery(name: string, foods: Food[]): string {
  const basic = nameVariants(name)[0] ?? '';
  if (!basic) return '';
  const words = dictionaryWords(foods);
  return basic.split(' ').map((token) => correctToken(token, words)).join(' ');
}

export function closeFoods(name: string, foods: Food[], limit = 4): Food[] {
  const corrected = correctQuery(name, foods);
  const tokens = corrected.split(' ').filter((token) => token.length >= 4);
  if (tokens.length === 0) return [];
  return foods
    .filter((food) => food.aliases.some((alias) => tokens.every((token) => alias.split(' ').includes(token))))
    .map((food) => ({
      food,
      score: Math.min(...food.aliases.map((alias) => Math.abs(alias.length - corrected.length))),
    }))
    .sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((item) => item.food);
}

export function suggestedGrams(name: string, foods: Food[]): number | null {
  const close = closeFoods(name, foods, 6);
  if (close.length === 0) return null;
  const grams = close.map((food) => food.pieceGrams).sort((a, b) => a - b);
  const mid = grams[Math.floor(grams.length / 2)];
  const similar = grams.every((gram) => Math.abs(gram - mid) / mid <= 0.25);
  return similar ? mid : null;
}

export function estimateFromFoods(name: string, foods: Food[]): { name: string; kcalPer100g: number } | null {
  const close = closeFoods(name, foods, 6);
  if (close.length === 0) return null;
  const kcals = close.map((food) => food.kcalPer100g).sort((a, b) => a - b);
  const mid = kcals.length % 2 === 1 ? kcals[(kcals.length - 1) / 2] : (kcals[kcals.length / 2 - 1] + kcals[kcals.length / 2]) / 2;
  return { name: correctQuery(name, foods), kcalPer100g: Math.round(mid) };
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

export function proteinFor(food: Food, grams: number): number | null {
  if (food.proteinPer100g == null) return null;
  return Math.max(0, (food.proteinPer100g * grams) / 100);
}
