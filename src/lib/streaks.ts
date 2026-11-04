import { addDays, eachDate, weekRange } from './dates';
import type { ActivityEntry, LogEntry } from '../types';

export type WeekMark = 'done' | 'missed' | 'open' | 'skipped' | 'future';
export type DayResult = 'done' | 'missed' | 'empty';

export function activityStreak(activities: ActivityEntry[], today: string): { days: number; doneToday: boolean } {
  const active = new Set(activities.map((entry) => entry.date));
  const doneToday = active.has(today);
  let count = 0;
  for (let cursor = doneToday ? today : addDays(today, -1), guard = 0; guard < 800 && active.has(cursor); guard += 1) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return { days: count, doneToday };
}

export function weekMarks(
  today: string,
  result: (iso: string) => DayResult,
  emptyPast: 'missed' | 'skipped' = 'missed',
  week: string = today,
): { iso: string; mark: WeekMark }[] {
  const { start, end } = weekRange(week);
  return eachDate(start, end).map((iso) => {
    if (iso > today) return { iso, mark: 'future' };
    const day = result(iso);
    if (day !== 'empty') return { iso, mark: day };
    return { iso, mark: iso === today ? 'open' : emptyPast };
  });
}

export function onTargetDay(logs: LogEntry[], iso: string, target: number): DayResult {
  const day = logs.filter((log) => log.date === iso);
  if (day.length === 0) return 'empty';
  return day.reduce((sum, log) => sum + log.kcal, 0) <= target ? 'done' : 'missed';
}

export function homeDay(logs: LogEntry[], iso: string): DayResult {
  const day = logs.filter((log) => log.date === iso);
  if (day.length === 0) return 'empty';
  return day.some((log) => log.outside) ? 'missed' : 'done';
}

export function activityDay(activities: ActivityEntry[], iso: string): DayResult {
  return activities.some((entry) => entry.date === iso) ? 'done' : 'empty';
}

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
