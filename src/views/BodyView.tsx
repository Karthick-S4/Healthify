import { useMemo, useState, type FormEvent } from 'react';
import { TrendChart } from '../components/TrendChart';
import { addDays, formatShort, todayISO } from '../lib/dates';
import { useHealth } from '../state';
import { MEASURE_PARTS, measureRank } from '../lib/measures';
import type { MeasureEntry } from '../types';

function decimal(value: string): string {
  return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
}

function change(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return 'No change';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ${unit}`;
}

export function BodyView() {
  const health = useHealth();
  const today = todayISO();
  const [kg, setKg] = useState('');
  const [weightDate, setWeightDate] = useState(today);
  const [part, setPart] = useState('');
  const [cm, setCm] = useState('');
  const [measureDate, setMeasureDate] = useState(today);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const [openPart, setOpenPart] = useState<string | null>(null);

  const weights = useMemo(() => [...health.data.weights].sort((a, b) => (a.date < b.date ? -1 : 1)), [health.data.weights]);
  const shown = weights.filter((entry) => entry.date >= addDays(today, -range));
  const latest = weights[weights.length - 1];
  const first = shown[0];
  const weekAgo = latest ? [...weights].reverse().find((entry) => entry.date <= addDays(latest.date, -7)) : undefined;
  const lowest = shown.length > 0 ? Math.min(...shown.map((entry) => entry.kg)) : null;

  const parts = useMemo(() => {
    const groups = new Map<string, MeasureEntry[]>();
    for (const entry of [...health.data.measures].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const key = entry.part.toLocaleLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.values()].sort((a, b) => measureRank(a[0].part) - measureRank(b[0].part) || (a[a.length - 1].date < b[b.length - 1].date ? 1 : -1));
  }, [health.data.measures]);

  const partNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const name of [...MEASURE_PARTS, ...parts.map((group) => group[group.length - 1].part)]) {
      if (!names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name);
    }
    return [...names.values()];
  }, [parts]);

  function saveWeight(event: FormEvent) {
    event.preventDefault();
    const value = Number(kg);
    if (!Number.isFinite(value) || value < 20 || value > 300) {
      setWeightError('Weight goes from 20 to 300 kg.');
      return;
    }
    if (weightDate > today) {
      setWeightError('Pick today or an earlier day.');
      return;
    }
    health.addWeight(weightDate, Math.round(value * 10) / 10);
    setKg('');
    setWeightDate(today);
    setWeightError(null);
  }

  function saveMeasure(event: FormEvent) {
    event.preventDefault();
    const name = part.trim();
    const value = Number(cm);
    if (!name || name.length > 32) {
      setMeasureError('Write which measurement, like waist.');
      return;
    }
    if (!Number.isFinite(value) || value < 5 || value > 300) {
      setMeasureError('Measurements go from 5 to 300 cm.');
      return;
    }
    if (measureDate > today) {
      setMeasureError('Pick today or an earlier day.');
      return;
    }
    const known = partNames.find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
    health.addMeasure(measureDate, known ?? name, Math.round(value * 10) / 10);
    setCm('');
    setMeasureDate(today);
    setMeasureError(null);
  }

  return (
    <div className="page board">
      <header className="topbar">
        <h1 className="brand-sm">Body</h1>
        {health.profileName && <p className="dateline">{health.profileName}</p>}
      </header>

      <section className="card">
        <div className="streak-head">
          <h2>Weight</h2>
          {latest && <p className="streak-week">Last {formatShort(latest.date)}</p>}
        </div>
        {latest ? (
          <>
            <p className="streak-num">
              {latest.kg}
              <span> kg</span>
            </p>
            <div className="stat-row">
              {weekAgo && (
                <p>
                  <span>Since a week ago</span>
                  <strong>{change(latest.kg - weekAgo.kg, 'kg')}</strong>
                </p>
              )}
              {first && first.id !== latest.id && (
                <p>
                  <span>Since {formatShort(first.date)}</span>
                  <strong>{change(latest.kg - first.kg, 'kg')}</strong>
                </p>
              )}
              {lowest != null && shown.length > 1 && (
                <p>
                  <span>Lowest</span>
                  <strong>{lowest} kg</strong>
                </p>
              )}
            </div>
            <div className="seg" role="tablist" aria-label="Weight range">
              {([30, 90, 365] as const).map((days) => (
                <button key={days} type="button" role="tab" aria-selected={range === days} className={range === days ? 'on' : undefined} onClick={() => setRange(days)}>
                  {days === 30 ? 'Month' : days === 90 ? '3 months' : 'Year'}
                </button>
              ))}
            </div>
            {shown.length > 1 ? (
              <TrendChart unit="kg" points={shown.map((entry) => ({ iso: entry.date, value: entry.kg }))} />
            ) : (
              <p className="note">Add another day to see the trend.</p>
            )}
          </>
        ) : (
          <p className="note">Weigh in once a week, at the same time of day, for the clearest trend.</p>
        )}
        <form className="inline-form" onSubmit={saveWeight}>
          <div className="two-fields">
            <div>
              <label className="field-label" htmlFor="weight-kg">
                Weight in kg
              </label>
              <input id="weight-kg" inputMode="decimal" value={kg} onChange={(event) => setKg(decimal(event.target.value))} />
            </div>
            <div>
              <label className="field-label" htmlFor="weight-date">
                Day
              </label>
              <input id="weight-date" type="date" max={today} value={weightDate} onChange={(event) => setWeightDate(event.target.value || today)} />
            </div>
          </div>
          <button className="primary" type="submit">
            Save weight
          </button>
          {weightError && <p className="error">{weightError}</p>}
        </form>
        {weights.length > 0 && (
          <ul className="meal-list">
            {[...weights].reverse().slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <div className="meal">
                  <span>
                    <strong>{entry.kg} kg</strong>
                    <small>{formatShort(entry.date)}</small>
                  </span>
                  <button type="button" className="icon-button" aria-label={`Delete ${entry.kg} kg on ${formatShort(entry.date)}`} onClick={() => health.removeEntries([entry.id])}>
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Measurements</h2>
        <form className="inline-form" onSubmit={saveMeasure}>
          <label className="field-label" htmlFor="measure-part">
            Measurement
          </label>
          <input
            id="measure-part"
            value={part}
            list="measure-parts"
            autoCapitalize="words"
            onChange={(event) => {
              setPart(event.target.value);
              setMeasureError(null);
            }}
          />
          <datalist id="measure-parts">
            {partNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="alt-row">
            {partNames.map((name) => (
              <button key={name} type="button" className={part.toLocaleLowerCase() === name.toLocaleLowerCase() ? 'pill pick on' : 'pill pick'} onClick={() => setPart(name)}>
                {name}
              </button>
            ))}
          </div>
          <div className="two-fields">
            <div>
              <label className="field-label" htmlFor="measure-cm">
                cm
              </label>
              <input id="measure-cm" inputMode="decimal" value={cm} onChange={(event) => setCm(decimal(event.target.value))} />
            </div>
            <div>
              <label className="field-label" htmlFor="measure-date">
                Day
              </label>
              <input id="measure-date" type="date" max={today} value={measureDate} onChange={(event) => setMeasureDate(event.target.value || today)} />
            </div>
          </div>
          <button className="primary" type="submit">
            Save measurement
          </button>
          {measureError && <p className="error">{measureError}</p>}
        </form>

        {parts.length === 0 ? (
          <p className="note">Measure the same spot each time, so the trend is fair.</p>
        ) : (
          <ul className="part-list">
            {parts.map((group) => {
              const last = group[group.length - 1];
              const start = group[0];
              const key = last.part.toLocaleLowerCase();
              const open = openPart === key;
              return (
                <li key={key} className="part">
                  <button type="button" className="part-head" aria-expanded={open} onClick={() => setOpenPart(open ? null : key)}>
                    <span>
                      <strong>{last.part}</strong>
                      <small>
                        {group.length > 1 ? `${change(last.cm - start.cm, 'cm')} since ${formatShort(start.date)}` : formatShort(last.date)}
                      </small>
                    </span>
                    <b>{last.cm} cm</b>
                  </button>
                  {group.length > 1 && <TrendChart compact unit="cm" points={group.map((entry) => ({ iso: entry.date, value: entry.cm }))} />}
                  {open && (
                    <ul className="meal-list">
                      {[...group].reverse().map((entry) => (
                        <li key={entry.id}>
                          <div className="meal">
                            <span>
                              <strong>{entry.cm} cm</strong>
                              <small>{formatShort(entry.date)}</small>
                            </span>
                            <button type="button" className="icon-button" aria-label={`Delete ${entry.part} ${entry.cm} cm`} onClick={() => health.removeEntries([entry.id])}>
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
