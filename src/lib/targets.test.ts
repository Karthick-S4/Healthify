import { describe, expect, it } from 'vitest';
import { buildReports, rangeBudget, targetForDay } from './budget';
import { FIRST_DAY, freshData, normalizeData } from './storage';
import type { AppData } from '../types';

function withPlans(): AppData {
  const data = freshData();
  data.profile.plans = [
    { from: FIRST_DAY, daily: 1800, week: null, month: null },
    { from: '2026-11-04', daily: 1500, week: null, month: null },
  ];
  return data;
}

describe('target history', () => {
  it('keeps earlier days on the old target and uses the new one from its start', () => {
    const data = withPlans();
    expect(targetForDay(data, '2026-11-03')).toBe(1800);
    expect(targetForDay(data, '2026-11-04')).toBe(1500);
    expect(targetForDay(data, '2026-12-01')).toBe(1500);
  });

  it('builds a week from the targets each day had', () => {
    const reports = buildReports(withPlans(), '2026-11-04', '2026-11-04');
    expect(reports.week.budget).toBe(2 * 1800 + 5 * 1500);
  });

  it('splits a weekly total across days so a mid-week change only moves the rest of the week', () => {
    const data = freshData();
    data.profile.plans = [
      { from: FIRST_DAY, daily: 1800, week: 14000, month: null },
      { from: '2026-11-04', daily: 1800, week: 10500, month: null },
    ];
    expect(buildReports(data, '2026-11-04', '2026-11-04').week.budget).toBe(2 * 2000 + 5 * 1500);
    expect(buildReports(data, '2026-11-04', '2026-10-28').week.budget).toBe(14000);
  });
});

describe('custom ranges', () => {
  it('replaces the regular daily target inside the range only', () => {
    const data = withPlans();
    data.profile.ranges = [{ id: 'r', start: '2026-11-10', end: '2026-11-12', daily: 1300, week: null }];
    expect(targetForDay(data, '2026-11-09')).toBe(1500);
    expect(targetForDay(data, '2026-11-11')).toBe(1300);
    expect(targetForDay(data, '2026-11-13')).toBe(1500);
  });

  it('works out a daily goal and a total from a weekly target alone', () => {
    const data = freshData();
    const range = { id: 'r', start: '2026-11-09', end: '2026-11-22', daily: null, week: 9800 };
    data.profile.ranges = [range];
    expect(targetForDay(data, '2026-11-10')).toBe(1400);
    expect(rangeBudget(range)).toBe(19600);
    const reports = buildReports(data, '2026-11-10', '2026-11-10', 'r');
    expect(reports.custom.budget).toBe(19600);
    expect(reports.week.budget).toBe(9800);
  });
});

describe('older saved data', () => {
  it('turns saved day targets into target history', () => {
    const data = normalizeData({
      profile: { dailyTarget: 1500, goalSet: true, weekBudget: null, monthBudget: null },
      dayTargets: { '2026-10-01': 1800, '2026-10-02': 1800, '2026-10-20': 1500 },
    });
    expect(targetForDay(data, '2026-10-10')).toBe(1800);
    expect(targetForDay(data, '2026-10-21')).toBe(1500);
  });

  it('turns an old custom total into a daily target for that range', () => {
    const data = normalizeData({
      profile: { dailyTarget: 1800, goalSet: true, custom: { start: '2026-11-01', end: '2026-11-10', budget: 14000 } },
    });
    expect(data.profile.ranges).toEqual([{ id: 'range-legacy', start: '2026-11-01', end: '2026-11-10', daily: 1400, week: null }]);
  });
});
