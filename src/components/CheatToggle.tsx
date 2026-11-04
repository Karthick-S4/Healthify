import { addDays, formatShort, formatWeekday, todayISO, weekRange } from '../lib/dates';
import { cheatInWeek } from '../lib/streaks';
import { useHealth } from '../state';
import { StarIcon } from './WeekStars';

export function CheatToggle() {
  const health = useHealth();
  const today = todayISO();
  const entries = health.data.cheatDays;
  const on = entries.some((entry) => entry.date === today);
  const used = on ? null : cheatInWeek(entries, today);
  const nextWeek = addDays(weekRange(today).start, 7);

  return (
    <div className={on ? 'cheat-toggle on' : used ? 'cheat-toggle used' : 'cheat-toggle'}>
      <span className="cheat-icon">
        <StarIcon mark="cheat" />
      </span>
      <span className="cheat-copy">
        <strong>{on ? 'Cheat day today' : 'Cheat day'}</strong>
        <small>
          {on
            ? 'Eat out, skip the workout, go over. Your streaks stay safe today.'
            : used
              ? `Used on ${formatWeekday(used)} ${formatShort(used)}. The next one opens ${formatWeekday(nextWeek)} ${formatShort(nextWeek)}.`
              : 'One a week. Streaks stay safe that day.'}
        </small>
      </span>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={on}
        aria-label="Cheat day today"
        disabled={Boolean(used)}
        onClick={() => health.setCheatDay(today, !on)}
      >
        <span />
      </button>
    </div>
  );
}
