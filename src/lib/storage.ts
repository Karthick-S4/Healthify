import { eachDate, todayISO } from './dates';
import type {
  ActivityEntry,
  AppData,
  CheatDay,
  CustomRange,
  Food,
  FoodTweak,
  HiddenIdea,
  LogEntry,
  MealIdea,
  MealSlot,
  MeasureEntry,
  Profile,
  ProfileBook,
  ProfileRecord,
  TargetPlan,
  WeightEntry,
} from '../types';

export const STORAGE_KEY = 'healthify.v1';
export const BOOK_KEY = 'healthify.shared.v1';
export const SESSION_KEY = 'healthify.profile';
export const DAILY_MIN = 1000;
export const DAILY_MAX = 5000;

export function freshData(): AppData {
  return {
    version: 1,
    pinHash: null,
    profile: { dailyTarget: 1800, goalSet: false, weekBudget: null, monthBudget: null, plans: [], ranges: [] },
    customFoods: [],
    tweaks: {},
    dayTargets: {},
    logs: [],
    weights: [],
    measures: [],
    activities: [],
    cheatDays: [],
    customIdeas: [],
    hiddenIdeas: [],
    removedLogIds: [],
    removedFoodIds: [],
    removedTweakIds: [],
    hintDismissed: false,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function entryBase(value: unknown): { id: string; date: string; createdAt: string; raw: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.date !== 'string' || !ISO_DATE.test(raw.date)) return null;
  return { id: raw.id, date: raw.date, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(), raw };
}

function asCheatDay(value: unknown): CheatDay | null {
  const base = entryBase(value);
  return base ? { id: base.id, date: base.date, createdAt: base.createdAt } : null;
}

const SLOTS: MealSlot[] = ['morning', 'midday', 'snack', 'evening'];

function asMealIdea(value: unknown): MealIdea | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.query !== 'string') return null;
  const title = raw.title.trim().slice(0, 60);
  const query = raw.query.trim().slice(0, 200);
  if (!title || !query) return null;
  const slot = SLOTS.includes(raw.slot as MealSlot) ? (raw.slot as MealSlot) : 'midday';
  return { id: raw.id, title, query, slot, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString() };
}

function asHiddenIdea(value: unknown): HiddenIdea | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.key !== 'string' || !raw.key.trim()) return null;
  return { id: raw.id, key: raw.key.trim().toLocaleLowerCase(), createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString() };
}

function asWeight(value: unknown): WeightEntry | null {
  const base = entryBase(value);
  if (!base || typeof base.raw.kg !== 'number' || !Number.isFinite(base.raw.kg) || base.raw.kg <= 0) return null;
  return { id: base.id, date: base.date, kg: base.raw.kg, createdAt: base.createdAt };
}

function asMeasure(value: unknown): MeasureEntry | null {
  const base = entryBase(value);
  if (!base || typeof base.raw.part !== 'string' || !base.raw.part.trim()) return null;
  if (typeof base.raw.cm !== 'number' || !Number.isFinite(base.raw.cm) || base.raw.cm <= 0) return null;
  return { id: base.id, date: base.date, part: base.raw.part.trim().slice(0, 32), cm: base.raw.cm, createdAt: base.createdAt };
}

function asActivity(value: unknown): ActivityEntry | null {
  const base = entryBase(value);
  if (!base || typeof base.raw.name !== 'string' || !base.raw.name.trim()) return null;
  if (typeof base.raw.minutes !== 'number' || !Number.isFinite(base.raw.minutes) || base.raw.minutes <= 0) return null;
  return { id: base.id, date: base.date, name: base.raw.name.trim().slice(0, 40), minutes: Math.round(base.raw.minutes), createdAt: base.createdAt };
}

function listOf<T>(value: unknown, read: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(read).filter((item): item is T => item !== null) : [];
}

function clampDaily(value: number): number {
  if (!Number.isFinite(value)) return 1800;
  return Math.min(DAILY_MAX, Math.max(DAILY_MIN, Math.round(value)));
}

function asFood(value: unknown): Food | null {
  if (!value || typeof value !== 'object') return null;
  const food = value as Partial<Food>;
  if (typeof food.id !== 'string' || typeof food.name !== 'string') return null;
  if (typeof food.kcalPer100g !== 'number' || typeof food.pieceGrams !== 'number') return null;
  return {
    id: food.id,
    name: food.name,
    group: 'Yours',
    aliases: Array.isArray(food.aliases) ? food.aliases.map(String) : [food.name.toLowerCase()],
    kcalPer100g: food.kcalPer100g,
    pieceGrams: food.pieceGrams,
    pieceLabel: typeof food.pieceLabel === 'string' ? food.pieceLabel : 'serving',
    source: 'custom',
  };
}

