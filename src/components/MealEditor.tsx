import { useEffect, useState } from 'react';
import type { LogEntry } from '../types';

type MealEditorProps = {
  log: LogEntry;
  onClose: () => void;
  onSave: (patch: { title: string; kcal: number; outside: boolean }) => void;
  onDelete: () => void;
};

export function MealEditor({ log, onClose, onSave, onDelete }: MealEditorProps) {
  const [title, setTitle] = useState(log.title);
  const [kcal, setKcal] = useState(String(log.kcal));
  const [outside, setOutside] = useState(log.outside);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(log.title);
    setKcal(String(log.kcal));
    setOutside(log.outside);
    setConfirming(false);
    setError(null);
  }, [log]);

  return (
    <div className="sheet-back" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="meal-editor-title">Edit meal</h2>
        <label className="field-label" htmlFor="meal-title">
          Name
        </label>
        <input id="meal-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="field-label" htmlFor="meal-kcal">
          Calories
        </label>
        <input
          id="meal-kcal"
          inputMode="numeric"
          value={kcal}
          onChange={(event) => setKcal(event.target.value.replace(/[^\d]/g, ''))}
        />
        <button type="button" className={outside ? 'pill on' : 'pill'} aria-pressed={outside} onClick={() => setOutside((value) => !value)}>
          {outside ? 'Outside food' : 'Home food'}
        </button>
        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              const calories = Number(kcal);
              if (!title.trim()) {
                setError('Give the meal a name.');
                return;
              }
              if (!Number.isFinite(calories) || calories < 0 || calories > 5000) {
                setError('Enter calories from 0 to 5,000.');
                return;
              }
              onSave({ title: title.trim(), kcal: calories, outside });
            }}
          >
            Save
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {confirming ? (
          <div className="confirm">
            <p>Delete this meal? Today’s streaks use whatever is left.</p>
            <button type="button" className="danger" onClick={onDelete}>
              Delete meal
            </button>
          </div>
        ) : (
          <button type="button" className="text-button" onClick={() => setConfirming(true)}>
            Delete meal
          </button>
        )}
      </div>
    </div>
  );
}
