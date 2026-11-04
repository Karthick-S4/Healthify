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
