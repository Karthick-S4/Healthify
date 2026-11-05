import { useMemo, useState, type FormEvent } from 'react';
import { DevicesCard } from '../components/DevicesCard';
import { BUILT_IN_FOODS } from '../data/foods';
import { buildReports, planOn, rangeBudget } from '../lib/budget';
import { addDays, eachDate, formatRange, formatShort, todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { kcalFor, searchFoods } from '../lib/foods';
import { DAILY_MAX, DAILY_MIN, FIRST_DAY } from '../lib/storage';
import { useHealth } from '../state';
import type { CustomRange, Food } from '../types';

export function MoreView() {
  const health = useHealth();
  const today = todayISO();
  const [daily, setDaily] = useState(String(health.data.profile.dailyTarget));
  const [week, setWeek] = useState(health.data.profile.weekBudget == null ? '' : String(health.data.profile.weekBudget));
  const [month, setMonth] = useState(health.data.profile.monthBudget == null ? '' : String(health.data.profile.monthBudget));
  const ranges = health.data.profile.ranges;
  const currentPlan = planOn(health.data, today);
  const [rangeId, setRangeId] = useState<string | null>(null);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [rangeDaily, setRangeDaily] = useState('');
  const [rangeWeek, setRangeWeek] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [kcalDraft, setKcalDraft] = useState('');
  const [gramsDraft, setGramsDraft] = useState('');
  const [eraseText, setEraseText] = useState('');
  const reports = useMemo(() => buildReports(health.data, today, today), [health.data, today]);

  const visibleFoods = useMemo(() => {
    if (!query.trim()) return health.foods.filter((food) => food.source === 'custom').slice(0, 24);
    return searchFoods(query, health.foods);
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
    health.setTargets({
      daily: Math.round(dailyTarget),
      week: weekBudget == null ? null : Math.round(weekBudget),
      month: monthBudget == null ? null : Math.round(monthBudget),
    });
    setError(null);
    setMessage('Targets saved. They count from today; earlier days keep their old targets.');
  }

  function resetRangeForm() {
    setRangeId(null);
    setStart(today);
    setEnd(addDays(today, 6));
    setRangeDaily('');
    setRangeWeek('');
  }

  function editRange(range: CustomRange) {
    setRangeId(range.id);
    setStart(range.start);
    setEnd(range.end);
    setRangeDaily(range.daily == null ? '' : String(range.daily));
    setRangeWeek(range.week == null ? '' : String(range.week));
    document.getElementById('custom-range')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const draftRange: CustomRange | null = (() => {
    const dailyValue = rangeDaily.trim() === '' ? null : Number(rangeDaily);
    const weekValue = rangeWeek.trim() === '' ? null : Number(rangeWeek);
    if (end < start || (dailyValue == null && weekValue == null)) return null;
    return { id: rangeId ?? '', start, end, daily: dailyValue, week: weekValue };
  })();

  function saveCustom(event: FormEvent) {
    event.preventDefault();
    const fail = (text: string) => {
      setError(text);
      setMessage(null);
    };
    const days = eachDate(start, end);
    if (days.length === 0) return fail('The end date has to be on or after the start.');
    if (days.length > 366) return fail('Keep a custom range to a year or less.');
    if (!draftRange) return fail('Give the range a daily target, a weekly target, or both.');
    if (draftRange.daily != null && (draftRange.daily < DAILY_MIN || draftRange.daily > DAILY_MAX)) {
      return fail('A daily target stays between 1,000 and 5,000 kcal.');
    }
    if (draftRange.week != null && (draftRange.week < 1000 || draftRange.week > 35000)) {
      return fail('A weekly target stays between 1,000 and 35,000 kcal.');
    }
    const clash = ranges.find((range) => range.id !== rangeId && range.start <= end && start <= range.end);
    if (clash) return fail(`That overlaps ${formatRange(clash.start, clash.end)}. Change the dates or edit that range.`);
    health.saveRange({
      ...draftRange,
      id: rangeId ?? crypto.randomUUID(),
      daily: draftRange.daily == null ? null : Math.round(draftRange.daily),
      week: draftRange.week == null ? null : Math.round(draftRange.week),
    });
    setError(null);
    setMessage(rangeId ? 'Range updated.' : 'Range saved. Its targets replace the regular ones on those days.');
    resetRangeForm();
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
    setMessage(`${food.name} updated for every profile.`);
  }

  return (
    <div className="page board">
      <header className="topbar">
        <h1 className="brand-sm">More</h1>
        {health.profileName && <p className="dateline">{health.profileName}</p>}
      </header>
      {message && <p className="preview">{message}</p>}
      {error && <p className="error">{error}</p>}

      <form className="card" onSubmit={saveTargets}>
        <h2>Regular targets</h2>
        <p className="help">
          Changes count from today. Days before today keep the targets they had.
          {currentPlan.from !== FIRST_DAY && ` These have been in use since ${formatShort(currentPlan.from)}.`}
        </p>
        <label className="field-label" htmlFor="daily-target">
          Daily calories
        </label>
        <input id="daily-target" inputMode="numeric" value={daily} onChange={(event) => setDaily(event.target.value.replace(/[^\d]/g, ''))} />
        <label className="field-label" htmlFor="week-target">
          Week total (optional)
        </label>
        <input id="week-target" inputMode="numeric" value={week} onChange={(event) => setWeek(event.target.value.replace(/[^\d]/g, ''))} />
        <p className="help">Leave blank and the week adds up each day’s target. This week comes to {formatKcal(reports.week.budget)} kcal.</p>
        <label className="field-label" htmlFor="month-target">
          Month total (optional)
        </label>
        <input id="month-target" inputMode="numeric" value={month} onChange={(event) => setMonth(event.target.value.replace(/[^\d]/g, ''))} />
        <p className="help">Leave blank and the month adds up each day’s target. This month comes to {formatKcal(reports.month.budget)} kcal.</p>
        <button className="primary" type="submit">
          Save targets
        </button>
      </form>

      <form className="card" id="custom-range" onSubmit={saveCustom}>
        <h2>Custom ranges</h2>
        <p className="help">
          For a trip, a festival or a stricter stretch. On the days inside a range, its targets replace your regular ones. Fill the daily
          target, the weekly target, or both.
        </p>
        {ranges.length > 0 && (
          <ul className="range-list">
            {ranges.map((range) => (
              <li key={range.id} className={range.id === rangeId ? 'range-row editing' : 'range-row'}>
                <span>
                  <strong>{formatRange(range.start, range.end)}</strong>
                  <small>
                    {[range.daily != null && `${formatKcal(range.daily)} a day`, range.week != null && `${formatKcal(range.week)} a week`]
                      .filter(Boolean)
                      .join(' · ')}
                    {' · '}
                    {range.end < today ? 'finished' : range.start > today ? 'coming up' : 'on now'}
                  </small>
                </span>
                <button type="button" className="ghost small" onClick={() => editRange(range)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Delete ${formatRange(range.start, range.end)}`}
                  onClick={() => {
                    health.removeRange(range.id);
                    if (rangeId === range.id) resetRangeForm();
                    setMessage('Range deleted. Those days use the regular targets again.');
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <h3 className="sub-title">{rangeId ? 'Edit range' : 'Add a range'}</h3>
        <div className="two-fields">
          <div>
            <label className="field-label" htmlFor="range-start">
              Start
            </label>
            <input id="range-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="range-end">
              End
            </label>
            <input id="range-end" type="date" min={start} value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
        </div>
        <div className="two-fields">
          <div>
            <label className="field-label" htmlFor="range-daily">
              Daily target
            </label>
            <input id="range-daily" inputMode="numeric" value={rangeDaily} onChange={(event) => setRangeDaily(event.target.value.replace(/[^\d]/g, ''))} />
          </div>
          <div>
            <label className="field-label" htmlFor="range-week">
              Weekly target
            </label>
            <input id="range-week" inputMode="numeric" value={rangeWeek} onChange={(event) => setRangeWeek(event.target.value.replace(/[^\d]/g, ''))} />
          </div>
        </div>
        <p className="help">
          {draftRange
            ? `${eachDate(start, end).length} days, about ${formatKcal(rangeBudget(draftRange))} kcal in all.${
                draftRange.daily == null ? ` Each day aims for about ${formatKcal(Math.round((draftRange.week ?? 0) / 7))}.` : ''
              }${draftRange.week != null ? ' Weeks that only partly fall in the range get their share of the weekly target.' : ''}`
            : 'Daily is the goal for each day. Weekly is the total for each Monday to Sunday week inside the range.'}
        </p>
        <div className="composer-actions">
          <button className="primary" type="submit">
            {rangeId ? 'Update range' : 'Save range'}
          </button>
          {rangeId && (
            <button type="button" className="ghost" onClick={resetRangeForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="card">
        <h2>Foods</h2>
        <p className="help">Portions are estimates. Search to change one, and the next log uses the new number.</p>
        <input value={query} aria-label="Search foods" onChange={(event) => setQuery(event.target.value)} />
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
                        {food.source === 'built-in' && health.isTweaked(food.id) && (
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

      <DevicesCard />

      <section className="card">
        <h2>{health.profileName ?? 'This profile'}</h2>
        <button type="button" className="ghost" onClick={health.switchProfile}>
          Switch profile
        </button>
        <p className="help">Type {health.profileName} to delete this profile on every device. Other profiles stay.</p>
        <input value={eraseText} aria-label="Type the profile name to confirm" onChange={(event) => setEraseText(event.target.value)} />
        <button
          type="button"
          className="danger"
          disabled={!health.profileName || eraseText.trim().toLowerCase() !== health.profileName.toLowerCase()}
          onClick={() => {
            if (health.profileId) health.removeProfile(health.profileId);
          }}
        >
          Delete profile
        </button>
      </section>
      <p className="footer-note">Calories are estimates, not medical advice. {BUILT_IN_FOODS.length} foods are built in.</p>
    </div>
  );
}
