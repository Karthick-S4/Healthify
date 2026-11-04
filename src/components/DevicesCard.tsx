import { useState, type FormEvent } from 'react';
import { useHealth } from '../state';

export function DevicesCard() {
  const health = useHealth();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const connected = !busy && health.sync !== 'off' && health.sync !== 'bad-key';

  async function onConnect(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setNote(null);
    const status = await health.connect(key.trim());
    setBusy(false);
    if (status === 'ok') {
      setKey('');
      setNote('Connected. Meals on this device are now shared.');
    } else if (status === 'bad-key') setNote('That key didn’t open Healthify-data. Check it can read and write that repository.');
    else setNote('GitHub didn’t answer. Try again in a moment.');
  }

  async function shareLink() {
    const link = health.linkForDevice();
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Healthify', url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setNote('Link copied. Open it once on the other device.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNote(link);
    }
  }

  return (
    <section className="card">
      <h2>Other devices</h2>
      {connected ? (
        <>
          <p className="help">
            {health.sync === 'failed'
              ? 'Connected, but GitHub didn’t answer just now. Meals are kept here and go up on the next try.'
              : health.sync === 'checking'
                ? 'Checking the shared diary…'
                : 'Connected. Meals added here show on every connected device within a minute.'}
          </p>
          <button type="button" className="primary" onClick={shareLink}>
            Send the link to another device
          </button>
          <p className="help">Open that link once on the iPhone, iPad or laptop. Anyone with the link can see and change the diary.</p>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              health.disconnect();
              setNote('This device stopped sharing. Its meals stay here.');
            }}
          >
            Stop sharing on this device
          </button>
        </>
      ) : (
        <form onSubmit={onConnect}>
          {!note && (
            <p className="help">
              {health.sync === 'bad-key'
                ? 'The saved key stopped working. Paste a new one, or open a fresh link from a connected device.'
                : 'Meals stay on this device until it’s connected. Open the link from a connected device, or paste the GitHub key.'}
            </p>
          )}
          <label className="field-label" htmlFor="sync-key">
            GitHub key
          </label>
          <input
            id="sync-key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={key}
            placeholder="github_pat_…"
            onChange={(event) => setKey(event.target.value)}
          />
          <button className="primary" type="submit" disabled={busy || !key.trim()}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      )}
      {note && <p className="help">{note}</p>}
    </section>
  );
}
