import { ACTIVE_STEPS } from './streaks';
import type { ActivityEntry, AppData, HealthDay, ProfileBook } from '../types';

const STEPS_PER_MINUTE = 100;

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

function textKind(label: string): Exclude<Kind, 'workout'> | null {
  const text = label.toLocaleLowerCase();
  if (text.includes('distance')) return null;
  if (text.includes('step')) return 'steps';
  if (text.includes('energ') || text.includes('cal')) return 'energy';
  if (text.includes('exerc')) return 'exercise';
  if (text.includes('stand')) return 'stand';
  return null;
}

export function readHealthText(text: string, fileName = '', today = localDay(Date.now())): FileResult {
  let profile: string | null = null;
  let day: string | null = null;
  const totals: DayTotals = { steps: 0, activeKcal: 0, exerciseMin: 0, standMin: 0 };
  const field: Record<Exclude<Kind, 'workout'>, keyof DayTotals> = { steps: 'steps', energy: 'activeKcal', exercise: 'exerciseMin', stand: 'standMin' };
  let current: Exclude<Kind, 'workout'> | null = null;
  let used = 0;
  let skipped = 0;
  const add = (raw: string) => {
    const value = healthNumber(raw);
    if (value === null || value < 0) {
      skipped += 1;
      return;
    }
    if (!current) return;
    totals[field[current]] += value;
    used += 1;
  };
  for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const colon = line.indexOf(':');
    if (colon >= 0 && !/^\d/.test(line)) {
      const label = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1).trim();
      if (/^(profile|name)$/i.test(label)) {
        profile = rest || null;
        current = null;
        continue;
      }
      if (/^date$/i.test(label)) {
        day = ISO_DAY.exec(rest)?.[1] ?? day;
        current = null;
        continue;
      }
      current = textKind(label);
      if (rest && current) add(rest);
      continue;
    }
    if (current) add(line);
  }
  if (!profile) {
    const prefix = /^([^\d_-][^_-]*)[_-]/.exec(fileName)?.[1]?.trim();
    profile = prefix || null;
  }
  if (!day) {
    const stamp = /(\d{4})-?(\d{2})-?(\d{2})/.exec(fileName);
    day = stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}` : today;
  }
  const rounded: DayTotals = {
    steps: Math.round(totals.steps),
    activeKcal: Math.round(totals.activeKcal),
    exerciseMin: Math.round(totals.exerciseMin),
    standMin: Math.round(totals.standMin),
  };
  return { profile, days: used > 0 ? { [day]: rounded } : {}, workouts: [], used, skipped };
}

export function readHealthFile(body: unknown, fileName = ''): FileResult {
  if (typeof body === 'string') return readHealthText(body, fileName);
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

export function healthFileTime(name: string): string | null {
  const match = /(\d{4})-?(\d{2})-?(\d{2})(?:[-_T ]?(\d{2})(\d{2})(\d{2})?)?/.exec(name);
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function applyResult(data: AppData, result: FileResult, fileName: string, now: string): AppData {
  const health = { ...data.health };
  const at = healthFileTime(fileName) ?? now;
  for (const [day, totals] of Object.entries(result.days)) {
    const old = health[day];
    if (!old || Date.parse(at) >= Date.parse(old.updatedAt)) health[day] = { ...totals, updatedAt: at };
  }
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
  logStepWalks(activities, health, data.removedLogIds, localDay(Date.parse(now)));
  return { ...data, health, activities, healthFiles: [...data.healthFiles, fileName].slice(-400) };
}

export function stepWalkId(day: string): string {
  return `apple-steps-${day}`;
}

function logStepWalks(activities: ActivityEntry[], health: Record<string, HealthDay>, removed: string[], today: string) {
  for (const [day, totals] of Object.entries(health)) {
    if (day >= today || totals.steps <= ACTIVE_STEPS) continue;
    const id = stepWalkId(day);
    if (removed.includes(id)) continue;
    const index = activities.findIndex((entry) => entry.id === id);
    const entry: ActivityEntry = {
      id,
      date: day,
      name: 'Walking',
      minutes: Math.max(1, Math.round(totals.steps / STEPS_PER_MINUTE)),
      steps: totals.steps,
      source: 'apple',
      createdAt: index >= 0 ? activities[index].createdAt : totals.updatedAt,
    };
    if (index >= 0) activities[index] = entry;
    else activities.push(entry);
  }
}

export function importedHealthFiles(book: ProfileBook): Set<string> {
  return new Set(book.profiles.flatMap((profile) => profile.data.healthFiles));
}

function findProfile(profiles: ProfileBook['profiles'], name: string | null) {
  const key = name?.trim().toLocaleLowerCase();
  if (!key) return undefined;
  const named = (profile: ProfileBook['profiles'][number]) => profile.name.trim().toLocaleLowerCase();
  const exact = profiles.find((profile) => named(profile) === key);
  if (exact) return exact;
  const starts = profiles.filter((profile) => named(profile).startsWith(key));
  return starts.length === 1 ? starts[0] : undefined;
}

export function applyHealthFiles(
  book: ProfileBook,
  files: HealthFile[],
  now = new Date().toISOString(),
): { book: ProfileBook; unmatched: string[] } {
  const unmatched: string[] = [];
  let profiles = book.profiles;
  for (const file of files) {
    const result = readHealthFile(file.body, file.name);
    const target = findProfile(profiles, result.profile);
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
