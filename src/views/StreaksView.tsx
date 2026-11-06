import { useMemo, useState } from 'react';
import { IconBack } from '../components/Icons';
import { StarIcon, WeekStars, weekDone } from '../components/WeekStars';
import { targetForDay } from '../lib/budget';
import { addDays, formatRange, todayISO, weekRange } from '../lib/dates';
import {
  activityDay,
  activityStreak,
  cheatDates,
  withCheat,
  homeDay,
  homeStreak,
  onTargetDay,
  onTargetStreak,
  weekMarks,
  type DayResult,
  type WeekMark,
} from '../lib/streaks';
import { useHealth } from '../state';

export type StreakInfo = {
  id: 'target' | 'home' | 'move';
  title: string;
  days: number;
  cheat: boolean;
  note: string;
  warn: boolean;
  result: (iso: string) => DayResult;
};

export function useStreaks(): StreakInfo[] {
  const { data } = useHealth();
  const today = todayISO();
  return useMemo(() => {
    const cheat = { target: cheatDates(data.cheatDays, 'target'), home: cheatDates(data.cheatDays, 'home'), move: cheatDates(data.cheatDays, 'move') };
    const onTarget = onTargetStreak(data.logs, today, (iso) => targetForDay(data, iso), cheat.target);
    const home = homeStreak(data.logs, today, cheat.home);
    const move = activityStreak(data.activities, today, cheat.move);
    const targetOver = onTarget.today === 'over';
    return [
      {
        id: 'target',
        title: 'Calorie target',
        days: onTarget.days,
        cheat: cheat.target.has(today),
        note: cheat.target.has(today)
          ? 'Cheat day today. The streak is safe.'
          : targetOver
            ? 'Over today’s target, so the count starts again tomorrow.'
            : 'Days in a row at or under your calorie target.',
        warn: targetOver,
        result: withCheat(cheat.target, (iso) => {
          const day = onTargetDay(data.logs, iso, targetForDay(data, iso));
          return iso === today && day === 'done' ? 'empty' : day;
        }),
      },
      {
        id: 'home',
        title: 'Home meals',
        days: home.days,
        cheat: cheat.home.has(today),
        note: cheat.home.has(today)
          ? 'Cheat day today. Eating out won’t break it.'
          : home.brokeToday
            ? 'Ate out today, so the count starts again tomorrow.'
            : 'Days in a row with only home food.',
        warn: home.brokeToday,
        result: withCheat(cheat.home, (iso) => {
          const day = homeDay(data.logs, iso);
          return iso === today && day === 'done' ? 'empty' : day;
        }),
      },
      {
        id: 'move',
        title: 'Activity',
        days: move.days,
        cheat: cheat.move.has(today),
        note: cheat.move.has(today)
          ? 'Cheat day today. A rest day won’t break it.'
          : !move.doneToday && move.days > 0
            ? 'Add an activity today to keep it going.'
            : 'Days in a row with any activity.',
        warn: false,
        result: withCheat(cheat.move, (iso) => activityDay(data.activities, iso)),
      },
    ];
  }, [data, today]);
}

function longestRun(marks: { mark: WeekMark }[]): number {
  let best = 0;
  let run = 0;
  for (const { mark } of marks) {
    if (mark === 'cheat') continue;
    run = mark === 'done' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function StreakCard({ title, days, note, warn, result }: StreakInfo) {
  const today = todayISO();
  const [week, setWeek] = useState(today);
  const shown = weekRange(week);
  const thisWeek = shown.start === weekRange(today).start;
  const marks = weekMarks(today, result, 'skipped', week);
  const count = thisWeek ? days : longestRun(marks);

  return (
    <section className={thisWeek && warn ? 'card streak-card warn' : 'card streak-card'}>
      <div className="streak-head">
        <p className="eyebrow">{title}</p>
        <div className="week-nav">
          <button type="button" aria-label={`${title}, previous week`} onClick={() => setWeek(addDays(shown.start, -7))}>
            <IconBack />
          </button>
          <span>{thisWeek ? 'This week' : formatRange(shown.start, shown.end)}</span>
          <button type="button" aria-label={`${title}, next week`} disabled={thisWeek} onClick={() => setWeek(addDays(shown.start, 7))}>
            <IconBack />
          </button>
        </div>
      </div>
      <p className="streak-num">
        {count}
        <span> {count === 1 ? 'day' : 'days'} in a row</span>
      </p>
      <p className="note">{thisWeek ? note : `Longest run that week. ${weekDone(marks)} of 7 days done.`}</p>
      <WeekStars marks={marks} />
      {thisWeek && <p className="streak-week">{weekDone(marks)} of 7 this week</p>}
    </section>
  );
}

export function StreaksView() {
  const streaks = useStreaks();
  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand-sm">Streaks</h1>
      </header>
      <div className="streak-grid">
        {streaks.map((streak) => (
          <StreakCard key={streak.id} {...streak} />
        ))}
      </div>
      <p className="star-legend">
        <span className="star-day done">
          <StarIcon />
        </span>
        done
        <span className="star-day open">
          <StarIcon />
        </span>
        today, not yet
        <span className="star-day missed">
          <StarIcon mark="missed" />
        </span>
        missed
        <span className="star-day cheat">
          <StarIcon mark="cheat" />
        </span>
        cheat day
        <span className="star-day skipped">
          <StarIcon mark="skipped" />
        </span>
        nothing logged
      </p>
    </div>
  );
}
