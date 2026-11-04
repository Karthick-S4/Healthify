import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MealEditor } from '../components/MealEditor';
import { Ring } from '../components/Ring';
import { buildReports, targetForDay, tightestRoom, type RoomReport } from '../lib/budget';
import { eachDate, formatLong, formatShort, formatWeekday, todayISO, weekRange } from '../lib/dates';
import { formatCount, formatKcal } from '../lib/format';
import { closeFoods, correctQuery, kcalFor, suggestedGrams } from '../lib/foods';
import { lookupCalories, type FoodLookup } from '../lib/lookupFood';
import { parseFoodList, type FoodHit } from '../lib/parseFood';
import { homeStreak, onTargetStreak, type OnTargetStreak } from '../lib/streaks';
import { suggestMeals } from '../lib/suggestions';
import { useHealth } from '../state';
import type { Food, LogEntry } from '../types';

type Pending =
  | { kind: 'unknown'; name: string; count: number; grams: number | null; unit: 'g' | 'ml' | null; outside: boolean }
  | { kind: 'need-grams'; food: Food; unit: 'g' | 'ml'; outside: boolean };

type TodayViewProps = {
  onOpenIdeas: () => void;
  onOpenMore: () => void;
};

function targetNote(streak: OnTargetStreak): string {
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

export function TodayView({ onOpenIdeas, onOpenMore }: TodayViewProps) {
  const health = useHealth();
  const today = todayISO();
  const [draft, setDraft] = useState('');
  const [ateOut, setAteOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [picked, setPicked] = useState(today);
  const [gramsDraft, setGramsDraft] = useState('');
  const [kcalDraft, setKcalDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [kcalEdited, setKcalEdited] = useState(false);
  const [lookup, setLookup] = useState<FoodLookup | null>(null);
  const [looking, setLooking] = useState(false);

  const reports = useMemo(() => buildReports(health.data, today, today), [health.data, today]);
  const tight = useMemo(() => tightestRoom(health.data, today), [health.data, today]);
  const todayLogs = health.data.logs.filter((log) => log.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const target = targetForDay(health.data, today);
  const eaten = reports.day.eaten;
  const targetStreak = onTargetStreak(health.data.logs, today, (iso) => targetForDay(health.data, iso));
  const home = homeStreak(health.data.logs, today);
  const weekDays = useMemo(() => {
    const range = weekRange(today);
    return eachDate(range.start, range.end);
  }, [today]);

  const preview = useMemo(() => {
    if (!draft.trim() || queue.length > 0) return null;
    const parsed = parseFoodList(draft, health.foods);
    const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
    if (hits.length === 0 || hits.length !== parsed.items.length) return null;
    const kcal = hits.reduce((sum, hit) => sum + hit.kcal, 0);
    return `${hits.map((hit) => hit.title).join(' + ')} · ${formatKcal(kcal)} kcal`;
  }, [draft, health.foods, queue.length]);

  const light = tight.over || eaten > target;
  const idea = useMemo(() => {
    const ideas = suggestMeals({
      foods: health.foods,
      logs: health.data.logs,
      today,
      room: tight.room,
      hour: new Date().getHours(),
      light,
    });
    return ideas[0] ?? null;
  }, [tight, eaten, target, health.foods, health.data.logs, today, light]);

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
        date: today,
        title: hit.title,
        grams: hit.grams,
        kcal: hit.kcal,
        outside,
        foodId: hit.food.id,
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
    if (parsed.items.length === 0) {
      setError(parsed.outside ? 'Add the food as well.' : 'Type a food, such as 3 idli, rasam 200 ml, or apple 150 gm.');
      return;
    }
    const outside = parsed.outside || ateOut;
    const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
    const invalid = parsed.items.find((item) => item.kind === 'invalid');
    const pending = parsed.items.flatMap((item): Pending[] => {
      if (item.kind === 'unknown') return [{ ...item, outside }];
      if (item.kind === 'need-grams') return [{ ...item, outside }];
      return [];
    });
    addHits(hits, outside);
    setQueue(pending);
    setLooking(pending[0]?.kind === 'unknown');
    setLookup(null);
    setGramsDraft(pending[0]?.kind === 'unknown' && pending[0].grams ? String(pending[0].grams) : '');
    setKcalDraft('');
    setError(invalid && invalid.kind === 'invalid' ? invalid.message : null);
    setDraft('');
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
      const ids = health.addLogs([{ date: today, title, grams, kcal, outside: current.outside, foodId: food.id }]);
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
  const alternates = pending?.kind === 'unknown' ? closeFoods(pending.name, health.foods) : [];
  const homeToday = todayLogs.some((log) => !log.outside);

  return (
    <div className="page today-page">
      <div className="today-status">
      <header className="topbar">
        <div>
          <h1 className="brand-sm">Healthify</h1>
          {health.profileName && <p className="who">{health.profileName}</p>}
          {health.syncError && <p className="help">Saved on this device for now. It will show on the others when the connection is back.</p>}
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
          <strong>{home.days}</strong>
          <small>{home.days === 1 ? 'day' : 'days'}</small>
        </button>
      </div>
      <p className="note">{targetNote(targetStreak)}</p>
      {home.brokeToday && <p className="note warn-text">Outside food today reset the home-meal streak.</p>}
      {!home.brokeToday && homeToday && <p className="note">Home meals today.</p>}

      <div className="ring-block">
        <Ring eaten={eaten} target={target} />
        <div className="ring-copy">
          <strong className={eaten > target ? 'over-num' : undefined}>{formatKcal(eaten)}</strong>
          <span>of {formatKcal(target)}</span>
        </div>
      </div>
      <p className={eaten > target || tight.over ? 'left over' : 'left'}>{roomSentence(tight)}</p>
      </div>

      <div className="today-log">
      <form className="composer" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="food">
          Add food
        </label>
        <input
          id="food"
          value={draft}
          placeholder="3 idli, rasam 200 ml, apple 150 gm"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {preview && <p className="preview">{preview}</p>}
        <div className="composer-actions">
          <button type="button" className={ateOut ? 'pill on' : 'pill'} aria-pressed={ateOut} onClick={() => setAteOut((value) => !value)}>
            Ate out
          </button>
          <button className="primary" type="submit">
            Add
          </button>
        </div>
        {ateOut && <p className="help">Everything in this box counts as outside food and resets the home-meal streak.</p>}
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

      {idea && (
        <section className="card suggest">
          <p className="eyebrow">{idea.fromLog ? 'From the log' : light ? 'If you’re still hungry' : 'Fits what’s left'}</p>
          <h2>{idea.title}</h2>
          <p>{idea.detail}</p>
          <div className="composer-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const parsed = parseFoodList(idea.query, health.foods);
                const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
                addHits(hits, false);
              }}
            >
              Add this
            </button>
            <button type="button" className="ghost" onClick={onOpenIdeas}>
              More ideas
            </button>
          </div>
        </section>
      )}

      <section className="meals">
        <h2>Today</h2>
        {todayLogs.length === 0 ? (
          <p className="empty">Nothing logged yet. Try 3 idli, rasam 200 ml, or apple 150 gm.</p>
        ) : (
          <ul className="meal-list">
            {todayLogs.map((log) => (
              <li key={log.id}>
                <button type="button" className="meal" onClick={() => setEditing(log)}>
                  <span>
                    <strong>{log.title}</strong>
                    {log.outside && <em className="tag">Outside</em>}
                  </span>
                  <b>{formatKcal(log.kcal)}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!health.data.hintDismissed && (
        <section className="card hint">
          <h2>Keep Healthify one tap away</h2>
          <p>
            On iPhone or iPad, open this in Safari, tap Share, then Add to Home Screen. On a Windows or Mac laptop, Chrome or Edge can install it from the address-bar icon. After an update, close it and open it again.
          </p>
          <button type="button" className="ghost" onClick={health.dismissHint}>
            Got it
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
