import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { captureLinkKey, deviceLink, pullDiary, pushDiary, readSyncKey, saveSyncKey, type PullResult } from './lib/cloud';
import { todayISO } from './lib/dates';
import { allFoods, sharedTweakOn } from './lib/foods';
import { FIRST_DAY, freshData, isProfileName, loadBook, normalizeBook, saveBook, SESSION_KEY } from './lib/storage';
import { booksEqual, liftFoods, mergeBooks } from './lib/sync';
import type { AppData, CustomRange, Food, FoodTweak, LogEntry, MealSlot, ProfileBook, ProfileRecord, SharedFoods } from './types';

type NewLog = Omit<LogEntry, 'id' | 'createdAt'>;
type Targets = { daily: number; week: number | null; month: number | null };

function withTargets(current: AppData, targets: Targets): AppData {
  const today = todayISO();
  const earlier = current.profile.plans.filter((plan) => plan.from < today);
  const from = earlier.length === 0 ? FIRST_DAY : today;
  return {
    ...current,
    profile: {
      ...current.profile,
      dailyTarget: targets.daily,
      weekBudget: targets.week,
      monthBudget: targets.month,
      goalSet: true,
      plans: [...earlier, { from, ...targets }],
    },
  };
}
type Undo = { ids: string[]; message: string };
type ListedProfile = { id: string; name: string };
type CreateResult = 'ok' | 'taken' | 'invalid';
export type SyncStatus = 'off' | 'checking' | 'ok' | 'failed' | 'bad-key';

