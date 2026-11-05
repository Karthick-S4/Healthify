import { afterEach, describe, expect, it, vi } from 'vitest';
import { pullHealthFiles } from './cloud';

const DIR = 'https://api.github.com/repos/Karthick-S4/Healthify-data/contents/health';

function fakeGitHub(files: Record<string, string>) {
  const deleted: string[] = [];
  vi.stubGlobal('localStorage', { getItem: () => 'key', setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === 'DELETE') {
        deleted.push(decodeURIComponent(url.slice(DIR.length + 1)));
        return new Response('{}', { status: 200 });
      }
      if (url === DIR) {
        return Response.json(Object.keys(files).map((name) => ({ name, type: 'file', url: `${DIR}/${name}?ref=main`, sha: `sha-${name}` })));
      }
      const name = decodeURIComponent(url.slice(DIR.length + 1).replace(/\?ref=main$/, ''));
      const text = files[name];
      if (text === undefined) return new Response('', { status: 404 });
      return Response.json({ content: btoa(text) });
    }),
  );
  return deleted;
}

afterEach(() => vi.unstubAllGlobals());

describe('pullHealthFiles', () => {
  it('deletes older files from the same day for the same person and imports only the newest', async () => {
    const deleted = fakeGitHub({
      '20261105-091500': 'Profile: Niv\nSteps: 900',
      '20261105-211500.txt': 'Profile: Niv\nSteps: 400',
      '20261105-120000': 'Profile: Karthick\nSteps: 7000',
      '20261104-210000': 'Profile: Niv\nSteps: 3000',
    });
    const files = await pullHealthFiles(new Set());
    expect(deleted).toEqual(['20261105-091500']);
    expect(files.map((file) => file.name)).toEqual(['20261104-210000', '20261105-120000', '20261105-211500.txt']);
  });
});
