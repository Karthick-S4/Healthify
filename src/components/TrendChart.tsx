import { useId } from 'react';
import { formatShort, parseISO } from '../lib/dates';

type Point = { iso: string; value: number };

const WIDTH = 320;
const HEIGHT = 130;
const PAD_X = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

export function TrendChart({ points, unit, compact = false }: { points: Point[]; unit: string; compact?: boolean }) {
  const gradient = useId();
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => (a.iso < b.iso ? -1 : 1));
  const times = sorted.map((point) => parseISO(point.iso).getTime());
  const values = sorted.map((point) => point.value);
  const minT = times[0];
  const maxT = times[times.length - 1];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(high - low, high * 0.02, 0.5);
  const height = compact ? 64 : HEIGHT;
  const bottom = compact ? 6 : PAD_BOTTOM;
  const top = compact ? 6 : PAD_TOP;
  const x = (time: number) => (maxT === minT ? WIDTH / 2 : PAD_X + ((time - minT) / (maxT - minT)) * (WIDTH - PAD_X * 2));
  const y = (value: number) => top + (1 - (value - (low - spread * 0.15)) / (spread * 1.3)) * (height - top - bottom);
  const coords = sorted.map((point, index) => [x(times[index]), y(point.value)] as const);
  const line = coords.map(([cx, cy], index) => `${index === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - bottom} L${coords[0][0].toFixed(1)},${height - bottom} Z`;
  const last = coords[coords.length - 1];
  const fmt = (value: number) => `${Math.round(value * 10) / 10} ${unit}`;

  return (
    <svg
      className={compact ? 'trend compact' : 'trend'}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`${sorted.length} entries from ${fmt(values[0])} to ${fmt(values[values.length - 1])}`}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {coords.length > 1 && <path className="trend-area" d={area} fill={`url(#${gradient})`} />}
      {coords.length > 1 && <path className="trend-line" d={line} />}
      {!compact && coords.map(([cx, cy], index) => <circle key={sorted[index].iso} className="trend-dot" cx={cx} cy={cy} r={3} />)}
      <circle className="trend-last" cx={last[0]} cy={last[1]} r={compact ? 3.5 : 5} />
      {!compact && (
        <>
          <text className="trend-label" x={PAD_X} y={HEIGHT - 6}>
            {formatShort(sorted[0].iso)}
          </text>
          <text className="trend-label" x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end">
            {formatShort(sorted[sorted.length - 1].iso)}
          </text>
        </>
      )}
    </svg>
  );
}
