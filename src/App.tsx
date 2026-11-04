import { useEffect, useState } from 'react';
import { IconIdeas, IconMore, IconPeriod, IconToday } from './components/Icons';
import { HealthProvider, useHealth } from './state';
import { IdeasView } from './views/IdeasView';
import { LockView } from './views/LockView';
import { MoreView } from './views/MoreView';
import { PeriodView } from './views/PeriodView';
import { TodayView } from './views/TodayView';

type View = 'today' | 'period' | 'ideas' | 'more';

function Shell() {
  const health = useHealth();
  const [view, setView] = useState<View>('today');
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const viewport = window.visualViewport;
      const height = viewport ? viewport.height : window.innerHeight;
      root.style.setProperty('--vv-height', `${Math.round(height)}px`);
    };
    apply();
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);

  useEffect(() => {
    const url = new URL('version.json', document.baseURI);
    url.searchParams.set('ts', String(Date.now()));
    fetch(url, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { buildId?: string } | null) => {
        if (body?.buildId && body.buildId !== __BUILD_ID__) setUpdateReady(true);
      })
      .catch(() => undefined);
  }, []);

  if (!health.profileId) return <LockView />;

  return (
    <div className="shell">
      {updateReady && (
        <div className="update">
          <p>A new version is ready.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <main>
        {view === 'today' && <TodayView onOpenIdeas={() => setView('ideas')} onOpenMore={() => setView('more')} />}
        {view === 'period' && <PeriodView onOpenMore={() => setView('more')} />}
        {view === 'ideas' && <IdeasView onOpenMore={() => setView('more')} />}
        {view === 'more' && <MoreView />}
      </main>
      <div className="dock">
        {health.undo && (
          <div className="undo" role="status">
            <span>{health.undo.message}</span>
            <button type="button" onClick={health.undoLast}>
              Undo
            </button>
          </div>
        )}
        <nav aria-label="Sections">
          <button type="button" aria-current={view === 'today' ? 'page' : undefined} onClick={() => setView('today')}>
            <IconToday />
            Today
          </button>
          <button type="button" aria-current={view === 'period' ? 'page' : undefined} onClick={() => setView('period')}>
            <IconPeriod />
            Period
          </button>
          <button type="button" aria-current={view === 'ideas' ? 'page' : undefined} onClick={() => setView('ideas')}>
            <IconIdeas />
            Ideas
          </button>
          <button type="button" aria-current={view === 'more' ? 'page' : undefined} onClick={() => setView('more')}>
            <IconMore />
            More
          </button>
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HealthProvider>
      <Shell />
    </HealthProvider>
  );
}
