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
type Row = { key: string; name: string; amount: string; unit: Unit; manual: string };
type Status =
  | { kind: 'empty' }
  | { kind: 'known'; hit: FoodHit }
  | { kind: 'looking' }
  | { kind: 'found'; lookup: FoodLookup; grams: number; kcal: number }
  | { kind: 'missing'; grams: number; kcal: number | null };

function blank(): Row {
  return { key: crypto.randomUUID(), name: '', amount: '', unit: 'serving', manual: '' };
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
    const hit = known[index];
    if (hit) return { kind: 'known', hit };
    const key = name.toLowerCase();
    if (!(key in lookups)) return { kind: 'looking' };
    const lookup = lookups[key];
    if (lookup) {
      const grams = gramsFor(row, lookup.servingGrams ?? 100);
      return { kind: 'found', lookup, grams, kcal: Math.round((lookup.kcalPer100g * grams) / 100) };
    }
    const manual = Number(row.manual);
    return { kind: 'missing', grams: gramsFor(row, 100), kcal: row.manual.trim() && Number.isFinite(manual) ? manual : null };
  });

  const total = statuses.reduce((sum, status) => {
    if (status.kind === 'known') return sum + status.hit.kcal;
    if (status.kind === 'found') return sum + status.kcal;
    if (status.kind === 'missing') return sum + (status.kcal ?? 0);
    return sum;
  }, 0);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setError(null);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const filled = rows.map((row, index) => ({ row, status: statuses[index] })).filter((item) => item.status.kind !== 'empty');
    if (filled.length === 0) {
      setError('Add at least one dish.');
      return;
    }
    const looking = filled.find((item) => item.status.kind === 'looking');
    if (looking) {
      setError(`Still looking up ${cleanName(looking.row.name)}. Try again in a moment.`);
      return;
    }
    const missing = filled.find((item) => item.status.kind === 'missing' && (item.status.kcal == null || item.status.kcal < 0 || item.status.kcal > 4000));
    if (missing) {
      setError(`Type the calories for ${cleanName(missing.row.name)}, or remove that dish.`);
      return;
    }
    const name = (title.trim() || filled.map((item) => displayName(cleanName(item.row.name))).join(', ')).slice(0, 60);
    if (health.data.customIdeas.some((idea) => ideaKey(idea.title) === ideaKey(name))) {
      setError('You already have an idea with this name.');
      return;
    }
    for (const { row, status } of filled) {
      if (status.kind !== 'found' && status.kind !== 'missing') continue;
      const typed = cleanName(row.name).toLowerCase();
      const servingGrams = status.kind === 'found' ? (status.lookup.servingGrams ?? 100) : row.unit === 'serving' ? 100 : status.grams;
      const kcalPer100g = status.kind === 'found' ? status.lookup.kcalPer100g : ((status.kcal ?? 0) / Math.max(status.grams, 1)) * 100;
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
    health.addIdea(name, filled.map((item) => partFor(item.row)).join(', '), slot);
    onSaved(`Saved “${name}” to ${MEAL_LABEL[slot].toLowerCase()} ideas · ${formatKcal(total)} kcal.`);
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
                onChange={(event) => update(row.key, { name: event.target.value })}
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
            {status.kind === 'known' && (
              <p className="idea-row-note">
                {status.hit.title} · {formatKcal(status.hit.kcal)} kcal
              </p>
            )}
            {status.kind === 'looking' && <p className="idea-row-note">Looking up the calories…</p>}
            {status.kind === 'found' && (
              <p className="idea-row-note">
                About {formatKcal(status.lookup.kcalPer100g)} kcal per 100 g, from {status.lookup.detail} · {formatKcal(status.kcal)} kcal for {Math.round(status.grams)} {row.unit === 'ml' ? 'ml' : 'g'}
              </p>
            )}
            {status.kind === 'missing' && (
              <div className="idea-row-missing">
                <p className="idea-row-note">No listing turned up. Type the calories for this amount.</p>
                <input
                  aria-label={`Calories for ${cleanName(row.name)}`}
                  inputMode="numeric"
                  placeholder="kcal"
                  value={row.manual}
                  onChange={(event) => update(row.key, { manual: event.target.value.replace(/[^\d]/g, '') })}
                />
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
