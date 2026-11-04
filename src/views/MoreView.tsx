import { useMemo, useState, type FormEvent } from 'react';
import { BUILT_IN_FOODS } from '../data/foods';
import { buildReports, targetForDay } from '../lib/budget';
import { eachDate, todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { kcalFor } from '../lib/foods';
import { hashPin, isPin } from '../lib/pin';
import { DAILY_MAX, DAILY_MIN, fromBackup } from '../lib/storage';
import { homeStreak, onTargetStreak } from '../lib/streaks';
import { useHealth } from '../state';
import type { Food } from '../types';

export function MoreView() {
  const health = useHealth();
  const today = todayISO();
  const [daily, setDaily] = useState(String(health.data.profile.dailyTarget));
  const [week, setWeek] = useState(health.data.profile.weekBudget == null ? '' : String(health.data.profile.weekBudget));
  const [month, setMonth] = useState(health.data.profile.monthBudget == null ? '' : String(health.data.profile.monthBudget));
  const custom = health.data.profile.custom;
  const [start, setStart] = useState(custom?.start ?? today);
  const [end, setEnd] = useState(custom?.end ?? today);
  const [customBudget, setCustomBudget] = useState(custom ? String(custom.budget) : '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [kcalDraft, setKcalDraft] = useState('');
  const [gramsDraft, setGramsDraft] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [eraseText, setEraseText] = useState('');
  const reports = useMemo(() => buildReports(health.data, today, today), [health.data, today]);
  const streak = onTargetStreak(health.data.logs, today, (iso) => targetForDay(health.data, iso));
  const home = homeStreak(health.data.logs, today);

  const visibleFoods = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = needle ? health.foods : health.foods.filter((food) => food.source === 'custom');
    return source
      .filter((food) => !needle || food.name.toLowerCase().includes(needle) || food.aliases.some((alias) => alias.includes(needle)))
      .slice(0, 24);
  }, [health.foods, query]);

  function saveTargets(event: FormEvent) {
    event.preventDefault();
    const dailyTarget = Number(daily);
    if (!Number.isFinite(dailyTarget) || dailyTarget < DAILY_MIN || dailyTarget > DAILY_MAX) {
      setError('Daily target stays between 1,000 and 5,000 kcal.');
      setMessage(null);
      return;
    }
    const weekBudget = week.trim() === '' ? null : Number(week);
    const monthBudget = month.trim() === '' ? null : Number(month);
    if (weekBudget != null && (!Number.isFinite(weekBudget) || weekBudget < 1000 || weekBudget > 35000)) {
      setError('Week budget stays between 1,000 and 35,000 kcal, or leave it blank.');
      setMessage(null);
      return;
    }
    if (monthBudget != null && (!Number.isFinite(monthBudget) || monthBudget < 1000 || monthBudget > 150000)) {
      setError('Month budget stays between 1,000 and 1,50,000 kcal, or leave it blank.');
      setMessage(null);
      return;
    }
    health.setDailyTarget(Math.round(dailyTarget));
    health.setWeekBudget(weekBudget == null ? null : Math.round(weekBudget));
    health.setMonthBudget(monthBudget == null ? null : Math.round(monthBudget));
    setError(null);
    setMessage('Targets saved. Today uses the new daily number.');
  }

  function saveCustom(event: FormEvent) {
    event.preventDefault();
    const budget = Number(customBudget);
    const days = eachDate(start, end);
    if (days.length === 0) {
      setError('The end date has to be on or after the start.');
      setMessage(null);
      return;
    }
    if (days.length > 366) {
      setError('Keep a custom range to a year or less.');
      setMessage(null);
      return;
    }
    if (!Number.isFinite(budget) || budget < 1000) {
      setError('Give the range a budget of at least 1,000 kcal.');
      setMessage(null);
      return;
    }
    health.setCustom({ start, end, budget: Math.round(budget) });
    setError(null);
    setMessage('Custom range saved.');
  }

  function openFood(food: Food) {
    setOpenId(food.id);
    setKcalDraft(String(food.kcalPer100g));
    setGramsDraft(String(food.pieceGrams));
  }

  function saveFood(food: Food) {
    const kcalPer100g = Number(kcalDraft);
    const pieceGrams = Number(gramsDraft);
    if (!Number.isFinite(kcalPer100g) || kcalPer100g < 0 || kcalPer100g > 900) {
      setError('Calories per 100 g stay between 0 and 900.');
      return;
    }
    if (!Number.isFinite(pieceGrams) || pieceGrams <= 0 || pieceGrams > 1000) {
      setError('Serving weight stays between 1 and 1,000 g.');
      return;
    }
    if (food.source === 'custom') health.updateCustomFood(food.id, { kcalPer100g, pieceGrams });
    else health.tweakFood(food.id, { kcalPer100g, pieceGrams });
    setError(null);
    setMessage(`${food.name} updated.`);
  }

  async function onPin(event: FormEvent) {
    event.preventDefault();
    if (!isPin(currentPin) || !isPin(nextPin)) {
      setError('Both PINs need 4 digits.');
      return;
    }
    const hashed = await hashPin(currentPin);
    if (hashed !== health.data.pinHash) {
      setError('The current PIN doesn’t match.');
      return;
    }
    await health.changePin(nextPin);
    setCurrentPin('');
    setNextPin('');
    setError(null);
    setMessage('PIN changed.');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand-sm">More</h1>
      </header>
      {message && <p className="preview">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card" id="streaks">
        <h2>Streaks</h2>
        <p>
          On target is {streak.days} {streak.days === 1 ? 'day' : 'days'}. A finished day counts when it has a log and the calories are at or under that day’s target. Going over, or leaving a day blank, ends it.
        </p>
        <p>
          Home meals is {home.days} {home.days === 1 ? 'day' : 'days'}. One outside meal — restaurant, delivery, or Ate out — ends it. Days with no meals are skipped.
        </p>
      </section>

      <form className="card" onSubmit={saveTargets}>
        <h2>Targets</h2>
        <label className="field-label" htmlFor="daily-target">
          Daily calories
        </label>
        <input id="daily-target" inputMode="numeric" value={daily} onChange={(event) => setDaily(event.target.value.replace(/[^\d]/g, ''))} />
        <label className="field-label" htmlFor="week-target">
          Week budget
        </label>
        <input
          id="week-target"
          inputMode="numeric"
          placeholder={String(reports.week.budget)}
          value={week}
          onChange={(event) => setWeek(event.target.value.replace(/[^\d]/g, ''))}
        />
        <p className="help">Leave blank to use each day’s target. This week would be {formatKcal(reports.week.budget)} kcal.</p>
        <label className="field-label" htmlFor="month-target">
          Month budget
        </label>
        <input
          id="month-target"
          inputMode="numeric"
          placeholder={String(reports.month.budget)}
          value={month}
          onChange={(event) => setMonth(event.target.value.replace(/[^\d]/g, ''))}
        />
        <button className="primary" type="submit">
          Save targets
        </button>
      </form>

      <form className="card" id="custom-range" onSubmit={saveCustom}>
        <h2>Custom range</h2>
        <label className="field-label" htmlFor="range-start">
          Start
        </label>
        <input id="range-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <label className="field-label" htmlFor="range-end">
          End
        </label>
        <input id="range-end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <label className="field-label" htmlFor="range-budget">
          Total calories
        </label>
        <input id="range-budget" inputMode="numeric" value={customBudget} onChange={(event) => setCustomBudget(event.target.value.replace(/[^\d]/g, ''))} />
        <div className="composer-actions">
          <button className="primary" type="submit">
            Save range
          </button>
          {custom && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                health.setCustom(null);
                setCustomBudget('');
                setMessage('Custom range cleared.');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <section className="card">
        <h2>Foods</h2>
        <p className="help">Portions are estimates. Search to change one, and the next log uses the new number.</p>
        <input value={query} placeholder="Search idli, apple, dosa" aria-label="Search foods" onChange={(event) => setQuery(event.target.value)} />
        {visibleFoods.length === 0 ? (
          <p className="empty">{query ? 'No food by that name.' : 'Foods you teach Healthify show up here.'}</p>
        ) : (
          <ul className="food-list">
            {visibleFoods.map((food) => {
              const each = kcalFor(food, food.pieceGrams);
              const open = openId === food.id;
              return (
                <li key={food.id}>
                  <button type="button" className="meal" onClick={() => (open ? setOpenId(null) : openFood(food))}>
                    <span>
                      <strong>{food.name}</strong>
                      <small>
                        {food.pieceGrams} g per {food.pieceLabel} · {formatKcal(each)} kcal
                      </small>
                    </span>
                  </button>
                  {open && (
                    <div className="food-edit">
                      <label className="field-label" htmlFor={`${food.id}-kcal`}>
                        kcal per 100 g
                      </label>
                      <input id={`${food.id}-kcal`} inputMode="decimal" value={kcalDraft} onChange={(event) => setKcalDraft(event.target.value)} />
                      <label className="field-label" htmlFor={`${food.id}-grams`}>
                        Grams per {food.pieceLabel}
                      </label>
                      <input id={`${food.id}-grams`} inputMode="decimal" value={gramsDraft} onChange={(event) => setGramsDraft(event.target.value)} />
                      <div className="composer-actions">
                        <button type="button" className="primary" onClick={() => saveFood(food)}>
                          Save food
                        </button>
                        {food.source === 'built-in' && health.data.tweaks[food.id] && (
                          <button type="button" className="ghost" onClick={() => health.tweakFood(food.id, null)}>
                            Reset
                          </button>
                        )}
                        {food.source === 'custom' && (
                          <button type="button" className="ghost" onClick={() => health.deleteCustomFood(food.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="help">The file holds this phone’s diary. Keep it private. The PIN in the file is stored as a hash.</p>
        <div className="composer-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(health.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `healthify-${today}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download backup
          </button>
          <label className="ghost file-button">
            Restore
            <input
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try {
                  const next = fromBackup(JSON.parse(await file.text()));
                  if (!next) {
                    setError('That file is not a Healthify backup.');
                    setMessage(null);
                    return;
                  }
                  health.importData(next);
                  setError(null);
                  setMessage('Backup restored. The PIN in that file opens Healthify next time.');
                } catch {
                  setError('That file could not be read.');
                  setMessage(null);
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>On an iPhone</h2>
        <ol className="steps">
          <li>Open this page in Safari.</li>
          <li>Tap Share, then Add to Home Screen.</li>
          <li>Open Healthify from the icon.</li>
        </ol>
        <p className="help">After a new version is published, swipe the icon away and open it again. Meals stay on this phone. The website code is public; the diary is not.</p>
      </section>

      <form className="card" onSubmit={(event) => void onPin(event)}>
        <h2>Change PIN</h2>
        <label className="field-label" htmlFor="current-pin">
          Current PIN
        </label>
        <input id="current-pin" className="pin-input" inputMode="numeric" maxLength={4} value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
        <label className="field-label" htmlFor="next-pin">
          New PIN
        </label>
        <input id="next-pin" className="pin-input" inputMode="numeric" maxLength={4} value={nextPin} onChange={(event) => setNextPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className="primary" type="submit">
          Change PIN
        </button>
      </form>

      <section className="card">
        <h2>This phone</h2>
        <button type="button" className="ghost" onClick={health.lock}>
          Lock now
        </button>
        <p className="help">Type ERASE to delete the diary, PIN, and targets on this phone.</p>
        <input value={eraseText} aria-label="Type ERASE to confirm" onChange={(event) => setEraseText(event.target.value)} />
        <button type="button" className="danger" disabled={eraseText !== 'ERASE'} onClick={() => health.erase()}>
          Erase diary
        </button>
      </section>
      <p className="footer-note">Calories are estimates, not medical advice. {BUILT_IN_FOODS.length} foods are built in.</p>
    </div>
  );
}