function asLog(value: unknown): LogEntry | null {
  if (!value || typeof value !== 'object') return null;
  const log = value as Partial<LogEntry>;
  if (typeof log.id !== 'string' || typeof log.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) return null;
  if (typeof log.title !== 'string' || typeof log.kcal !== 'number' || typeof log.grams !== 'number') return null;
  return {
    id: log.id,
    date: log.date,
    title: log.title,
    grams: log.grams,
    kcal: Math.round(log.kcal),
    outside: Boolean(log.outside),
    foodId: typeof log.foodId === 'string' ? log.foodId : undefined,
    createdAt: typeof log.createdAt === 'string' ? log.createdAt : new Date().toISOString(),
  };
}

function asIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))];
}

export const FIRST_DAY = '0000-01-01';

const optionalKcal = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null);

function asPlan(value: unknown): TargetPlan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as Partial<TargetPlan>;
  if (typeof plan.from !== 'string' || !ISO_DATE.test(plan.from) || typeof plan.daily !== 'number') return null;
  return { from: plan.from, daily: clampDaily(plan.daily), week: optionalKcal(plan.week), month: optionalKcal(plan.month) };
}

function asRange(value: unknown): CustomRange | null {
  if (!value || typeof value !== 'object') return null;
  const range = value as Partial<CustomRange>;
  if (typeof range.id !== 'string' || typeof range.start !== 'string' || typeof range.end !== 'string') return null;
  if (!ISO_DATE.test(range.start) || !ISO_DATE.test(range.end) || range.end < range.start) return null;
  const daily = optionalKcal(range.daily);
  const week = optionalKcal(range.week);
  if (daily == null && week == null) return null;
  return { id: range.id, start: range.start, end: range.end, daily: daily == null ? null : clampDaily(daily), week };
}

function plansFromHistory(dayTargets: Record<string, number>, daily: number, week: number | null, month: number | null): TargetPlan[] {
  const days = Object.keys(dayTargets).sort();
  if (days.length === 0) return [{ from: FIRST_DAY, daily, week, month }];
  const plans: TargetPlan[] = [{ from: FIRST_DAY, daily: dayTargets[days[0]], week, month }];
  for (const iso of days) {
    if (dayTargets[iso] !== plans[plans.length - 1].daily) plans.push({ from: iso, daily: dayTargets[iso], week, month });
  }
  const today = todayISO();
  const last = plans[plans.length - 1];
  if (last.daily !== daily) {
    if (last.from >= today) last.daily = daily;
    else plans.push({ from: today, daily, week, month });
  }
  return plans;
}

function asProfile(value: unknown, dayTargets: Record<string, number>): Profile {
  const fallback = freshData().profile;
  if (!value || typeof value !== 'object') return fallback;
  const profile = value as Partial<Profile> & { custom?: { start?: unknown; end?: unknown; budget?: unknown } | null };
  const dailyTarget = clampDaily(typeof profile.dailyTarget === 'number' ? profile.dailyTarget : fallback.dailyTarget);
  const weekBudget = optionalKcal(profile.weekBudget);
  const monthBudget = optionalKcal(profile.monthBudget);
  const savedPlans = Array.isArray(profile.plans) ? profile.plans.map(asPlan).filter((plan): plan is TargetPlan => plan !== null) : [];
  const plans = savedPlans.length > 0 ? [...savedPlans].sort((a, b) => (a.from < b.from ? -1 : 1)) : plansFromHistory(dayTargets, dailyTarget, weekBudget, monthBudget);
  let ranges = Array.isArray(profile.ranges) ? profile.ranges.map(asRange).filter((range): range is CustomRange => range !== null) : [];
  const legacy = profile.custom;
  if (!Array.isArray(profile.ranges) && legacy && typeof legacy.start === 'string' && typeof legacy.end === 'string' && typeof legacy.budget === 'number') {
    const days = eachDate(legacy.start, legacy.end).length;
    if (days > 0) ranges = [{ id: 'range-legacy', start: legacy.start, end: legacy.end, daily: clampDaily(legacy.budget / days), week: null }];
  }
  return {
    dailyTarget,
    goalSet: profile.goalSet === false ? false : true,
    weekBudget,
    monthBudget,
    plans,
    ranges: ranges.sort((a, b) => (a.start < b.start ? -1 : 1)),
  };
}

