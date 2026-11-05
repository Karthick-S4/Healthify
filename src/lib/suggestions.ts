import type { Food, LogEntry, MealIdea, MealSlot } from '../types';
import { addDays } from './dates';
import { proteinFor } from './foods';
import { formatKcal } from './format';
import { parseFoodList, type FoodHit } from './parseFood';

export type { MealSlot };

export const MEAL_SLOTS: MealSlot[] = ['morning', 'midday', 'snack', 'evening'];
export const MEAL_LABEL: Record<MealSlot, string> = { morning: 'Breakfast', midday: 'Lunch', snack: 'Snack', evening: 'Dinner' };

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
  { title: 'Pesarattu and chutney', query: '2 pesarattu, coconut chutney', slot: 'morning' },
  { title: 'Omelette and toast', query: '2 omelette, 2 bread', slot: 'morning' },
  { title: 'Egg whites and toast', query: '4 egg white, 1 bread', slot: 'morning' },
  { title: 'Oats, milk and almonds', query: 'oats 40g, 1 glass milk, almonds', slot: 'morning' },
  { title: 'Idli and an egg', query: '3 idli, sambar, 1 egg', slot: 'morning' },
  { title: 'Upma and curd', query: '1 bowl upma, curd', slot: 'morning' },
  { title: 'Rice, dal and poriyal', query: '1 bowl rice, 1 bowl dal, poriyal', slot: 'midday' },
  { title: 'Roti and chicken curry', query: '2 roti, chicken curry', slot: 'midday' },
  { title: 'Curd rice', query: '1 bowl curd rice', slot: 'midday' },
  { title: 'Lemon rice', query: '1 bowl lemon rice', slot: 'midday' },
  { title: 'Rice, sambar and eggs', query: '1 bowl rice, 1 bowl sambar, 2 egg', slot: 'midday' },
  { title: 'Rice and fish curry', query: '1 bowl rice, fish curry', slot: 'midday' },
  { title: 'Roti and paneer bhurji', query: '2 roti, paneer bhurji', slot: 'midday' },
  { title: 'Rajma rice', query: '1 bowl rice, rajma', slot: 'midday' },
  { title: 'Chole and roti', query: '2 roti, chole', slot: 'midday' },
  { title: 'Rice, dal and curd', query: '1 bowl rice, 1 bowl dal, curd', slot: 'midday' },
  { title: 'Chicken, rice and salad', query: 'chicken breast 150g, 1 bowl rice, salad', slot: 'midday' },
  { title: 'Roti and soya curry', query: '2 roti, soya chunks curry', slot: 'midday' },
  { title: 'Roti and egg curry', query: '2 roti, egg curry', slot: 'midday' },
  { title: 'Palak paneer and roti', query: '2 roti, palak paneer', slot: 'midday' },
  { title: 'Fruit', query: 'apple, papaya', slot: 'snack' },
  { title: 'Buttermilk and fruit', query: '1 glass buttermilk, orange', slot: 'snack' },
  { title: 'Tea and biscuits', query: 'tea, 2 biscuit', slot: 'snack' },
  { title: 'Sundal', query: '1 bowl sundal', slot: 'snack' },
  { title: 'Sprouts salad', query: '1 bowl sprouts', slot: 'snack' },
  { title: 'Two boiled eggs', query: '2 egg', slot: 'snack' },
  { title: 'Curd and banana', query: 'curd, banana', slot: 'snack' },
  { title: 'Peanuts and tea', query: 'peanuts, tea', slot: 'snack' },
  { title: 'Almonds', query: 'almonds', slot: 'snack' },
  { title: 'Paneer cubes', query: 'paneer 100g', slot: 'snack' },
  { title: 'A glass of milk', query: '1 glass milk', slot: 'snack' },
  { title: 'Lassi', query: '1 glass lassi', slot: 'snack' },
  { title: 'Egg whites', query: '3 egg white', slot: 'snack' },
  { title: 'Roti and dal', query: '2 roti, 1 bowl dal', slot: 'evening' },
  { title: 'Idli dinner', query: '3 idli, sambar', slot: 'evening' },
  { title: 'Chicken and salad', query: 'chicken breast 150g, salad', slot: 'evening' },
  { title: 'Rice and rasam', query: '1 bowl rice, 1 bowl rasam', slot: 'evening' },
  { title: 'Fish fry, rice and rasam', query: '1 bowl rice, 2 fish fry, rasam', slot: 'evening' },
  { title: 'Chicken curry and rice', query: '1 bowl rice, chicken curry', slot: 'evening' },
  { title: 'Roti, dal and paneer', query: '2 roti, 1 bowl dal, paneer 50g', slot: 'evening' },
  { title: 'Rice and soya curry', query: '1 bowl rice, soya chunks curry', slot: 'evening' },
  { title: 'Dosa and egg curry', query: '2 dosa, egg curry', slot: 'evening' },
  { title: 'Pesarattu dinner', query: '2 pesarattu, tomato chutney', slot: 'evening' },
  { title: 'Oats, banana and peanut butter', query: 'oats 40g, 1 glass milk, banana, 1 peanut butter', slot: 'morning' },
  { title: 'Oats porridge and nuts', query: '1 bowl oats porridge, mixed nuts 15g', slot: 'morning' },
  { title: 'Oats upma', query: '1 bowl oats upma', slot: 'morning' },
  { title: 'Oats dosa and sambar', query: '2 oats dosa, 1 bowl sambar', slot: 'morning' },
  { title: 'Solam dosa and chutney', query: '2 solam dosa, coconut chutney', slot: 'morning' },
  { title: 'Ragi dosa and sambar', query: '2 ragi dosa, 1 bowl sambar', slot: 'morning' },
  { title: 'Ragi malt and boiled egg', query: '1 glass ragi malt, 1 boiled egg', slot: 'morning' },
  { title: 'Boiled eggs and fruit', query: '2 boiled egg, apple', slot: 'morning' },
  { title: 'Tofu bhurji and chapati', query: '1 bowl tofu bhurji, 1 chapati', slot: 'morning' },
  { title: 'Rice, dal and beans poriyal', query: '1 bowl rice, 1 bowl dal, beans poriyal', slot: 'midday' },
  { title: 'Rice, sambar and ladies finger fry', query: '1 bowl rice, 1 bowl sambar, ladies finger fry', slot: 'midday' },
  { title: 'Chapati, dal and vegetables', query: '2 chapati, 1 bowl dal, vegetables', slot: 'midday' },
  { title: 'Chapati and green gram curry', query: '2 chapati, green gram curry', slot: 'midday' },
  { title: 'Carrot rice and curd', query: '1 bowl carrot rice, curd', slot: 'midday' },
  { title: 'Rice, chicken curry and cucumber', query: '1 bowl rice, chicken curry, cucumber', slot: 'midday' },
  { title: 'Chapati and tofu curry', query: '2 chapati, tofu curry', slot: 'midday' },
  { title: 'Rice, kootu and keerai', query: '1 bowl rice, kootu, keerai', slot: 'midday' },
  { title: 'Rice, kuzhambu and poriyal', query: '1 bowl rice, kuzhambu, beans poriyal', slot: 'midday' },
  { title: 'Rice, moong dal and carrot poriyal', query: '1 bowl rice, moong dal, carrot poriyal', slot: 'midday' },
  { title: 'Brown rice, dal and keerai', query: '1 bowl brown rice, 1 bowl dal, keerai', slot: 'midday' },
  { title: 'Millet rice and sambar', query: '1 bowl millet rice, 1 bowl sambar, cabbage poriyal', slot: 'midday' },
  { title: 'Rice, avial and curd', query: '1 bowl rice, avial, curd', slot: 'midday' },
  { title: 'Solam, dal and vegetables', query: '1 bowl solam, 1 bowl dal, vegetables', slot: 'midday' },
  { title: 'Quinoa, tofu and vegetables', query: '1 bowl quinoa, tofu 100g, vegetables', slot: 'midday' },
  { title: 'Rice, chicken fry and rasam', query: '1 bowl rice, chicken fry, 1 bowl rasam', slot: 'midday' },
  { title: 'Banana and peanut butter', query: 'banana, 1 peanut butter', slot: 'snack' },
  { title: 'Apple and peanut butter', query: 'apple, 1 peanut butter', slot: 'snack' },
  { title: 'Mixed nuts', query: 'mixed nuts 20g', slot: 'snack' },
  { title: 'Cucumber and carrot', query: 'cucumber, carrot', slot: 'snack' },
  { title: 'Boiled egg and cucumber', query: '2 boiled egg, cucumber', slot: 'snack' },
  { title: 'Fruit bowl', query: 'papaya, pomegranate', slot: 'snack' },
  { title: 'Guava and orange', query: 'guava, orange', slot: 'snack' },
  { title: 'Chana sundal', query: '1 bowl chana sundal', slot: 'snack' },
  { title: 'Green gram sundal', query: '1 bowl green gram sundal', slot: 'snack' },
  { title: 'Roasted chana', query: 'roasted chana', slot: 'snack' },
  { title: 'Makhana', query: 'makhana 20g', slot: 'snack' },
  { title: 'Dates and walnuts', query: '2 dates, walnuts 10g', slot: 'snack' },
  { title: 'Boiled corn', query: '1 boiled corn', slot: 'snack' },
  { title: 'Sweet potato', query: '1 sweet potato', slot: 'snack' },
  { title: 'Ragi malt', query: '1 glass ragi malt', slot: 'snack' },
  { title: 'Almonds and an apple', query: 'almonds, apple', slot: 'snack' },
  { title: 'Chapati and tofu bhurji', query: '2 chapati, tofu bhurji', slot: 'evening' },
  { title: 'Chapati, chicken and salad', query: '2 chapati, grilled chicken 100g, salad', slot: 'evening' },
  { title: 'Jowar roti and vegetables', query: '2 jowar roti, vegetables, 1 bowl dal', slot: 'evening' },
  { title: 'Chapati, dal and beans poriyal', query: '2 chapati, 1 bowl dal, beans poriyal', slot: 'evening' },
  { title: 'Ragi dosa dinner', query: '2 ragi dosa, tomato chutney', slot: 'evening' },
  { title: 'Solam dosa and sambar', query: '2 solam dosa, 1 bowl sambar', slot: 'evening' },
  { title: 'Tofu and vegetables', query: 'tofu 150g, vegetables', slot: 'evening' },
  { title: 'Green gram curry and chapati', query: '2 chapati, green gram curry, cucumber', slot: 'evening' },
  { title: 'Oats dosa and chutney', query: '2 oats dosa, coconut chutney', slot: 'evening' },
  { title: 'Boiled eggs and vegetables', query: '2 boiled egg, vegetables, 1 chapati', slot: 'evening' },
  { title: 'Chapati and ladies finger fry', query: '2 chapati, ladies finger fry, 1 bowl dal', slot: 'evening' },
];

