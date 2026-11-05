import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheatToggle } from '../components/CheatToggle';
import { MealEditor } from '../components/MealEditor';
import { MealGroups } from '../components/MealGroups';
import { MealPicker } from '../components/MealPicker';
import { Ring } from '../components/Ring';
import { buildReports, targetForDay, tightestRoom, type RoomReport } from '../lib/budget';
import { eachDate, formatLong, formatShort, formatWeekday, todayISO, weekRange } from '../lib/dates';
import { formatCount, formatKcal } from '../lib/format';
import { closeFoods, correctQuery, kcalFor, searchFoods, suggestedGrams } from '../lib/foods';
import { lookupCalories, type FoodLookup } from '../lib/lookupFood';
import { parseFoodList, type FoodHit } from '../lib/parseFood';
import { cheatDates, homeStreak, onTargetStreak, type OnTargetStreak } from '../lib/streaks';
import { KIND_LABEL, mixedIdeas, slotForHour, suggestMeals } from '../lib/suggestions';
import { useHealth } from '../state';
import type { Food, LogEntry, MealSlot } from '../types';

type Pending =
  | { kind: 'unknown'; name: string; count: number; grams: number | null; unit: 'g' | 'ml' | null; outside: boolean }
  | { kind: 'need-grams'; food: Food; unit: 'g' | 'ml'; outside: boolean };

type TodayViewProps = {
  onOpenIdeas: () => void;
  onOpenMore: () => void;
};

function targetNote(streak: OnTargetStreak): string {
  if (streak.today === 'cheat') return 'Cheat day. Targets, eating out and activity don’t count against your streaks today.';
  if (streak.today === 'over') {
    return streak.ended > 0
      ? `Over today. That ends a ${streak.ended} day streak unless a meal is removed.`
      : 'Over today. The streak resets unless a meal is removed.';
  }
  if (streak.today === 'under') return 'Today is on track.';
  if (streak.days > 0) return 'Log today to keep it.';
  return 'A day at or under target starts the streak.';
}

function roomSentence(report: RoomReport): string {
  if (report.eatenToday > report.dailyTarget) {
    return `${formatKcal(report.eatenToday - report.dailyTarget)} kcal over today’s target.`;
  }
  if (report.over) return `${report.label} is ${formatKcal(Math.abs(report.remaining))} kcal over budget.`;
  if (report.limiter === 'period' && report.kind !== 'day') {
    return `${formatKcal(report.remaining)} kcal left this ${report.label.toLowerCase()}, about ${formatKcal(report.room)} more today.`;
  }
  return `${formatKcal(Math.max(report.dailyTarget - report.eatenToday, 0))} kcal left today.`;
}

function displayName(name: string): string {
  return name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function portionAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 3000) return Number.NaN;
  return value;
}

function withPortion(hit: FoodHit, grams: number, unit: 'g' | 'ml'): FoodHit {
  return {
    ...hit,
    grams,
    kcal: kcalFor(hit.food, grams),
    title: `${hit.food.name}, ${Math.round(grams)} ${unit}`,
  };
}