type HealthApi = {
  data: AppData;
  foods: Food[];
  loading: boolean;
  syncError: boolean;
  sync: SyncStatus;
  connect: (key: string) => Promise<SyncStatus>;
  disconnect: () => void;
  linkForDevice: () => string | null;
  profileName: string | null;
  profileId: string | null;
  profiles: ListedProfile[];
  undo: Undo | null;
  openProfile: (id: string) => void;
  createProfile: (name: string) => CreateResult;
  switchProfile: () => void;
  removeProfile: (id: string) => void;
  dismissHint: () => void;
  setDailyTarget: (value: number) => void;
  setTargets: (targets: { daily: number; week: number | null; month: number | null }) => void;
  saveRange: (range: CustomRange) => void;
  removeRange: (id: string) => void;
  addLogs: (entries: NewLog[]) => string[];
  updateLog: (id: string, patch: Partial<Pick<LogEntry, 'title' | 'kcal' | 'outside' | 'meal'>>) => void;
  removeLogs: (ids: string[]) => void;
  addWeight: (date: string, kg: number) => void;
  addMeasure: (date: string, part: string, cm: number) => void;
  addActivity: (date: string, name: string, minutes: number) => string;
  removeEntries: (ids: string[]) => void;
  setCheatDay: (date: string, on: boolean) => void;
  addIdea: (title: string, query: string, slot: MealSlot) => void;
  removeIdea: (title: string, customId?: string) => void;
  restoreIdeas: () => void;
  undoLast: () => void;
  setUndo: (undo: Undo | null) => void;
  addCustomFood: (food: Food) => void;
  updateCustomFood: (id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => void;
  deleteCustomFood: (id: string) => void;
  tweakFood: (id: string, tweak: FoodTweak | null) => void;
  isTweaked: (id: string) => boolean;
  importData: (data: AppData) => void;
};

const HealthContext = createContext<HealthApi | null>(null);

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function stamp(book: ProfileBook, now = new Date().toISOString()): ProfileBook {
  return { ...book, updatedAt: now };
}

function readSelected(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function rememberProfile(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The open profile still lasts until this page is closed.
  }
}

const PROFILE_PARAM = 'profile';

function readUrlProfile(): string | null {
  const name = new URLSearchParams(window.location.search).get(PROFILE_PARAM)?.trim();
  return name ? name.toLocaleLowerCase() : null;
}

function writeUrlProfile(name: string | null) {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set(PROFILE_PARAM, name);
  else url.searchParams.delete(PROFILE_PARAM);
  const next = url.pathname + url.search + url.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', next);
}

function profileNamed(book: ProfileBook, name: string | null): ProfileRecord | undefined {
  return name ? book.profiles.find((profile) => profile.name.trim().toLocaleLowerCase() === name) : undefined;
}

function statusOf(result: PullResult): SyncStatus {
  if (result.kind === 'no-key') return 'off';
  return result.kind;
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<ProfileBook>(() => {
    captureLinkKey();
    return loadBook();
  });
  const urlProfile = useRef<string | null>(readUrlProfile());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const named = profileNamed(book, urlProfile.current);
    if (!named) return readSelected();
    urlProfile.current = null;
    rememberProfile(named.id);
    return named.id;
  });
  const [undo, setUndo] = useState<Undo | null>(null);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncStatus>(() => (readSyncKey() ? 'checking' : 'off'));
  const syncError = sync === 'failed';
  const activeName = useRef<string | null>(null);
  const [blank] = useState<AppData>(() => freshData());
  const bookRef = useRef(book);
  const activeRef = useRef(activeId);
  const queue = useRef(Promise.resolve());
  const mirror = useRef<ProfileBook | null>(null);
  const seen = useRef<string | null>(null);
  if (seen.current === null) seen.current = JSON.stringify(normalizeBook(book));
  bookRef.current = book;
  activeRef.current = activeId;

  const enqueue = useCallback((task: () => Promise<unknown>) => {
    const run = async () => {
      await task();
    };
    queue.current = queue.current.then(run, run);
  }, []);

  const refresh = useCallback(async (): Promise<SyncStatus> => {
    const result = await pullDiary();
    setSync(statusOf(result));
    if (result.kind !== 'ok') return statusOf(result);
    const remote = result.book;
    const merged = mergeBooks(remote, bookRef.current);
    mirror.current = booksEqual(merged, remote) ? merged : remote;
    setBook((current) => {
      const next = mergeBooks(remote, current);
      return booksEqual(next, current) ? current : next;
    });
    return 'ok';
  }, []);

  const publish = useCallback(async () => {
    const local = bookRef.current;
    const serial = JSON.stringify(normalizeBook(local));
    if (mirror.current && booksEqual(local, mirror.current)) {
      seen.current = serial;
      return;
    }
    if (!mirror.current && serial === seen.current) return;
    const result = await pushDiary(local);
    setSync(statusOf(result));
    if (result.kind !== 'ok') return;
    const remote = result.book;
    const merged = mergeBooks(remote, bookRef.current);
    mirror.current = merged;
    seen.current = JSON.stringify(normalizeBook(merged));
    setBook((current) => (booksEqual(merged, current) ? current : mergeBooks(remote, current)));
  }, []);

  const connect = useCallback(
    (key: string) =>
      new Promise<SyncStatus>((resolve) => {
        saveSyncKey(key);
        mirror.current = null;
        seen.current = '';
        setSync('checking');
        enqueue(async () => {
          const status = await refresh();
          if (status === 'bad-key') saveSyncKey(null);
          if (status === 'ok') await publish();
          resolve(status);
        });
      }),
    [enqueue, publish, refresh],
  );

  const disconnect = useCallback(() => {
    saveSyncKey(null);
    mirror.current = null;
    setSync('off');
  }, []);

  const linkForDevice = useCallback(() => {
    const key = readSyncKey();
    const name = bookRef.current.profiles.find((profile) => profile.id === activeRef.current)?.name ?? null;
    return key ? deviceLink(key, name) : null;
  }, []);

  const active = book.profiles.find((profile) => profile.id === activeId) ?? null;
  const data = active?.data ?? blank;

  useEffect(() => {
    let cancel = false;
    enqueue(async () => {
      await refresh();
      if (!cancel) setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, [enqueue, refresh]);

  useEffect(() => {
    saveBook(book);
    if (!ready) return;
    const timer = window.setTimeout(() => enqueue(() => publish()), 400);
    return () => window.clearTimeout(timer);
  }, [book, enqueue, publish, ready]);

  useEffect(() => {
    if (!ready) return;
    let last = 0;
    const onShow = () => {
      if (document.visibilityState === 'hidden') {
        enqueue(() => publish());
        return;
      }
      const now = Date.now();
      if (now - last < 15000) return;
      last = now;
      enqueue(() => refresh());
    };
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && readSyncKey()) enqueue(() => refresh());
    }, 60000);
    window.addEventListener('focus', onShow);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', onShow);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [enqueue, publish, ready, refresh]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!activeId) return;
    const current = book.profiles.find((profile) => profile.id === activeId);
    if (current) {
      activeName.current = current.name.trim().toLocaleLowerCase();
      return;
    }
    if (!ready) return;
    const sameName = book.profiles.find((profile) => profile.name.trim().toLocaleLowerCase() === activeName.current);
    setActiveId(sameName?.id ?? null);
    rememberProfile(sameName?.id ?? null);
  }, [activeId, book.profiles, ready]);

  useEffect(() => {
    if (!urlProfile.current) return;
    const named = profileNamed(book, urlProfile.current);
    if (named) {
      urlProfile.current = null;
      setActiveId(named.id);
      rememberProfile(named.id);
    } else if (ready) {
      urlProfile.current = null;
    }
  }, [book, ready]);

  const activeProfileName = active?.name ?? null;
  useEffect(() => {
    if (urlProfile.current) return;
    writeUrlProfile(activeProfileName);
  }, [activeProfileName, ready]);

  const foods = useMemo(() => allFoods(data, book.shared), [data, book.shared]);

  const updateData = useCallback((recipe: (current: AppData) => AppData) => {
    const now = new Date().toISOString();
    setBook((bookNow) => {
      const profile = bookNow.profiles.find((item) => item.id === activeRef.current);
      if (!profile) return bookNow;
      return stamp(
        {
          ...bookNow,
          profiles: bookNow.profiles.map((item) =>
            item.id === profile.id ? { ...item, updatedAt: now, data: recipe(item.data) } : item,
          ),
        },
        now,
      );
    });
  }, []);

  const openProfile = useCallback((id: string) => {
    if (!bookRef.current.profiles.some((item) => item.id === id)) return;
    setActiveId(id);
    rememberProfile(id);
  }, []);

  const createProfile = useCallback((name: string): CreateResult => {
    const clean = name.trim();
    if (!isProfileName(clean)) return 'invalid';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let result: CreateResult = 'ok';
    setBook((bookNow) => {
      if (bookNow.profiles.some((item) => item.name.toLowerCase() === clean.toLowerCase())) {
        result = 'taken';
        return bookNow;
      }
      const next = freshData();
      next.profile = { ...next.profile, goalSet: false };
      return stamp({ ...bookNow, profiles: [...bookNow.profiles, { id, name: clean, updatedAt: now, data: next }] }, now);
    });
    if (result !== 'ok') return result;
    setActiveId(id);
    rememberProfile(id);
    return 'ok';
  }, []);

  const switchProfile = useCallback(() => {
    setUndo(null);
    setActiveId(null);
    rememberProfile(null);
  }, []);

  const removeProfile = useCallback((id: string) => {
    const now = new Date().toISOString();
    setBook((bookNow) =>
      stamp(
        {
          ...bookNow,
          removedProfileIds: unique([...bookNow.removedProfileIds, id]),
          profiles: bookNow.profiles.filter((item) => item.id !== id),
        },
        now,
      ),
    );
    setUndo(null);
    setActiveId((current) => {
      if (current !== id) return current;
      rememberProfile(null);
      return null;
    });
  }, []);

  const dismissHint = useCallback(() => {
    updateData((current) => ({ ...current, hintDismissed: true }));
  }, [updateData]);

  const setTargets = useCallback((targets: { daily: number; week: number | null; month: number | null }) => {
    updateData((current) => withTargets(current, targets));
  }, [updateData]);

  const setDailyTarget = useCallback((value: number) => {
    updateData((current) => withTargets(current, { daily: value, week: current.profile.weekBudget, month: current.profile.monthBudget }));
  }, [updateData]);

  const saveRange = useCallback((range: CustomRange) => {
    updateData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        ranges: [...current.profile.ranges.filter((item) => item.id !== range.id), range].sort((a, b) => (a.start < b.start ? -1 : 1)),
      },
    }));
  }, [updateData]);

  const removeRange = useCallback((id: string) => {
    updateData((current) => ({ ...current, profile: { ...current.profile, ranges: current.profile.ranges.filter((item) => item.id !== id) } }));
  }, [updateData]);

  const addLogs = useCallback((entries: NewLog[]) => {
    const created = entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    updateData((current) => ({ ...current, logs: [...current.logs, ...created] }));
    return created.map((entry) => entry.id);
  }, [updateData]);

  const updateLog = useCallback((id: string, patch: Partial<Pick<LogEntry, 'title' | 'kcal' | 'outside' | 'meal'>>) => {
    updateData((current) => ({
      ...current,
      logs: current.logs.map((log) => (log.id === id ? { ...log, ...patch } : log)),
    }));
  }, [updateData]);

  const removeLogs = useCallback((ids: string[]) => {
    updateData((current) => ({
      ...current,
      logs: current.logs.filter((log) => !ids.includes(log.id)),
      removedLogIds: unique([...current.removedLogIds, ...ids]),
    }));
  }, [updateData]);

  const addWeight = useCallback((date: string, kg: number) => {
    const createdAt = new Date().toISOString();
    updateData((current) => {
      const replaced = current.weights.filter((entry) => entry.date === date).map((entry) => entry.id);
      return {
        ...current,
        weights: [...current.weights.filter((entry) => entry.date !== date), { id: crypto.randomUUID(), date, kg, createdAt }],
        removedLogIds: unique([...current.removedLogIds, ...replaced]),
      };
    });
  }, [updateData]);

  const addMeasure = useCallback((date: string, part: string, cm: number) => {
    const createdAt = new Date().toISOString();
    const key = part.trim().toLocaleLowerCase();
    updateData((current) => {
      const same = (entry: { date: string; part: string }) => entry.date === date && entry.part.toLocaleLowerCase() === key;
      const replaced = current.measures.filter(same).map((entry) => entry.id);
      return {
        ...current,
        measures: [...current.measures.filter((entry) => !same(entry)), { id: crypto.randomUUID(), date, part: part.trim(), cm, createdAt }],
        removedLogIds: unique([...current.removedLogIds, ...replaced]),
      };
    });
  }, [updateData]);

  const addActivity = useCallback((date: string, name: string, minutes: number) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    updateData((current) => ({ ...current, activities: [...current.activities, { id, date, name: name.trim(), minutes, createdAt }] }));
    return id;
  }, [updateData]);

  const removeEntries = useCallback((ids: string[]) => {
    updateData((current) => ({
      ...current,
      weights: current.weights.filter((entry) => !ids.includes(entry.id)),
      measures: current.measures.filter((entry) => !ids.includes(entry.id)),
      activities: current.activities.filter((entry) => !ids.includes(entry.id)),
      removedLogIds: unique([...current.removedLogIds, ...ids]),
    }));
  }, [updateData]);

  const addIdea = useCallback(
    (title: string, query: string, slot: MealSlot) => {
      updateData((current) => {
        const key = title.trim().toLocaleLowerCase();
        const unhidden = current.hiddenIdeas.filter((entry) => entry.key === key).map((entry) => entry.id);
        return {
          ...current,
          customIdeas: [...current.customIdeas, { id: crypto.randomUUID(), title: title.trim(), query: query.trim(), slot, createdAt: new Date().toISOString() }],
          hiddenIdeas: current.hiddenIdeas.filter((entry) => entry.key !== key),
          removedLogIds: unique([...current.removedLogIds, ...unhidden]),
        };
      });
    },
    [updateData],
  );

  const removeIdea = useCallback(
    (title: string, customId?: string) => {
      updateData((current) => {
        if (customId) {
          return {
            ...current,
            customIdeas: current.customIdeas.filter((idea) => idea.id !== customId),
            removedLogIds: unique([...current.removedLogIds, customId]),
          };
        }
        const key = title.trim().toLocaleLowerCase();
        if (current.hiddenIdeas.some((entry) => entry.key === key)) return current;
        return { ...current, hiddenIdeas: [...current.hiddenIdeas, { id: crypto.randomUUID(), key, createdAt: new Date().toISOString() }] };
      });
    },
    [updateData],
  );

  const restoreIdeas = useCallback(() => {
    updateData((current) => ({
      ...current,
      hiddenIdeas: [],
      removedLogIds: unique([...current.removedLogIds, ...current.hiddenIdeas.map((entry) => entry.id)]),
    }));
  }, [updateData]);

  const setCheatDay = useCallback((date: string, on: boolean) => {
    updateData((current) => {
      const same = current.cheatDays.filter((entry) => entry.date === date);
      if (on) {
        if (same.length > 0) return current;
        return { ...current, cheatDays: [...current.cheatDays, { id: crypto.randomUUID(), date, createdAt: new Date().toISOString() }] };
      }
      if (same.length === 0) return current;
      return {
        ...current,
        cheatDays: current.cheatDays.filter((entry) => entry.date !== date),
        removedLogIds: unique([...current.removedLogIds, ...same.map((entry) => entry.id)]),
      };
    });
  }, [updateData]);

  const undoLast = useCallback(() => {
    setUndo((current) => {
      if (current) {
        const ids = current.ids;
        updateData((dataNow) => ({
          ...dataNow,
          logs: dataNow.logs.filter((log) => !ids.includes(log.id)),
          removedLogIds: unique([...dataNow.removedLogIds, ...ids]),
        }));
      }
      return null;
    });
  }, [updateData]);

  const updateShared = useCallback((recipe: (current: SharedFoods) => SharedFoods) => {
    const now = new Date().toISOString();
    setBook((bookNow) => stamp({ ...bookNow, shared: recipe(bookNow.shared) }, now));
  }, []);

  const addCustomFood = useCallback((food: Food) => {
    updateShared((current) => ({ ...current, foods: [food, ...current.foods.filter((item) => item.id !== food.id)] }));
  }, [updateShared]);

  const updateCustomFood = useCallback((id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => {
    const legacy = bookRef.current.profiles.flatMap((profile) => profile.data.customFoods).find((food) => food.id === id);
    updateShared((current) => {
      const existing = current.foods.find((food) => food.id === id) ?? legacy;
      if (!existing) return current;
      return { ...current, foods: [{ ...existing, ...patch }, ...current.foods.filter((food) => food.id !== id)] };
    });
  }, [updateShared]);

  const deleteCustomFood = useCallback((id: string) => {
    updateShared((current) => ({
      ...current,
      foods: current.foods.filter((food) => food.id !== id),
      removedFoodIds: unique([...current.removedFoodIds, id]),
    }));
    updateData((current) => ({
      ...current,
      customFoods: current.customFoods.filter((food) => food.id !== id),
      removedFoodIds: unique([...current.removedFoodIds, id]),
    }));
  }, [updateData, updateShared]);

  const tweakFood = useCallback((id: string, tweak: FoodTweak | null) => {
    const updatedAt = new Date().toISOString();
    updateShared((current) => ({ ...current, tweaks: { ...current.tweaks, [id]: { ...(tweak ?? {}), updatedAt } } }));
  }, [updateShared]);

  const isTweaked = useCallback((id: string) => sharedTweakOn(book.shared, id) != null || (!book.shared.tweaks[id] && data.tweaks[id] != null), [book.shared, data.tweaks]);

  useEffect(() => {
    if (!ready) return;
    setBook((current) => liftFoods(current));
  }, [book, ready]);

  const importData = useCallback((next: AppData) => {
    updateData((current) => {
      const nextLogs = new Set(next.logs.map((log) => log.id));
      const nextFoods = new Set(next.customFoods.map((food) => food.id));
      return {
        ...next,
        pinHash: null,
        removedLogIds: unique([
          ...current.removedLogIds,
          ...next.removedLogIds,
          ...current.logs.map((log) => log.id).filter((id) => !nextLogs.has(id)),
        ]),
        removedFoodIds: unique([
          ...current.removedFoodIds,
          ...next.removedFoodIds,
          ...current.customFoods.map((food) => food.id).filter((id) => !nextFoods.has(id)),
        ]),
        removedTweakIds: unique([
          ...current.removedTweakIds,
          ...next.removedTweakIds,
          ...Object.keys(current.tweaks).filter((id) => next.tweaks[id] == null),
        ]),
      };
    });
    setUndo(null);
  }, [updateData]);

  const profiles = useMemo<ListedProfile[]>(
    () => book.profiles.map((profile) => ({ id: profile.id, name: profile.name })),
    [book.profiles],
  );

  const api = useMemo<HealthApi>(
    () => ({
      data,
      foods,
      loading: !ready,
      syncError,
      sync,
      connect,
      disconnect,
      linkForDevice,
      profileName: active?.name ?? null,
      profileId: active?.id ?? null,
      profiles,
      undo,
      openProfile,
      createProfile,
      switchProfile,
      removeProfile,
      dismissHint,
      setDailyTarget,
      setTargets,
      saveRange,
      removeRange,
      addLogs,
      updateLog,
      removeLogs,
      addWeight,
      addMeasure,
      addActivity,
      removeEntries,
      setCheatDay,
      addIdea,
      removeIdea,
      restoreIdeas,
      undoLast,
      setUndo,
      addCustomFood,
      updateCustomFood,
      deleteCustomFood,
      tweakFood,
      isTweaked,
      importData,
    }),
    [
      data,
      foods,
      ready,
      syncError,
      sync,
      connect,
      disconnect,
      linkForDevice,
      active,
      profiles,
      undo,
      openProfile,
      createProfile,
      switchProfile,
      removeProfile,
      dismissHint,
      setDailyTarget,
      setTargets,
      saveRange,
      removeRange,
      addLogs,
      updateLog,
      removeLogs,
      addWeight,
      addMeasure,
      addActivity,
      removeEntries,
      setCheatDay,
      addIdea,
      removeIdea,
      restoreIdeas,
      undoLast,
      addCustomFood,
      updateCustomFood,
      deleteCustomFood,
      tweakFood,
      isTweaked,
      importData,
    ],
  );

  return <HealthContext.Provider value={api}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthApi {
  const api = useContext(HealthContext);
  if (!api) throw new Error('Healthify is outside its provider');
  return api;
}
