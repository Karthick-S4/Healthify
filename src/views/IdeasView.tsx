import { useMemo, useState } from 'react';
import { IdeaForm } from '../components/IdeaForm';
import { buildReports, type RoomReport } from '../lib/budget';
import { todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { parseFoodList, type FoodHit } from '../lib/parseFood';
import { KIND_LABEL, MEAL_LABEL, proteinEaten, slotForHour, suggestMeals } from '../lib/suggestions';
import { useHealth } from '../state';
import type { PeriodKind } from '../types';

function YourIdeas() {
  const health = useHealth();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const mine = health.data.customIdeas;

  return (
    <section className="card add-idea">
      <div className="streak-head">
        <h2>Your own ideas</h2>
        {open && (
          <button type="button" className="text-button" onClick={() => setOpen(false)}>
            Close
          </button>
        )}
      </div>
      {!open && (
        <>
          <p className="note">Save meals you like. They show first when they fit what’s left.</p>
          <button type="button" className="primary" onClick={() => { setOpen(true); setSaved(null); }}>
            {mine.length > 0 ? `Add an idea · ${mine.length} saved` : 'Add an idea'}
          </button>
        </>
      )}
      {saved && <p className="preview">{saved}</p>}
      {open && <IdeaForm onSaved={setSaved} />}
      {open && mine.length > 0 && (
        <ul className="meal-list">
          {mine.map((idea) => (
            <li key={idea.id}>
              <div className="meal">
                <span>
                  <strong>{idea.title}</strong>
                  <small>
                    {MEAL_LABEL[idea.slot]} · {idea.query}
                  </small>
                </span>
                <button type="button" className="icon-button" aria-label={`Delete ${idea.title}`} onClick={() => health.removeIdea(idea.title, idea.id)}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
  const missingCustom = kind === 'custom' && health.data.profile.ranges.length === 0;
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
      custom: health.data.customIdeas,
      hidden: new Set(health.data.hiddenIdeas.map((entry) => entry.key)),
    });
  }, [missingCustom, report, health.foods, health.data.logs, health.data.customIdeas, health.data.hiddenIdeas, today, light]);
  const hiddenCount = health.data.hiddenIdeas.length;
  const protein = useMemo(
    () => proteinEaten(health.data.logs.filter((log) => log.date === today), health.foods),
    [health.data.logs, health.foods, today],
  );
  const groups = (['yours', 'protein', 'fit', 'fill', 'usual', 'more', 'light'] as const)
    .map((kind) => ({ kind, items: ideas.filter((idea) => idea.kind === kind) }))
    .filter((group) => group.items.length > 0);

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
      <YourIdeas />
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
            {protein != null && <p className="note">About {protein} g protein so far today.</p>}
          </section>
          {ideas.length === 0 ? (
            <p className="empty">
              {report.room > 0 && report.room < 40
                ? `${formatKcal(report.room)} kcal is left. Nothing in the list fits, and a suggested meal would go over.`
                : 'Nothing to suggest for this budget right now.'}
            </p>
          ) : (
            <div className="idea-groups">
              {groups.map((group) => (
                <section key={group.kind} className="idea-group">
                  <h2 className="idea-heading">{KIND_LABEL[group.kind]}</h2>
                  <ul className="idea-list">
                    {group.items.map((idea) => (
                      <li key={idea.query} className="card idea">
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
                                meal: slotForHour(new Date().getHours()),
                              })),
                            );
                            health.setUndo({ ids, message: `Added ${idea.title} · ${formatKcal(idea.kcal)} kcal` });
                          }}
                        >
                          Add this
                        </button>
                        <button
                          type="button"
                          className="text-button idea-hide"
                          onClick={() => health.removeIdea(idea.title, idea.customId)}
                        >
                          {idea.customId ? 'Delete this idea' : 'Not for me'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {hiddenCount > 0 && (
            <p className="help">
              {hiddenCount === 1 ? '1 idea is hidden.' : `${hiddenCount} ideas are hidden.`}{' '}
              <button type="button" className="text-button" onClick={health.restoreIdeas}>
                Show them again
              </button>
            </p>
          )}
          <p className="help">Suggestions are home meals. Calories are estimates from standard portions, and you can correct any food in More.</p>
        </div>
      )}
    </div>
  );
}
