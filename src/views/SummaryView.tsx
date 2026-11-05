import { useMemo } from 'react';
import { CheatToggle } from '../components/CheatToggle';
import { HeartMark } from '../components/Icons';
import { BAND_NUM, Ring, ringBand } from '../components/Ring';
import { StreakSummary } from '../components/StreakSummary';
import { TrendChart } from '../components/TrendChart';
import { targetForDay } from '../lib/budget';
import { addDays, formatLong, formatShort, todayISO, weekRange } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { measureRank } from '../lib/measures';
import { cheatDates } from '../lib/streaks';
import { useHealth } from '../state';

type SummaryViewProps = {
  onOpen: (view: 'food' | 'move' | 'body' | 'period' | 'more' | 'streaks') => void;
  onLogFood: () => void;
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

export function SummaryView({ onOpen, onLogFood }: SummaryViewProps) {
  const health = useHealth();
  const data = health.data;
  const today = todayISO();
  const target = targetForDay(data, today);
  const eaten = data.logs.filter((log) => log.date === today).reduce((sum, log) => sum + log.kcal, 0);

  const cheatToday = useMemo(() => cheatDates(data.cheatDays), [data.cheatDays]).has(today);

  const weights = useMemo(() => [...data.weights].sort((a, b) => (a.date < b.date ? -1 : 1)), [data.weights]);
  const latestWeight = weights[weights.length - 1];
  const monthAgo = addDays(today, -30);
  const weightBase = weights.find((entry) => entry.date >= monthAgo) ?? weights[0];
  const recentWeights = weights.filter((entry) => entry.date >= addDays(today, -90));

  const { start } = weekRange(today);
  const weekMinutes = data.activities.filter((entry) => entry.date >= start && entry.date <= today).reduce((sum, entry) => sum + entry.minutes, 0);
  const todayMinutes = data.activities.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.minutes, 0);
  const todaySteps = data.health[today]?.steps ?? 0;

  const parts = useMemo(() => {
    const latest = new Map<string, { part: string; cm: number; first: number; date: string }>();
    const sorted = [...data.measures].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const entry of sorted) {
      const key = entry.part.toLocaleLowerCase();
      const seen = latest.get(key);
      latest.set(key, { part: entry.part, cm: entry.cm, first: seen?.first ?? entry.cm, date: entry.date });
    }
    return [...latest.values()].sort((a, b) => measureRank(a.part) - measureRank(b.part));
  }, [data.measures]);

  return (
    <div className="page summary-page">
      <header className="topbar">
        <div>
          <h1 className="brand-sm">
            <HeartMark />
            NivFit
          </h1>
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

      <StreakSummary onOpen={() => onOpen('streaks')} />

      <CheatToggle />

      <section className="card hero">
        <div className="hero-ring">
          <Ring eaten={eaten} target={target} cheat={cheatToday} />
          <div className="ring-copy">
            <strong className={cheatToday ? 'cheat-num' : BAND_NUM[ringBand(eaten, target)]}>{formatKcal(eaten)}</strong>
            <span>{cheatToday ? 'kcal eaten' : `of ${formatKcal(target)}`}</span>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">{cheatToday ? 'Cheat day' : 'Calories today'}</p>
          <p className={cheatToday ? 'hero-left cheat-num' : ringBand(eaten, target) === 'over' ? 'hero-left way-over' : eaten > target ? 'hero-left over' : 'hero-left'}>
            {cheatToday
              ? 'Target is off today'
              : eaten > target
                ? `${formatKcal(eaten - target)} kcal over`
                : `${formatKcal(target - eaten)} kcal left`}
          </p>
          <div className="composer-actions">
            <button type="button" className="primary" onClick={onLogFood}>
              Log food
            </button>
            <button type="button" className="ghost" onClick={() => onOpen('period')}>
              History
            </button>
          </div>
        </div>
      </section>

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
          {todaySteps > 0 && <p className="note">{formatKcal(todaySteps)} steps today</p>}
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