import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { correctQuery } from '../lib/foods';
import { formatKcal } from '../lib/format';
import { lookupCalories, type FoodLookup } from '../lib/lookupFood';
import { parseFoodList, type FoodHit } from '../lib/parseFood';
import { ideaKey, MEAL_LABEL, slotForHour } from '../lib/suggestions';
import { useHealth } from '../state';
import type { Food, MealSlot } from '../types';
import { MealPicker } from './MealPicker';

type Unit = 'serving' | 'g' | 'ml';
type Row = { key: string; name: string; amount: string; unit: Unit; manual: string; editing: boolean };
type Status =
  | { kind: 'empty' }
  | { kind: 'known'; hit: FoodHit; estimate: number; kcal: number | null }
  | { kind: 'looking'; grams: number; kcal: number | null }
  | { kind: 'found'; lookup: FoodLookup; grams: number; estimate: number; kcal: number | null }
  | { kind: 'missing'; grams: number; kcal: number | null };

function blank(): Row {
  return { key: crypto.randomUUID(), name: '', amount: '', unit: 'serving', manual: '', editing: false };
}

function typedKcal(row: Row): number | null {
  const value = Number(row.manual);
  return row.manual.trim() && Number.isFinite(value) && value <= 4000 ? Math.round(value) : null;
}

function kcalOf(status: Status): number | null {
  if (status.kind === 'empty') return null;
  if (status.kind === 'known' || status.kind === 'found') return status.kcal ?? status.estimate;
  return status.kcal;
}

function cleanName(name: string): string {
  return name.replace(/[,+]/g, ' ').replace(/\s+/g, ' ').trim();
}

function amountOf(row: Row): number | null {
  const value = Number(row.amount);
  return row.amount.trim() && Number.isFinite(value) && value > 0 ? value : null;
}

function partFor(row: Row): string {
  const name = cleanName(row.name);
  const amount = amountOf(row);
  if (row.unit === 'serving') return amount ? `${amount} ${name}` : name;
  return `${name} ${amount ?? 100}${row.unit}`;
}

function gramsFor(row: Row, servingGrams: number): number {
  const amount = amountOf(row);
  if (row.unit === 'serving') return servingGrams * (amount ?? 1);
  return amount ?? 100;
}

