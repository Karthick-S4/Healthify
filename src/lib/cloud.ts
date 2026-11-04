import { emptyBook, normalizeBook } from './storage';
import { mergeBooks } from './sync';
import type { ProfileBook } from '../types';

const DIARY_URL = 'https://crudcrud.com/api/fda0d8957ad745f29c558c6897b3588f/diary';

type CloudRow = { _id?: string };

async function readRows(): Promise<CloudRow[] | null> {
  const response = await fetch(`${DIARY_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const rows = (await response.json()) as unknown;
  return Array.isArray(rows) ? (rows as CloudRow[]) : null;
}

export async function pullDiary(): Promise<ProfileBook | null> {
  try {
    const rows = await readRows();
    if (!rows) return null;
    return rows.map((row) => normalizeBook(row)).reduce(mergeBooks, emptyBook());
  } catch {
    return null;
  }
}

export async function pushDiary(local: ProfileBook): Promise<ProfileBook | null> {
  try {
    const rows = await readRows();
    if (!rows) return null;
    const remote = rows.map((row) => normalizeBook(row)).reduce(mergeBooks, emptyBook());
    const merged = mergeBooks(remote, local);
    const body = JSON.stringify(merged);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (!rows[0]?._id) {
      const created = await fetch(DIARY_URL, { method: 'POST', headers, body });
      return created.ok ? merged : null;
    }
    const updated = await fetch(`${DIARY_URL}/${rows[0]._id}`, { method: 'PUT', headers, body });
    return updated.ok ? merged : null;
  } catch {
    return null;
  }
}
