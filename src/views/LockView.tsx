import { useEffect, useState, type FormEvent } from 'react';
import { isPassword, isProfileName } from '../lib/password';
import { DAILY_MAX, DAILY_MIN } from '../lib/storage';
import { useHealth } from '../state';

const PRESETS = [1400, 1600, 1800, 2000];

export function LockView() {
  const health = useHealth();
  const [creating, setCreating] = useState(health.profiles.length === 0);
  const [chosen, setChosen] = useState(health.profiles[0]?.id ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [target, setTarget] = useState('1800');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetName, setForgetName] = useState('');

  const selected = health.profiles.find((profile) => profile.id === chosen) ?? null;
  const showCreate = creating || health.profiles.length === 0;
  const waiting = waitUntil > Date.now();

  useEffect(() => {
    if (!waitUntil) return;
    const timer = window.setTimeout(() => setWaitUntil(0), Math.max(0, waitUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [waitUntil]);

  useEffect(() => {
    if (chosen && health.profiles.some((profile) => profile.id === chosen)) return;
    setChosen(health.profiles[0]?.id ?? '');
  }, [chosen, health.profiles]);

  function noteFailure(message: string) {
    const nextFails = fails + 1;
    setFails(nextFails);
    setPassword('');
    setPin('');
    if (nextFails >= 5) {
      setWaitUntil(Date.now() + 30_000);
      setFails(0);
      setError('Too many tries. Wait 30 seconds, then try again.');
      return;
    }
    setError(message);
  }

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    if (!selected || waiting || busy) return;
    setBusy(true);
    const ok = await health.signIn(selected.id, password);
    setBusy(false);
    if (ok) return;
    noteFailure('That password doesn’t match this profile.');
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const daily = Number(target);
    if (!isProfileName(name)) {
      setError('Use a name of up to 24 letters.');
      return;
    }
    if (!isPassword(password)) {
      setError('Use a password of at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    if (!Number.isFinite(daily) || daily < DAILY_MIN || daily > DAILY_MAX) {
      setError(`Set a daily target between ${DAILY_MIN.toLocaleString('en-IN')} and ${DAILY_MAX.toLocaleString('en-IN')} kcal.`);
      return;
    }
    setBusy(true);
    const result = await health.createProfile(name, password, Math.round(daily));
    setBusy(false);
    if (result === 'taken') {
      setError('A profile already uses that name.');
      return;
    }
  }

  async function onClaim(event: FormEvent) {
    event.preventDefault();
    if (!selected || waiting || busy) return;
    if (!isProfileName(name)) {
      setError('Use a name of up to 24 letters.');
      return;
    }
    if (!isPassword(password)) {
      setError('Use a password of at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    const result = await health.claimProfile(selected.id, name, password, pin);
    setBusy(false);
    if (result === 'pin') {
      noteFailure('That PIN doesn’t match this diary.');
      return;
    }
    if (result === 'taken') setError('A profile already uses that name.');
  }

  function resetFields() {
    setPassword('');
    setConfirm('');
    setPin('');
    setError(null);
    setForgetOpen(false);
    setForgetName('');
  }

  return (
    <main className="lock">
      <p className="eyebrow">On this device</p>
      <h1>Healthify</h1>
      {showCreate ? (
        <form onSubmit={(event) => void onCreate(event)}>
          <p className="lede">Create a profile with a name and password. Meals stay on this device, separate for each profile.</p>
          <label className="field-label" htmlFor="profile-name">
            Name
          </label>
          <input
            id="profile-name"
            autoComplete="nickname"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          <label className="field-label" htmlFor="profile-password">
            Password
          </label>
          <input
            id="profile-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="field-label" htmlFor="profile-confirm">
            Confirm password
          </label>
          <input
            id="profile-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          <p className="help">At least 6 characters.</p>
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
          <p className="help">Between 1,000 and 5,000 kcal. This is a personal target, not a prescription.</p>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>
            Create profile
          </button>
          {health.profiles.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setCreating(false);
                resetFields();
              }}
            >
              Back to profiles
            </button>
          )}
        </form>
      ) : selected?.legacy ? (
        <form onSubmit={(event) => void onClaim(event)}>
          <p className="lede">
            {selected.needsPin
              ? 'This diary used a 4-digit PIN. Give it a name and password to keep the meals.'
              : 'Give this diary a name and password to keep the meals.'}
          </p>
          <label className="field-label" htmlFor="claim-name">
            Profile name
          </label>
          <input
            id="claim-name"
            autoComplete="nickname"
            value={name}
            placeholder={selected.name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          {selected.needsPin && (
            <>
              <label className="field-label" htmlFor="claim-pin">
                Current PIN
              </label>
              <input
                id="claim-pin"
                className="pin-input"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
              />
            </>
          )}
          <label className="field-label" htmlFor="claim-password">
            New password
          </label>
          <input
            id="claim-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="field-label" htmlFor="claim-confirm">
            Confirm password
          </label>
          <input
            id="claim-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          <p className="help">{selected.needsPin ? 'At least 6 characters. This replaces the PIN.' : 'At least 6 characters.'}</p>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={busy || waiting}>
            Save profile
          </button>
          {health.profiles.length > 1 && (
            <div className="profile-list" role="group" aria-label="Other profiles">
              {health.profiles
                .filter((profile) => profile.id !== selected.id)
                .map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className="choice"
                    onClick={() => {
                      setChosen(profile.id);
                      resetFields();
                      setName('');
                    }}
                  >
                    {profile.name}
                  </button>
                ))}
            </div>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setCreating(true);
              setName('');
              resetFields();
            }}
          >
            Create a profile
          </button>
          <button type="button" className="text-button" onClick={() => setForgetOpen((open) => !open)}>
            Forgot the PIN
          </button>
          {forgetOpen && (
            <div className="erase-block">
              <p className="help">This deletes the diary on this device. Type {selected.name} to confirm.</p>
              <input value={forgetName} aria-label="Type the profile name to confirm" onChange={(event) => setForgetName(event.target.value)} />
              <button
                type="button"
                className="danger"
                disabled={forgetName.trim().toLowerCase() !== selected.name.toLowerCase()}
                onClick={() => health.removeProfile(selected.id)}
              >
                Delete diary
              </button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={(event) => void onSignIn(event)}>
          <p className="lede">Choose a profile and enter its password.</p>
          <div className="profile-list" role="group" aria-label="Profiles">
            {health.profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={profile.id === chosen ? 'choice on' : 'choice'}
                aria-pressed={profile.id === chosen}
                onClick={() => {
                  setChosen(profile.id);
                  resetFields();
                }}
              >
                {profile.name}
                {profile.legacy ? ' · needs a password' : ''}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="sign-password">
            Password
          </label>
          <input
            id="sign-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={busy || waiting || password.length < 6}>
            Open
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setCreating(true);
              setName('');
              resetFields();
            }}
          >
            Create a profile
          </button>
          {selected && (
            <>
              <button type="button" className="text-button" onClick={() => setForgetOpen((open) => !open)}>
                Forgot the password
              </button>
              {forgetOpen && (
                <div className="erase-block">
                  <p className="help">The password can’t be recovered. Type {selected.name} to delete that diary on this device.</p>
                  <input value={forgetName} aria-label="Type the profile name to confirm" onChange={(event) => setForgetName(event.target.value)} />
                  <button
                    type="button"
                    className="danger"
                    disabled={forgetName.trim().toLowerCase() !== selected.name.toLowerCase()}
                    onClick={() => health.removeProfile(selected.id)}
                  >
                    Delete {selected.name}
                  </button>
                </div>
              )}
            </>
          )}
        </form>
      )}
    </main>
  );
}
