import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function serviceWorker(buildId: string, assets: string[]): string {
  return `const CACHE = ${JSON.stringify(`healthify-${buildId}`)};
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request).catch(() => caches.match('./version.json')));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, request.mode === 'navigate' ? { cache: 'no-cache' } : undefined);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await caches.match('./index.html');
      if (home) return home;
    }
    throw error;
  }
}
`;
}

export function healthifySw(buildId: string): Plugin {
  let dist = path.resolve('dist');
  return {
    name: 'healthify-sw',
    apply: 'build',
    configResolved(config) {
      dist = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({ buildId }));
      const assets = walk(dist)
        .map((file) => `./${path.relative(dist, file).split(path.sep).join('/')}`)
        .filter((file) => file !== './sw.js');
      fs.writeFileSync(path.join(dist, 'sw.js'), serviceWorker(buildId, assets));
    },
  };
}
