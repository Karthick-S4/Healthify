import { addDays } from './dates';
import type { LogEntry } from '../types';

export type DayStatus = 'over' | 'under' | 'empty';

export type OnTargetStreak = {
  days: number;
  ended: number;
  today: DayStatus;
};

function grouped(logs: LogEntry[]): Map<string, LogEntry[]> {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const day = map.get(log.date);
    if (day) day.push(log);
    else map.set(log.date, [log]);
  }
  return map;
}

function completedDays(logs: LogEntry[], today: string, targetFor: (iso: string) => number): number {
  const days = grouped(logs);
  let count = 0;
  for (let cursor = addDays(today, -1), guard = 0; guard < 800; guard += 1) {
    const entries = days.get(cursor) ?? [];
    if (entries.length === 0) break;
    const kcal = entries.reduce((sum, entry) => sum + entry.kcal, 0);
    if (kcal > targetFor(cursor)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function onTargetStreak(logs: LogEntry[], today: string, targetFor: (iso: string) => number): OnTargetStreak {
  const todayLogs = logs.filter((log) => log.date === today);
  const todayKcal = todayLogs.reduce((sum, log) => sum + log.kcal, 0);
  const todayStatus: DayStatus =
    todayLogs.length === 0 ? 'empty' : todayKcal > targetFor(today) ? 'over' : 'under';
  const ended = completedDays(logs, today, targetFor);
  return {
    days: todayStatus === 'over' ? 0 : ended,
    ended,
    today: todayStatus,
  };
}

export function homeStreak(logs: LogEntry[], today: string): { days: number; brokeToday: boolean } {
  const days = grouped(logs);
  const todayLogs = days.get(today) ?? [];
  if (todayLogs.some((log) => log.outside)) return { days: 0, brokeToday: true };
  if (logs.length === 0) return { days: 0, brokeToday: false };

  const earliest = logs.reduce((min, log) => (log.date < min ? log.date : min), logs[0].date);
  let count = 0;
  for (let cursor = todayLogs.length > 0 ? today : addDays(today, -1); cursor >= earliest; cursor = addDays(cursor, -1)) {
    const entries = days.get(cursor) ?? [];
    if (entries.length === 0) continue;
    if (entries.some((log) => log.outside)) break;
    count += 1;
  }
  return { days: count, brokeToday: false };
}
