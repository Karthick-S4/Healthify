import { useId, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { addDays, todayISO } from '../lib/dates';
import { useHealth } from '../state';
import type { CheatKind } from '../types';
import { cheatState } from './CheatToggle';
import { useStreaks } from '../views/StreaksView';
import { StreakGirl } from './StreakGirl';

function dayWord(count: number): string {
  return count === 1 ? 'day' : 'days';
}

const FLAME_PATH = 'M30 2c4 13 14 18 19 29 2-4 2-8 1-12 8 8 11 21 8 33-3 11-13 20-26 20S6 63 5 50C4 40 9 31 15 25c0 5 1 9 4 12 0-14 4-25 11-35z';

function Fire({ lit, cheat }: { lit: boolean; cheat: boolean }) {
  const id = `fire${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg className="sr-fire-svg" viewBox="0 0 64 76" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd34e" />
          <stop offset="0.5" stopColor="#ff8a2b" />
          <stop offset="1" stopColor="#e2401f" />
        </linearGradient>
        <linearGradient id={`${id}-cool`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9f0ff" />
          <stop offset="0.5" stopColor="#5cb8ff" />
          <stop offset="1" stopColor="#2f6fe0" />
        </linearGradient>
      </defs>
      <path className="sr-fire-outer" style={lit ? { fill: `url(#${id}-${cheat ? 'cool' : 'outer'})` } : undefined} d={FLAME_PATH} />
      <path className="sr-fire-inner" d="M31 33c2 9 12 14 12 24 0 7-5 12-12 12s-12-5-12-11c0-7 5-11 7-16 1 3 2 5 3 6 1-5 2-10 2-15z" />
      {!lit && (
        <>
          <ellipse className="sr-ember" cx="32" cy="70" rx="9" ry="2.4" />
          <g className="sr-smoke">
            <circle cx="30" cy="22" r="5" />
            <circle cx="34" cy="22" r="4" />
            <circle cx="28" cy="22" r="3.5" />
            <circle cx="32" cy="22" r="4.5" />
          </g>
        </>
      )}
    </svg>
  );
}

function BlueFlame() {
  return (
    <svg className="sr-blue-flame" viewBox="0 0 64 76" aria-hidden="true">
      <path d={FLAME_PATH} />
    </svg>
  );
}

const HOLD_MS = 550;

type Streak = ReturnType<typeof useStreaks>[number];

function Stage({ streak, slot }: { streak: Streak; slot: number }) {
  const lit = isLit(streak);
  return (
    <span className="sr-stage">
      <span className="sr-fire">
        <Fire lit={lit} cheat={streak.cheat} />
        <b>{streak.days}</b>
      </span>
      <StreakGirl mood={lit ? 'happy' : 'sad'} kind={streak.id === 'move' ? 'exercise' : 'meal'} slot={slot} />
    </span>
  );
}

function isLit(streak: Streak) {
  return (streak.days > 0 || streak.cheat) && !streak.warn;
}

function itemClass(streak: Streak, extra = '') {
  return `sr-fire-item${isLit(streak) ? ' lit' : ''}${streak.cheat ? ' cheat' : ''}${extra}`;
}

function useHold(onOpen: () => void) {
  const [pressing, setPressing] = useState<CheatKind | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const action = useRef<(kind: CheatKind) => void>(() => undefined);

  function cancel() {
    window.clearTimeout(timer.current);
    setPressing(null);
  }

  function fire(kind: CheatKind) {
    window.clearTimeout(timer.current);
    held.current = true;
    setPressing(null);
    navigator.vibrate?.(15);
    action.current(kind);
  }

  function bind(kind: CheatKind) {
    return {
      onClick: () => {
        if (held.current) held.current = false;
        else onOpen();
      },
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        if (!held.current) fire(kind);
      },
      onPointerDown: (event: PointerEvent) => {
        held.current = false;
        start.current = { x: event.clientX, y: event.clientY };
        setPressing(kind);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => fire(kind), HOLD_MS);
      },
      onPointerMove: (event: PointerEvent) => {
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    };
  }

  return { pressing, bind, onHold: (fn: (kind: CheatKind) => void) => (action.current = fn) };
}

export function StreakSummary({ onOpen }: { onOpen: () => void }) {
  return <RevealSummary onOpen={onOpen} />;
}

function Title({ onOpen }: { onOpen: () => void }) {
  const streaks = useStreaks();
  const label = `Streaks: ${streaks.map((streak) => `${streak.title} ${streak.days} ${dayWord(streak.days)}`).join(', ')}. Open details`;
  return (
    <button type="button" className="sr-title eyebrow" aria-label={label} onClick={onOpen}>
      Streaks
    </button>
  );
}

function RevealSummary({ onOpen }: { onOpen: () => void }) {
  const streaks = useStreaks();
  const health = useHealth();
  const today = todayISO();
  const [shown, setShown] = useState(false);
  const [day, setDay] = useState(today);
  const hold = useHold(onOpen);
  hold.onHold(() => {
    setDay(today);
    setShown(true);
  });
  const yesterday = day !== today;

  return (
    <section className={`card streak-board${shown ? ' cheat-shown' : ''}${yesterday ? ' cheat-yesterday' : ''}`}>
      <div className="sr-head">
        <Title onOpen={onOpen} />
        {shown && (
          <div className="sr-reveal-head">
            <div className="cheat-when small" role="radiogroup" aria-label="Cheat day for">
              {[today, addDays(today, -1)].map((iso) => (
                <button key={iso} type="button" role="radio" aria-checked={day === iso} onClick={() => setDay(iso)}>
                  {iso === today ? 'Today' : 'Yesterday'}
                </button>
              ))}
            </div>
            <button type="button" className="sr-done" onClick={() => setShown(false)}>
              Done
            </button>
          </div>
        )}
      </div>
      <div className="sr-fires">
        {streaks.map((streak, slot) => {
          const state = cheatState(health.data.cheatDays, streak.id, day);
          return (
            <div key={streak.id} className={itemClass(streak, hold.pressing === streak.id ? ' pressing' : '')}>
              <button
                type="button"
                className="sr-front"
                aria-label={`${streak.title} ${streak.days} ${dayWord(streak.days)}. Open details, or press and hold for cheat days`}
                {...hold.bind(streak.id)}
              >
                <Stage streak={streak} slot={slot} />
                <span className="sr-fire-days">{dayWord(streak.days)}</span>
                <strong>{streak.title}</strong>
              </button>
              {shown && (
                <button
                  type="button"
                  role="switch"
                  className="sr-slide"
                  aria-checked={state.on}
                  aria-label={`${streak.title} cheat ${yesterday ? 'yesterday' : 'today'}. ${state.note}`}
                  disabled={state.full}
                  onClick={() => health.setCheatDay(day, streak.id, !state.on)}
                >
                  <span className="sr-slide-knob">
                    <BlueFlame />
                  </span>
                  <small>{state.on ? (yesterday ? 'Yest' : 'Cheat') : `${state.left}/${state.limit}`}</small>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
