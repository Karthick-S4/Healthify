import { formatWeekday } from '../lib/dates';
import type { WeekMark } from '../lib/streaks';

const LABEL: Record<WeekMark, string> = {
  done: 'done',
  missed: 'missed',
  open: 'not yet',
  skipped: 'nothing logged',
  future: 'coming up',
  cheat: 'cheat day',
};

export function StarIcon({ mark = 'done' }: { mark?: WeekMark }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {mark === 'missed' ? (
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
      ) : mark === 'cheat' ? (
        <>
          <path className="bun" d="M4 11C4 6.6 7.6 4.2 12 4.2S20 6.6 20 11Z" />
          <ellipse className="seed" cx="9" cy="7.4" rx="0.8" ry="0.5" />
          <ellipse className="seed" cx="12.6" cy="6.4" rx="0.8" ry="0.5" />
          <ellipse className="seed" cx="15.2" cy="8.2" rx="0.8" ry="0.5" />
          <path className="lettuce" d="M3.4 12.6c1.4 1.3 2.8 1.3 4.2 0s2.8-1.3 4.2 0 2.8 1.3 4.2 0 2.8-1.3 4.2 0" />
          <rect className="patty" x="3.6" y="14.2" width="16.8" height="2.8" rx="1.4" />
          <path className="bun" d="M4.2 18h15.6c0 1.5-1.2 2.4-2.6 2.4H6.8c-1.4 0-2.6-.9-2.6-2.4z" />
        </>
      ) : mark === 'skipped' ? (
        <circle cx="12" cy="12" r="2.2" />
      ) : (
        <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
      )}
    </svg>
  );
}

export function WeekStars({ marks }: { marks: { iso: string; mark: WeekMark }[] }) {
  return (
    <ol className="week-stars">
      {marks.map(({ iso, mark }) => (
        <li key={iso} className={`star-day ${mark}`} aria-label={`${formatWeekday(iso)}, ${LABEL[mark]}`}>
          <StarIcon mark={mark} />
          <span>{formatWeekday(iso).slice(0, 1)}</span>
        </li>
      ))}
    </ol>
  );
}

export function weekDone(marks: { mark: WeekMark }[]): number {
  return marks.filter((item) => item.mark === 'done').length;
}
