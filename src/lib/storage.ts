import type { AppData, Food, FoodTweak, LogEntry, Profile, ProfileBook, ProfileRecord } from '../types';

export const STORAGE_KEY = 'healthify.v1';
export const BOOK_KEY = 'healthify.shared.v1';
export const SESSION_KEY = 'healthify.profile';
export const DAILY_MIN = 1000;
export const DAILY_MAX = 5000;

export function freshData(): AppData {
  return {
    version: 1,
    pinHash: null,
    profile: { dailyTarget: 1800, goalSet: false, weekBudget: null, monthBudget: null, custom: null },
    customFoods: [],
    tweaks: {},
    dayTargets: {},
    logs: [],
    removedLogIds: [],
    removedFoodIds: [],
    removedTweakIds: [],
    hintDismissed: false,
  };
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

function asProfile(value: unknown): Profile {
  const fallback = freshData().profile;
  if (!value || typeof value !== 'object') return fallback;
  const profile = value as Partial<Profile>;
  const custom = profile.custom;
  const safeCustom =
    custom &&
    typeof custom === 'object' &&
    typeof custom.start === 'string' &&
    typeof custom.end === 'string' &&
    typeof custom.budget === 'number' &&
    custom.end >= custom.start
      ? { start: custom.start, end: custom.end, budget: Math.round(custom.budget) }
      : null;
  return {
    dailyTarget: clampDaily(typeof profile.dailyTarget === 'number' ? profile.dailyTarget : fallback.dailyTarget),
    goalSet: profile.goalSet === false ? false : true,
    weekBudget: typeof profile.weekBudget === 'number' ? Math.round(profile.weekBudget) : null,
    monthBudget: typeof profile.monthBudget === 'number' ? Math.round(profile.monthBudget) : null,
    custom: safeCustom,
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
    profile: asProfile(data.profile),
    customFoods: Array.isArray(data.customFoods) ? data.customFoods.map(asFood).filter((food): food is Food => food !== null) : [],
    tweaks,
    dayTargets,
    logs: Array.isArray(data.logs) ? data.logs.map(asLog).filter((log): log is LogEntry => log !== null) : [],
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
