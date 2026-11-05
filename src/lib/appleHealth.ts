import type { ActivityEntry, AppData, HealthDay, ProfileBook } from '../types';

type Kind = 'steps' | 'energy' | 'exercise' | 'stand' | 'workout';

type Sample = {
  kind: Kind;
  value: number;
  start: number;
  end: number;
  day: string;
  source: string;
  name: string;
};

export type HealthFile = { name: string; body: unknown };

type Workout = { id: string; day: string; name: string; start: number; end: number };

export type DayTotals = Omit<HealthDay, 'updatedAt'>;

export type FileResult = {
  profile: string | null;
  days: Record<string, DayTotals>;
  workouts: (Workout & { minutes: number; steps: number; kcal: number })[];
  used: number;
  skipped: number;
};

const ISO_DAY = /^(\d{4}-\d{2}-\d{2})/;

function kindOf(raw: unknown): Kind | null {
  const text = String(raw ?? '').toLocaleLowerCase();
  if (text.includes('step')) return 'steps';
  if (text.includes('energ') || text.includes('cal')) return 'energy';
  if (text.includes('exerc')) return 'exercise';
  if (text.includes('stand')) return 'stand';
  if (text.includes('work') || text.includes('walk')) return 'workout';
  return null;
}

export function healthNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let text = String(raw ?? '').replace(/[^\d.,-]/g, '');
  if (!text) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function localDay(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toMinutes(value: number, unit: string): number {
  if (/^(s|sec|secs|second|seconds)$/.test(unit)) return value / 60;
  if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return value * 60;
  return value;
}

function readSample(raw: unknown): Sample | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const kind = kindOf(item.k ?? item.kind ?? item.type);
  if (!kind) return null;
  const startText = String(item.s ?? item.start ?? '').trim();
  const endText = String(item.e ?? item.end ?? '').trim();
  const start = Date.parse(startText);
  const end = endText ? Date.parse(endText) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const day = ISO_DAY.exec(startText)?.[1] ?? localDay(start);
  const unit = String(item.u ?? item.unit ?? '').trim().toLocaleLowerCase();
  const source = String(item.src ?? item.source ?? '').trim();
  const name = String(item.n ?? item.name ?? '').trim();
  if (kind === 'workout') return { kind, value: 0, start, end, day, source, name };
  let value = healthNumber(item.v ?? item.value);
  if (value === null || value < 0) return null;
  if (kind === 'energy' && unit.includes('kj')) value /= 4.184;
  if (kind === 'exercise' || kind === 'stand') {
    if (unit === 'count') return null;
    value = toMinutes(value, unit);
  }
  return { kind, value, start, end, day, source, name };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  if (a.start === a.end || b.start === b.end) return a.start <= b.end && b.start <= a.end;
  return a.start < b.end && b.start < a.end;
}

export function pickSources(samples: Sample[]): Sample[] {
  const bySource = new Map<string, Sample[]>();
  for (const sample of samples) bySource.set(sample.source, [...(bySource.get(sample.source) ?? []), sample]);
  if (bySource.size <= 1) return samples;
  const total = (list: Sample[]) => list.reduce((sum, item) => sum + item.value, 0);
  const isWatch = (source: string) => /watch/i.test(source);
  const ranked = [...bySource.entries()].sort(
    (a, b) => Number(isWatch(b[0])) - Number(isWatch(a[0])) || total(b[1]) - total(a[1]),
  );
  const kept = [...ranked[0][1]];
  for (const [, others] of ranked.slice(1)) {
    for (const sample of others) {
      if (!kept.some((item) => overlaps(item, sample))) kept.push(sample);
    }
  }
  return kept;
}

function within(samples: Sample[], start: number, end: number): number {
  let total = 0;
  for (const sample of samples) {
    if (sample.end <= start || sample.start >= end) {
      if (!(sample.start === sample.end && sample.start >= start && sample.start <= end)) continue;
    }
    const length = sample.end - sample.start;
    if (length <= 0) {
      total += sample.value;
      continue;
    }
    const shared = Math.min(sample.end, end) - Math.max(sample.start, start);
    total += sample.value * Math.max(0, Math.min(1, shared / length));
  }
  return total;
}

