import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Board } from './ui/Board';
import { Volunteer } from './ui/Volunteer';
import { demoScenario } from './core/scenario';
import { INCIDENT_ID, joinIncident, membership, saveHousehold } from './store';
import { firebase } from './firebase';
import './styles.css';

function useRoute() {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const f = () => setR(location.hash.slice(1) || '/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

function Home() {
  const [loaded, setLoaded] = useState(false);
  return (
    <main class="home">
      <h1>Muster</h1>
      <p class="lead">After a disaster, many deaths come in the days after the storm: oxygen runs out, insulin goes warm, a dialysis session is missed, someone living alone is never checked.
        Muster finds those households before their time runs out, even with every cell tower down.</p>
      <div class="choices">
        <a class="choice" href="#/volunteer"><b>I'm at the doors</b><span>Volunteer. Works with no signal. On-device AI if this device has it, tap mode if not.</span></a>
        <a class="choice" href="#/board"><b>I'm coordinating</b><span>Shelter or response center. Time-to-harm board, unchecked homes, cloud run sheets.</span></a>
      </div>
      <p class="small muted">Incident: {INCIDENT_ID} · {firebase() ? 'Firebase connected' : 'Demo mode: Firebase not configured yet'}</p>
      <button class="btn ghost small" onClick={async () => { for (const h of demoScenario(Date.now(), INCIDENT_ID)) await saveHousehold(h); setLoaded(true); }}>
        {loaded ? 'Demo households loaded' : 'Load demo households (synthetic)'}
      </button>
      <p class="small muted">Needs intake and logistics only. Not medical advice. Thresholds come from the responding agency's rulebook.</p>
    </main>
  );
}

function JoinGate({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  return (
    <main class="home">
      <h2>Join incident {INCIDENT_ID}</h2>
      <p class="muted">Ask your coordinator for the join code. You only need signal once.</p>
      <div class="actions">
        <input value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="Join code" />
        <button class="btn primary" onClick={async () => { try { await joinIncident(code); onJoined(); } catch { setErr('That code did not work.'); } }}>Join</button>
      </div>
      {err && <p class="error">{err}</p>}
    </main>
  );
}

function App() {
  const r = useRoute();
  const [role, setRole] = useState<string>('…');
  useEffect(() => { membership().then(setRole); }, []);
  if (role === 'none') return <JoinGate onJoined={() => membership().then(setRole)} />;
  return (
    <>
      <nav class="nav"><a href="#/">Muster</a><a href="#/volunteer">Doors</a><a href="#/board">Coordinator</a></nav>
      {r === '/volunteer' ? <Volunteer /> : r === '/board' ? <Board /> : <Home />}
    </>
  );
}

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Offline shell not installed', e));
}
