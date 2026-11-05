import type { Food } from '../types';
import { formatCount } from './format';
import { kcalFor, matchFood } from './foods';

const OUTSIDE_PATTERN =
  /\b(ate out|dine out|dined out|eating out|outside food|outside|restaurant|swiggy|zomato|takeaway|takeout|delivery|hotel food|ordered)\b/gi;

type Household = 'bowl' | 'cup' | 'glass' | 'plate' | 'tbsp' | 'tsp';

export type Measure = 'g' | 'ml';

type Quantity =
  | { mode: 'piece'; name: string; count: number }
  | { mode: 'grams'; name: string; grams: number; unit: Measure }
  | { mode: 'each-grams'; name: string; count: number; gramsEach: number; unit: Measure }
  | { mode: 'household'; name: string; unit: Household; count: number }
  | { mode: 'grams-missing'; name: string; unit: Measure };

export type FoodHit = {
  kind: 'food';
  food: Food;
  grams: number;
  kcal: number;
  title: string;
};

export type ParsedItem =
  | FoodHit
  | { kind: 'unknown'; name: string; count: number; grams: number | null; unit: Measure | null }
  | { kind: 'need-grams'; food: Food; unit: Measure }
  | { kind: 'invalid'; message: string };

const HOUSEHOLD = String.raw`tablespoons?|teaspoons?|cups?|bowls?|katoris?|glasses|glass|plates?|tbsp|tsp`;
const WEIGHT = String.raw`kilograms?|kgs?|kg|grams?|gms?|millilitres?|milliliters?|mls?|ml|g`;

function cleanup(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(\d)\s*[x×]\s+/gi, '$1 ')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonUnit(unit: string): Household {
  const value = unit.toLowerCase();
  if (value.startsWith('cup')) return 'cup';
  if (value.startsWith('bowl') || value.startsWith('katori')) return 'bowl';
  if (value.startsWith('glass')) return 'glass';
  if (value.startsWith('plate')) return 'plate';
  if (value.startsWith('tbsp') || value.startsWith('tablespoon')) return 'tbsp';
  return 'tsp';
}

function measureOf(unit: string): Measure {
  const value = unit.toLowerCase();
  return value === 'ml' || value === 'mls' || value.startsWith('milli') ? 'ml' : 'g';
}

function weightGrams(amount: number, unit: string): number {
  const value = unit.toLowerCase();
  return value === 'kg' || value === 'kgs' || value.startsWith('kilogram') ? amount * 1000 : amount;
}

function amountLabel(grams: number, unit: Measure): string {
  return `${Math.round(grams)} ${unit}`;
}

function extractQuantity(text: string): Quantity | null {
  const source = cleanup(text);
  if (!source) return null;

  let match = source.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT})$`, 'i'));
  if (match) {
    return { mode: 'each-grams', count: Number(match[1]), name: match[2], gramsEach: Number(match[3]), unit: measureOf(match[4]) };
  }

  match = source.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT})\\s+(.+)$`, 'i'));
  if (match) {
    return { mode: 'grams', grams: weightGrams(Number(match[1]), match[2]), unit: measureOf(match[2]), name: match[3] };
  }

  match = source.match(new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT})$`, 'i'));
  if (match) {
    return { mode: 'grams', name: match[1], grams: weightGrams(Number(match[2]), match[3]), unit: measureOf(match[3]) };
  }

  match = source.match(new RegExp(`^(.+?)\\s+(${WEIGHT})$`, 'i'));
  if (match) return { mode: 'grams-missing', name: match[1], unit: measureOf(match[2]) };

  match = source.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${HOUSEHOLD})\\s+(?:of\\s+)?(.+)$`, 'i'));
  if (match) {
    return { mode: 'household', count: Number(match[1]), unit: canonUnit(match[2]), name: match[3] };
  }

  match = source.match(/^(?:a|an)\s+(cup|bowl|katori|glass|plate|tbsp|tsp|tablespoon|teaspoon)\s+(?:of\s+)?(.+)$/i);
  if (match) return { mode: 'household', count: 1, unit: canonUnit(match[1]), name: match[2] };

  match = source.match(/^half\s+(?:a\s+|an\s+)?(cup|bowl|katori|glass|plate)\s+(?:of\s+)?(.+)$/i);
  if (match) return { mode: 'household', count: 0.5, unit: canonUnit(match[1]), name: match[2] };

  match = source.match(/^half\s+(?:an?\s+)?(.+)$/i);
  if (match) return { mode: 'piece', count: 0.5, name: match[1] };

  match = source.match(/^(?:a|an)\s+(.+)$/i);
  if (match) return { mode: 'piece', count: 1, name: match[1] };

  match = source.match(/^(\d+(?:\.\d+)?)\s*(?:pcs|pc|pieces|piece)\s+(?:of\s+)?(.+)$/i);
  if (match) return { mode: 'piece', count: Number(match[1]), name: match[2] };

  match = source.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (match) return { mode: 'piece', count: Number(match[1]), name: match[2] };

  match = source.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/i);
  if (match) {
    const amount = Number(match[2]);
    if (amount >= 20) return { mode: 'grams', name: match[1], grams: amount, unit: 'g' };
    return { mode: 'piece', count: amount, name: match[1] };
  }

  return { mode: 'piece', count: 1, name: source };
}

