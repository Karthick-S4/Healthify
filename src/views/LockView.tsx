import { useState, type FormEvent } from 'react';
import { isProfileName } from '../lib/storage';
import { useHealth } from '../state';

export function LockView() {
  const health = useHealth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showCreate = creating || (!health.loading && health.profiles.length === 0);

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
      {health.loading && health.profiles.length === 0 ? (
        <p className="lede">Opening profiles…</p>
      ) : showCreate ? (
        <form onSubmit={onCreate}>
          <p className="lede">Create a profile with a name. Open that same name on the iPhone, iPad, or laptop and the meals are already there.</p>
          <label className="field-label" htmlFor="profile-name">
            Name
          </label>
          <input id="profile-name" autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            Create profile
          </button>
          {health.profiles.length > 0 && (
            <button type="button" className="ghost" onClick={() => setCreating(false)}>
              Back to profiles
            </button>
          )}
          <p className="help">There is no password. Anyone who opens this page can choose a profile.</p>
          {health.syncError && <p className="help">The shared diary didn’t answer. A profile created here will show on the other devices when the connection is back.</p>}
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <p className="lede">Choose a profile. Its meals are the same on every device.</p>
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
          {health.syncError && <p className="help">Showing profiles saved on this device. The shared diary didn’t answer just now.</p>}
        </form>
      )}
    </div>
  );
}