export function TodayView({ onOpenIdeas, onOpenMore }: TodayViewProps) {
  const health = useHealth();
  const today = todayISO();
  const [draft, setDraft] = useState('');
  const [amount, setAmount] = useState('');
  const [measure, setMeasure] = useState<'g' | 'ml'>('g');
  const [ateOut, setAteOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [picked, setPicked] = useState(today);
  const [meal, setMeal] = useState<MealSlot>(() => slotForHour(new Date().getHours()));
  const [gramsDraft, setGramsDraft] = useState('');
  const [kcalDraft, setKcalDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [kcalEdited, setKcalEdited] = useState(false);
  const [lookup, setLookup] = useState<FoodLookup | null>(null);
  const [looking, setLooking] = useState(false);

  const reports = useMemo(() => buildReports(health.data, today, today), [health.data, today]);
  const tight = useMemo(() => tightestRoom(health.data, today), [health.data, today]);
  const day = picked > today ? today : picked;
  const pastDay = day !== today;
  const dayLogs = health.data.logs.filter((log) => log.date === day);
  const target = targetForDay(health.data, today);
  const eaten = reports.day.eaten;
  const cheat = cheatDates(health.data.cheatDays);
  const cheatToday = cheat.has(today);
  const targetStreak = onTargetStreak(health.data.logs, today, (iso) => targetForDay(health.data, iso), cheat);
  const home = homeStreak(health.data.logs, today, cheat);
  const weekDays = useMemo(() => {
    const range = weekRange(today);
    return eachDate(range.start, range.end);
  }, [today]);

  const preview = useMemo(() => {
    if (!draft.trim() || queue.length > 0) return null;
    const portion = portionAmount(amount);
    if (Number.isNaN(portion)) return null;
    const parsed = parseFoodList(draft, health.foods);
    const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
    if (hits.length === 0 || hits.length !== parsed.items.length) return null;
    const shown = portion != null && hits.length === 1 ? [withPortion(hits[0], portion, measure)] : hits;
    if (portion != null && hits.length !== 1) return null;
    const kcal = shown.reduce((sum, hit) => sum + hit.kcal, 0);
    return `${shown.map((hit) => hit.title).join(' + ')} · ${formatKcal(kcal)} kcal`;
  }, [amount, draft, health.foods, measure, queue.length]);

  const typing = useMemo(() => {
    const segment = /^(.*(?:,|\+|\band\b)\s*)?(.*)$/i.exec(draft) ?? ['', '', draft];
    const quantity = /^(\s*\d+(?:\.\d+)?\s*(?:x\s*)?)?(.*)$/i.exec(segment[2] ?? '') ?? ['', '', ''];
    const term = (quantity[2] ?? '').trim();
    const prefix = (segment[1] ?? '') + (quantity[1] ?? '');
    if (term.length < 2 || queue.length > 0) return { prefix, foods: [] as Food[] };
    const found = searchFoods(term, health.foods, 5);
    const known = found.some((food) => food.aliases.includes(term.toLowerCase()));
    return { prefix, foods: known ? [] : found };
  }, [draft, health.foods, queue.length]);

  function pickSuggestion(food: Food) {
    setDraft(`${typing.prefix}${food.name.toLowerCase()}`);
    setError(null);
    document.getElementById('food')?.focus();
  }

  const light = !cheatToday && (tight.over || eaten > target);
  const ideas = useMemo(() => {
    const all = suggestMeals({
      foods: health.foods,
      logs: health.data.logs,
      today,
      room: tight.room,
      hour: new Date().getHours(),
      light,
      custom: health.data.customIdeas,
      hidden: new Set(health.data.hiddenIdeas.map((entry) => entry.key)),
    });
    return mixedIdeas(all, 3);
  }, [tight, eaten, target, health.foods, health.data.logs, health.data.customIdeas, health.data.hiddenIdeas, today, light]);

  const unknown = queue[0]?.kind === 'unknown' ? queue[0] : null;
  const unknownKey = unknown ? `${unknown.name}|${unknown.count}|${unknown.grams ?? ''}|${queue.length}` : '';

  useEffect(() => {
    if (!unknown) {
      setLooking(false);
      setLookup(null);
      return;
    }
    const controller = new AbortController();
    setLooking(true);
    setLookup(null);
    setKcalEdited(false);
    setNameDraft(displayName(unknown.name));
    void lookupCalories(unknown.name, health.foods, controller.signal).then((hit) => {
      if (controller.signal.aborted) return;
      setLooking(false);
      if (!hit) return;
      const grams = unknown.grams ?? hit.servingGrams ?? suggestedGrams(unknown.name, health.foods) ?? 100;
      setLookup(hit);
      setNameDraft(displayName(hit.name));
      setGramsDraft(String(Math.round(grams)));
      setKcalDraft(String(Math.max(0, Math.round((hit.kcalPer100g * grams) / 100))));
    });
    return () => controller.abort();
  }, [unknownKey, health.foods]);

  function addHits(hits: FoodHit[], outside: boolean) {
    if (hits.length === 0) return;
    const ids = health.addLogs(
      hits.map((hit) => ({
        date: day,
        title: hit.title,
        grams: hit.grams,
        kcal: hit.kcal,
        outside,
        foodId: hit.food.id,
        meal,
      })),
    );
    const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
    health.setUndo({
      ids,
      message: `Added ${hits.length === 1 ? hits[0].title : `${hits.length} items`} · ${formatKcal(kcal)} kcal`,
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseFoodList(draft, health.foods);
    const portion = portionAmount(amount);
    if (Number.isNaN(portion)) {
      setError(measure === 'ml' ? 'Enter millilitres between 1 and 3,000.' : 'Enter grams between 1 and 3,000.');
      return;
    }
    if (portion != null && parsed.items.length !== 1) {
      setError(parsed.items.length === 0 ? 'Type the food in the first box.' : 'Use the amount for one food, then add the next.');
      return;
    }
    if (parsed.items.length === 0) {
      setError(parsed.outside ? 'Add the food as well.' : 'Type a food, such as rasam or 3 idli.');
      return;
    }
    const outside = parsed.outside || ateOut;
    const items =
      portion != null
        ? parsed.items.map((item) => {
            if (item.kind === 'food') return withPortion(item, portion, measure);
            if (item.kind === 'unknown') return { ...item, grams: portion, unit: measure };
            if (item.kind === 'need-grams') return { ...item, unit: measure };
            return item;
          })
        : parsed.items;
    const hits = items.filter((item): item is FoodHit => item.kind === 'food');
    const invalid = items.find((item) => item.kind === 'invalid');
    const pending = items.flatMap((item): Pending[] => {
      if (item.kind === 'unknown') return [{ ...item, outside }];
      if (item.kind === 'need-grams') return [{ ...item, outside }];
      return [];
    });
    addHits(hits, outside);
    setQueue(pending);
    setLooking(pending[0]?.kind === 'unknown');
    setLookup(null);
    setGramsDraft(portion != null ? String(Math.round(portion)) : pending[0]?.kind === 'unknown' && pending[0].grams ? String(pending[0].grams) : '');
    setKcalDraft('');
    setError(invalid && invalid.kind === 'invalid' ? invalid.message : null);
    setDraft('');
    setAmount('');
    if (pending.length === 0) setAteOut(false);
  }

  function resolvePending(event: FormEvent) {
    event.preventDefault();
    const current = queue[0];
    if (!current) return;
    const grams = Number(gramsDraft);
    const unit = current.unit === 'ml' ? 'ml' : 'g';
    if (!Number.isFinite(grams) || grams <= 0 || grams > 3000) {
      setError(unit === 'ml' ? 'Enter millilitres between 1 and 3,000.' : 'Enter a weight between 1 and 3,000 grams.');
      return;
    }
    if (current.kind === 'need-grams') {
      const kcal = kcalFor(current.food, grams);
      addHits([{ kind: 'food', food: current.food, grams, kcal, title: `${current.food.name}, ${Math.round(grams)} ${unit}` }], current.outside);
    } else {
      const kcal = Number(kcalDraft);
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 4000) {
        setError('Enter calories from 0 to 4,000 for this food.');
        return;
      }
      const count = current.count > 0 ? current.count : 1;
      const name = displayName(nameDraft.trim() || current.name);
      const corrected = correctQuery(current.name, health.foods);
      const food: Food = {
        id: crypto.randomUUID(),
        name,
        group: 'Yours',
        aliases: [...new Set([current.name.toLowerCase(), corrected, name.toLowerCase()].filter(Boolean))],
        kcalPer100g: grams === 0 ? 0 : (kcal / grams) * 100,
        pieceGrams: grams / count,
        pieceLabel: 'serving',
        source: 'custom',
      };
      health.addCustomFood(food);
      const title = `${name}, ${Math.round(grams)} ${unit}`;
      const ids = health.addLogs([{ date: day, title, grams, kcal, outside: current.outside, foodId: food.id, meal }]);
      health.setUndo({ ids, message: `Added ${title} · ${formatKcal(kcal)} kcal` });
    }
    const rest = queue.slice(1);
    setQueue(rest);
    setLooking(rest[0]?.kind === 'unknown');
    setGramsDraft(rest[0]?.kind === 'unknown' && rest[0].grams ? String(rest[0].grams) : '');
    setKcalDraft('');
    setNameDraft('');
    setLookup(null);
    setError(null);
    if (rest.length === 0) setAteOut(false);
  }

  function chooseSaved(food: Food) {
    const current = queue[0];
    if (!current || current.kind !== 'unknown') return;
    const count = current.count > 0 ? current.count : 1;
    const grams = current.grams ?? food.pieceGrams * count;
    const unit = current.unit === 'ml' ? 'ml' : 'g';
    const title = current.grams != null ? `${food.name}, ${Math.round(grams)} ${unit}` : `${formatCount(count)} ${food.name}`;
    addHits([{ kind: 'food', food, grams, kcal: kcalFor(food, grams), title }], current.outside);
    const rest = queue.slice(1);
    setQueue(rest);
    setLooking(rest[0]?.kind === 'unknown');
    setGramsDraft(rest[0]?.kind === 'unknown' && rest[0].grams ? String(rest[0].grams) : '');
    setKcalDraft('');
    setNameDraft('');
    setLookup(null);
    setError(null);
    if (rest.length === 0) setAteOut(false);
  }

  const pending = queue[0];
  const pendingKcal = pending?.kind === 'need-grams' && Number(gramsDraft) > 0 ? kcalFor(pending.food, Number(gramsDraft)) : null;
  const alternates = pending?.kind === 'unknown' ? closeFoods(pending.name, health.foods, 4, 'any') : [];

  return (
    <div className="page today-page">
      <div className="today-status">
      <header className="topbar">
        <div>
          <h1 className="brand-sm">Food</h1>
          {health.profileName && <p className="who">{health.profileName}</p>}
          {health.sync === 'failed' && <p className="help">Saved here. GitHub didn’t answer, so your other devices get it on the next try.</p>}
          {health.sync === 'off' && (
            <p className="help">
              This device isn’t sharing meals yet.{' '}
              <button type="button" className="text-button" onClick={onOpenMore}>
                Connect it
              </button>
            </p>
          )}
          {health.sync === 'bad-key' && (
            <p className="help">
              The sharing key stopped working.{' '}
              <button type="button" className="text-button" onClick={onOpenMore}>
                Fix it in More
              </button>
            </p>
          )}
        </div>
        <p className="dateline">{formatLong(today)}</p>
      </header>

      <div className="chips">
        <button type="button" className={targetStreak.today === 'over' ? 'chip warn' : 'chip'} onClick={onOpenMore}>
          <span>On target</span>
          <strong>{targetStreak.days}</strong>
          <small>{targetStreak.days === 1 ? 'day' : 'days'}</small>
        </button>
        <button type="button" className={home.brokeToday ? 'chip warn' : 'chip'} onClick={onOpenMore}>
          <span>Home meals</span>
          <strong>{home.brokeToday ? 'Ended' : home.days}</strong>
          <small>{home.brokeToday ? 'today' : home.days === 1 ? 'day' : 'days'}</small>
        </button>
      </div>
      <CheatToggle />
      <p className="note">{targetNote(targetStreak)}</p>

      <div className="ring-block">
        <Ring eaten={eaten} target={target} cheat={cheatToday} />
        <div className="ring-copy">
          <strong className={cheatToday ? 'cheat-num' : eaten > target ? 'over-num' : undefined}>{formatKcal(eaten)}</strong>
          <span>{cheatToday ? 'kcal eaten' : `of ${formatKcal(target)}`}</span>
        </div>
      </div>
      <p className={cheatToday ? 'left cheat' : eaten > target || tight.over ? 'left over' : 'left'}>{cheatToday ? 'Target is off today. Enjoy.' : roomSentence(tight)}</p>
      </div>

      <div className="today-log">
      <form className="composer" onSubmit={onSubmit}>
        <MealPicker value={meal} onChange={setMeal} />
        <label className="field-label" htmlFor="food">
          Food
        </label>
        <input
          id="food"
          value={draft}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          onFocus={(event) => {
            const form = event.currentTarget.form;
            if (window.matchMedia('(min-width: 960px)').matches) return;
            window.setTimeout(() => form?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {typing.foods.length > 0 && (
          <div className="food-suggest" aria-label="Matching foods">
            {typing.foods.map((food) => (
              <button key={food.id} type="button" className="pill" onClick={() => pickSuggestion(food)}>
                {food.name}
                <small>
                  {formatKcal(kcalFor(food, food.pieceGrams))} kcal per {food.pieceLabel}
                </small>
              </button>
            ))}
          </div>
        )}
        <label className="field-label" htmlFor="amount">
          Amount
        </label>
        <div className="amount-row">
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'));
              setError(null);
            }}
          />
          <div className="unit-toggle" role="group" aria-label="Grams or millilitres">
            <button type="button" className={measure === 'g' ? 'on' : undefined} aria-pressed={measure === 'g'} onClick={() => setMeasure('g')}>
              gm
            </button>
            <button type="button" className={measure === 'ml' ? 'on' : undefined} aria-pressed={measure === 'ml'} onClick={() => setMeasure('ml')}>
              ml
            </button>
          </div>
        </div>
        {preview && <p className="preview">{preview}</p>}
        {pastDay && (
          <p className="past-day">
            Adding to {formatWeekday(day)} {formatShort(day)}.{' '}
            <button type="button" className="text-button" onClick={() => setPicked(today)}>
              Back to today
            </button>
          </p>
        )}
        <div className="composer-actions">
          <button type="button" className={ateOut ? 'pill on' : 'pill'} aria-pressed={ateOut} onClick={() => setAteOut((value) => !value)}>
            Ate out
          </button>
          <button className="primary" type="submit">
            Add
          </button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="strip" aria-label="This week, calories eaten">
        {weekDays.map((iso) => {
          const dayTarget = targetForDay(health.data, iso);
          const dayEaten = health.data.logs.filter((log) => log.date === iso).reduce((sum, log) => sum + log.kcal, 0);
          const hasLogs = health.data.logs.some((log) => log.date === iso);
          const over = hasLogs && dayEaten > dayTarget;
          const pct = dayTarget <= 0 ? 0 : Math.min(100, (dayEaten / dayTarget) * 100);
          return (
            <button
              key={iso}
              type="button"
              className={picked === iso ? 'strip-col on' : 'strip-col'}
              onClick={() => setPicked(iso)}
              disabled={iso > today}
              aria-pressed={picked === iso}
              aria-label={`${formatWeekday(iso)} ${formatShort(iso)}, ${hasLogs ? `${Math.round(dayEaten)} of ${Math.round(dayTarget)} calories` : 'no log'}`}
            >
              <span className="strip-track">
                <span
                  className={over ? 'strip-fill over' : hasLogs ? 'strip-fill' : 'strip-fill empty'}
                  style={{ height: hasLogs ? `${Math.max(pct, 8)}%` : undefined }}
                />
              </span>
              <span className="strip-letter">{formatWeekday(iso).slice(0, 1)}</span>
            </button>
          );
        })}
      </div>
      <p className="strip-caption">
        {formatWeekday(picked)} {formatShort(picked)} ·{' '}
        {health.data.logs.some((log) => log.date === picked)
          ? `${formatKcal(health.data.logs.filter((log) => log.date === picked).reduce((sum, log) => sum + log.kcal, 0))} of ${formatKcal(targetForDay(health.data, picked))}`
          : 'No log'}
      </p>

      {pending && (
        <form className="card pending" onSubmit={resolvePending}>
          {pending.kind === 'need-grams' ? (
            <>
              <h2>How many {pending.unit === 'ml' ? 'ml' : 'grams'} of {pending.food.name}?</h2>
              <input
                inputMode="numeric"
                value={gramsDraft}
                aria-label={pending.unit === 'ml' ? 'Millilitres' : 'Grams'}
                onChange={(event) => setGramsDraft(event.target.value.replace(/[^\d.]/g, ''))}
              />
              {pendingKcal != null && <p className="preview">{formatKcal(pendingKcal)} kcal</p>}
            </>
          ) : (
            <>
              <h2>{looking ? `Looking up “${pending.name.trim()}”` : nameDraft || displayName(pending.name)}</h2>
              {queue.length > 1 && <p className="help">{queue.length} foods in this note.</p>}
              {looking && <p className="help">Checking a food database for the calories.</p>}
              {!looking && lookup && (
                <p className="help">
                  About {formatKcal(lookup.kcalPer100g)} kcal per 100 {pending.unit === 'ml' ? 'ml' : 'g'}, from {lookup.detail}. Change the amount or calories if this portion is different.
                </p>
              )}
              {!looking && !lookup && (
                <p className="help">No listing turned up. Type the calories and the grams or ml. Healthify remembers them, and you can change the meal later.</p>
              )}
              {!looking && (
                <>
                  <label className="field-label" htmlFor="new-name">
                    Name
                  </label>
                  <input id="new-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                  <label className="field-label" htmlFor="new-grams">
                    {pending.unit === 'ml' ? 'Millilitres' : 'Grams'}
                  </label>
                  <input
                    id="new-grams"
                    inputMode="decimal"
                    value={gramsDraft}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^\d.]/g, '');
                      setGramsDraft(next);
                      if (!kcalEdited && lookup) {
                        const grams = Number(next);
                        if (Number.isFinite(grams) && grams > 0) {
                          setKcalDraft(String(Math.max(0, Math.round((lookup.kcalPer100g * grams) / 100))));
                        }
                      }
                    }}
                  />
                  <label className="field-label" htmlFor="new-kcal">
                    Calories
                  </label>
                  <input
                    id="new-kcal"
                    inputMode="numeric"
                    value={kcalDraft}
                    onChange={(event) => {
                      setKcalEdited(true);
                      setKcalDraft(event.target.value.replace(/[^\d]/g, ''));
                    }}
                  />
                </>
              )}
              {alternates.length > 0 && (
                <>
                  <p className="field-label">Or a saved plate</p>
                  <div className="alt-row">
                  {alternates.map((food) => {
                    const count = pending.count > 0 ? pending.count : 1;
                    const grams = pending.grams ?? food.pieceGrams * count;
                    return (
                      <button key={food.id} type="button" className="pill" onClick={() => chooseSaved(food)}>
                        {food.name} · {formatKcal(kcalFor(food, grams))}
                      </button>
                    );
                  })}
                  </div>
                </>
              )}
            </>
          )}
          <div className="composer-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQueue((items) => items.slice(1));
                setError(null);
              }}
            >
              Skip
            </button>
            <button className="primary" type="submit" disabled={pending.kind === 'unknown' && looking}>
              {pending.kind === 'need-grams' ? 'Save' : 'Add this'}
            </button>
          </div>
        </form>
      )}

      <section className="meals">
        <div className="streak-head">
          <h2>{pastDay ? `${formatWeekday(day)} ${formatShort(day)}` : 'Today'}</h2>
          {pastDay && (
            <button type="button" className="text-button" onClick={() => setPicked(today)}>
              Back to today
            </button>
          )}
        </div>
        {dayLogs.length === 0 ? (
          <p className="empty">{pastDay ? 'Nothing logged on this day. Add it above if you forgot.' : 'Nothing logged yet. Type the food, then the grams or ml beside it.'}</p>
        ) : (
          <MealGroups logs={dayLogs} onOpen={setEditing} />
        )}
      </section>

      {ideas.length > 0 && !pastDay && (
        <section className="card suggest">
          <h2>Ideas for now</h2>
          <ul className="suggest-list">
            {ideas.map((idea) => (
              <li key={idea.query} className="suggest-row">
                <div>
                  <p className="eyebrow">{KIND_LABEL[idea.kind]}</p>
                  <p className="suggest-title">{idea.title}</p>
                  <p className="note">{idea.detail}</p>
                  <button type="button" className="text-button idea-hide" onClick={() => health.removeIdea(idea.title, idea.customId)}>
                    {idea.customId ? 'Delete this idea' : 'Not for me'}
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Add ${idea.title}`}
                  onClick={() => {
                    const parsed = parseFoodList(idea.query, health.foods);
                    const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
                    addHits(hits, false);
                  }}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="ghost" onClick={onOpenIdeas}>
            More ideas
          </button>
        </section>
      )}

      </div>

      {editing && (
        <MealEditor
          log={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            health.updateLog(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            health.removeLogs([editing.id]);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
