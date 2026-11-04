import { useMemo, useState } from 'react';
import { IconBack } from '../components/Icons';
import { Ring } from '../components/Ring';
import { TrendChart } from '../components/TrendChart';
import { StarIcon, WeekStars, weekDone } from '../components/WeekStars';
import { targetForDay } from '../lib/budget';
import { addDays, formatLong, formatRange, formatShort, todayISO, weekRange } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { activityDay, activityStreak, homeDay, homeStreak, onTargetDay, onTargetStreak, weekMarks } from '../lib/streaks';
import { useHealth } from '../state';

type SummaryViewProps = {
  onOpen: (view: 'food' | 'move' | 'body' | 'period' | 'more') => void;
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function signed(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `no change`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ${unit}`;
}

export function SummaryView({ onOpen }: SummaryViewProps) {
  const health = useHealth();
  const data = health.data;
  const today = todayISO();
  const target = targetForDay(data, today);
  const eaten = data.logs.filter((log) => log.date === today).reduce((sum, log) => sum + log.kcal, 0);

  const [week, setWeek] = useState(today);
  const shownWeek = weekRange(week);
  const thisWeek = shownWeek.start === weekRange(today).start;

  const streaks = useMemo(() => {
    const targetFor = (iso: string) => targetForDay(data, iso);
    const onTarget = onTargetStreak(data.logs, today, targetFor);
    const home = homeStreak(data.logs, today);
    const move = activityStreak(data.activities, today);
    const targetMarks = weekMarks(
      today,
      (iso) => {
        const day = onTargetDay(data.logs, iso, targetFor(iso));
        return iso === today && day === 'done' ? 'empty' : day;
      },
      'skipped',
      week,
    );
    const homeMarks = weekMarks(today, (iso) => homeDay(data.logs, iso), 'skipped', week);
    const moveMarks = weekMarks(today, (iso) => activityDay(data.activities, iso), 'missed', week);
    return { onTarget, home, move, targetMarks, homeMarks, moveMarks };
  }, [data, today, week]);

  const weights = useMemo(() => [...data.weights].sort((a, b) => (a.date < b.date ? -1 : 1)), [data.weights]);
  const latestWeight = weights[weights.length - 1];
  const monthAgo = addDays(today, -30);
  const weightBase = weights.find((entry) => entry.date >= monthAgo) ?? weights[0];
  const recentWeights = weights.filter((entry) => entry.date >= addDays(today, -90));

  const { start } = weekRange(today);
  const weekMinutes = data.activities.filter((entry) => entry.date >= start && entry.date <= today).reduce((sum, entry) => sum + entry.minutes, 0);
  const todayMinutes = data.activities.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.minutes, 0);

  const parts = useMemo(() => {
    const latest = new Map<string, { part: string; cm: number; first: number; date: string }>();
    const sorted = [...data.measures].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const entry of sorted) {
      const key = entry.part.toLocaleLowerCase();
      const seen = latest.get(key);
      latest.set(key, { part: entry.part, cm: entry.cm, first: seen?.first ?? entry.cm, date: entry.date });
    }
    return [...latest.values()].slice(0, 4);
  }, [data.measures]);

  const targetOver = streaks.onTarget.today === 'over';
  const streakCards = [
    {
      key: 'target',
      title: 'On target',
      days: streaks.onTarget.days,
      note: targetOver ? 'Over today’s target, so the count starts again tomorrow.' : 'Days in a row at or under your calorie target.',
      marks: streaks.targetMarks,
      warn: targetOver,
    },
    {
      key: 'home',
      title: 'Home meals',
      days: streaks.home.days,
      note: streaks.home.brokeToday ? 'Ate out today, so the count starts again tomorrow.' : 'Days in a row with only home food.',
      marks: streaks.homeMarks,
      warn: streaks.home.brokeToday,
    },
    {
      key: 'move',
      title: 'Activity',
      days: streaks.move.days,
      note:
        !streaks.move.doneToday && streaks.move.days > 0
          ? 'Add an activity today to keep it going.'
          : 'Days in a row with any activity.',
      marks: streaks.moveMarks,
      warn: false,
    },
  ];

  return (
    <div className="page summary-page">
      <header className="topbar">
        <div>
          <h1 className="brand-sm">Healthify</h1>
          <p className="greeting">
            {greeting(new Date().getHours())}
            {health.profileName ? `, ${health.profileName}` : ''}
          </p>
        </div>
        <p className="dateline">{formatLong(today)}</p>
      </header>
      {(health.sync === 'off' || health.sync === 'bad-key') && (
        <p className="help">
          {health.sync === 'off' ? 'This device isn’t sharing with your others yet.' : 'The sharing key stopped working.'}{' '}
          <button type="button" className="text-button" onClick={() => onOpen('more')}>
            Connect it
          </button>
        </p>
      )}

      <section className="card hero">
        <div className="hero-ring">
          <Ring eaten={eaten} target={target} />
          <div className="ring-copy">
            <strong className={eaten > target ? 'over-num' : undefined}>{formatKcal(eaten)}</strong>
            <span>of {formatKcal(target)}</span>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Calories today</p>
          <p className={eaten > target ? 'hero-left over' : 'hero-left'}>
            {eaten > target ? `${formatKcal(eaten - target)} kcal over` : `${formatKcal(target - eaten)} kcal left`}
          </p>
          <div className="composer-actions">
            <button type="button" className="primary" onClick={() => onOpen('food')}>
              Log food
            </button>
            <button type="button" className="ghost" onClick={() => onOpen('period')}>
              History
            </button>
          </div>
        </div>
      </section>

      <div className="section-head">
        <h2 className="section-title">Streaks</h2>
        <div className="week-nav">
          <button type="button" aria-label="Previous week" onClick={() => setWeek(addDays(shownWeek.start, -7))}>
            <IconBack />
          </button>
          <span>{thisWeek ? 'This week' : formatRange(shownWeek.start, shownWeek.end)}</span>
          <button type="button" aria-label="Next week" disabled={thisWeek} onClick={() => setWeek(addDays(shownWeek.start, 7))}>
            <IconBack />
          </button>
        </div>
      </div>
      <div className="streak-grid">
        {streakCards.map((card) => (
          <section key={card.key} className={card.warn ? 'card streak-card warn' : 'card streak-card'}>
            <div className="streak-head">
              <p className="eyebrow">{card.title}</p>
              <p className="streak-week">
                {weekDone(card.marks)} of 7 {thisWeek ? 'this week' : 'that week'}
              </p>
            </div>
            <p className="streak-num">
              {card.days}
              <span> {card.days === 1 ? 'day' : 'days'} in a row</span>
            </p>
            <p className="note">{card.note}</p>
            <WeekStars marks={card.marks} />
          </section>
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
        <span className="star-day skipped">
          <StarIcon mark="skipped" />
        </span>
        nothing logged
      </p>

      <h2 className="section-title">Body and activity</h2>
      <div className="summary-grid">
        <button type="button" className="card tile" onClick={() => onOpen('body')}>
          <p className="eyebrow">Weight</p>
          {latestWeight ? (
            <>
              <p className="tile-num">
                {latestWeight.kg}
                <span> kg</span>
              </p>
              <p className="note">
                {weightBase && weightBase.id !== latestWeight.id
                  ? `${signed(latestWeight.kg - weightBase.kg, 'kg')} since ${formatShort(weightBase.date)}`
                  : `Logged ${formatShort(latestWeight.date)}`}
              </p>
              {recentWeights.length > 1 && <TrendChart compact unit="kg" points={recentWeights.map((entry) => ({ iso: entry.date, value: entry.kg }))} />}
            </>
          ) : (
            <p className="note">Add your weight to see the trend.</p>
          )}
        </button>

        <button type="button" className="card tile" onClick={() => onOpen('move')}>
          <p className="eyebrow">Activity</p>
          <p className="tile-num">
            {weekMinutes}
            <span> min this week</span>
          </p>
          <p className="note">{todayMinutes > 0 ? `${plural(todayMinutes, 'minute')} today` : 'Nothing logged today yet.'}</p>
        </button>

        <button type="button" className="card tile" onClick={() => onOpen('body')}>
          <p className="eyebrow">Measurements</p>
          {parts.length === 0 ? (
            <p className="note">Add waist, hips or any measurement in cm.</p>
          ) : (
            <ul className="tile-list">
              {parts.map((part) => (
                <li key={part.part}>
                  <span>{part.part}</span>
                  <strong>{part.cm} cm</strong>
                  {part.cm !== part.first && <em>{signed(part.cm - part.first, 'cm')}</em>}
                </li>
              ))}
            </ul>
          )}
        </button>
      </div>
    </div>
  );
}