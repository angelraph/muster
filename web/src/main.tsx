import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Board } from './ui/Board';
import { Volunteer } from './ui/Volunteer';
import { demoScenario } from './core/scenario';
import { INCIDENT_ID, joinIncident, membership, saveHousehold } from './store';
import { firebase } from './firebase';
import { SiteFooter, SiteNav } from './site/chrome';
import { Landing } from './site/Landing';
import { AboutPage, AgenciesPage, FaqPage, FeaturesPage, HowPage, JudgesPage, NotFound, PrivacyPage, SafetyPage } from './site/pages';
import { Logo } from './site/brand';
import { Icon } from './site/icons';
import { useRevealAll } from './site/motion';
import { useOnline } from './ui/common';
import { LedgerPill } from './ui/Ledger';
import { ResidentReport } from './ui/DoorHanger';
import { EvalPage } from './ui/Eval';
import './styles.css';
import './site/site.css';

function useRoute() {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => { setR(location.hash.slice(1) || '/'); scrollTo({ top: 0 }); };
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

const SITE: Record<string, [string, () => preact.JSX.Element]> = {
  '/': ['Muster: find them before their clock runs out', Landing],
  '/how': ['How it works · Muster', HowPage],
  '/features': ['Features · Muster', FeaturesPage],
  '/agencies': ['For response agencies · Muster', AgenciesPage],
  '/faq': ['FAQ · Muster', FaqPage],
  '/privacy': ['Privacy · Muster', PrivacyPage],
  '/safety': ['Safety & limits · Muster', SafetyPage],
  '/judges': ['For judges · Muster', JudgesPage],
  '/about': ['About & credits · Muster', AboutPage],
};
const APP: Record<string, string> = { '/volunteer': 'Doors · Muster', '/board': 'Coordinator · Muster', '/eval': 'Accuracy test · Muster' };

function Site({ route }: { route: string }) {
  const entry = SITE[route];
  const Page = entry?.[1] ?? NotFound;
  useEffect(() => { document.title = entry?.[0] ?? 'Not found · Muster'; }, [route]);
  useRevealAll(route);
  return (
    <div class="site">
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <SiteNav route={route} />
      <main id="main" tabIndex={-1}><Page /></main>
      <SiteFooter />
    </div>
  );
}

function JoinGate({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(e: Event) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await joinIncident(code); onJoined(); } catch { setErr('That code did not work. Check it with your coordinator.'); } finally { setBusy(false); }
  }
  return (
    <main class="join">
      <form class="join-card" onSubmit={go}>
        <Logo size={44} word={false} />
        <h1>Join the response</h1>
        <p class="muted">Incident <b>{INCIDENT_ID}</b>. Ask your coordinator for the join code. You only need signal once.</p>
        <label class="field-l">Join code
          <input value={code} autoFocus autoCapitalize="characters" onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="e.g. ABCD-1234" />
        </label>
        {err && <p class="error">{err}</p>}
        <button class="btn primary block" disabled={busy || !code.trim()}>{busy ? 'Joining…' : 'Join incident'}</button>
        <p class="small muted">No account, no name, no email. You join anonymously.</p>
        <a class="small" href="#/">Back to the website</a>
      </form>
    </main>
  );
}

function AppShell({ route }: { route: string }) {
  const online = useOnline();
  const [role, setRole] = useState<string>('…');
  const [loaded, setLoaded] = useState(false);
  const [field, setField] = useState<string>(() => { try { return localStorage.getItem('muster.field') ?? 'off'; } catch { return 'off'; } });
  const cycleField = () => { const n = field === 'off' ? 'field' : field === 'field' ? 'night' : 'off'; setField(n); try { localStorage.setItem('muster.field', n); } catch { /* ignore */ } };
  useEffect(() => { membership().then(setRole); }, []);
  useEffect(() => { document.title = APP[route]; }, [route]);
  if (role === '…') return <main class="join"><span class="muted">Loading…</span></main>;
  if (role === 'none') return <JoinGate onJoined={() => membership().then(setRole)} />;
  return (
    <div class={`app ${field !== 'off' ? 'field' : ''} ${field === 'night' ? 'night' : ''}`}>
      <header class="appbar">
        <a href="#/" class="appbar-brand" aria-label="Muster website"><Logo size={28} /></a>
        <nav class="appbar-tabs" aria-label="App">
          <a href="#/volunteer" class={route === '/volunteer' ? 'on' : ''}><Icon name="door" size={18} /> <span>Doors</span></a>
          <a href="#/board" class={route === '/board' ? 'on' : ''}><Icon name="map" size={18} /> <span>Coordinator</span></a>
          <a href="#/eval" class={route === '/eval' ? 'on' : ''}><Icon name="check" size={18} /> <span>Accuracy</span></a>
        </nav>
        <div class="appbar-right">
          {route === '/board' && (
            <button class="btn small ghost hide-sm" title="Adds synthetic households for demos"
              onClick={async () => { for (const h of demoScenario(Date.now(), INCIDENT_ID)) await saveHousehold(h); setLoaded(true); }}>
              {loaded ? 'Demo loaded' : 'Load demo households'}
            </button>)}
          <button class={`fieldbtn ${field}`} onClick={cycleField} title="Field mode: big targets for gloves, then red night mode" aria-label={`Display mode: ${field}`}>
            <Icon name={field === 'night' ? 'eyeOff' : 'sliders'} size={16} /> <span class="hide-sm">{field === 'off' ? 'Field mode' : field === 'field' ? 'Field' : 'Night'}</span>
          </button>
          <LedgerPill />
          <span class={`net ${online ? 'on' : 'off'}`}><i />{online ? 'Online' : 'Offline'}</span>
          {role === 'coordinator' && <span class="role">Coordinator</span>}
          <span class="net hide-sm" title={firebase() ? 'Connected to Firebase' : 'Demo mode, Firebase not configured'}>{firebase() ? INCIDENT_ID : 'Demo mode'}</span>
        </div>
      </header>
      {route === '/volunteer' ? <Volunteer /> : route === '/eval' ? <EvalPage /> : <Board />}
    </div>
  );
}

function App() {
  const r = useRoute();
  if (r === '/r' || r.startsWith('/r/')) return <ResidentReport token={r.slice(3)} />;
  return r in APP ? <AppShell route={r} /> : <Site route={r} />;
}

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Offline shell not installed', e));
}
