export function formatKcal(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '';
  return sign + Math.abs(rounded).toLocaleString('en-IN');
}

export function formatHours(minutes: number): string {
  return String(Math.round(minutes / 6) / 10);
}

export function hoursWord(minutes: number): string {
  return Math.round(minutes / 6) === 10 ? 'hr' : 'hrs';
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatCount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}
