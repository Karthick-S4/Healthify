export function todayISO(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function addMonths(iso: string, count: number): string {
  const date = parseISO(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return todayISO(date);
}

export function weekRange(iso: string): { start: string; end: string } {
  const date = parseISO(iso);
  const weekday = date.getDay();
  const fromMonday = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(iso, fromMonday);
  return { start, end: addDays(start, 6) };
}

export function monthRange(iso: string): { start: string; end: string } {
  const date = parseISO(iso);
  const start = todayISO(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = todayISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { start, end };
}

export function eachDate(start: string, end: string): string[] {
  if (end < start) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 400) break;
  }
  return dates;
}

export function formatLong(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatWeekday(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short' });
}

export function formatRange(start: string, end: string): string {
  const from = parseISO(start);
  const to = parseISO(end);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    const month = from.toLocaleDateString('en-IN', { month: 'short' });
    return `${from.getDate()}–${to.getDate()} ${month}`;
  }
  return `${formatShort(start)} – ${formatShort(end)}`;
}
