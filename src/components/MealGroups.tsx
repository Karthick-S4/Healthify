import { todayISO } from '../lib/dates';
import { formatKcal } from '../lib/format';
import { MEAL_LABEL, MEAL_SLOTS, slotForHour } from '../lib/suggestions';
import type { LogEntry, MealSlot } from '../types';

type MealGroupsProps = {
  logs: LogEntry[];
  onOpen: (log: LogEntry) => void;
};

function mealOf(log: LogEntry): MealSlot | null {
  if (log.meal) return log.meal;
  const logged = new Date(log.createdAt);
  if (Number.isNaN(logged.getTime()) || todayISO(logged) !== log.date) return null;
  return slotForHour(logged.getHours());
}

export function MealGroups({ logs, onOpen }: MealGroupsProps) {
  const sorted = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups = [...MEAL_SLOTS, null].flatMap((slot) => {
    const items = sorted.filter((log) => mealOf(log) === slot);
    return items.length === 0 ? [] : [{ slot, items, kcal: items.reduce((sum, log) => sum + log.kcal, 0) }];
  });
  return (
    <>
      {groups.map((group) => (
        <div key={group.slot ?? 'other'} className="meal-group">
          <p className="meal-group-head">
            <span>{group.slot ? MEAL_LABEL[group.slot] : 'Other'}</span>
            <span>{formatKcal(group.kcal)} kcal</span>
          </p>
          <ul className="meal-list">
            {group.items.map((log) => (
              <li key={log.id}>
                <button type="button" className="meal" onClick={() => onOpen(log)}>
                  <span>
                    <strong>{log.title}</strong>
                    {log.outside && <em className="tag">Outside</em>}
                  </span>
                  <b>{formatKcal(log.kcal)}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
