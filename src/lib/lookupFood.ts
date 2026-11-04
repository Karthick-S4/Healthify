import type { Food } from '../types';
import { correctQuery, estimateFromFoods } from './foods';
import { caloriesFromIndian } from './indianFoods';

export type FoodLookup = {
  name: string;
  kcalPer100g: number;
  servingGrams?: number | null;
  source: string;
  detail: string;
};

const CACHE_KEY = 'healthify.lookup.v1';

type Nutrient = { nutrientId?: number; nutrientName?: string; unitName?: string; value?: number };
type UsdaFood = {
  description?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Nutrient[];
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && token !== 'with' && token !== 'and');
}

function scoreName(query: string, description: string): number {
  const wanted = tokens(query);
  const found = tokens(description);
  if (wanted.length === 0 || found.length === 0) return 0;
  const hits = wanted.filter((token) => found.includes(token)).length;
  if (hits === 0) return 0;
  return (hits / wanted.length) * 0.7 + (hits / found.length) * 0.3;
}

function per100(food: UsdaFood): number | null {
  const nutrient = food.foodNutrients?.find((item) => item.nutrientId === 1008 || /^energy$/i.test(item.nutrientName ?? ''));
  if (!nutrient || typeof nutrient.value !== 'number' || nutrient.value < 0) return null;
  const branded = /branded/i.test(food.dataType ?? '');
  if (!branded) return nutrient.value <= 900 ? nutrient.value : null;
  const serving = food.servingSize;
  const unit = (food.servingSizeUnit ?? '').toLowerCase();
  if (!serving || serving <= 0 || (unit !== 'g' && unit !== 'ml')) return null;
  const kcal = (nutrient.value / serving) * 100;
  return kcal <= 900 ? kcal : null;
}

export function caloriesFromUsda(payload: unknown, query: string): FoodLookup | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { foods?: unknown }).foods)) return null;
  const ranked = ((payload as { foods: unknown[] }).foods)
    .map((item) => {
      const food = item as UsdaFood;
      const kcal = per100(food);
      const name = typeof food.description === 'string' ? food.description.trim() : '';
      if (!name || kcal == null) return null;
      const score = scoreName(query, name) - (/branded/i.test(food.dataType ?? '') ? 0.12 : 0);
      return { name, kcal, score };
    })
    .filter((item): item is { name: string; kcal: number; score: number } => item !== null && item.score >= 0.62)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  const cluster = ranked.filter((item) => best.score - item.score <= 0.02);
  if (cluster.length === 1) {
    return {
      name: best.name,
      kcalPer100g: Math.round(best.kcal),
      source: 'USDA FoodData Central',
      detail: `USDA listing “${best.name}”`,
    };
  }
  const kcals = cluster.map((item) => item.kcal).sort((a, b) => a - b);
  const mid = kcals.length % 2 === 1 ? kcals[(kcals.length - 1) / 2] : (kcals[kcals.length / 2 - 1] + kcals[kcals.length / 2]) / 2;
  return {
    name: query,
    kcalPer100g: Math.round(mid),
    source: 'USDA FoodData Central',
    detail: 'several USDA listings for this name',
  };
}

function readCache(query: string): FoodLookup | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, Partial<FoodLookup>>;
    const hit = saved[query];
    if (!hit || typeof hit.name !== 'string' || typeof hit.kcalPer100g !== 'number' || typeof hit.detail !== 'string') return null;
    return {
      name: hit.name,
      kcalPer100g: hit.kcalPer100g,
      source: typeof hit.source === 'string' ? hit.source : 'USDA FoodData Central',
      detail: hit.detail,
    };
  } catch {
    return null;
  }
}

function writeCache(query: string, hit: FoodLookup) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, FoodLookup>) : {};
    saved[query] = hit;
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
  } catch {
    // A missed cache only means the next lookup searches again.
  }
}

async function fetchUsda(query: string, parent?: AbortSignal): Promise<FoodLookup | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  parent?.addEventListener('abort', onAbort);
  try {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '8');
    url.searchParams.set('api_key', 'DEMO_KEY');
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return caloriesFromUsda(await response.json(), query);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onAbort);
  }
}

export async function lookupCalories(name: string, foods: Food[], signal?: AbortSignal): Promise<FoodLookup | null> {
  const corrected = correctQuery(name, foods) || name.trim().toLowerCase();
  if (!corrected) return null;
  const indian = caloriesFromIndian(corrected);
  if (indian) return indian;
  const cached = readCache(corrected);
  if (cached) return cached;
  const remote = await fetchUsda(corrected, signal);
  if (signal?.aborted) return null;
  if (remote) {
    writeCache(corrected, remote);
    return remote;
  }
  const local = estimateFromFoods(name, foods);
  if (!local) return null;
  return {
    name: local.name,
    kcalPer100g: local.kcalPer100g,
    source: 'similar foods in Healthify',
    detail: 'similar foods already saved in Healthify',
  };
}
