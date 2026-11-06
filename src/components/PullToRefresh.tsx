import { useEffect, useRef, useState, type RefObject } from 'react';

const TRIGGER = 70;
const MAX_PULL = 110;
const HOLD = 56;

type Phase = 'idle' | 'pulling' | 'ready' | 'refreshing';

export const REFRESHED_EVENT = 'nivfit:refreshed';

export function usePullToRefresh(target: RefObject<HTMLElement | null>, onRefresh: () => Promise<void>, enabled = true) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const element = target.current;
    if (!element || !enabled) return;
    let startY: number | null = null;
    let distance = 0;
    let busy = false;

    const blocked = (node: EventTarget | null) =>
      node instanceof Element && node.closest('.sheet-back, [role="dialog"], input, textarea, select') !== null;

    const onStart = (event: TouchEvent) => {
      if (busy || event.touches.length !== 1 || element.scrollTop > 0 || blocked(event.target)) return;
      startY = event.touches[0].clientY;
      distance = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0 || element.scrollTop > 0) {
        if (distance > 0) {
          distance = 0;
          setPull(0);
          setPhase('idle');
        }
        if (element.scrollTop > 0) startY = null;
        return;
      }
      event.preventDefault();
      distance = Math.min(MAX_PULL, delta * 0.5);
      setPull(distance);
      setPhase(distance >= TRIGGER ? 'ready' : 'pulling');
    };

    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (distance < TRIGGER) {
        distance = 0;
        setPull(0);
        setPhase('idle');
        return;
      }
      busy = true;
      setPull(HOLD);
      setPhase('refreshing');
      const started = Date.now();
      try {
        await refreshRef.current();
      } finally {
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 600 - (Date.now() - started))));
        busy = false;
        distance = 0;
        setPull(0);
        setPhase('idle');
      }
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', onEnd);
    element.addEventListener('touchcancel', onEnd);
    return () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onEnd);
    };
  }, [target, enabled]);

  return { pull, phase };
}

export function PullIndicator({ pull, phase }: { pull: number; phase: Phase }) {
  if (phase === 'idle' && pull === 0) return null;
  const label = phase === 'refreshing' ? 'Refreshing…' : phase === 'ready' ? 'Release to refresh' : 'Pull to refresh';
  return (
    <div className={phase === 'refreshing' ? 'ptr settling' : 'ptr'} style={{ height: pull }} aria-live="polite">
      <span className={phase === 'refreshing' ? 'ptr-spin on' : 'ptr-spin'} style={{ transform: phase === 'refreshing' ? undefined : `rotate(${pull * 3}deg)` }} />
      <span className="ptr-label">{label}</span>
    </div>
  );
}
