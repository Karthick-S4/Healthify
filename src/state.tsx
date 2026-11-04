import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { pullDiary, pushDiary } from './lib/cloud';
import { todayISO } from './lib/dates';
import { allFoods } from './lib/foods';
import { freshData, isProfileName, loadBook, saveBook, SESSION_KEY } from './lib/storage';
import { booksEqual, mergeBooks } from './lib/sync';
import type { AppData, CustomRange, Food, FoodTweak, LogEntry, ProfileBook } from './types';

type NewLog = Omit<LogEntry, 'id' | 'createdAt'>;
type Undo = { ids: string[]; message: string };
type ListedProfile = { id: string; name: string };
type CreateResult = 'ok' | 'taken' | 'invalid';

type HealthApi = {
  data: AppData;
  foods: Food[];
  loading: boolean;
  syncError: boolean;
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
  setWeekBudget: (value: number | null) => void;
  setMonthBudget: (value: number | null) => void;
  setCustom: (value: CustomRange | null) => void;
  addLogs: (entries: NewLog[]) => string[];
  updateLog: (id: string, patch: Partial<Pick<LogEntry, 'title' | 'kcal' | 'outside'>>) => void;
  removeLogs: (ids: string[]) => void;
  undoLast: () => void;
  setUndo: (undo: Undo | null) => void;
  addCustomFood: (food: Food) => void;
  updateCustomFood: (id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => void;
  deleteCustomFood: (id: string) => void;
  tweakFood: (id: string, tweak: FoodTweak | null) => void;
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

export function HealthProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<ProfileBook>(() => loadBook());
  const [activeId, setActiveId] = useState<string | null>(() => readSelected());
  const [undo, setUndo] = useState<Undo | null>(null);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [blank] = useState<AppData>(() => freshData());
  const bookRef = useRef(book);
  const activeRef = useRef(activeId);
  const queue = useRef(Promise.resolve());
  bookRef.current = book;
  activeRef.current = activeId;

  const enqueue = useCallback((task: () => Promise<void>) => {
    queue.current = queue.current.then(task, task);
  }, []);

  const refresh = useCallback(async () => {
    const remote = await pullDiary();
    if (!remote) {
      setSyncError(true);
      return;
    }
    setSyncError(false);
    setBook((current) => {
      const merged = mergeBooks(remote, current);
      return booksEqual(merged, current) ? current : merged;
    });
  }, []);

  const publish = useCallback(async () => {
    const result = await pushDiary(bookRef.current);
    if (!result) {
      setSyncError(true);
      return;
    }
    setSyncError(false);
    setBook((current) => {
      const merged = mergeBooks(result, current);
      return booksEqual(merged, current) ? current : merged;
    });
  }, []);

  const active = book.profiles.find((profile) => profile.id === activeId) ?? null;
  const data = active?.data ?? blank;

  useEffect(() => {
    let cancel = false;
    enqueue(async () => {
      const remote = await pullDiary();
      if (cancel) return;
      if (remote) {
        setSyncError(false);
        setBook((current) => {
          const merged = mergeBooks(remote, current);
          return booksEqual(merged, current) ? current : merged;
        });
      } else {
        setSyncError(true);
      }
      if (!cancel) setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, [enqueue]);

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
      if (now - last < 8000) return;
      last = now;
      enqueue(() => refresh());
    };
    window.addEventListener('focus', onShow);
    document.addEventListener('visibilitychange', onShow);
    return () => {
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
    const today = todayISO();
    setBook((bookNow) => {
      const profile = bookNow.profiles.find((item) => item.id === activeId);
      if (!profile || !profile.data.profile.goalSet || profile.data.dayTargets[today] != null) return bookNow;
      const now = new Date().toISOString();
      return stamp(
        {
          ...bookNow,
          profiles: bookNow.profiles.map((item) =>
            item.id === profile.id
              ? {
                  ...item,
                  updatedAt: now,
                  data: { ...item.data, dayTargets: { ...item.data.dayTargets, [today]: item.data.profile.dailyTarget } },
                }
              : item,
          ),
        },
        now,
      );
    });
  }, [activeId]);

  useEffect(() => {
    if (!ready || !activeId) return;
    if (book.profiles.some((profile) => profile.id === activeId)) return;
    setActiveId(null);
    rememberProfile(null);
  }, [activeId, book.profiles, ready]);

  const foods = useMemo(() => allFoods(data), [data]);

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

  const setDailyTarget = useCallback((value: number) => {
    const today = todayISO();
    updateData((current) => ({
      ...current,
      profile: { ...current.profile, dailyTarget: value, goalSet: true },
      dayTargets: { ...current.dayTargets, [today]: value },
    }));
  }, [updateData]);

  const setWeekBudget = useCallback((value: number | null) => {
    updateData((current) => ({ ...current, profile: { ...current.profile, weekBudget: value } }));
  }, [updateData]);

  const setMonthBudget = useCallback((value: number | null) => {
    updateData((current) => ({ ...current, profile: { ...current.profile, monthBudget: value } }));
  }, [updateData]);

  const setCustom = useCallback((value: CustomRange | null) => {
    updateData((current) => ({ ...current, profile: { ...current.profile, custom: value } }));
  }, [updateData]);

  const addLogs = useCallback((entries: NewLog[]) => {
    const created = entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    updateData((current) => {
      const dayTargets = { ...current.dayTargets };
      for (const entry of created) {
        if (dayTargets[entry.date] == null) dayTargets[entry.date] = current.profile.dailyTarget;
      }
      return { ...current, dayTargets, logs: [...current.logs, ...created] };
    });
    return created.map((entry) => entry.id);
  }, [updateData]);

  const updateLog = useCallback((id: string, patch: Partial<Pick<LogEntry, 'title' | 'kcal' | 'outside'>>) => {
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

  const addCustomFood = useCallback((food: Food) => {
    updateData((current) => ({
      ...current,
      customFoods: [food, ...current.customFoods.filter((item) => item.id !== food.id)],
      removedFoodIds: current.removedFoodIds.filter((item) => item !== food.id),
    }));
  }, [updateData]);

  const updateCustomFood = useCallback((id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => {
    updateData((current) => ({
      ...current,
      customFoods: current.customFoods.map((food) => (food.id === id ? { ...food, ...patch } : food)),
    }));
  }, [updateData]);

  const deleteCustomFood = useCallback((id: string) => {
    updateData((current) => ({
      ...current,
      customFoods: current.customFoods.filter((food) => food.id !== id),
      removedFoodIds: unique([...current.removedFoodIds, id]),
    }));
  }, [updateData]);

  const tweakFood = useCallback((id: string, tweak: FoodTweak | null) => {
    updateData((current) => {
      const tweaks = { ...current.tweaks };
      const removedTweakIds = current.removedTweakIds.filter((item) => item !== id);
      if (tweak) tweaks[id] = tweak;
      else {
        delete tweaks[id];
        removedTweakIds.push(id);
      }
      return { ...current, tweaks, removedTweakIds };
    });
  }, [updateData]);

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
      setWeekBudget,
      setMonthBudget,
      setCustom,
      addLogs,
      updateLog,
      removeLogs,
      undoLast,
      setUndo,
      addCustomFood,
      updateCustomFood,
      deleteCustomFood,
      tweakFood,
      importData,
    }),
    [
      data,
      foods,
      ready,
      syncError,
      active,
      profiles,
      undo,
      openProfile,
      createProfile,
      switchProfile,
      removeProfile,
      dismissHint,
      setDailyTarget,
      setWeekBudget,
      setMonthBudget,
      setCustom,
      addLogs,
      updateLog,
      removeLogs,
      undoLast,
      addCustomFood,
      updateCustomFood,
      deleteCustomFood,
      tweakFood,
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
