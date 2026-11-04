import { useMemo, useState } from 'react';
import { MealEditor } from '../components/MealEditor';
import { buildReports, targetForDay } from '../lib/budget';
import { addDays, addMonths, eachDate, formatRange, formatShort, formatWeekday, todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { useHealth } from '../state';
import type { LogEntry, PeriodKind } from '../types';

type PeriodViewProps = {
  onOpenMore: () => void;
};

export function PeriodView({ onOpenMore }: PeriodViewProps) {
  const health = useHealth();
  const today = todayISO();
  const [kind, setKind] = useState<Exclude<PeriodKind, 'day'>>('week');
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(today);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const reports = useMemo(() => buildReports(health.data, today, anchor), [health.data, today, anchor]);
  const report = reports[kind];
  const hasCustom = health.data.profile.custom != null;
  const days = eachDate(report.start, report.end);

  function shift(direction: -1 | 1) {
    if (kind === 'month') setAnchor(addMonths(anchor, direction));
    else setAnchor(direction < 0 ? addDays(report.start, -1) : addDays(report.end, 1));
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand-sm">Period</h1>
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
            {kind !== 'custom' && (
              <div className="pager">
                <button type="button" className="ghost" onClick={() => shift(-1)}>
                  Previous
                </button>
                <button type="button" className="ghost" onClick={() => setAnchor(today)}>
                  Current
                </button>
                <button type="button" className="ghost" onClick={() => shift(1)}>
                  Next
                </button>
              </div>
            )}
          </section>
          <ul className="day-list">
            {days.map((iso) => {
              const dayTarget = targetForDay(health.data, iso);
              const entries = health.data.logs.filter((log) => log.date === iso);
              const dayEaten = entries.reduce((sum, log) => sum + log.kcal, 0);
              const future = iso > today;
              const missed = !future && iso < today && entries.length === 0;
              const over = entries.length > 0 && dayEaten > dayTarget;
              const pct = dayTarget <= 0 ? 0 : Math.min(100, (dayEaten / dayTarget) * 100);
              return (
                <li key={iso} className={iso === today ? 'day today' : 'day'}>
                  <button type="button" className="day-button" onClick={() => setOpenDay(openDay === iso ? null : iso)} aria-expanded={openDay === iso}>
                    <span className="day-name">
                      {formatWeekday(iso)} {formatShort(iso)}
                      {missed && <em>No log</em>}
                      {future && <em>Ahead</em>}
                    </span>
                    <span className="track" aria-hidden="true">
                      <span className={over ? 'fill over' : 'fill'} style={{ width: `${entries.length === 0 ? 0 : Math.max(pct, 4)}%` }} />
                    </span>
                    <b className={over ? 'over-num' : undefined}>{entries.length === 0 ? '—' : formatKcal(dayEaten)}</b>
                  </button>
                  {openDay === iso && (
                    entries.length === 0 ? (
                      <p className="empty">Nothing logged.</p>
                    ) : (
                      <ul className="meal-list inset">
                        {entries.map((log) => (
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
                    )
                  )}
                </li>
              );
            })}
          </ul>
          <p className="help">Green stays at or under that day’s target. Terracotta is over. A past day with no log ends the on-target streak.</p>
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
