import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayISO } from './lib/dates';
import { allFoods } from './lib/foods';
import { hashPin, isPin } from './lib/pin';
import { freshData, loadData, saveData, UNLOCK_KEY } from './lib/storage';
import type { AppData, CustomRange, Food, FoodTweak, LogEntry } from './types';

type NewLog = Omit<LogEntry, 'id' | 'createdAt'>;
type Undo = { ids: string[]; message: string };

type HealthApi = {
  data: AppData;
  foods: Food[];
  unlocked: boolean;
  undo: Undo | null;
  unlock: (pin: string) => Promise<boolean>;
  setup: (pin: string, dailyTarget: number) => Promise<void>;
  lock: () => void;
  changePin: (pin: string) => Promise<void>;
  erase: () => void;
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

function rememberUnlock(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1');
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // Session unlock is a convenience. The PIN still protects the next visit.
  }
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [undo, setUndo] = useState<Undo | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    const today = todayISO();
    setData((current) => {
      if (!current.pinHash || current.dayTargets[today] != null) return current;
      return { ...current, dayTargets: { ...current.dayTargets, [today]: current.profile.dailyTarget } };
    });
  }, []);

  const foods = useMemo(() => allFoods(data), [data.customFoods, data.tweaks]);

  const unlock = useCallback(
    async (pin: string) => {
      if (!isPin(pin) || !data.pinHash) return false;
      const hashed = await hashPin(pin);
      if (hashed !== data.pinHash) return false;
      rememberUnlock(true);
      setUnlocked(true);
      return true;
    },
    [data.pinHash],
  );

  const setup = useCallback(async (pin: string, dailyTarget: number) => {
    const pinHash = await hashPin(pin);
    const today = todayISO();
    setData((current) => ({
      ...current,
      pinHash,
      profile: { ...current.profile, dailyTarget },
      dayTargets: { ...current.dayTargets, [today]: dailyTarget },
    }));
    rememberUnlock(true);
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    rememberUnlock(false);
    setUnlocked(false);
  }, []);

  const changePin = useCallback(async (pin: string) => {
    const pinHash = await hashPin(pin);
    setData((current) => ({ ...current, pinHash }));
  }, []);

  const erase = useCallback(() => {
    setData(freshData());
    setUndo(null);
    rememberUnlock(false);
    setUnlocked(false);
  }, []);

  const dismissHint = useCallback(() => {
    setData((current) => ({ ...current, hintDismissed: true }));
  }, []);

  const setDailyTarget = useCallback((value: number) => {
    const today = todayISO();
    setData((current) => ({
      ...current,
      profile: { ...current.profile, dailyTarget: value },
      dayTargets: { ...current.dayTargets, [today]: value },
    }));
  }, []);

  const setWeekBudget = useCallback((value: number | null) => {
    setData((current) => ({ ...current, profile: { ...current.profile, weekBudget: value } }));
  }, []);

  const setMonthBudget = useCallback((value: number | null) => {
    setData((current) => ({ ...current, profile: { ...current.profile, monthBudget: value } }));
  }, []);

  const setCustom = useCallback((value: CustomRange | null) => {
    setData((current) => ({ ...current, profile: { ...current.profile, custom: value } }));
  }, []);

  const addLogs = useCallback((entries: NewLog[]) => {
    const created = entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    setData((current) => {
      const dayTargets = { ...current.dayTargets };
      for (const entry of created) {
        if (dayTargets[entry.date] == null) dayTargets[entry.date] = current.profile.dailyTarget;
      }
      return { ...current, dayTargets, logs: [...current.logs, ...created] };
    });
    return created.map((entry) => entry.id);
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<Pick<LogEntry, 'title' | 'kcal' | 'outside'>>) => {
    setData((current) => ({
      ...current,
      logs: current.logs.map((log) => (log.id === id ? { ...log, ...patch } : log)),
    }));
  }, []);

  const removeLogs = useCallback((ids: string[]) => {
    setData((current) => ({ ...current, logs: current.logs.filter((log) => !ids.includes(log.id)) }));
  }, []);

  const undoLast = useCallback(() => {
    setUndo((current) => {
      if (current) {
        const ids = current.ids;
        setData((dataNow) => ({ ...dataNow, logs: dataNow.logs.filter((log) => !ids.includes(log.id)) }));
      }
      return null;
    });
  }, []);

  const addCustomFood = useCallback((food: Food) => {
    setData((current) => ({
      ...current,
      customFoods: [food, ...current.customFoods.filter((item) => item.id !== food.id)],
    }));
  }, []);

  const updateCustomFood = useCallback((id: string, patch: Pick<Food, 'kcalPer100g' | 'pieceGrams'>) => {
    setData((current) => ({
      ...current,
      customFoods: current.customFoods.map((food) => (food.id === id ? { ...food, ...patch } : food)),
    }));
  }, []);

  const deleteCustomFood = useCallback((id: string) => {
    setData((current) => ({ ...current, customFoods: current.customFoods.filter((food) => food.id !== id) }));
  }, []);

  const tweakFood = useCallback((id: string, tweak: FoodTweak | null) => {
    setData((current) => {
      const tweaks = { ...current.tweaks };
      if (tweak) tweaks[id] = tweak;
      else delete tweaks[id];
      return { ...current, tweaks };
    });
  }, []);

  const importData = useCallback((next: AppData) => {
    setData(next);
    setUndo(null);
    rememberUnlock(true);
    setUnlocked(true);
  }, []);

  const api = useMemo<HealthApi>(
    () => ({
      data,
      foods,
      unlocked,
      undo,
      unlock,
      setup,
      lock,
      changePin,
      erase,
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
      unlocked,
      undo,
      unlock,
      setup,
      lock,
      changePin,
      erase,
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