function displayName(name: string): string {
  return name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function IdeaForm({ onSaved }: { onSaved: (message: string) => void }) {
  const health = useHealth();
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank()]);
  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState<MealSlot>(() => slotForHour(new Date().getHours()));
  const [lookups, setLookups] = useState<Record<string, FoodLookup | null>>({});
  const [error, setError] = useState<string | null>(null);

  const known = useMemo(
    () =>
      rows.map((row) => {
        if (!cleanName(row.name)) return null;
        const items = parseFoodList(partFor(row), health.foods).items;
        return items.length === 1 && items[0].kind === 'food' ? items[0] : null;
      }),
    [rows, health.foods],
  );

  const unknownNames = rows
    .map((row, index) => (cleanName(row.name) && !known[index] ? cleanName(row.name).toLowerCase() : ''))
    .filter((name) => name && !(name in lookups));
  const pendingKey = [...new Set(unknownNames)].join('|');

  useEffect(() => {
    if (!pendingKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      for (const name of pendingKey.split('|')) {
        void lookupCalories(name, health.foods, controller.signal).then((hit) => {
          if (!controller.signal.aborted) setLookups((current) => ({ ...current, [name]: hit }));
        });
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pendingKey, health.foods]);

  const statuses: Status[] = rows.map((row, index) => {
    const name = cleanName(row.name);
    if (!name) return { kind: 'empty' };
    const typed = row.editing ? typedKcal(row) : null;
    const hit = known[index];
    if (hit) return { kind: 'known', hit, estimate: hit.kcal, kcal: typed };
    const key = name.toLowerCase();
    if (!(key in lookups)) return { kind: 'looking', grams: gramsFor(row, 100), kcal: typed };
    const lookup = lookups[key];
    if (lookup) {
      const grams = gramsFor(row, lookup.servingGrams ?? 100);
      return { kind: 'found', lookup, grams, estimate: Math.round((lookup.kcalPer100g * grams) / 100), kcal: typed };
    }
    return { kind: 'missing', grams: gramsFor(row, 100), kcal: typedKcal(row) };
  });

  const total = statuses.reduce((sum, status) => sum + (kcalOf(status) ?? 0), 0);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setError(null);
  }

  function startEditing(row: Row, status: Status) {
    const start = kcalOf(status);
    update(row.key, { editing: true, manual: start != null ? String(start) : '' });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const filled = rows.map((row, index) => ({ row, status: statuses[index] })).filter((item) => item.status.kind !== 'empty');
    if (filled.length === 0) {
      setError('Add at least one dish.');
      return;
    }
    const looking = filled.find((item) => item.status.kind === 'looking' && item.status.kcal == null);
    if (looking) {
      setError(`Still looking up ${cleanName(looking.row.name)}. Wait a moment, or type its calories.`);
      return;
    }
    const blankKcal = filled.find((item) => kcalOf(item.status) == null);
    if (blankKcal) {
      setError(`Type the calories for ${cleanName(blankKcal.row.name)}, or remove that dish.`);
      return;
    }
    const corrections = filled.flatMap(({ row, status }) =>
      status.kind === 'known' && status.kcal != null && status.kcal !== status.estimate
        ? [{ row, food: status.hit.food, kcal: status.kcal, kcalPer100g: Math.round(((status.kcal * 100) / Math.max(status.hit.grams, 1)) * 10) / 10 }]
        : [],
    );
    const tooRich = corrections.find((item) => item.kcalPer100g > 900);
    if (tooRich) {
      setError(`${formatKcal(tooRich.kcal)} kcal is too much for that amount of ${tooRich.food.name}. Check the amount or the calories.`);
      return;
    }
    const name = (title.trim() || filled.map((item) => displayName(cleanName(item.row.name))).join(', ')).slice(0, 60);
    if (health.data.customIdeas.some((idea) => ideaKey(idea.title) === ideaKey(name))) {
      setError('You already have an idea with this name.');
      return;
    }
    for (const { row, status } of filled) {
      if (status.kind === 'empty' || status.kind === 'known') continue;
      const typed = cleanName(row.name).toLowerCase();
      const servingGrams = status.kind === 'found' ? (status.lookup.servingGrams ?? 100) : row.unit === 'serving' ? 100 : status.grams;
      const kcalPer100g =
        status.kind === 'found' && status.kcal == null ? status.lookup.kcalPer100g : ((kcalOf(status) ?? 0) / Math.max(status.grams, 1)) * 100;
      const food: Food = {
        id: crypto.randomUUID(),
        name: displayName(cleanName(row.name)),
        group: 'Yours',
        aliases: [...new Set([typed, correctQuery(typed, health.foods)].filter(Boolean))],
        kcalPer100g,
        pieceGrams: servingGrams,
        pieceLabel: 'serving',
        source: 'custom',
      };
      health.addCustomFood(food);
    }
    for (const { food, kcalPer100g } of corrections) {
      if (food.source === 'custom') health.updateCustomFood(food.id, { kcalPer100g, pieceGrams: food.pieceGrams });
      else health.tweakFood(food.id, { kcalPer100g, pieceGrams: food.pieceGrams });
    }
    health.addIdea(name, filled.map((item) => partFor(item.row)).join(', '), slot);
    const updated = corrections.length > 0 ? ` Updated ${corrections.map((item) => item.food.name).join(', ')} for every profile.` : '';
    onSaved(`Saved “${name}” to ${MEAL_LABEL[slot].toLowerCase()} ideas · ${formatKcal(total)} kcal.${updated}`);
    setRows([blank(), blank()]);
    setTitle('');
    setError(null);
  }

  return (
    <form className="inline-form idea-form" onSubmit={save}>
      <MealPicker value={slot} onChange={setSlot} />
      {rows.map((row, index) => {
        const status = statuses[index];
        const label = status.kind === 'known' ? status.hit.food.pieceLabel : 'serving';
        return (
          <div key={row.key} className="idea-row">
            <div className="idea-row-fields">
              <input
                aria-label={`Dish ${index + 1}`}
                placeholder={index === 0 ? 'Rice' : index === 1 ? 'Dal' : 'Dish'}
                value={row.name}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => update(row.key, { name: event.target.value, editing: false, manual: '' })}
              />
              <input
                className="idea-amount"
                aria-label={`Amount of dish ${index + 1}`}
                inputMode="decimal"
                placeholder="1"
                value={row.amount}
                onChange={(event) => update(row.key, { amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') })}
              />
              <select aria-label={`Unit for dish ${index + 1}`} value={row.unit} onChange={(event) => update(row.key, { unit: event.target.value as Unit })}>
                <option value="serving">{label}</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
              </select>
              {rows.length > 1 && (
                <button type="button" className="icon-button" aria-label={`Remove dish ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                  ×
                </button>
              )}
            </div>
            {status.kind !== 'empty' && (
              <div className="idea-row-note">
                <span>
                  {status.kind === 'known' && status.hit.title}
                  {status.kind === 'looking' && 'Looking up the calories…'}
                  {status.kind === 'found' &&
                    `About ${formatKcal(status.lookup.kcalPer100g)} kcal per 100 g, from ${status.lookup.detail}, for ${Math.round(status.grams)} ${row.unit === 'ml' ? 'ml' : 'g'}`}
                  {status.kind === 'missing' && 'Not found. Type the calories for this amount'}
                </span>
                {row.editing || status.kind === 'missing' ? (
                  <span className="idea-kcal">
                    <input
                      aria-label={`Calories for ${cleanName(row.name)}`}
                      inputMode="numeric"
                      placeholder="kcal"
                      value={row.manual}
                      autoFocus={row.editing}
                      onChange={(event) => update(row.key, { manual: event.target.value.replace(/[^\d]/g, '') })}
                    />
                    kcal
                    {(status.kind === 'known' || status.kind === 'found') && (
                      <button type="button" className="text-button" onClick={() => update(row.key, { editing: false, manual: '' })}>
                        Use {formatKcal(status.estimate)}
                      </button>
                    )}
                  </span>
                ) : status.kind === 'looking' ? (
                  <button type="button" className="text-button" onClick={() => startEditing(row, status)}>
                    Type it myself
                  </button>
                ) : (
                  <button type="button" className="idea-kcal-edit" aria-label={`Edit calories for ${cleanName(row.name)}`} onClick={() => startEditing(row, status)}>
                    {formatKcal(status.estimate)} kcal ✎
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="ghost" onClick={() => setRows((current) => [...current, blank()])}>
        + Add another dish
      </button>
      <label className="field-label" htmlFor="idea-name">
        Name (optional)
      </label>
      <input id="idea-name" value={title} autoCapitalize="sentences" placeholder="Rice and dal lunch" onChange={(event) => setTitle(event.target.value)} />
      {total > 0 && <p className="preview">Total about {formatKcal(total)} kcal</p>}
      <button className="primary" type="submit">
        Save idea
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
