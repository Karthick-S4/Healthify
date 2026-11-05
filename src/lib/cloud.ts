import { normalizeBook } from './storage';
import { mergeBooks } from './sync';
import type { ProfileBook } from '../types';
import { healthFileTime, readHealthFile, type HealthFile } from './appleHealth';

const REPO = 'Karthick-S4/Healthify-data';
const FILE_URL = `https://api.github.com/repos/${REPO}/contents/diary.json`;
const KEY_STORAGE = 'healthify.sync.v1';
const LINK_PARAM = 'connect';
const TIMEOUT_MS = 10000;

export type PullResult = { kind: 'ok'; book: ProfileBook } | { kind: 'no-key' } | { kind: 'bad-key' } | { kind: 'failed' };

type Remote = { book: ProfileBook | null; sha: string | null };

export function readSyncKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function saveSyncKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Without storage the key lasts until the page is closed.
  }
}

export function captureLinkKey() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get(LINK_PARAM);
  if (!key) return;
  saveSyncKey(key);
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

export function deviceLink(key: string, profile: string | null = null): string {
  const search = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  return `${window.location.origin}${window.location.pathname}${search}#${LINK_PARAM}=${encodeURIComponent(key)}`;
}
async function send(url: string, key: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${key}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

class KeyError extends Error {}

async function readRemote(key: string): Promise<Remote | null> {
  const response = await send(FILE_URL, key);
  if (!response) return null;
  if (response.status === 401 || response.status === 403) throw new KeyError();
  if (response.status === 404) {
    const repo = await send(`https://api.github.com/repos/${REPO}`, key);
    if (repo?.status === 404 || repo?.status === 401 || repo?.status === 403) throw new KeyError();
    return repo?.ok ? { book: null, sha: null } : null;
  }
  if (!response.ok) return null;
  const file = (await response.json()) as { sha: string; content?: string; git_url?: string };
  let content = file.content ?? '';
  if (!content && file.git_url) {
    const blob = await send(file.git_url, key);
    if (!blob?.ok) return null;
    content = ((await blob.json()) as { content: string }).content;
  }
  return { book: content ? normalizeBook(JSON.parse(fromBase64(content))) : null, sha: file.sha };
}

async function readFileText(url: string, key: string): Promise<string | null> {
  const response = await send(url, key);
  if (!response?.ok) return null;
  const file = (await response.json()) as { content?: string; git_url?: string };
  let content = file.content ?? '';
  if (!content && file.git_url) {
    const blob = await send(file.git_url, key);
    if (!blob?.ok) return null;
    content = ((await blob.json()) as { content: string }).content;
  }
  return content ? fromBase64(content) : null;
}

type HealthEntry = { name: string; type: string; url: string; sha: string };

const HEALTH_DIR = `https://api.github.com/repos/${REPO}/contents/health`;

function parseHealthText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function byFileTime(a: HealthEntry, b: HealthEntry): number {
  const at = healthFileTime(a.name) ?? '';
  const bt = healthFileTime(b.name) ?? '';
  return at === bt ? (a.name < b.name ? -1 : 1) : at < bt ? -1 : 1;
}

export async function pullHealthFiles(skip: Set<string>, limit = 20): Promise<HealthFile[]> {
  const key = readSyncKey();
  if (!key) return [];
  const listing = await send(HEALTH_DIR, key);
  if (!listing?.ok) return [];
  const entries = (await listing.json()) as HealthEntry[];
  if (!Array.isArray(entries)) return [];
  const usable = entries
    .filter((entry) => entry.type === 'file' && (/\.(json|txt)$/i.test(entry.name) || !entry.name.includes('.')))
    .sort(byFileTime);

  const texts = new Map<string, string>();
  const stale: HealthEntry[] = [];
  const byDay = new Map<string, HealthEntry[]>();
  for (const entry of usable) {
    const day = /(\d{4})-?(\d{2})-?(\d{2})/.exec(entry.name)?.slice(1).join('-');
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  for (const group of byDay.values()) {
    if (group.length < 2) continue;
    const newest = new Map<string, HealthEntry>();
    for (const entry of group) {
      const text = await readFileText(entry.url, key);
      if (text === null) continue;
      texts.set(entry.name, text);
      const who = readHealthFile(parseHealthText(text), entry.name).profile?.toLocaleLowerCase() ?? '';
      const older = newest.get(who);
      if (older) stale.push(older);
      newest.set(who, entry);
    }
  }
  for (const entry of stale) {
    await send(`${HEALTH_DIR}/${encodeURIComponent(entry.name)}`, key, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Remove older Apple Health file', sha: entry.sha }),
    });
  }

  const gone = new Set(stale.map((entry) => entry.name));
  const fresh = usable.filter((entry) => !skip.has(entry.name) && !gone.has(entry.name)).slice(0, limit);
  const files: HealthFile[] = [];
  for (const entry of fresh) {
    const text = texts.get(entry.name) ?? (await readFileText(entry.url, key));
    if (text === null) continue;
    files.push({ name: entry.name, body: parseHealthText(text) });
  }
  return files;
}

export async function pullDiary(): Promise<PullResult> {
  const key = readSyncKey();
  if (!key) return { kind: 'no-key' };
  try {
    const remote = await readRemote(key);
    if (!remote) return { kind: 'failed' };
    return { kind: 'ok', book: remote.book ?? normalizeBook({}) };
  } catch (error) {
    return { kind: error instanceof KeyError ? 'bad-key' : 'failed' };
  }
}

export async function pushDiary(local: ProfileBook): Promise<PullResult> {
  const key = readSyncKey();
  if (!key) return { kind: 'no-key' };
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remote = await readRemote(key);
      if (!remote) return { kind: 'failed' };
      const merged = remote.book ? mergeBooks(remote.book, local) : local;
      const response = await send(FILE_URL, key, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Update diary',
          content: toBase64(JSON.stringify(merged)),
          ...(remote.sha ? { sha: remote.sha } : {}),
        }),
      });
      if (!response) return { kind: 'failed' };
      if (response.ok) return { kind: 'ok', book: merged };
      if (response.status === 401 || response.status === 403) return { kind: 'bad-key' };
      if (response.status !== 409 && response.status !== 422) return { kind: 'failed' };
    }
    return { kind: 'failed' };
  } catch (error) {
    return { kind: error instanceof KeyError ? 'bad-key' : 'failed' };
  }
}