export type SuggestionKind = 'yours' | 'protein' | 'fit' | 'fill' | 'usual' | 'more' | 'light';

export type Suggestion = {
  title: string;
  detail: string;
  query: string;
  kcal: number;
  protein: number | null;
  kind: SuggestionKind;
  customId?: string;
};

export function ideaKey(title: string): string {
  return title.trim().toLocaleLowerCase();
}

export function previewIdea(query: string, foods: Food[]): { kcal: number; detail: string; unknown: string[] } | null {
  const parsed = parseFoodList(query, foods);
  if (parsed.items.length === 0) return null;
  const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
  const unknown = parsed.items.flatMap((item) => (item.kind === 'food' ? [] : 'name' in item ? [item.name] : item.kind === 'need-grams' ? [item.food.name] : []));
  const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
  return { kcal, detail: `${hits.map((hit) => hit.title).join(', ')} · ${formatKcal(kcal)} kcal`, unknown };
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  yours: 'Your ideas',
  protein: 'More protein',
  fit: 'Fits what’s left',
  fill: 'Fills the day',
  usual: 'From the log',
  more: 'More to pick from',
  light: 'If you’re still hungry',
};

const SLOT_AIM: Record<MealSlot, number> = {
  morning: 400,
  midday: 550,
  snack: 200,
  evening: 500,
};

