import type { Food, LogEntry } from '../types';
import { addDays } from './dates';
import { formatKcal } from './format';
import { parseFoodList, type FoodHit } from './parseFood';

export type MealSlot = 'morning' | 'midday' | 'snack' | 'evening';

export type MealTemplate = {
  title: string;
  query: string;
  slot: MealSlot;
};

export const MEAL_TEMPLATES: MealTemplate[] = [
  { title: 'Idli and sambar', query: '3 idli, sambar, coconut chutney', slot: 'morning' },
  { title: 'Poha', query: '1 bowl poha', slot: 'morning' },
  { title: 'Eggs and a banana', query: '2 egg, banana', slot: 'morning' },
  { title: 'Oats and milk', query: 'oats 40g, 1 glass milk', slot: 'morning' },
  { title: 'Dosa and chutney', query: '2 dosa, coconut chutney', slot: 'morning' },
  { title: 'Rice, dal and poriyal', query: '1 bowl rice, 1 bowl dal, poriyal', slot: 'midday' },
  { title: 'Roti and chicken curry', query: '2 roti, chicken curry', slot: 'midday' },
  { title: 'Curd rice', query: '1 bowl curd rice', slot: 'midday' },
  { title: 'Lemon rice', query: '1 bowl lemon rice', slot: 'midday' },
  { title: 'Fruit', query: 'apple, papaya', slot: 'snack' },
  { title: 'Buttermilk and fruit', query: '1 glass buttermilk, orange', slot: 'snack' },
  { title: 'Tea and biscuits', query: 'tea, 2 biscuit', slot: 'snack' },
  { title: 'Roti and dal', query: '2 roti, 1 bowl dal', slot: 'evening' },
  { title: 'Idli dinner', query: '3 idli, sambar', slot: 'evening' },
  { title: 'Chicken and salad', query: 'chicken breast 150g, salad', slot: 'evening' },
  { title: 'Rice and rasam', query: '1 bowl rice, 1 bowl rasam', slot: 'evening' },
];

export type Suggestion = {
  title: string;
  detail: string;
  query: string;
  kcal: number;
  fromLog: boolean;
};

const SLOT_AIM: Record<MealSlot, number> = {
  morning: 400,
  midday: 550,
  snack: 200,
  evening: 500,
};

export function slotForHour(hour: number): MealSlot {
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 18) return 'snack';
  return 'evening';
}

function hitsOf(query: string, foods: Food[]): FoodHit[] | null {
  const parsed = parseFoodList(query, foods);
  const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
  if (hits.length === 0 || hits.length !== parsed.items.length) return null;
  return hits;
}

function suggestionFrom(title: string, query: string, hits: FoodHit[], fromLog: boolean): Suggestion {
  const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
  return {
    title,
    query,
    kcal,
    fromLog,
    detail: `${hits.map((hit) => hit.title).join(', ')} · ${formatKcal(kcal)} kcal`,
  };
}

function usualSuggestions(foods: Food[], logs: LogEntry[], today: string, aim: number, maxKcal: number): Suggestion[] {
  const since = addDays(today, -21);
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (!log.foodId || log.date < since || log.date > today) continue;
    counts.set(log.foodId, (counts.get(log.foodId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const ideas: Suggestion[] = [];
  for (const [foodId] of ranked) {
    const food = foods.find((item) => item.id === foodId);
    if (!food || (counts.get(foodId) ?? 0) < 2) continue;
    const piece = Math.max(1, Math.round((food.kcalPer100g * food.pieceGrams) / 100));
    let query = '';
    if (piece <= maxKcal) {
      const maxPieces = piece >= 80 ? 2 : 4;
      const count = Math.max(1, Math.min(maxPieces, Math.round(aim / piece) || 1));
      query = `${count} ${food.aliases[0]}`;
    } else {
      const grams = Math.floor((maxKcal * 100) / food.kcalPer100g / 10) * 10;
      if (grams >= 30) query = `${food.aliases[0]} ${grams}g`;
    }
    if (!query) continue;
    const hits = hitsOf(query, foods);
    if (!hits) continue;
    const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
    if (kcal <= 0 || kcal > maxKcal) continue;
    ideas.push(suggestionFrom(hits[0]?.title ?? food.name, query, hits, true));
    if (ideas.length === 2) break;
  }
  return ideas;
}

export function suggestMeals(args: {
  foods: Food[];
  logs: LogEntry[];
  today: string;
  room: number;
  hour: number;
  light: boolean;
}): Suggestion[] {
  const maxKcal = args.light ? 150 : Math.max(0, Math.floor(args.room));
  if (!args.light && maxKcal < 40) return [];
  const slot = slotForHour(args.hour);
  const aim = args.light ? 100 : Math.min(maxKcal * 0.85, SLOT_AIM[slot]);
  const minKcal = args.light ? 0 : Math.min(80, maxKcal);

  const templates = MEAL_TEMPLATES.flatMap((template) => {
    const hits = hitsOf(template.query, args.foods);
    if (!hits) return [];
    const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
    if (kcal < minKcal || kcal > maxKcal) return [];
    return [{ ...suggestionFrom(template.title, template.query, hits, false), slot: template.slot, kcal }];
  });

  const preferred = templates.filter((template) => template.slot === slot);
  const chosen = (preferred.length >= 2 ? preferred : templates)
    .sort((a, b) => Math.abs(a.kcal - aim) - Math.abs(b.kcal - aim))
    .slice(0, 3);

  const usual = args.light ? [] : usualSuggestions(args.foods, args.logs, args.today, aim, maxKcal);
  const seen = new Set<string>();
  const merged: Suggestion[] = [];
  for (const idea of [...chosen, ...usual]) {
    const key = idea.query;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(idea);
  }
  return merged.slice(0, 5);
}
