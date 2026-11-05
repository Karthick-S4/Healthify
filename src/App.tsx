import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { HeartMark, IconBack, IconBody, IconFood, IconMore, IconMove, IconSummary } from './components/Icons';
import { HealthProvider, useHealth } from './state';
import { ActivityView } from './views/ActivityView';
import { BodyView } from './views/BodyView';
import { GoalView } from './views/GoalView';
import { IdeasView } from './views/IdeasView';
import { LockView } from './views/LockView';
import { MoreView } from './views/MoreView';
import { PeriodView } from './views/PeriodView';
import { StreaksView } from './views/StreaksView';
import { SummaryView } from './views/SummaryView';
import { TodayView } from './views/TodayView';

type Tab = 'summary' | 'food' | 'move' | 'body' | 'more';
type SubView = 'period' | 'ideas' | 'streaks';
type View = Tab | SubView;

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <IconSummary /> },
  { id: 'food', label: 'Food', icon: <IconFood /> },
  { id: 'move', label: 'Move', icon: <IconMove /> },
  { id: 'body', label: 'Body', icon: <IconBody /> },
  { id: 'more', label: 'More', icon: <IconMore /> },
];

const PARENT: Record<SubView, Tab> = { period: 'summary', ideas: 'food', streaks: 'summary' };
const VIEWS = new Set<string>(['summary', 'food', 'move', 'body', 'more', 'period', 'ideas', 'streaks']);

function isSubView(view: View): view is SubView {
  return view in PARENT;
}

function asView(value: unknown): View | null {
  return typeof value === 'string' && VIEWS.has(value) ? (value as View) : null;
}

function Shell() {
  const health = useHealth();
  const [view, setShown] = useState<View>('summary');
  const viewRef = useRef<View>(view);
  const [updateReady, setUpdateReady] = useState(false);
  const [typing, setTyping] = useState(false);
  const goalSet = health.data.profile.goalSet;
  const tab: Tab = isSubView(view) ? PARENT[view] : view;

  const show = useCallback((next: View) => {
    viewRef.current = next;
    setShown(next);
  }, []);

  const setView = useCallback(
    (next: View) => {
      const current = viewRef.current;
      if (next === current) return;
      window.history.pushState({ ...(window.history.state ?? {}), view: next, prev: current }, '');
      show(next);
    },
    [show],
  );

  const goBack = useCallback(
    (parent: Tab) => {
      if (window.history.state?.prev === parent) window.history.back();
      else setView(parent);
    },
    [setView],
  );

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state ?? {}), view: viewRef.current, prev: null }, '');
    const onPop = (event: PopStateEvent) => show(asView((event.state as { view?: unknown } | null)?.view) ?? 'summary');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [show]);

  useEffect(() => {
    if (!goalSet) return;
    show('summary');
    window.history.replaceState({ ...(window.history.state ?? {}), view: 'summary', prev: null }, '');
  }, [health.profileId, goalSet, show]);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [view]);

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
    const check = () => {
      const url = new URL('version.json', document.baseURI);
      url.searchParams.set('ts', String(Date.now()));
      fetch(url, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { buildId?: string } | null) => {
          if (body?.buildId && body.buildId !== __BUILD_ID__) setUpdateReady(true);
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const isField = (element: Element | null) =>
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'submit'].includes(element.type));
    const update = () => setTyping(isField(document.activeElement));
    const onFocusOut = () => window.setTimeout(update, 120);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  if (!health.profileId) return <LockView />;
  if (!health.data.profile.goalSet) return <GoalView />;

  const back = isSubView(view) ? PARENT[view] : null;

  return (
    <div className={typing ? 'shell typing' : 'shell'}>
      {updateReady && (
        <div className="update">
          <p>A new version is ready.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <main>
        {back && (
          <div className="back-row">
            <button type="button" className="back-button" onClick={() => goBack(back)}>
              <IconBack />
              {back === 'summary' ? 'Summary' : 'Food'}
            </button>
          </div>
        )}
        {view === 'summary' && <SummaryView onOpen={setView} />}
        {view === 'food' && <TodayView onOpenIdeas={() => setView('ideas')} onOpenMore={() => setView('more')} />}
        {view === 'move' && <ActivityView />}
        {view === 'body' && <BodyView />}
        {view === 'period' && <PeriodView onOpenMore={() => setView('more')} />}
        {view === 'ideas' && <IdeasView onOpenMore={() => setView('more')} />}
        {view === 'more' && <MoreView />}
        {view === 'streaks' && <StreaksView />}
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
          <button type="button" className="side-brand" aria-label="NivFit, go to Summary" onClick={() => setView('summary')}>
            <HeartMark />
            NivFit
          </button>
          {TABS.map((item) => (
            <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>
              {item.icon}
              {item.label}
            </button>
          ))}
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
