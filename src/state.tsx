import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayISO } from './lib/dates';
import { allFoods } from './lib/foods';
import { hashPassword, newSalt } from './lib/password';
import { hashPin, isPin } from './lib/pin';
import { freshData, loadBook, saveBook, SESSION_KEY, UNLOCK_KEY } from './lib/storage';
import type { AppData, CustomRange, Food, FoodTweak, LogEntry, ProfileBook } from './types';

type NewLog = Omit<LogEntry, 'id' | 'createdAt'>;
type Undo = { ids: string[]; message: string };
type ListedProfile = { id: string; name: string; legacy: boolean; needsPin: boolean };
type ClaimResult = 'ok' | 'taken' | 'pin' | 'missing';

type HealthApi = {
  data: AppData;
  foods: Food[];
  signedIn: boolean;
  profileName: string | null;
  profileId: string | null;
  profiles: ListedProfile[];
  undo: Undo | null;
  signIn: (id: string, password: string) => Promise<boolean>;
  createProfile: (name: string, password: string, dailyTarget: number) => Promise<ClaimResult>;
  claimProfile: (id: string, name: string, password: string, pin: string) => Promise<ClaimResult>;
  signOut: () => void;
  changePassword: (current: string, next: string) => Promise<boolean>;
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

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function rememberProfile(id: string | null) {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Signing in still works until this tab closes.
  }
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<ProfileBook>(() => loadBook());
  const [activeId, setActiveId] = useState<string | null>(() => readSession());
  const [undo, setUndo] = useState<Undo | null>(null);

  const [blank] = useState<AppData>(() => freshData());
  const active = book.profiles.find((profile) => profile.id === activeId && profile.passwordHash) ?? null;
  const data = active?.data ?? blank;

  useEffect(() => {
    saveBook(book);
  }, [book]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    const today = todayISO();
    setBook((bookNow) => {
      const profile = bookNow.profiles.find((item) => item.id === activeId && item.passwordHash);
      if (!profile || profile.data.dayTargets[today] != null) return bookNow;
      return {
        ...bookNow,
        profiles: bookNow.profiles.map((item) =>
          item.id === profile.id
            ? {
                ...item,
                data: { ...item.data, dayTargets: { ...item.data.dayTargets, [today]: item.data.profile.dailyTarget } },
              }
            : item,
        ),
      };
    });
  }, [activeId]);

  const foods = useMemo(() => allFoods(data), [data]);

  const updateData = useCallback((recipe: (current: AppData) => AppData) => {
    setBook((bookNow) => ({
      ...bookNow,
      profiles: bookNow.profiles.map((profile) =>
        profile.id === activeId && profile.passwordHash ? { ...profile, data: recipe(profile.data) } : profile,
      ),
    }));
  }, [activeId]);

  const signIn = useCallback(async (id: string, password: string) => {
    const profile = book.profiles.find((item) => item.id === id && item.passwordHash);
    if (!profile) return false;
    const hashed = await hashPassword(password, profile.salt);
    if (hashed !== profile.passwordHash) return false;
    setActiveId(id);
    rememberProfile(id);
    return true;
  }, [book.profiles]);

  const createProfile = useCallback(async (name: string, password: string, dailyTarget: number) => {
    const clean = name.trim();
    if (book.profiles.some((item) => item.name.toLowerCase() === clean.toLowerCase())) return 'taken' as const;
    const salt = newSalt();
    const passwordHash = await hashPassword(password, salt);
    const id = crypto.randomUUID();
    const today = todayISO();
    const next = freshData();
    next.profile = { ...next.profile, dailyTarget };
    next.dayTargets = { [today]: dailyTarget };
    setBook((bookNow) => ({
      ...bookNow,
      profiles: [...bookNow.profiles, { id, name: clean, salt, passwordHash, legacyPinHash: null, data: next }],
    }));
    setActiveId(id);
    rememberProfile(id);
    return 'ok' as const;
  }, [book.profiles]);

  const claimProfile = useCallback(async (id: string, name: string, password: string, pin: string) => {
    const clean = name.trim();
    const profile = book.profiles.find((item) => item.id === id);
    if (!profile) return 'missing' as const;
    if (book.profiles.some((item) => item.id !== id && item.name.toLowerCase() === clean.toLowerCase())) return 'taken' as const;
    if (profile.legacyPinHash) {
      if (!isPin(pin)) return 'pin' as const;
      const hashed = await hashPin(pin);
      if (hashed !== profile.legacyPinHash) return 'pin' as const;
    }
    const salt = newSalt();
    const passwordHash = await hashPassword(password, salt);
    setBook((bookNow) => ({
      ...bookNow,
      profiles: bookNow.profiles.map((item) =>
        item.id === id
          ? { ...item, name: clean, salt, passwordHash, legacyPinHash: null, data: { ...item.data, pinHash: null } }
          : item,
      ),
    }));
    setActiveId(id);
    rememberProfile(id);
    return 'ok' as const;
  }, [book.profiles]);

  const signOut = useCallback(() => {
    setUndo(null);
    setActiveId(null);
    rememberProfile(null);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const profile = book.profiles.find((item) => item.id === activeId && item.passwordHash);
    if (!profile) return false;
    const hashed = await hashPassword(current, profile.salt);
    if (hashed !== profile.passwordHash) return false;
    const salt = newSalt();
    const passwordHash = await hashPassword(next, salt);
    setBook((bookNow) => ({
      ...bookNow,
      profiles: bookNow.profiles.map((item) => (item.id === activeId ? { ...item, salt, passwordHash } : item)),
    }));
    return true;
  }, [activeId, book.profiles]);

  const removeProfile = useCallback((id: string) => {
    setBook((bookNow) => ({ ...bookNow, profiles: bookNow.profiles.filter((item) => item.id !== id) }));
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
      profile: { ...current.profile, dailyTarget: value },
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
    updateData((current) => ({ ...current, logs: current.logs.filter((log) => !ids.includes(log.id)) }));
  }, [updateData]);

  const undoLast = useCallback(() => {
    setUndo((current) => {
      if (current) {
        const ids = current.ids;
        updateData((dataNow) => ({ ...dataNow, logs: dataNow.logs.filter((log) => !ids.includes(log.id)) }));
      }
      return null;
    });
  }, [updateData]);

  const addCustomFood = useCallback((food: Food) => {
    updateData((current) => ({
      ...current,
      customFoods: [food, ...current.customFoods.filter((item) => item.id !== food.id)],
    }));
  }, [updateData]);

  const updateCustomFood = useCallback((id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => {
    updateData((current) => ({
      ...current,
      customFoods: current.customFoods.map((food) => (food.id === id ? { ...food, ...patch } : food)),
    }));
  }, [updateData]);

  const deleteCustomFood = useCallback((id: string) => {
    updateData((current) => ({ ...current, customFoods: current.customFoods.filter((food) => food.id !== id) }));
  }, [updateData]);

  const tweakFood = useCallback((id: string, tweak: FoodTweak | null) => {
    updateData((current) => {
      const tweaks = { ...current.tweaks };
      if (tweak) tweaks[id] = tweak;
      else delete tweaks[id];
      return { ...current, tweaks };
    });
  }, [updateData]);

  const importData = useCallback((next: AppData) => {
    updateData(() => ({ ...next, pinHash: null }));
    setUndo(null);
  }, [updateData]);

  const profiles = useMemo<ListedProfile[]>(
    () =>
      book.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        legacy: !profile.passwordHash,
        needsPin: Boolean(profile.legacyPinHash),
      })),
    [book.profiles],
  );

  const api = useMemo<HealthApi>(
    () => ({
      data,
      foods,
      signedIn: active != null,
      profileName: active?.name ?? null,
      profileId: active?.id ?? null,
      profiles,
      undo,
      signIn,
      createProfile,
      claimProfile,
      signOut,
      changePassword,
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
      active,
      profiles,
      undo,
      signIn,
      createProfile,
      claimProfile,
      signOut,
      changePassword,
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