function householdGrams(food: Food, unit: Household, count: number): number {
  if (unit === 'tbsp') return (food.pieceLabel === 'tbsp' ? food.pieceGrams : 15) * count;
  if (unit === 'tsp') return (food.pieceLabel === 'tsp' ? food.pieceGrams : 5) * count;
  if (unit === 'bowl') return (food.bowlGrams ?? food.pieceGrams) * count;
  if (unit === 'cup' || unit === 'glass') return (food.cupGrams ?? food.pieceGrams) * count;
  return (food.plateGrams ?? food.pieceGrams) * count;
}

function unitWord(unit: Household, count: number): string {
  if (count === 1) return unit;
  return unit === 'glass' ? 'glasses' : `${unit}s`;
}

function titleFor(food: Food, quantity: Exclude<Quantity, { mode: 'grams-missing' }>, grams: number): string {
  if (quantity.mode === 'piece') return `${formatCount(quantity.count)} ${food.name}`;
  if (quantity.mode === 'each-grams') return `${formatCount(quantity.count)} ${food.name}, ${amountLabel(grams, quantity.unit)}`;
  if (quantity.mode === 'grams') return `${food.name}, ${amountLabel(grams, quantity.unit)}`;
  return `${food.name}, ${formatCount(quantity.count)} ${unitWord(quantity.unit, quantity.count)}`;
}

function assumedGrams(quantity: Quantity): number | null {
  if (quantity.mode === 'grams') return quantity.grams;
  if (quantity.mode === 'each-grams') return quantity.gramsEach * quantity.count;
  if (quantity.mode === 'household') {
    const one =
      quantity.unit === 'tbsp' ? 15 : quantity.unit === 'tsp' ? 5 : quantity.unit === 'bowl' ? 250 : quantity.unit === 'plate' ? 300 : 200;
    return one * quantity.count;
  }
  return null;
}

function invalidAmount(count: number, grams: number): string | null {
  if (!Number.isFinite(count) || !Number.isFinite(grams) || count <= 0 || grams <= 0) {
    return 'Use a quantity bigger than zero.';
  }
  if (count > 20) return 'That count looks too high. Try again with the grams instead.';
  if (grams > 3000) return 'That weight looks too high for one entry.';
  return null;
}

const KCAL_PATTERN = /\s*[=@-]?\s*(\d+(?:\.\d+)?)\s*(?:kcal|cals?|calories)\s*$/i;

export function parseOne(raw: string, foods: Food[]): ParsedItem | null {
  const typed = raw.match(KCAL_PATTERN);
  const kcalOverride = typed && Number(typed[1]) <= 4000 ? Math.round(Number(typed[1])) : null;
  const quantity = extractQuantity(typed ? raw.slice(0, typed.index) : raw);
  if (!quantity) return null;
  const count = quantity.mode === 'grams' || quantity.mode === 'grams-missing' ? 1 : quantity.count;
  const food = matchFood(quantity.name, foods);

  if (!food) {
    return {
      kind: 'unknown',
      name: quantity.name,
      count,
      grams: assumedGrams(quantity),
      unit: quantity.mode === 'grams' || quantity.mode === 'each-grams' ? quantity.unit : null,
    };
  }

  if (quantity.mode === 'grams-missing') return { kind: 'need-grams', food, unit: quantity.unit };

  const grams =
    quantity.mode === 'piece'
      ? food.pieceGrams * quantity.count
      : quantity.mode === 'grams'
        ? quantity.grams
        : quantity.mode === 'each-grams'
          ? quantity.gramsEach * quantity.count
          : householdGrams(food, quantity.unit, quantity.count);

  const problem = invalidAmount(count, grams);
  if (problem) return { kind: 'invalid', message: problem };

  return {
    kind: 'food',
    food,
    grams,
    kcal: kcalOverride ?? kcalFor(food, grams),
    title: titleFor(food, quantity, grams),
  };
}

function splitConjunction(part: string, foods: Food[]): string[] {
  const bits = part
    .split(/\s+\band\b\s+|\s+\bwith\b\s+/i)
    .map((bit) => bit.trim())
    .filter(Boolean);
  if (bits.length <= 1) return [part];
  const quantity = extractQuantity(part);
  if (quantity && matchFood(quantity.name, foods)) return [part];
  return bits;
}

export function parseFoodList(input: string, foods: Food[]): { outside: boolean; items: ParsedItem[] } {
  let outside = false;
  const withoutPlace = input.replace(OUTSIDE_PATTERN, () => {
    outside = true;
    return ' ';
  });
  const parts = withoutPlace
    .split(/[,;\n+]|\s+&\s+/g)
    .flatMap((part) => splitConjunction(part.trim(), foods))
    .map((part) => part.trim())
    .filter(Boolean);

  const items = parts
    .map((part) => parseOne(part, foods))
    .filter((item): item is ParsedItem => item !== null);
  return { outside, items };
}