export function normalizeData(value: unknown): AppData {
  const base = freshData();
  if (!value || typeof value !== 'object') return base;
  const data = value as Partial<AppData>;
  const tweaks: Record<string, FoodTweak> = {};
  if (data.tweaks && typeof data.tweaks === 'object') {
    for (const [id, tweak] of Object.entries(data.tweaks)) {
      if (!tweak || typeof tweak !== 'object') continue;
      const next: FoodTweak = {};
      if (typeof tweak.kcalPer100g === 'number') next.kcalPer100g = tweak.kcalPer100g;
      if (typeof tweak.pieceGrams === 'number') next.pieceGrams = tweak.pieceGrams;
      if (next.kcalPer100g != null || next.pieceGrams != null) tweaks[id] = next;
    }
  }
  const dayTargets: Record<string, number> = {};
  if (data.dayTargets && typeof data.dayTargets === 'object') {
    for (const [iso, target] of Object.entries(data.dayTargets)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && typeof target === 'number') dayTargets[iso] = clampDaily(target);
    }
  }
  return {
    version: 1,
    pinHash: typeof data.pinHash === 'string' ? data.pinHash : null,
    profile: asProfile(data.profile, dayTargets),
    customFoods: Array.isArray(data.customFoods) ? data.customFoods.map(asFood).filter((food): food is Food => food !== null) : [],
    tweaks,
    dayTargets,
    logs: Array.isArray(data.logs) ? data.logs.map(asLog).filter((log): log is LogEntry => log !== null) : [],
    weights: listOf(data.weights, asWeight),
    measures: listOf(data.measures, asMeasure),
    activities: listOf(data.activities, asActivity),
    cheatDays: listOf(data.cheatDays, asCheatDay),
    customIdeas: listOf(data.customIdeas, asMealIdea),
    hiddenIdeas: listOf(data.hiddenIdeas, asHiddenIdea),
    removedLogIds: asIds(data.removedLogIds),
    removedFoodIds: asIds(data.removedFoodIds),
    removedTweakIds: asIds(data.removedTweakIds),
    hintDismissed: Boolean(data.hintDismissed),
  };
}

export function fromBackup(value: unknown): AppData | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { version?: unknown; diary?: unknown; pinHash?: unknown; logs?: unknown };
  if (body.version === 2 && body.diary && typeof body.diary === 'object') {
    const diary = body.diary as Partial<AppData>;
    if (!Array.isArray(diary.logs)) return null;
    return normalizeData(diary);
  }
  if (body.version === 1 && typeof body.pinHash === 'string' && Array.isArray(body.logs)) return normalizeData(body);
  return null;
}

export function isProfileName(value: string): boolean {
  const name = value.trim();
  return name.length >= 1 && name.length <= 24 && /^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(name);
}

export function emptyBook(): ProfileBook {
  return { version: 1, updatedAt: '', profiles: [], removedProfileIds: [] };
}

function asProfileRecord(value: unknown): ProfileRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ProfileRecord>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const name = record.name.trim().slice(0, 24);
  if (!name) return null;
  return {
    id: record.id,
    name,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    data: normalizeData(record.data),
  };
}

export function normalizeBook(value: unknown): ProfileBook {
  if (!value || typeof value !== 'object') return emptyBook();
  const book = value as Partial<ProfileBook>;
  const profiles = Array.isArray(book.profiles)
    ? book.profiles.map(asProfileRecord).filter((item): item is ProfileRecord => item !== null)
    : [];
  return {
    version: 1,
    updatedAt: typeof book.updatedAt === 'string' ? book.updatedAt : '',
    profiles,
    removedProfileIds: asIds(book.removedProfileIds),
  };
}

export function loadBook(): ProfileBook {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (!raw) return emptyBook();
    return normalizeBook(JSON.parse(raw));
  } catch {
    return emptyBook();
  }
}

export function saveBook(book: ProfileBook): void {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(book));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The open profile stays in memory for this visit if storage is full.
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    return normalizeData(JSON.parse(raw));
  } catch {
    return freshData();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The diary stays in memory for this visit if the phone refuses more storage.
  }
}
