import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Win } from '../lib/wins';
import { REFRESHED_EVENT } from './PullToRefresh';
import { StreakGirl } from './StreakGirl';

const CHEERS = ['Way to go!', 'You’re glowing!', 'So proud of you!', 'Look at you go!', 'Amazing work!', 'Keep shining!', 'Brilliant!'];
const COLORS = ['#ff5c8a', '#ffc83d', '#4cc9f0', '#7ccf6b', '#8e6cf0', '#ff9b42'];

function Confetti() {
  const pieces = Array.from({ length: 42 }, (_, index) => ({
    left: (index * 37) % 100,
    delay: (index % 7) * 0.12,
    drift: ((index * 53) % 60) - 30,
    spin: 360 + ((index * 97) % 540),
    color: COLORS[index % COLORS.length],
    round: index % 3 === 0,
  }));
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <i
          key={index}
          className={piece.round ? 'round' : undefined}
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            ['--drift' as string]: `${piece.drift}vw`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

function WinMark({ kind }: { kind: string }) {
  if (kind === 'activity') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 5 13h6l-1 9 8-12h-6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v13M6 12l6 6 6-6" />
    </svg>
  );
}

export function WinsCard({ wins }: { wins: Win[] }) {
  const [burst, setBurst] = useState(0);
  const ids = wins.map((win) => win.id).join('|');

  useEffect(() => {
    if (!ids) return;
    setBurst((count) => count + 1);
    const replay = () => setBurst((count) => count + 1);
    window.addEventListener(REFRESHED_EVENT, replay);
    return () => window.removeEventListener(REFRESHED_EVENT, replay);
  }, [ids]);

  const [showing, setShowing] = useState(0);
  useEffect(() => {
    if (!burst) return;
    setShowing(burst);
    const timer = window.setTimeout(() => setShowing(0), 4200);
    return () => window.clearTimeout(timer);
  }, [burst]);

  if (wins.length === 0) return null;
  const cheer = CHEERS[new Date().getDate() % CHEERS.length];

  return (
    <section className="card wins-card" aria-live="polite">
      {showing > 0 && <Confetti key={showing} />}
      <div className="wins-head">
        <span className="wins-trophy" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path className="cup" d="M9 5h14v6a7 7 0 0 1-14 0z" />
            <path className="handles" d="M9 7H5.5a3.5 3.5 0 0 0 4 5M23 7h3.5a3.5 3.5 0 0 1-4 5" />
            <path className="cup" d="M14 18h4v4h-4zM10.5 23h11l1 4h-13z" />
            <path className="shine" d="M12.5 7.5v3.5" />
          </svg>
        </span>
        <div className="wins-title">
          <p className="eyebrow">Wins</p>
          <p className="wins-cheer">{cheer}</p>
        </div>
        <StreakGirl mood="happy" kind="win" slot={0} />
      </div>
      <ul className="wins-list">
        {wins.map((win, index) => (
          <li key={win.id} style={{ animationDelay: `${0.15 + index * 0.12}s` }}>
            <span className={`wins-mark ${win.id.split('-')[0]}`}>
              <WinMark kind={win.id.split('-')[0]} />
            </span>
            <span>
              <strong>{win.title}</strong>
              <small>{win.detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
