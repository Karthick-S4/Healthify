import { useId } from 'react';
import { useStreaks } from '../views/StreaksView';

function dayWord(count: number): string {
  return count === 1 ? 'day' : 'days';
}

function Fire({ lit }: { lit: boolean }) {
  const id = `fire${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg className="sr-fire-svg" viewBox="0 0 64 76" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd34e" />
          <stop offset="0.5" stopColor="#ff8a2b" />
          <stop offset="1" stopColor="#e2401f" />
        </linearGradient>
      </defs>
      <path
        className="sr-fire-outer"
        style={lit ? { fill: `url(#${id}-outer)` } : undefined}
        d="M30 2c4 13 14 18 19 29 2-4 2-8 1-12 8 8 11 21 8 33-3 11-13 20-26 20S6 63 5 50C4 40 9 31 15 25c0 5 1 9 4 12 0-14 4-25 11-35z"
      />
      <path className="sr-fire-inner" d="M31 33c2 9 12 14 12 24 0 7-5 12-12 12s-12-5-12-11c0-7 5-11 7-16 1 3 2 5 3 6 1-5 2-10 2-15z" />
    </svg>
  );
}

export function StreakSummary({ onOpen }: { onOpen: () => void }) {
  const streaks = useStreaks();
  const label = `Streaks: ${streaks.map((streak) => `${streak.title} ${streak.days} ${dayWord(streak.days)}`).join(', ')}. Open details`;

  return (
    <button type="button" className="card streak-board" onClick={onOpen} aria-label={label}>
      <span className="eyebrow">Streaks</span>
      <span className="sr-fires">
        {streaks.map((streak) => {
          const lit = streak.days > 0 && !streak.warn;
          return (
            <span key={streak.id} className={lit ? 'sr-fire-item lit' : 'sr-fire-item'}>
              <span className="sr-fire">
                <Fire lit={lit} />
                <b>{streak.days}</b>
              </span>
              <span className="sr-fire-days">{dayWord(streak.days)}</span>
              <strong>{streak.title}</strong>
            </span>
          );
        })}
      </span>
    </button>
  );
}