function workoutName(name: string): string {
  const clean = name.replace(/^HKWorkoutActivityType/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  if (!clean) return 'Workout';
  return (clean[0].toLocaleUpperCase() + clean.slice(1)).slice(0, 40);
}

export function readHealthFile(body: unknown): FileResult {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const profile = typeof payload.profile === 'string' && payload.profile.trim() ? payload.profile.trim() : null;
  const rawSamples = Array.isArray(payload.samples) ? payload.samples : [];
  const seen = new Set<string>();
  const samples: Sample[] = [];
  let skipped = 0;
  for (const raw of rawSamples) {
    const sample = readSample(raw);
    if (!sample) {
      skipped += 1;
      continue;
    }
    const key = `${sample.kind}|${sample.start}|${sample.end}|${sample.kind === 'workout' ? sample.name : sample.source}|${sample.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push(sample);
  }

  const groups = new Map<string, Sample[]>();
  for (const sample of samples) {
    if (sample.kind === 'workout') continue;
    const key = `${sample.day}|${sample.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  const picked = new Map<string, Sample[]>();
  for (const [key, list] of groups) picked.set(key, pickSources(list));

  const days: Record<string, DayTotals> = {};
  const field: Record<Exclude<Kind, 'workout'>, keyof DayTotals> = { steps: 'steps', energy: 'activeKcal', exercise: 'exerciseMin', stand: 'standMin' };
  for (const [key, list] of picked) {
    const [day, kind] = key.split('|') as [string, Exclude<Kind, 'workout'>];
    days[day] ??= { steps: 0, activeKcal: 0, exerciseMin: 0, standMin: 0 };
    days[day][field[kind]] = Math.round(list.reduce((sum, item) => sum + item.value, 0));
  }

  const workouts: FileResult['workouts'] = [];
  const known = new Set<string>();
  for (const sample of samples) {
    if (sample.kind !== 'workout' || sample.end <= sample.start) continue;
    const id = `apple-${new Date(sample.start).toISOString()}`;
    if (known.has(id)) continue;
    known.add(id);
    const steps = picked.get(`${sample.day}|steps`) ?? [];
    const energy = picked.get(`${sample.day}|energy`) ?? [];
    workouts.push({
      id,
      day: sample.day,
      name: workoutName(sample.name),
      start: sample.start,
      end: sample.end,
      minutes: Math.max(1, Math.round((sample.end - sample.start) / 60000)),
      steps: Math.round(within(steps, sample.start, sample.end)),
      kcal: Math.round(within(energy, sample.start, sample.end)),
    });
    days[sample.day] ??= { steps: 0, activeKcal: 0, exerciseMin: 0, standMin: 0 };
  }

  return { profile, days, workouts, used: samples.length, skipped };
}

function mergeDay(old: HealthDay | undefined, next: DayTotals, now: string): HealthDay {
  return {
    steps: Math.max(old?.steps ?? 0, next.steps),
    activeKcal: Math.max(old?.activeKcal ?? 0, next.activeKcal),
    exerciseMin: Math.max(old?.exerciseMin ?? 0, next.exerciseMin),
    standMin: Math.max(old?.standMin ?? 0, next.standMin),
    updatedAt: now,
  };
}

function applyResult(data: AppData, result: FileResult, fileName: string, now: string): AppData {
  const health = { ...data.health };
  for (const [day, totals] of Object.entries(result.days)) health[day] = mergeDay(health[day], totals, now);
  const activities = [...data.activities];
  for (const workout of result.workouts) {
    if (data.removedLogIds.includes(workout.id)) continue;
    const index = activities.findIndex((entry) => entry.id === workout.id);
    const old = index >= 0 ? activities[index] : null;
    const entry: ActivityEntry = {
      id: workout.id,
      date: workout.day,
      name: workout.name,
      minutes: Math.max(old?.minutes ?? 0, workout.minutes),
      steps: Math.max(old?.steps ?? 0, workout.steps) || undefined,
      kcal: Math.max(old?.kcal ?? 0, workout.kcal) || undefined,
      source: 'apple',
      createdAt: old?.createdAt ?? new Date(workout.start).toISOString(),
    };
    if (index >= 0) activities[index] = entry;
    else activities.push(entry);
  }
  return { ...data, health, activities, healthFiles: [...data.healthFiles, fileName].slice(-400) };
}

export function importedHealthFiles(book: ProfileBook): Set<string> {
  return new Set(book.profiles.flatMap((profile) => profile.data.healthFiles));
}

export function applyHealthFiles(
  book: ProfileBook,
  files: HealthFile[],
  now = new Date().toISOString(),
): { book: ProfileBook; unmatched: string[] } {
  const unmatched: string[] = [];
  let profiles = book.profiles;
  for (const file of files) {
    const result = readHealthFile(file.body);
    const key = result.profile?.toLocaleLowerCase();
    const target = key ? profiles.find((profile) => profile.name.trim().toLocaleLowerCase() === key) : undefined;
    if (!target || target.data.healthFiles.includes(file.name)) {
      if (!target) unmatched.push(file.name);
      continue;
    }
    profiles = profiles.map((profile) =>
      profile.id === target.id ? { ...profile, updatedAt: now, data: applyResult(profile.data, result, file.name, now) } : profile,
    );
  }
  return { book: profiles === book.profiles ? book : { ...book, profiles, updatedAt: now }, unmatched };
}
