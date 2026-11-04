import { useState, type FormEvent } from 'react';
import { DevicesCard } from '../components/DevicesCard';
import { isProfileName } from '../lib/storage';
import { useHealth } from '../state';

export function LockView() {
  const health = useHealth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasProfiles = health.profiles.length > 0;
  const showCreate = creating || name.trim().length > 0 || !hasProfiles;
  const syncNote =
    health.sync === 'checking' ? (
      <p className="help">Checking your other devices…</p>
    ) : health.sync === 'failed' ? (
      <p className="help">GitHub didn’t answer, so this shows profiles saved on this device.</p>
    ) : null;

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!isProfileName(name)) {
      setError('Use a name of up to 24 letters.');
      return;
    }
    const result = health.createProfile(name);
    if (result === 'taken') {
      setError('A profile already uses that name.');
      return;
    }
    if (result === 'invalid') {
      setError('Use a name of up to 24 letters.');
      return;
    }
    setError(null);
  }

  return (
    <div className="lock">
      <h1>Healthify</h1>
      {showCreate ? (
        <form onSubmit={onCreate}>
          <p className="lede">
            {hasProfiles
              ? 'Add another profile. The names already here stay in the list.'
              : 'Create a profile with a name. Next time, choose that name and continue.'}
          </p>
          <label className="field-label" htmlFor="profile-name">
            Name
          </label>
          <input id="profile-name" autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            Create profile
          </button>
          {hasProfiles && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setCreating(false);
                setName('');
                setError(null);
              }}
            >
              Back to profiles
            </button>
          )}
          <p className="help">There is no password. Anyone who opens this page can choose a profile.</p>
          {syncNote}
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <p className="lede">Choose a profile to continue. Its meals are the same on every device.</p>
          <div className="profile-list" role="group" aria-label="Profiles">
            {health.profiles.map((profile) => (
              <button key={profile.id} type="button" className="choice" onClick={() => health.openProfile(profile.id)}>
                {profile.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
          >
            Create a profile
          </button>
          <p className="help">There is no password. Anyone who opens this page can choose a profile.</p>
          {syncNote}
        </form>
      )}
      {(health.sync === 'off' || health.sync === 'bad-key') && <DevicesCard />}
    </div>
  );
}
