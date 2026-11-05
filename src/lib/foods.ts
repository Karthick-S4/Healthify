import { BUILT_IN_FOODS } from '../data/foods';
import type { AppData, Food, SharedFoods, SharedTweak } from '../types';

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

export function foldWord(word: string): string {
  return word
    .replace(/([bdgkpt])h/g, '$1')
    .replace(/sh/g, 's')
    .replace(/w/g, 'v')
    .replace(/ck|q/g, 'k')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/([^aeiou])iy/g, '$1y')
    .replace(/ai$/, 'a')
    .replace(/y$/, 'i');
}

function foldTokens(input: string): string[] {
  const variants = nameVariants(input);
  const singular = variants[variants.length - 1];
  return singular ? singular.split(' ').map(foldWord) : [];
}

function typedLimits(input: string): number[] {
  const variants = nameVariants(input);
  const singular = variants[variants.length - 1];
  return singular ? singular.split(' ').map((token) => allowance(token.length)) : [];
}

function spellings(input: string): string[] {
  const variants = nameVariants(input);
  if (variants.length === 0) return [];
  return [...new Set([...variants, foldTokens(input).join(' ')])];
}

function allowance(length: number): number {
  return length >= 7 ? 2 : length >= 5 ? 1 : 0;
}

function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, index) => index)];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
      row[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max + 1) return max + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

function tokenDistance(token: string, candidates: string[], allowPrefix: boolean, max: number): number | null {
  let best: number | null = null;
  for (const candidate of candidates) {
    if (candidate === token) return 0;
    if (allowPrefix && token.length >= 3 && candidate.startsWith(token)) {
      best = best == null ? 0.5 : Math.min(best, 0.5);
      continue;
    }
    if (max === 0) continue;
    const distance = editDistance(token, candidate, max);
    if (distance <= max && (best == null || distance < best)) best = distance;
  }
  return best;
}

function sameShape(query: string[], limits: number[], alias: string[]): number | null {
  if (query.length !== alias.length) return null;
  let total = 0;
  for (let index = 0; index < query.length; index += 1) {
    const distance = tokenDistance(query[index], [alias[index]], false, limits[index]);
    if (distance == null) return null;
    total += distance;
  }
  return total;
}

export function matchFood(name: string, foods: Food[]): Food | null {
  const wants = new Set(spellings(name));
  if (wants.size === 0) return null;

  const exact = new Set(nameVariants(name));
  for (const [want, expand] of [[exact, nameVariants], [wants, spellings]] as const) {
    let best: { food: Food; score: number } | null = null;
    for (const food of foods) {
      for (const alias of food.aliases) {
        if (!expand(alias).some((variant) => want.has(variant))) continue;
        if (!best || alias.length > best.score) best = { food, score: alias.length };
      }
    }
    if (best) return best.food;
  }

  const probes = [...wants].filter((want) => want.length >= 4);
  if (probes.length === 0) return null;
  const hits = foods.filter((food) =>
    food.aliases.some((alias) => spellings(alias).some((variant) => probes.some((probe) => variant.startsWith(probe)))),
  );
  const unique = [...new Map(hits.map((food) => [food.id, food])).values()];
  if (unique.length === 1) return unique[0];

  const query = foldTokens(name);
  const limits = typedLimits(name);
  let fuzzy: Food | null = null;
  let fuzzyDistance = 99;
  let fuzzyTie = false;
  for (const food of foods) {
    for (const alias of food.aliases) {
      const distance = sameShape(query, limits, foldTokens(alias));
      if (distance == null) continue;
      if (fuzzy && fuzzy.id !== food.id && distance === fuzzyDistance) fuzzyTie = true;
      if (!fuzzy || distance < fuzzyDistance) {
        fuzzy = food;
        fuzzyDistance = distance;
        fuzzyTie = false;
      }
    }
  }
  return fuzzy && !fuzzyTie ? fuzzy : null;
}

function dictionaryWords(foods: Food[]): Map<string, string> {
  const words = new Map<string, string>();
  for (const food of foods) {
    for (const alias of food.aliases) {
      for (const word of alias.split(' ')) {
        if (word.length >= 4 && !words.has(word)) words.set(word, foldWord(singularToken(word)));
      }
    }
  }
  return words;
}

function correctToken(token: string, words: Map<string, string>): string {
  if (token.length < 4 || words.has(token)) return token;
  const folded = foldWord(singularToken(token));
  const max = allowance(token.length);
  let best: string | null = null;
  let bestDistance = max + 1;
  let ambiguous = false;
  for (const [word, wordFolded] of words) {
    const distance = wordFolded === folded ? 0 : max === 0 ? max + 1 : editDistance(folded, wordFolded, max);
    if (distance > max) continue;
    if (distance < bestDistance) {
      best = word;
      bestDistance = distance;
      ambiguous = false;
    } else if (distance === bestDistance && word !== best && wordFolded !== words.get(best ?? '')) ambiguous = true;
  }
  return best && !ambiguous ? best : token;
}

