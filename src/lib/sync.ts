import { emptyShared, normalizeBook } from './storage';
import type { AppData, Food, HealthDay, LogEntry, ProfileBook, ProfileRecord, SharedFoods, SharedTweak } from '../types';

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mergeData(older: AppData, newer: AppData): AppData {
  const removedLogIds = unique([...older.removedLogIds, ...newer.removedLogIds]);
  const removedFoodIds = unique([...older.removedFoodIds, ...newer.removedFoodIds]);
  const removedTweakIds = unique([...older.removedTweakIds, ...newer.removedTweakIds]);
  const logs = new Map<string, LogEntry>();
  for (const log of [...older.logs, ...newer.logs]) {
    if (!removedLogIds.includes(log.id)) logs.set(log.id, log);
  }
  const foods = new Map<string, Food>();
  for (const food of [...older.customFoods, ...newer.customFoods]) {
    if (!removedFoodIds.includes(food.id)) foods.set(food.id, food);
  }
  const byId = <T extends { id: string }>(left: T[], right: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of [...left, ...right]) {
      if (!removedLogIds.includes(item.id)) map.set(item.id, item);
    }
    return [...map.values()];
  };
  const tweaks = { ...older.tweaks, ...newer.tweaks };
  for (const id of removedTweakIds) delete tweaks[id];
  const health: Record<string, HealthDay> = { ...(older.health ?? {}) };
  for (const [day, next] of Object.entries(newer.health ?? {})) {
    const kept = health[day];
    health[day] = kept
      ? {
          steps: Math.max(kept.steps, next.steps),
          activeKcal: Math.max(kept.activeKcal, next.activeKcal),
          exerciseMin: Math.max(kept.exerciseMin, next.exerciseMin),
          standMin: Math.max(kept.standMin, next.standMin),
          updatedAt: time(next.updatedAt) >= time(kept.updatedAt) ? next.updatedAt : kept.updatedAt,
        }
      : next;
  }
  return {
    version: 1,
    pinHash: null,
    profile: newer.profile,
    customFoods: [...foods.values()],
    tweaks,
    dayTargets: { ...older.dayTargets, ...newer.dayTargets },
    logs: [...logs.values()],
    weights: byId(older.weights, newer.weights),
    measures: byId(older.measures, newer.measures),
    activities: byId(older.activities, newer.activities),
    health,
    healthFiles: unique([...(older.healthFiles ?? []), ...(newer.healthFiles ?? [])]).slice(-400),
    cheatDays: byId(older.cheatDays, newer.cheatDays),
    customIdeas: byId(older.customIdeas, newer.customIdeas),
    hiddenIdeas: byId(older.hiddenIdeas, newer.hiddenIdeas),
    removedLogIds,
    removedFoodIds,
    removedTweakIds,
    hintDismissed: older.hintDismissed || newer.hintDismissed,
  };
}

function mergeProfiles(left: ProfileRecord, right: ProfileRecord): ProfileRecord {
  const rightNewer = time(right.updatedAt) >= time(left.updatedAt);
  const newer = rightNewer ? right : left;
  const older = rightNewer ? left : right;
  return {
    id: left.id,
    name: newer.name,
    updatedAt: newer.updatedAt,
    data: mergeData(older.data, newer.data),
  };
}

function mergeShared(older: SharedFoods, newer: SharedFoods): SharedFoods {
  const removedFoodIds = unique([...older.removedFoodIds, ...newer.removedFoodIds]);
  const foods = new Map<string, Food>();
  for (const food of [...older.foods, ...newer.foods]) {
    if (!removedFoodIds.includes(food.id)) foods.set(food.id, food);
  }
  const tweaks: Record<string, SharedTweak> = { ...older.tweaks };
  for (const [id, tweak] of Object.entries(newer.tweaks)) {
    const kept = tweaks[id];
    if (!kept || time(tweak.updatedAt) >= time(kept.updatedAt)) tweaks[id] = tweak;
  }
  return { foods: [...foods.values()], tweaks, removedFoodIds };
}

export function mergeBooks(left: ProfileBook, right: ProfileBook): ProfileBook {
  const rightNewer = time(right.updatedAt) >= time(left.updatedAt);
  const leftShared = left.shared ?? emptyShared();
  const rightShared = right.shared ?? emptyShared();
  const shared = rightNewer ? mergeShared(leftShared, rightShared) : mergeShared(rightShared, leftShared);
  const removed = new Set([...left.removedProfileIds, ...right.removedProfileIds]);
  const profiles = new Map<string, ProfileRecord>();
  for (const profile of left.profiles) {
    if (!removed.has(profile.id)) profiles.set(profile.id, profile);
  }
  for (const profile of right.profiles) {
    if (removed.has(profile.id)) {
      profiles.delete(profile.id);
      continue;
    }
    const existing = profiles.get(profile.id);
    profiles.set(profile.id, existing ? mergeProfiles(existing, profile) : profile);
  }
  const named: ProfileRecord[] = [];
  const slots = new Map<string, number>();
  for (const profile of profiles.values()) {
    const key = profile.name.trim().toLocaleLowerCase();
    const slot = slots.get(key);
    if (slot === undefined) {
      slots.set(key, named.length);
      named.push(profile);
      continue;
    }
    const kept = named[slot];
    const keepId = kept.id < profile.id ? kept.id : profile.id;
    removed.add(keepId === kept.id ? profile.id : kept.id);
    named[slot] = { ...mergeProfiles(kept, profile), id: keepId };
  }
  return {
    version: 1,
    updatedAt: rightNewer ? right.updatedAt : left.updatedAt,
    profiles: named,
    removedProfileIds: [...removed],
    shared,
  };
}

export function liftFoods(book: ProfileBook, now = new Date().toISOString()): ProfileBook {
  const shared = book.shared ?? emptyShared();
  const foods = [...shared.foods];
  const known = new Set([...foods.map((food) => food.id), ...shared.removedFoodIds]);
  const tweaks = { ...shared.tweaks };
  let changed = false;
  const oldestFirst = [...book.profiles].sort((a, b) => time(a.updatedAt) - time(b.updatedAt));
  for (const profile of oldestFirst) {
    for (const food of profile.data.customFoods) {
      if (known.has(food.id) || profile.data.removedFoodIds.includes(food.id)) continue;
      known.add(food.id);
      foods.push(food);
      changed = true;
    }
  }
  for (const profile of [...oldestFirst].reverse()) {
    for (const [id, tweak] of Object.entries(profile.data.tweaks)) {
      if (tweaks[id]) continue;
      tweaks[id] = { ...tweak, updatedAt: profile.updatedAt || now };
      changed = true;
    }
  }
  return changed ? { ...book, updatedAt: now, shared: { ...shared, foods, tweaks } } : book;
}

export function booksEqual(left: ProfileBook, right: ProfileBook): boolean {
  return JSON.stringify(normalizeBook(left)) === JSON.stringify(normalizeBook(right));
}
