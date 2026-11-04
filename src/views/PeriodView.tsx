import { useMemo, useState } from 'react';
import { IconBack } from '../components/Icons';
import { MealEditor } from '../components/MealEditor';
import { buildReports, targetForDay } from '../lib/budget';
import { addDays, addMonths, eachDate, formatLong, formatRange, parseISO, todayISO, weekRange } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { useHealth } from '../state';
import type { LogEntry, PeriodKind } from '../types';

type PeriodViewProps = {
  onOpenMore: () => void;
};

type DayTone = 'under' | 'near' | 'over' | 'empty' | 'future' | 'outside';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NEAR_SHARE = 0.85;

function toneFor(eaten: number, target: number, logged: boolean): DayTone {
  if (!logged) return 'empty';
  if (eaten > target) return 'over';
  return eaten >= target * NEAR_SHARE ? 'near' : 'under';
}

export function PeriodView({ onOpenMore }: PeriodViewProps) {
  const health = useHealth();
  const today = todayISO();
  const [kind, setKind] = useState<Exclude<PeriodKind, 'day'>>('week');
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<string>(today);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const reports = useMemo(() => buildReports(health.data, today, anchor), [health.data, today, anchor]);
  const report = reports[kind];
  const hasCustom = health.data.profile.custom != null;

  const byDay = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const log of health.data.logs) {
      const list = map.get(log.date);
      if (list) list.push(log);
      else map.set(log.date, [log]);
    }
    return map;
  }, [health.data.logs]);

  const grid = eachDate(weekRange(report.start).start, weekRange(report.end).end);
  const selected = picked >= report.start && picked <= report.end ? picked : report.start <= today && today <= report.end ? today : report.start;
  const selectedLogs = byDay.get(selected) ?? [];
  const selectedEaten = selectedLogs.reduce((sum, log) => sum + log.kcal, 0);
  const selectedTarget = targetForDay(health.data, selected);
  const selectedTone = toneFor(selectedEaten, selectedTarget, selectedLogs.length > 0);
  const isCurrent = report.start <= today && today <= report.end;
  const title =
    kind === 'month' ? parseISO(report.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : formatRange(report.start, report.end);

  function shift(direction: -1 | 1) {
    if (kind === 'month') setAnchor(addMonths(anchor, direction));
    else setAnchor(direction < 0 ? addDays(report.start, -1) : addDays(report.end, 1));
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand-sm">History</h1>
        <p className="dateline">{formatRange(report.start, report.end)}</p>
      </header>
      <div className="seg" role="tablist" aria-label="Time range">
        {(['week', 'month', 'custom'] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={kind === item} className={kind === item ? 'on' : undefined} onClick={() => setKind(item)}>
            {item === 'week' ? 'Week' : item === 'month' ? 'Month' : 'Custom'}
          </button>
        ))}
      </div>

      {kind === 'custom' && !hasCustom ? (
        <section className="card">
          <h2>Set a custom range</h2>
          <p>Choose a start, an end, and a total calorie budget. Ideas will use what’s left in that range.</p>
          <button type="button" className="primary" onClick={onOpenMore}>
            Set the range
          </button>
        </section>
      ) : (
        <div className="split">
          <section className="summary">
            <p className="eyebrow">{report.over ? 'Over budget' : 'Within budget'}</p>
            <p className="summary-num">
              {formatKcal(report.eaten)}
              <span> of {formatKcal(report.budget)}</span>
            </p>
            <p className="note">
              {report.over
                ? `${formatKcal(Math.abs(report.remaining))} kcal over this ${kind}.`
                : `${formatKcal(report.remaining)} kcal left.`}
              {health.data.profile.weekBudget == null && kind === 'week' && ' Week budget follows the daily target.'}
              {health.data.profile.monthBudget == null && kind === 'month' && ' Month budget follows the daily target.'}
            </p>
          </section>

          <div className="history-side">
            <section className="card calendar-card">
              <div className="calendar-head">
                {kind !== 'custom' && (
                  <button type="button" className="cal-arrow" aria-label={`Previous ${kind}`} onClick={() => shift(-1)}>
                    <IconBack />
                  </button>
                )}
                <h2>{title}</h2>
                {kind !== 'custom' && (
                  <button type="button" className="cal-arrow next" aria-label={`Next ${kind}`} onClick={() => shift(1)}>
                    <IconBack />
                  </button>
                )}
              </div>
              {kind !== 'custom' && !isCurrent && (
                <button type="button" className="text-button cal-today" onClick={() => setAnchor(today)}>
                  Back to {kind === 'week' ? 'this week' : 'this month'}
                </button>
              )}
              <div className="calendar" role="grid" aria-label="Calories by day">
                {WEEKDAYS.map((letter, index) => (
                  <span key={index} className="cal-weekday" aria-hidden="true">
                    {letter}
                  </span>
                ))}
                {grid.map((iso) => {
                  const logs = byDay.get(iso) ?? [];
                  const eaten = logs.reduce((sum, log) => sum + log.kcal, 0);
                  const inRange = iso >= report.start && iso <= report.end;
                  const tone: DayTone = !inRange ? 'outside' : iso > today ? 'future' : toneFor(eaten, targetForDay(health.data, iso), logs.length > 0);
                  const classes = ['cal-day', tone, iso === today ? 'today' : '', iso === selected ? 'picked' : ''].filter(Boolean).join(' ');
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={classes}
                      disabled={!inRange}
                      aria-pressed={iso === selected}
                      aria-label={`${formatLong(iso)}, ${logs.length > 0 ? `${formatKcal(eaten)} kcal` : 'nothing logged'}`}
                      onClick={() => setPicked(iso)}
                    >
                      <span className="cal-date">{parseISO(iso).getDate()}</span>
                      <span className="cal-kcal">{logs.length > 0 ? formatKcal(eaten) : inRange && iso <= today ? '—' : ''}</span>
                    </button>
                  );
                })}
              </div>
              <p className="cal-legend">
                <span className="dot under" /> Under
                <span className="dot near" /> On target
                <span className="dot over" /> Over
              </p>
            </section>

            <section className="card day-detail">
              <div className="day-detail-head">
                <div>
                  <p className="eyebrow">{selected === today ? 'Today' : formatLong(selected)}</p>
                  <p className={selectedTone === 'over' ? 'day-total over' : 'day-total'}>
                    {formatKcal(selectedEaten)}
                    <span> of {formatKcal(selectedTarget)} kcal</span>
                  </p>
                </div>
                {selectedLogs.length > 0 && (
                  <span className={`tone-chip ${selectedTone}`}>
                    {selectedTone === 'over'
                      ? `${formatKcal(selectedEaten - selectedTarget)} over`
                      : selectedTone === 'near'
                        ? 'On target'
                        : `${formatKcal(selectedTarget - selectedEaten)} under`}
                  </span>
                )}
              </div>
              {selectedLogs.length === 0 ? (
                <p className="empty">{selected > today ? 'This day hasn’t come yet.' : 'Nothing logged this day.'}</p>
              ) : (
                <ul className="meal-list">
                  {selectedLogs.map((log) => (
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
          </div>
        </div>
      )}
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
