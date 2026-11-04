import type { AppData, PeriodKind } from '../types';
import { eachDate, monthRange, weekRange } from './dates';
import type { LogEntry } from '../types';

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

export function targetForDay(data: AppData, iso: string): number {
  return data.dayTargets[iso] ?? data.profile.dailyTarget;
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

export function buildReports(data: AppData, today: string, anchor: string): Record<PeriodKind, RoomReport> {
  const eatenToday = sumBetween(data.logs, today, today);
  const dailyTarget = targetForDay(data, today);
  const shared = { today, logs: data.logs, dailyTarget, eatenToday };
  const week = weekRange(anchor);
  const month = monthRange(anchor);
  const custom = data.profile.custom && data.profile.custom.end >= data.profile.custom.start ? data.profile.custom : null;
  const sumTargets = (start: string, end: string) =>
    eachDate(start, end).reduce((sum, iso) => sum + targetForDay(data, iso), 0);

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
      budget: data.profile.weekBudget ?? sumTargets(week.start, week.end),
    }),
    month: reportForRange({
      ...shared,
      kind: 'month',
      label: 'Month',
      start: month.start,
      end: month.end,
      budget: data.profile.monthBudget ?? sumTargets(month.start, month.end),
    }),
    custom: reportForRange({
      ...shared,
      kind: 'custom',
      label: 'Custom',
      start: custom?.start ?? today,
      end: custom?.end ?? today,
      budget: custom?.budget ?? dailyTarget,
    }),
  };
}

export function tightestRoom(data: AppData, today: string): RoomReport {
  const reports = buildReports(data, today, today);
  const list = [reports.day, reports.week, reports.month];
  if (data.profile.custom) list.push(reports.custom);
  const active = list.filter((report) => report.status === 'during');
  const pool = active.length > 0 ? active : list;
  return pool.reduce((tight, report) => (report.room < tight.room ? report : tight));
}
