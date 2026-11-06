import { describe, expect, it } from 'vitest';
import { MOVE_LISTS, pickGirl } from '../components/girl/moves';
import { findWins } from './wins';

const at = '2026-01-01T08:00:00.000Z';

describe('findWins', () => {
  it('cheers a lower weight, a smaller measurement and a more active week', () => {
    const wins = findWins(
      {
        weights: [
          { id: 'w1', date: '2026-11-01', kg: 70.4, createdAt: at },
          { id: 'w2', date: '2026-11-06', kg: 69.8, createdAt: at },
        ],
        measures: [
          { id: 'm1', date: '2026-10-20', part: 'Waist', cm: 82, createdAt: at },
          { id: 'm2', date: '2026-11-06', part: 'Waist', cm: 80.5, createdAt: at },
          { id: 'm3', date: '2026-10-20', part: 'Hips', cm: 98, createdAt: at },
          { id: 'm4', date: '2026-11-06', part: 'Hips', cm: 99, createdAt: at },
        ],
        activities: [
          { id: 'a1', date: '2026-10-28', name: 'Walking', minutes: 30, createdAt: at },
          { id: 'a2', date: '2026-11-03', name: 'Running', minutes: 20, createdAt: at },
          { id: 'a3', date: '2026-11-06', name: 'Walking', minutes: 25, createdAt: at },
        ],
      },
      '2026-11-06',
    );

    expect(wins.map((win) => win.title)).toEqual(['Weight down 0.6 kg', 'Waist down 1.5 cm', 'More active than last week']);
  });

  it('only cheers on the day the win happened', () => {
    const data = {
      weights: [
        { id: 'w1', date: '2026-11-01', kg: 70.4, createdAt: at },
        { id: 'w2', date: '2026-11-05', kg: 69.8, createdAt: at },
      ],
      measures: [],
      activities: [
        { id: 'a1', date: '2026-10-28', name: 'Walking', minutes: 30, createdAt: at },
        { id: 'a2', date: '2026-11-04', name: 'Running', minutes: 40, createdAt: at },
        { id: 'a3', date: '2026-11-06', name: 'Walking', minutes: 25, createdAt: at },
      ],
    };

    expect(findWins(data, '2026-11-05').map((win) => win.title)).toEqual(['Weight down 0.6 kg']);
    expect(findWins(data, '2026-11-06')).toEqual([]);
  });

  it('stays quiet when nothing improved recently', () => {
    const wins = findWins(
      {
        weights: [
          { id: 'w1', date: '2026-10-01', kg: 71, createdAt: at },
          { id: 'w2', date: '2026-10-10', kg: 70, createdAt: at },
        ],
        measures: [],
        activities: [{ id: 'a1', date: '2026-10-28', name: 'Walking', minutes: 90, createdAt: at }],
      },
      '2026-11-06',
    );

    expect(wins).toEqual([]);
  });
});

describe('pickGirl', () => {
  it('has 50 distinct animations in every set', () => {
    for (const lists of Object.values(MOVE_LISTS)) {
      for (const list of [lists.happy, lists.sad]) {
        expect(list).toHaveLength(50);
        expect(new Set(list.map((move) => move.name)).size).toBe(50);
      }
    }
  });

  it('gives the two meal streaks different moves and walks through all 50 over 50 days', () => {
    const seen = new Set<number>();
    for (let day = 0; day < 50; day += 1) {
      const date = new Date(2026, 10, 1 + day);
      for (const mood of ['happy', 'sad'] as const) {
        expect(pickGirl('meal', mood, 0, date).index).not.toBe(pickGirl('meal', mood, 1, date).index);
      }
      const today = pickGirl('exercise', 'happy', 2, date);
      seen.add(today.index);
      expect(today.index).not.toBe(pickGirl('exercise', 'happy', 2, new Date(2026, 10, 2 + day)).index);
    }
    expect(seen.size).toBe(50);
  });
});
