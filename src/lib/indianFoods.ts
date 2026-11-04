import { INDIAN_RECIPES } from '../data/indianRecipes';

export type IndianHit = {
  name: string;
  kcalPer100g: number;
  servingGrams: number | null;
  source: string;
  detail: string;
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/biriyani|briyani/g, 'biryani')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && token !== 'with' && token !== 'and');
}

function scoreName(query: string, description: string): number {
  const wanted = tokens(query);
  const found = tokens(description);
  if (wanted.length === 0 || found.length === 0) return 0;
  const hits = wanted.filter((token) => found.includes(token)).length;
  if (hits < wanted.length) return 0;
  return (hits / wanted.length) * 0.7 + (hits / found.length) * 0.3;
}

function agreedServing(grams: number[]): number | null {
  if (grams.length === 0) return null;
  const sorted = [...grams].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return grams.every((gram) => Math.abs(gram - mid) / mid <= 0.25) ? mid : null;
}

export function caloriesFromIndian(query: string): IndianHit | null {
  const wanted = tokens(query).join(' ');
  if (!wanted) return null;
  const ranked: { name: string; kcal: number; serving: number | null; score: number }[] = [];
  for (const [name, aliasText, kcal, serving] of INDIAN_RECIPES) {
    let best = 0;
    for (const alias of aliasText.split('|')) {
      let score = scoreName(wanted, alias);
      if (tokens(alias).join(' ') === wanted) score = Math.max(score, 1.05);
      if (/\bpowder\b/.test(alias) && !wanted.includes('powder')) score -= 0.25;
      if (/\bmasala$/.test(alias.trim()) && !/\bmasala\b/.test(wanted)) score -= 0.25;
      if (score > best) best = score;
    }
    if (best >= 0.62) ranked.push({ name, kcal, serving: serving > 0 ? serving : null, score: best });
  }
  ranked.sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  const cluster = ranked.filter((item) => best.score - item.score <= 0.02);
  const serving = agreedServing(cluster.flatMap((item) => (item.serving == null ? [] : [item.serving])));
  if (cluster.length === 1) {
    return {
      name: best.name,
      kcalPer100g: best.kcal,
      servingGrams: best.serving,
      source: 'Indian Nutrient Databank',
      detail: `the Indian Nutrient Databank recipe “${best.name}”`,
    };
  }
  const kcals = cluster.map((item) => item.kcal).sort((a, b) => a - b);
  const mid = kcals.length % 2 === 1 ? kcals[(kcals.length - 1) / 2] : (kcals[kcals.length / 2 - 1] + kcals[kcals.length / 2]) / 2;
  return {
    name: query,
    kcalPer100g: Math.round(mid),
    servingGrams: serving,
    source: 'Indian Nutrient Databank',
    detail: 'several Indian Nutrient Databank recipes for this name',
  };
}
