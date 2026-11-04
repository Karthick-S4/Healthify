type RingProps = {
  eaten: number;
  target: number;
};

export function Ring({ eaten, target }: RingProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const over = target > 0 && eaten > target;
  const shown = target <= 0 ? 0 : Math.min(eaten / target, 1);
  const dash = circumference * shown;
  return (
    <svg className="ring" viewBox="0 0 140 140" role="img" aria-label={`${Math.round(eaten)} of ${Math.round(target)} calories eaten`}>
      <defs>
        <linearGradient id="ring-ok" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4b6a6" />
          <stop offset="100%" stopColor="#d8627f" />
        </linearGradient>
        <linearGradient id="ring-over" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5b14c" />
          <stop offset="100%" stopColor="#d9542b" />
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="70" cy="70" r={radius} />
      {shown > 0 && (
        <circle
          className={over ? 'ring-value over' : 'ring-value'}
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={`${dash} ${circumference}`}
        />
      )}
    </svg>
  );
}
