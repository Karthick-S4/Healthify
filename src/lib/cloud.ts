import { normalizeBook } from './storage';
import { mergeBooks } from './sync';
import type { ProfileBook } from '../types';

const ITEM_URL = 'https://crudcrud.com/api/507f3b82f30f4b01a6c6d258e4146607/diary/6aeaf809062f2b03e883fa27';
const TIMEOUT_MS = 8000;

async function send(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readDiary(): Promise<ProfileBook | null> {
  const response = await send(ITEM_URL, { headers: { Accept: 'application/json' } });
  if (!response?.ok) return null;
  return normalizeBook(await response.json());
}

export async function pullDiary(): Promise<ProfileBook | null> {
  try {
    return await readDiary();
  } catch {
    return null;
  }
}

export async function pushDiary(local: ProfileBook): Promise<ProfileBook | null> {
  try {
    const remote = await readDiary();
    if (!remote) return null;
    const merged = mergeBooks(remote, local);
    const updated = await send(ITEM_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(merged),
    });
    return updated?.ok ? merged : null;
  } catch {
    return null;
  }
}
