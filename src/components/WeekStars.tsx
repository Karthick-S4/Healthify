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
          <path d="M11 3.5l1.9 5.4 5.4 1.9-5.4 1.9L11 18.1l-1.9-5.4-5.4-1.9 5.4-1.9z" />
          <path className="spark" d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
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
