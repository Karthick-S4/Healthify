import { describe, expect, it } from 'vitest';
import { freshData } from './storage';
import { buildReports, tightestRoom } from './budget';
import { onTargetStreak, homeStreak } from './streaks';
import { MEAL_TEMPLATES, mixedIdeas, suggestMeals } from './suggestions';
import { BUILT_IN_FOODS } from '../data/foods';
import { parseFoodList } from './parseFood';
import { parseISO, weekRange } from './dates';
import type { LogEntry } from '../types';

function log(partial: Partial<LogEntry> & Pick<LogEntry, 'date' | 'kcal'>): LogEntry {
  return {
    id: partial.id ?? partial.date + partial.kcal,
    title: partial.title ?? 'Meal',
    grams: partial.grams ?? 100,
    outside: partial.outside ?? false,
    createdAt: partial.createdAt ?? '2026-11-04T00:00:00.000Z',
    foodId: partial.foodId,
    date: partial.date,
    kcal: partial.kcal,
  };
}

describe('dates', () => {
  it('starts a week on Monday', () => {
    const range = weekRange('2026-11-04');
    expect(parseISO(range.start).getDay()).toBe(1);
    expect(parseISO(range.end).getDay()).toBe(0);
    expect(range.start <= '2026-11-04' && range.end >= '2026-11-04').toBe(true);
  });
});

describe('streaks', () => {
  const target = () => 1800;

  it('counts finished days at or under target and stops on a gap', () => {
    const logs = [log({ date: '2026-11-01', kcal: 1800 }), log({ date: '2026-11-02', kcal: 1700 }), log({ date: '2026-11-03', kcal: 1600 })];
    expect(onTargetStreak(logs, '2026-11-04', target)).toMatchObject({ days: 3, today: 'empty' });
  });

  it('loses the streak immediately when today is over, and restores the count in ended', () => {
    const logs = [log({ date: '2026-11-03', kcal: 1500 }), log({ date: '2026-11-04', kcal: 1900 })];
    expect(onTargetStreak(logs, '2026-11-04', target)).toMatchObject({ days: 0, ended: 1, today: 'over' });
  });

  it('breaks the run when a previous day was missed or over', () => {
    const logs = [log({ date: '2026-11-01', kcal: 1500 }), log({ date: '2026-11-03', kcal: 1500 })];
    expect(onTargetStreak(logs, '2026-11-04', target).days).toBe(1);
    const over = [log({ date: '2026-11-02', kcal: 2000 }), log({ date: '2026-11-03', kcal: 1500 })];
    expect(onTargetStreak(over, '2026-11-04', target).days).toBe(1);
  });

  it('resets the home streak on outside food and skips empty days', () => {
    const logs = [
      log({ date: '2026-11-01', kcal: 500 }),
      log({ date: '2026-11-03', kcal: 500, outside: true }),
      log({ date: '2026-11-04', kcal: 400 }),
    ];
    expect(homeStreak(logs, '2026-11-04')).toEqual({ days: 1, brokeToday: false });
    expect(homeStreak([...logs, log({ date: '2026-11-04', kcal: 100, outside: true })], '2026-11-04')).toEqual({
      days: 0,
      brokeToday: true,
    });
  });
});

describe('budgets', () => {
  it('uses the tighter period when the week has less room than today', () => {
    const data = freshData();
    data.profile.dailyTarget = 1800;
    data.profile.weekBudget = 2000;
    data.dayTargets['2026-11-04'] = 1800;
    data.logs = [log({ date: '2026-11-02', kcal: 1400 }), log({ date: '2026-11-04', kcal: 400 })];
    const reports = buildReports(data, '2026-11-04', '2026-11-04');
    expect(reports.day.room).toBe(1400);
    expect(reports.week.remaining).toBe(200);
    expect(tightestRoom(data, '2026-11-04').kind).toBe('week');
    expect(tightestRoom(data, '2026-11-04').room).toBeLessThanOrEqual(200);
  });
});

describe('suggestions', () => {
  it('parses every built-in meal', () => {
    for (const meal of MEAL_TEMPLATES) {
      const parsed = parseFoodList(meal.query, BUILT_IN_FOODS);
      const foods = parsed.items.filter((item) => item.kind === 'food');
      expect(foods, meal.query).toHaveLength(parsed.items.length);
      expect(foods.length).toBeGreaterThan(0);
    }
  });

  it('waits until a food is logged twice before calling it usual', () => {
    const ideas = suggestMeals({
      foods: BUILT_IN_FOODS,
      logs: [log({ date: '2026-11-04', kcal: 175, foodId: 'idli' })],
      today: '2026-11-04',
      room: 1000,
      hour: 12,
      light: false,
    });
    expect(ideas.some((idea) => idea.kind === 'usual')).toBe(false);
  });

  it('knows the protein of every built-in food', () => {
    expect(BUILT_IN_FOODS.filter((food) => food.proteinPer100g == null).map((food) => food.id)).toEqual([]);
  });

  it('offers protein-rich ideas and plenty of choice', () => {
    const ideas = suggestMeals({
      foods: BUILT_IN_FOODS,
      logs: [],
      today: '2026-11-04',
      room: 900,
      hour: 13,
      light: false,
    });
    const protein = ideas.filter((idea) => idea.kind === 'protein');
    expect(protein.length).toBeGreaterThanOrEqual(3);
    expect(protein.every((idea) => (idea.protein ?? 0) >= 12)).toBe(true);
    expect(ideas.some((idea) => idea.kind === 'fill')).toBe(true);
    expect(ideas.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ideas.map((idea) => idea.query)).size).toBe(ideas.length);
    expect(ideas.every((idea) => idea.kcal <= 900)).toBe(true);
  });

  it('mixes kinds for the Today card', () => {
    const ideas = suggestMeals({
      foods: BUILT_IN_FOODS,
      logs: [],
      today: '2026-11-04',
      room: 900,
      hour: 13,
      light: false,
    });
    expect(new Set(mixedIdeas(ideas, 3).map((idea) => idea.kind)).size).toBe(3);
    const evening = suggestMeals({ foods: BUILT_IN_FOODS, logs: [], today: '2026-11-04', room: 1200, hour: 16, light: false });
    expect(evening.some((idea) => idea.kind === 'fill')).toBe(true);
  });

  it('only suggests meals that fit the calories left', () => {
    const ideas = suggestMeals({
      foods: BUILT_IN_FOODS,
      logs: [],
      today: '2026-11-04',
      room: 400,
      hour: 8,
      light: false,
    });
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((idea) => idea.kcal <= 400)).toBe(true);
    expect(ideas.some((idea) => idea.title === 'Idli and sambar')).toBe(true);
  });
});
