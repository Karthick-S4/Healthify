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
          <path className="slice" d="M4.6 8.4C9.4 6.4 14.6 6.4 19.4 8.4L12 21.4Z" />
          <path className="crust" d="M3.8 7.4C9 4.9 15 4.9 20.2 7.4" />
          <circle className="topping" cx="10" cy="11.4" r="1.6" />
          <circle className="topping" cx="14.4" cy="12" r="1.35" />
          <circle className="topping" cx="12" cy="16.2" r="1.25" />
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
