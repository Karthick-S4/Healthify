import { useEffect, useMemo, useState } from 'react';
import { isPin } from '../lib/pin';
import { DAILY_MAX, DAILY_MIN } from '../lib/storage';
import { useHealth } from '../state';

const PRESETS = [1400, 1600, 1800, 2000];

type LockViewProps = {
  mode: 'setup' | 'unlock';
};

export function LockView({ mode }: LockViewProps) {
  const health = useHealth();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [target, setTarget] = useState('1800');
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState('');
  const waiting = waitUntil > Date.now();
  const digits = useMemo(() => pin.replace(/\D/g, '').slice(0, 4), [pin]);

  useEffect(() => {
    if (!waitUntil) return;
    const timer = window.setTimeout(() => setWaitUntil(0), Math.max(0, waitUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [waitUntil]);

  async function onUnlock() {
    if (Date.now() < waitUntil) return;
    const ok = await health.unlock(digits);
    if (ok) return;
    const nextFails = fails + 1;
    setFails(nextFails);
    setPin('');
    if (nextFails >= 5) {
      setWaitUntil(Date.now() + 30_000);
      setFails(0);
      setError('Too many tries. Wait 30 seconds, then try the PIN again.');
      return;
    }
    setError('That PIN doesn’t match.');
  }

  async function onSetup() {
    const daily = Number(target);
    if (!isPin(digits) || !isPin(confirm)) {
      setError('Use a 4-digit PIN.');
      return;
    }
    if (digits !== confirm) {
      setError('The two PINs don’t match.');
      return;
    }
    if (!Number.isFinite(daily) || daily < DAILY_MIN || daily > DAILY_MAX) {
      setError(`Set a daily target between ${DAILY_MIN.toLocaleString('en-IN')} and ${DAILY_MAX.toLocaleString('en-IN')} kcal.`);
      return;
    }
    await health.setup(digits, Math.round(daily));
  }

  return (
    <main className="lock">
      <p className="eyebrow">On this iPhone</p>
      <h1>Healthify</h1>
      <p className="lede">
        {mode === 'setup'
          ? 'A calorie log that stays on this phone. Set a PIN, then a daily target.'
          : 'Enter the PIN to open the diary stored on this phone.'}
      </p>
      <label className="field-label" htmlFor="pin">
        PIN
      </label>
      <input
        id="pin"
        className="pin-input"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={digits}
        onChange={(event) => {
          setPin(event.target.value);
          setError(null);
        }}
      />
      {mode === 'setup' && (
        <>
          <label className="field-label" htmlFor="pin-confirm">
            Confirm PIN
          </label>
          <input
            id="pin-confirm"
            className="pin-input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <p className="field-label">Daily calorie target</p>
          <div className="target-grid">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={target === String(preset) ? 'choice on' : 'choice'}
                onClick={() => setTarget(String(preset))}
              >
                {preset.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="target">
            Or type a target
          </label>
          <input
            id="target"
            inputMode="numeric"
            value={target}
            onChange={(event) => setTarget(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
          />
          <p className="help">Between 1,000 and 5,000 kcal. This is her own target, not a prescription.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="primary"
        disabled={mode === 'unlock' && (digits.length < 4 || waiting)}
        onClick={() => void (mode === 'setup' ? onSetup() : onUnlock())}
      >
        {mode === 'setup' ? 'Continue' : 'Open'}
      </button>
      {mode === 'unlock' && (
        <div className="erase-block">
          <button type="button" className="text-button" onClick={() => setEraseOpen((open) => !open)}>
            Forgot the PIN
          </button>
          {eraseOpen && (
            <>
              <p className="help">This erases the diary on this phone. Type ERASE to confirm.</p>
              <input value={eraseText} onChange={(event) => setEraseText(event.target.value)} aria-label="Type ERASE to confirm" />
              <button type="button" className="danger" disabled={eraseText !== 'ERASE'} onClick={() => health.erase()}>
                Erase diary
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
