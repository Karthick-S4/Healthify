import { useState, type FormEvent } from 'react';
import { DAILY_MAX, DAILY_MIN } from '../lib/storage';
import { useHealth } from '../state';

const PRESETS = [1400, 1600, 1800, 2000];

export function GoalView() {
  const health = useHealth();
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSave(event: FormEvent) {
    event.preventDefault();
    const daily = Number(target);
    if (!Number.isFinite(daily) || daily < DAILY_MIN || daily > DAILY_MAX) {
      setError(`Set a daily goal between ${DAILY_MIN.toLocaleString('en-IN')} and ${DAILY_MAX.toLocaleString('en-IN')} kcal.`);
      return;
    }
    health.setDailyTarget(Math.round(daily));
  }

  return (
    <div className="lock">
      <h1>Healthify</h1>
      <form onSubmit={onSave}>
        <p className="lede">{health.profileName}, set the daily calorie goal for this profile.</p>
        <div className="target-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={target === String(preset) ? 'choice on' : 'choice'}
              aria-pressed={target === String(preset)}
              onClick={() => setTarget(String(preset))}
            >
              {preset.toLocaleString('en-IN')}
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="daily-goal">
          Daily calorie goal
        </label>
        <input id="daily-goal" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value.replace(/[^\d]/g, ''))} />
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">
          Save goal
        </button>
        <button type="button" className="ghost" onClick={health.switchProfile}>
          Switch profile
        </button>
      </form>
    </div>
  );
}
