type RingProps = {
  eaten: number;
  target: number;
  cheat?: boolean;
};

export type RingBand = 'low' | 'good' | 'high' | 'over';

export function ringBand(eaten: number, target: number): RingBand {
  if (target <= 0) return 'low';
  const share = eaten / target;
  if (share <= 0.8) return 'low';
  if (share <= 1) return 'good';
  if (share <= 1.2) return 'high';
  return 'over';
}

export const BAND_NUM: Record<RingBand, string | undefined> = {
  low: undefined,
  good: 'good-num',
  high: 'over-num',
  over: 'danger-num',
};

export function Ring({ eaten, target, cheat = false }: RingProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const band = ringBand(eaten, target);
  const shown = target <= 0 ? 0 : Math.min(eaten / target, 1);
  const dash = circumference * shown;
  return (
    <svg className="ring" viewBox="0 0 140 140" role="img" aria-label={`${Math.round(eaten)} of ${Math.round(target)} calories eaten`}>
      <defs>
        <linearGradient id="ring-low" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4b6a6" />
          <stop offset="100%" stopColor="#d8627f" />
        </linearGradient>
        <linearGradient id="ring-good" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fdcb3" />
          <stop offset="100%" stopColor="#3f9f78" />
        </linearGradient>
        <linearGradient id="ring-high" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8c25c" />
          <stop offset="100%" stopColor="#e8873a" />
        </linearGradient>
        <linearGradient id="ring-over" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff5a4a" />
          <stop offset="100%" stopColor="#d81e1e" />
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="70" cy="70" r={radius} />
      {shown > 0 && (
        <circle
          className={cheat ? 'ring-value cheat' : `ring-value ${band}`}
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={`${dash} ${circumference}`}
        />
      )}
    </svg>
  );
}