export function correctQuery(name: string, foods: Food[]): string {
  const basic = nameVariants(name)[0] ?? '';
  if (!basic) return '';
  const words = dictionaryWords(foods);
  return basic.split(' ').map((token) => correctToken(token, words)).join(' ');
}

type Closeness = { matched: number; distance: number; extra: number };

function closeness(query: string[], limits: number[], alias: string[], needAll: boolean, allowPrefix: boolean): Closeness | null {
  let matched = 0;
  let distance = 0;
  for (const [index, token] of query.entries()) {
    const found = tokenDistance(token, alias, allowPrefix, limits[index]);
    if (found == null) continue;
    matched += 1;
    distance += found;
  }
  if (matched === 0 || (needAll && matched < query.length)) return null;
  return { matched, distance, extra: Math.abs(alias.length - query.length) };
}

function better(a: Closeness, b: Closeness): boolean {
  return a.matched !== b.matched ? a.matched > b.matched : a.distance !== b.distance ? a.distance < b.distance : a.extra < b.extra;
}

export function closeFoods(name: string, foods: Food[], limit = 4, mode: 'all' | 'any' = 'all'): Food[] {
  const corrected = correctQuery(name, foods);
  const limits = typedLimits(corrected);
  const query = foldTokens(corrected);
  if (!query.some((token) => token.length >= 3)) return [];
  const scored: { food: Food; score: Closeness }[] = [];
  for (const food of foods) {
    let best: Closeness | null = null;
    for (const alias of food.aliases) {
      const score = closeness(query, limits, foldTokens(alias), mode === 'all', false);
      if (score && (!best || better(score, best))) best = score;
    }
    if (best) scored.push({ food, score: best });
  }
  return scored
    .sort((a, b) => (better(a.score, b.score) ? -1 : better(b.score, a.score) ? 1 : a.food.name.localeCompare(b.food.name)))
    .slice(0, limit)
    .map((item) => item.food);
}

export function searchFoods(query: string, foods: Food[], limit = 24): Food[] {
  const raw = nameVariants(query)[0] ?? '';
  const tokens = foldTokens(query);
  const limits = typedLimits(query);
  if (!raw || tokens.length === 0) return [];
  const needle = tokens.join(' ');
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    let best = Infinity;
    for (const alias of food.aliases) {
      const folded = foldTokens(alias).join(' ');
      let score = Infinity;
      if (alias.startsWith(raw) || folded.startsWith(needle)) score = 0;
      else if (alias.includes(` ${raw}`) || folded.includes(` ${needle}`)) score = 1;
      else if (alias.includes(raw) || folded.includes(needle)) score = 2;
      else {
        const close = closeness(tokens, limits, folded.split(' '), true, true);
        if (close) score = 3 + close.distance + close.extra / 10;
      }
      best = Math.min(best, score);
    }
    if (best < Infinity) scored.push({ food, score: best });
  }
  return scored
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

export function sharedTweakOn(shared: SharedFoods | undefined, id: string): SharedTweak | null {
  const tweak = shared?.tweaks[id];
  return tweak && (tweak.kcalPer100g != null || tweak.pieceGrams != null) ? tweak : null;
}

export function allFoods(data: Pick<AppData, 'customFoods' | 'tweaks'>, shared?: SharedFoods): Food[] {
  const fix = (food: Food): Food => {
    const common = sharedTweakOn(shared, food.id);
    if (common) return { ...food, ...(common.kcalPer100g != null ? { kcalPer100g: common.kcalPer100g } : {}), ...(common.pieceGrams != null ? { pieceGrams: common.pieceGrams } : {}) };
    const own = shared?.tweaks[food.id] ? null : data.tweaks[food.id];
    return own ? { ...food, ...own } : food;
  };
  const sharedFoods = shared?.foods ?? [];
  const sharedIds = new Set(sharedFoods.map((food) => food.id));
  const own = data.customFoods.filter((food) => !sharedIds.has(food.id)).map(fix);
  return [...sharedFoods, ...own, ...BUILT_IN_FOODS.map(fix)];
}

export function kcalFor(food: Food, grams: number): number {
  return Math.max(0, Math.round((food.kcalPer100g * grams) / 100));
}

export function proteinFor(food: Food, grams: number): number | null {
  if (food.proteinPer100g == null) return null;
  return Math.max(0, (food.proteinPer100g * grams) / 100);
}
