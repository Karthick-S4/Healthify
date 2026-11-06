import { useState } from 'react';
import { addDays, formatShort, formatWeekday, todayISO, weekRange } from '../lib/dates';
import { CHEAT_LIMITS, cheatDates, cheatsInWeek } from '../lib/streaks';
import { useHealth } from '../state';
import type { CheatDay, CheatKind } from '../types';
import { StarIcon } from './WeekStars';

const LABEL: Record<CheatKind, string> = { target: 'Calorie target', home: 'Home meals', move: 'Activity' };
const ON_NOTE: Record<CheatKind, string> = {
  target: 'Going over won’t break it.',
  home: 'Eating out won’t break it.',
  move: 'A rest day won’t break it.',
};

export function cheatState(entries: CheatDay[], kind: CheatKind, day: string) {
  const today = todayISO();
  const on = cheatDates(entries, kind).has(day);
  const used = cheatsInWeek(entries, kind, day);
  const limit = CHEAT_LIMITS[kind];
  const left = Math.max(0, limit - used.length);
  const full = !on && left === 0;
  const reopen = addDays(weekRange(day).start, 7);
  const usedOn = used.map(formatWeekday).join(' and ');
  const note = on
    ? ON_NOTE[kind]
    : full
      ? reopen <= today
        ? `Used ${usedOn} that week.`
        : `Used ${usedOn}. Opens again ${formatWeekday(reopen)} ${formatShort(reopen)}.`
      : `${left} of ${limit} left this week`;
  return { on, limit, left, full, note };
}

function CheatRow({ kind, day }: { kind: CheatKind; day: string }) {
  const health = useHealth();
  const state = cheatState(health.data.cheatDays, kind, day);
  const label = `${LABEL[kind]} cheat ${day === todayISO() ? 'today' : 'yesterday'}`;

  return (
    <li className={state.on ? 'on' : state.full ? 'full' : undefined}>
      <span className="cheat-copy">
        <strong>{LABEL[kind]}</strong>
        <small>{state.note}</small>
      </span>
      <button type="button" role="switch" className="switch" aria-checked={state.on} aria-label={label} disabled={state.full} onClick={() => health.setCheatDay(day, kind, !state.on)}>
        <span />
      </button>
    </li>
  );
}

export function CheatCard({ kinds }: { kinds: CheatKind[] }) {
  const health = useHealth();
  const today = todayISO();
  const [day, setDay] = useState(today);
  const anyOn = kinds.some((kind) => cheatDates(health.data.cheatDays, kind).has(day));

  return (
    <section className={anyOn ? 'cheat-card on' : 'cheat-card'}>
      <div className="cheat-head">
        <span className="cheat-icon">
          <StarIcon mark="cheat" />
        </span>
        <strong>{kinds.length > 1 ? 'Cheat days' : 'Cheat day'}</strong>
        <div className="cheat-when" role="radiogroup" aria-label="Cheat day for">
          {[today, addDays(today, -1)].map((iso) => (
            <button key={iso} type="button" role="radio" aria-checked={day === iso} onClick={() => setDay(iso)}>
              {iso === today ? 'Today' : 'Yesterday'}
            </button>
          ))}
        </div>
      </div>
      <ul className="cheat-rows">
        {kinds.map((kind) => (
          <CheatRow key={kind} kind={kind} day={day} />
        ))}
      </ul>
    </section>
  );
}
