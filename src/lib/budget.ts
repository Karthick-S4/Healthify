import type { AppData, CustomRange, LogEntry, PeriodKind, TargetPlan } from '../types';
import { eachDate, monthRange, weekRange } from './dates';

export type RangeStatus = 'before' | 'during' | 'after';

export type RoomReport = {
  kind: PeriodKind;
  label: string;
  start: string;
  end: string;
  budget: number;
  eaten: number;
  remaining: number;
  daysLeft: number;
  eatenToday: number;
  dailyTarget: number;
  dailyRoom: number;
  periodShare: number;
  room: number;
  over: boolean;
  limiter: 'day' | 'period';
  status: RangeStatus;
};

type CalorieLog = Pick<LogEntry, 'date' | 'kcal'>;

export function sumBetween(logs: CalorieLog[], start: string, end: string): number {
  return logs.reduce((sum, log) => (log.date >= start && log.date <= end ? sum + log.kcal : sum), 0);
}

export function planOn(data: AppData, iso: string): TargetPlan {
  const plans = data.profile.plans;
  let found: TargetPlan | undefined;
  for (const plan of plans) {
    if (plan.from <= iso) found = plan;
  }
  return found ?? plans[0] ?? { from: iso, daily: data.profile.dailyTarget, week: data.profile.weekBudget, month: data.profile.monthBudget };
}

export function rangeOn(data: AppData, iso: string): CustomRange | null {
  return data.profile.ranges.find((range) => range.start <= iso && iso <= range.end) ?? null;
}

function rangeDaily(range: CustomRange): number {
  return range.daily ?? Math.round((range.week ?? 0) / 7);
}

function rangeShare(range: CustomRange): number {
  return range.week != null ? range.week / 7 : rangeDaily(range);
}

export function targetForDay(data: AppData, iso: string): number {
  const range = rangeOn(data, iso);
  return range ? rangeDaily(range) : planOn(data, iso).daily;
}

function weekShare(data: AppData, iso: string): number {
  const range = rangeOn(data, iso);
  if (range) return rangeShare(range);
  const plan = planOn(data, iso);
  return plan.week != null ? plan.week / 7 : plan.daily;
}

function monthShare(data: AppData, iso: string): number {
  const range = rangeOn(data, iso);
  if (range) return rangeShare(range);
  const plan = planOn(data, iso);
  if (plan.month == null) return plan.daily;
  const { start, end } = monthRange(iso);
  return plan.month / eachDate(start, end).length;
}

export function rangeBudget(range: CustomRange): number {
  return Math.round(rangeShare(range) * eachDate(range.start, range.end).length);
}

export function pickRange(data: AppData, today: string, id?: string | null): CustomRange | null {
  const ranges = data.profile.ranges;
  return (
    ranges.find((range) => range.id === id) ??
    rangeOn(data, today) ??
    ranges.find((range) => range.start > today) ??
    ranges[ranges.length - 1] ??
    null
  );
}

export function reportForRange(args: {
  kind: PeriodKind;
  label: string;
  start: string;
  end: string;
  today: string;
  budget: number;
  logs: CalorieLog[];
  dailyTarget: number;
  eatenToday: number;
}): RoomReport {
  const eaten = sumBetween(args.logs, args.start, args.end);
  const remaining = args.budget - eaten;
  const status: RangeStatus = args.today < args.start ? 'before' : args.today > args.end ? 'after' : 'during';
  const daysLeft = status === 'during' ? eachDate(args.today, args.end).length : 0;
  const periodShare = daysLeft > 0 ? remaining / daysLeft : 0;
  const dailyRoom = Math.max(0, args.dailyTarget - args.eatenToday);
  const room = status === 'during' ? Math.max(0, Math.min(dailyRoom, periodShare)) : 0;
  return {
    kind: args.kind,
    label: args.label,
    start: args.start,
    end: args.end,
    budget: args.budget,
    eaten,
    remaining,
    daysLeft,
    eatenToday: args.eatenToday,
    dailyTarget: args.dailyTarget,
    dailyRoom,
    periodShare,
    room,
    over: remaining < 0,
    limiter: periodShare < dailyRoom ? 'period' : 'day',
    status,
  };
}

export function buildReports(data: AppData, today: string, anchor: string, rangeId?: string | null): Record<PeriodKind, RoomReport> {
  const eatenToday = sumBetween(data.logs, today, today);
  const dailyTarget = targetForDay(data, today);
  const shared = { today, logs: data.logs, dailyTarget, eatenToday };
  const week = weekRange(anchor);
  const month = monthRange(anchor);
  const custom = pickRange(data, today, rangeId);
  const sumShares = (start: string, end: string, share: (data: AppData, iso: string) => number) =>
    Math.round(eachDate(start, end).reduce((sum, iso) => sum + share(data, iso), 0));

  return {
    day: reportForRange({
      ...shared,
      kind: 'day',
      label: 'Today',
      start: today,
      end: today,
      budget: dailyTarget,
    }),
    week: reportForRange({
      ...shared,
      kind: 'week',
      label: 'Week',
      start: week.start,
      end: week.end,
      budget: sumShares(week.start, week.end, weekShare),
    }),
    month: reportForRange({
      ...shared,
      kind: 'month',
      label: 'Month',
      start: month.start,
      end: month.end,
      budget: sumShares(month.start, month.end, monthShare),
    }),
    custom: reportForRange({
      ...shared,
      kind: 'custom',
      label: 'Custom',
      start: custom?.start ?? today,
      end: custom?.end ?? today,
      budget: custom ? rangeBudget(custom) : dailyTarget,
    }),
  };
}

export function tightestRoom(data: AppData, today: string): RoomReport {
  const reports = buildReports(data, today, today);
  const list = [reports.day, reports.week, reports.month];
  if (rangeOn(data, today)) list.push(reports.custom);
  const active = list.filter((report) => report.status === 'during');
  const pool = active.length > 0 ? active : list;
  return pool.reduce((tight, report) => (report.room < tight.room ? report : tight));
}
