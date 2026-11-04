import { normalizeBook } from './storage';
import type { AppData, Food, LogEntry, ProfileBook, ProfileRecord } from '../types';

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
  const tweaks = { ...older.tweaks, ...newer.tweaks };
  for (const id of removedTweakIds) delete tweaks[id];
  return {
    version: 1,
    pinHash: null,
    profile: newer.profile,
    customFoods: [...foods.values()],
    tweaks,
    dayTargets: { ...older.dayTargets, ...newer.dayTargets },
    logs: [...logs.values()],
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

export function mergeBooks(left: ProfileBook, right: ProfileBook): ProfileBook {
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
    updatedAt: time(right.updatedAt) >= time(left.updatedAt) ? right.updatedAt : left.updatedAt,
    profiles: named,
    removedProfileIds: [...removed],
  };
}

export function booksEqual(left: ProfileBook, right: ProfileBook): boolean {
  return JSON.stringify(normalizeBook(left)) === JSON.stringify(normalizeBook(right));
}