const PROTEIN_RICH = 12;

function dailyOrder(day: string, title: string): number {
  let hash = 2166136261;
  for (const char of `${day}|${title}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

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

function proteinOf(hits: FoodHit[]): number | null {
  let total = 0;
  for (const hit of hits) {
    const grams = proteinFor(hit.food, hit.grams);
    if (grams == null) return null;
    total += grams;
  }
  return Math.round(total);
}

function suggestionFrom(title: string, query: string, hits: FoodHit[], kind: SuggestionKind): Suggestion {
  const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
  const protein = proteinOf(hits);
  const proteinText = protein != null && protein > 0 ? ` · ${protein} g protein` : '';
  return {
    title,
    query,
    kcal,
    protein,
    kind,
    detail: `${hits.map((hit) => hit.title).join(', ')} · ${formatKcal(kcal)} kcal${proteinText}`,
  };
}

function usualSuggestions(foods: Food[], logs: LogEntry[], today: string, aim: number, maxKcal: number): Suggestion[] {
  const since = addDays(today, -21);
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (!log.foodId || log.date < since || log.date > today) continue;
    counts.set(log.foodId, (counts.get(log.foodId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
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
    ideas.push(suggestionFrom(hits[0]?.title ?? food.name, query, hits, 'usual'));
    if (ideas.length === 3) break;
  }
  return ideas;
}

type Candidate = Suggestion & { slot: MealSlot };

export function suggestMeals(args: {
  foods: Food[];
  logs: LogEntry[];
  today: string;
  room: number;
  hour: number;
  light: boolean;
  custom?: MealIdea[];
  hidden?: ReadonlySet<string>;
}): Suggestion[] {
  const maxKcal = args.light ? 150 : Math.max(0, Math.floor(args.room));
  if (!args.light && maxKcal < 40) return [];
  const slot = slotForHour(args.hour);
  const aim = args.light ? 100 : Math.min(maxKcal * 0.85, SLOT_AIM[slot]);
  const minKcal = args.light ? 0 : Math.min(80, maxKcal);
  const hidden = args.hidden ?? new Set<string>();

  const toCandidate = (title: string, query: string, ideaSlot: MealSlot, customId?: string): Candidate[] => {
    if (hidden.has(ideaKey(title))) return [];
    const hits = hitsOf(query, args.foods);
    if (!hits) return [];
    const idea = suggestionFrom(title, query, hits, 'fit');
    if (idea.kcal > maxKcal || (!customId && idea.kcal < minKcal)) return [];
    return [{ ...idea, slot: ideaSlot, ...(customId ? { customId } : {}) }];
  };
  const own = (args.custom ?? []).flatMap((idea) => toCandidate(idea.title, idea.query, idea.slot, idea.id));
  const ownTitles = new Set(own.map((idea) => ideaKey(idea.title)));
  const candidates: Candidate[] = MEAL_TEMPLATES.flatMap((template) =>
    ownTitles.has(ideaKey(template.title)) ? [] : toCandidate(template.title, template.query, template.slot),
  );

  const taken = new Set<string>();
  const take = (list: Candidate[], kind: SuggestionKind, count: number): Suggestion[] => {
    const out: Suggestion[] = [];
    for (const { slot: _slot, ...idea } of list) {
      if (out.length === count) break;
      if (taken.has(idea.query)) continue;
      taken.add(idea.query);
      out.push({ ...idea, kind });
    }
    return out;
  };
  const inSlot = (idea: Candidate) => (idea.slot === slot ? 0 : 1);
  const density = (idea: Candidate) => Math.round(((idea.protein ?? 0) / Math.max(idea.kcal, 1)) * 40);
  const shuffle = (idea: Candidate) => dailyOrder(args.today, idea.title);
  const closeness = (idea: Candidate, target: number) => Math.round(Math.abs(idea.kcal - target) / 75);

  const yours = take(
    [...own].sort((a, b) => inSlot(a) - inSlot(b) || shuffle(a) - shuffle(b)),
    'yours',
    args.light ? 3 : 6,
  );

  if (args.light) {
    const light = [...candidates].sort((a, b) => Math.round((b.protein ?? 0) / 3) - Math.round((a.protein ?? 0) / 3) || shuffle(a) - shuffle(b));
    return [...yours, ...take(light, 'light', 8)];
  }

  const protein = take(
    candidates
      .filter((idea) => (idea.protein ?? 0) >= PROTEIN_RICH)
      .sort((a, b) => inSlot(a) - inSlot(b) || density(b) - density(a) || shuffle(a) - shuffle(b)),
    'protein',
    4,
  );

  const fit = take(
    [...candidates].sort((a, b) => inSlot(a) - inSlot(b) || closeness(a, aim) - closeness(b, aim) || shuffle(a) - shuffle(b)),
    'fit',
    4,
  );

  const fillAim = maxKcal * 0.9;
  const fill =
    maxKcal >= 350
      ? take(
          [...candidates].sort((a, b) => closeness(a, fillAim) - closeness(b, fillAim) || shuffle(a) - shuffle(b)),
          'fill',
          2,
        )
      : [];

  const usual = usualSuggestions(args.foods, args.logs, args.today, aim, maxKcal).filter((idea) => {
    if (taken.has(idea.query) || hidden.has(ideaKey(idea.title))) return false;
    taken.add(idea.query);
    return true;
  });

  const more = take(
    candidates.filter((idea) => idea.slot === slot).sort((a, b) => shuffle(a) - shuffle(b)),
    'more',
    12,
  );

  return [...yours, ...protein, ...fit, ...fill, ...usual, ...more];
}

export function mixedIdeas(ideas: Suggestion[], count: number): Suggestion[] {
  const groups = new Map<SuggestionKind, Suggestion[]>();
  for (const idea of ideas) groups.set(idea.kind, [...(groups.get(idea.kind) ?? []), idea]);
  const queues = [...groups.values()];
  const out: Suggestion[] = [];
  while (out.length < count && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && out.length < count) out.push(next);
    }
  }
  return out;
}

export function proteinEaten(logs: LogEntry[], foods: Food[]): number | null {
  let total = 0;
  let known = false;
  for (const log of logs) {
    const food = log.foodId ? foods.find((item) => item.id === log.foodId) : undefined;
    const grams = food ? proteinFor(food, log.grams) : null;
    if (grams == null) continue;
    total += grams;
    known = true;
  }
  return known ? Math.round(total) : null;
}
