import { useMemo, useState } from 'react';
import { buildReports, type RoomReport } from '../lib/budget';
import { todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { parseFoodList, type FoodHit } from '../lib/parseFood';
import { suggestMeals } from '../lib/suggestions';
import { useHealth } from '../state';
import type { PeriodKind } from '../types';

type IdeasViewProps = {
  onOpenMore: () => void;
};

function explain(report: RoomReport): string {
  if (report.kind !== 'day' && report.status === 'before') return 'This range has not started.';
  if (report.kind !== 'day' && report.status === 'after') return 'This range has ended.';
  if (report.eatenToday > report.dailyTarget) {
    return 'Today is over the calorie target. The on-target streak resets unless today’s total comes back under it.';
  }
  if (report.kind !== 'day') {
    const todayLeft = Math.max(report.dailyTarget - report.eatenToday, 0);
    if (report.over) return `${report.label} is ${formatKcal(Math.abs(report.remaining))} kcal over budget.`;
    if (report.limiter === 'period') {
      return `${formatKcal(report.remaining)} kcal left this ${report.label.toLowerCase()}, so about ${formatKcal(report.room)} kcal more today.`;
    }
    return `${formatKcal(report.remaining)} kcal left this ${report.label.toLowerCase()}. Today still has ${formatKcal(todayLeft)} kcal.`;
  }
  if (report.over) return `${report.label} is ${formatKcal(Math.abs(report.remaining))} kcal over budget.`;
  const left = Math.max(report.dailyTarget - report.eatenToday, 0);
  return left === 0 ? 'Today is exactly on target.' : `${formatKcal(left)} kcal left today.`;
}

export function IdeasView({ onOpenMore }: IdeasViewProps) {
  const health = useHealth();
  const today = todayISO();
  const [kind, setKind] = useState<PeriodKind>('day');
  const reports = useMemo(() => buildReports(health.data, today, today), [health.data, today]);
  const report = reports[kind];
  const missingCustom = kind === 'custom' && health.data.profile.custom == null;
  const todayOver = report.eatenToday > report.dailyTarget;
  const light = todayOver || report.over;
  const ideas = useMemo(() => {
    if (missingCustom || report.status !== 'during') return [];
    return suggestMeals({
      foods: health.foods,
      logs: health.data.logs,
      today,
      room: report.room,
      hour: new Date().getHours(),
      light,
    });
  }, [missingCustom, report, health.foods, health.data.logs, today, light]);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand-sm">Ideas</h1>
      </header>
      <div className="seg" role="tablist" aria-label="Budget to use">
        {(['day', 'week', 'month', 'custom'] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={kind === item} className={kind === item ? 'on' : undefined} onClick={() => setKind(item)}>
            {item === 'day' ? 'Today' : item === 'week' ? 'Week' : item === 'month' ? 'Month' : 'Custom'}
          </button>
        ))}
      </div>
      {missingCustom ? (
        <section className="card">
          <h2>No custom range yet</h2>
          <p>Set a start, an end, and a calorie budget, then ideas can follow what’s left.</p>
          <button type="button" className="primary" onClick={onOpenMore}>
            Set the range
          </button>
        </section>
      ) : (
        <div className="split">
          <section className="summary">
            <p className="eyebrow">{report.label}</p>
            {report.over ? (
              <p className="summary-num">
                <span className="over-num">{formatKcal(Math.abs(report.remaining))}</span>
                <span> kcal over</span>
              </p>
            ) : (
              <p className="summary-num">
                {formatKcal(report.remaining)}
                <span> kcal left</span>
              </p>
            )}
            <p className="note">{explain(report)}</p>
          </section>
          {ideas.length === 0 ? (
            <p className="empty">
              {report.room > 0 && report.room < 40
                ? `${formatKcal(report.room)} kcal is left. Nothing in the list fits, and a suggested meal would go over.`
                : 'Nothing to suggest for this budget right now.'}
            </p>
          ) : (
            <ul className="idea-list">
              {ideas.map((idea) => (
                <li key={idea.query} className="card idea">
                  <p className="eyebrow">{idea.fromLog ? 'From the log' : light ? 'If you’re still hungry' : 'Fits the budget'}</p>
                  <h2>{idea.title}</h2>
                  <p>{idea.detail}</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      const parsed = parseFoodList(idea.query, health.foods);
                      const hits = parsed.items.filter((item): item is FoodHit => item.kind === 'food');
                      const ids = health.addLogs(
                        hits.map((hit) => ({
                          date: today,
                          title: hit.title,
                          grams: hit.grams,
                          kcal: hit.kcal,
                          outside: false,
                          foodId: hit.food.id,
                        })),
                      );
                      health.setUndo({ ids, message: `Added ${idea.title} · ${formatKcal(idea.kcal)} kcal` });
                    }}
                  >
                    Add this
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="help">Suggestions are home meals. Calories are estimates from standard portions, and you can correct any food in More.</p>
        </div>
      )}
    </div>
  );
}
