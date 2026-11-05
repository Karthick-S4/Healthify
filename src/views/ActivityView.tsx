import { useMemo, useState, type FormEvent } from 'react';
import { WeekStars, weekDone } from '../components/WeekStars';
import { addDays, eachDate, formatLong, formatShort, formatWeekday, todayISO, weekRange } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { activityDay, activityStreak, cheatDates, weekMarks, withCheat } from '../lib/streaks';
import { useHealth } from '../state';

export function ActivityView() {
  const health = useHealth();
  const today = todayISO();
  const activities = health.data.activities;
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const cheat = cheatDates(health.data.cheatDays);
  const streak = activityStreak(activities, today, cheat, health.data.health);
  const marks = weekMarks(today, withCheat(cheat, (iso) => activityDay(activities, iso, health.data.health)), 'skipped');
  const { start, end } = weekRange(today);
  const week = eachDate(start, end).map((iso) => ({
    iso,
    minutes: activities.filter((entry) => entry.date === iso).reduce((sum, entry) => sum + entry.minutes, 0),
  }));
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const peak = Math.max(30, ...week.map((day) => day.minutes));

  const past = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of [...activities].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      const key = entry.name.toLocaleLowerCase();
      if (!names.has(key)) names.set(key, entry.name);
    }
    return [...names.values()].slice(0, 8);
  }, [activities]);

  const recent = useMemo(() => {
    const since = addDays(today, -13);
    const days = new Map<string, typeof activities>();
    for (const entry of activities) {
      if (entry.date < since) continue;
      days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);
    }
    return [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [activities, today]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    const count = Number(minutes);
    if (!clean) {
      setError('Write what you did, like walking or yoga.');
      return;
    }
    if (!Number.isFinite(count) || count < 1 || count > 600) {
      setError('Minutes go from 1 to 600.');
      return;
    }
    if (date > today) {
      setError('Pick today or an earlier day.');
      return;
    }
    health.addActivity(date, clean, Math.round(count));
    setSaved(`${clean}, ${Math.round(count)} min added.`);
    setName('');
    setMinutes('');
    setDate(today);
    setError(null);
  }

  return (
    <div className="page split">
      <div className="today-status">
        <header className="topbar">
          <h1 className="brand-sm">Move</h1>
          <p className="dateline">{formatLong(today)}</p>
        </header>

        <form className="composer" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="activity-name">
            Activity
          </label>
          <input
            id="activity-name"
            value={name}
            autoCapitalize="sentences"
            list="activity-names"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
              setSaved(null);
            }}
          />
          <datalist id="activity-names">
            {past.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <div className="two-fields">
            <div>
              <label className="field-label" htmlFor="activity-minutes">
                Minutes
              </label>
              <input id="activity-minutes" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, ''))} />
            </div>
            <div>
              <label className="field-label" htmlFor="activity-date">
                Day
              </label>
              <input id="activity-date" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value || today)} />
            </div>
          </div>
          {past.length > 0 && (
            <div className="alt-row" aria-label="Recent activities">
              {past.slice(0, 4).map((item) => (
                <button key={item} type="button" className={name === item ? 'pill pick on' : 'pill pick'} onClick={() => setName(item)}>
                  {item}
                </button>
              ))}
            </div>
          )}
          <button className="primary" type="submit">
            Add activity
          </button>
          {error && <p className="error">{error}</p>}
          {saved && <p className="preview">{saved}</p>}
        </form>

        <section className="card streak-card">
          <div className="streak-head">
            <p className="eyebrow">Activity streak</p>
            <p className="streak-week">{weekDone(marks)} of 7 this week</p>
          </div>
          <p className="streak-num">
            {streak.days}
            <span> {streak.days === 1 ? 'day' : 'days'}</span>
          </p>
          <WeekStars marks={marks} />
          <p className="note">
            {streak.doneToday ? 'Today counts. Keep it going tomorrow.' : streak.days > 0 ? 'Move a little today to keep the streak.' : 'Any activity today starts a streak.'}
          </p>
        </section>
      </div>

      <div className="today-log">
        {health.healthIssue && (
          <p className="help">An Apple Health file names a profile that isn’t here. Check the profile name in the Shortcut matches the one she signs in with.</p>
        )}
        <section className="card">
          <div className="streak-head">
            <h2>This week</h2>
            <p className="streak-week">{weekMinutes} min</p>
          </div>
          <div className="minute-bars">
            {week.map((day) => (
              <div key={day.iso} className={day.iso === today ? 'minute-bar today' : 'minute-bar'}>
                <span className="minute-track">
                  <span className="minute-fill" style={{ height: day.minutes > 0 ? `${Math.max((day.minutes / peak) * 100, 8)}%` : 0 }} />
                </span>
                <small>{day.minutes > 0 ? day.minutes : ''}</small>
                <span className="strip-letter">{formatWeekday(day.iso).slice(0, 1)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="meals">
          <h2>Last two weeks</h2>
          {recent.length === 0 ? (
            <p className="empty">Nothing yet. Add a walk, yoga, a workout, anything.</p>
          ) : (
            <ul className="meal-list">
              {recent.map(([iso, entries]) =>
                entries.map((entry, index) => (
                  <li key={entry.id}>
                    <div className="meal">
                      <span>
                        <strong>{entry.name}</strong>
                        {(index === 0 || entry.source === 'apple') && (
                          <small>
                            {[
                              index === 0 ? (iso === today ? 'Today' : formatShort(iso)) : null,
                              entry.steps ? `${formatKcal(entry.steps)} steps` : null,
                              entry.kcal ? `${formatKcal(entry.kcal)} kcal` : null,
                              entry.source === 'apple' ? 'Apple Health' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                        )}
                      </span>
                      <span className="row-end">
                        <b>{entry.minutes} min</b>
                        <button type="button" className="icon-button" aria-label={`Delete ${entry.name}`} onClick={() => health.removeEntries([entry.id])}>
                          ×
                        </button>
                      </span>
                    </div>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
