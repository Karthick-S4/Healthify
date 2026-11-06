import type { AppData } from '../types';
import { addDays, formatShort, weekRange } from './dates';

export type Win = { id: string; title: string; detail: string };

function byDate<T extends { date: string; createdAt: string }>(a: T, b: T): number {
  return a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1;
}

function amount(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function findWins(data: Pick<AppData, 'weights' | 'measures' | 'activities'>, today: string): Win[] {
  const wins: Win[] = [];

  const weights = [...data.weights].sort(byDate);
  const latest = weights[weights.length - 1];
  const before = weights[weights.length - 2];
  if (latest && before && latest.date === today && before.kg - latest.kg >= 0.05) {
    wins.push({ id: `weight-${latest.id}`, title: `Weight down ${amount(before.kg - latest.kg)} kg`, detail: `since ${formatShort(before.date)}` });
  }

  const parts = new Map<string, AppData['measures']>();
  for (const entry of [...data.measures].sort(byDate)) {
    const key = entry.part.toLocaleLowerCase();
    parts.set(key, [...(parts.get(key) ?? []), entry]);
  }
  for (const entries of parts.values()) {
    const last = entries[entries.length - 1];
    const prev = entries[entries.length - 2];
    if (last && prev && last.date === today && prev.cm - last.cm >= 0.05) {
      wins.push({ id: `measure-${last.id}`, title: `${last.part} down ${amount(prev.cm - last.cm)} cm`, detail: `since ${formatShort(prev.date)}` });
    }
  }

  const { start } = weekRange(today);
  const lastStart = addDays(start, -7);
  const minutes = (from: string, to: string) => data.activities.filter((entry) => entry.date >= from && entry.date <= to).reduce((sum, entry) => sum + entry.minutes, 0);
  const thisWeek = minutes(start, today);
  const lastWeek = minutes(lastStart, addDays(start, -1));
  const beforeToday = minutes(start, addDays(today, -1));
  if (thisWeek > lastWeek && beforeToday <= lastWeek) {
    wins.push({
      id: `activity-${start}`,
      title: 'More active than last week',
      detail: lastWeek > 0 ? `${thisWeek} min so far, last week ${lastWeek} min` : `${thisWeek} min so far this week`,
    });
  }

  return wins;
}
