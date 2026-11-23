// "No answer" is not "safe". The volunteer leaves a door-hanger with a one-time code; the resident reports later.
import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { submitSelfReport, type Attempt, type SelfStatus } from '../store';
import { Icon } from '../site/icons';
import { Logo } from '../site/brand';
import { LANGS, langByCode } from '../core/language';

export const residentUrl = (token: string) => `${location.origin}/#/r/${token}`;

export function DoorHanger({ attempt, label, onClose }: { attempt: Attempt; label: string; onClose: () => void }) {
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(residentUrl(attempt.token), { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(setQr); }, [attempt.token]);
  return (
    <div class="modal" role="dialog" aria-label="Door-hanger">
      <div class="modal-body hanger-wrap">
        <p class="small muted">Nobody answered at <b>{label}</b>. It stays on the list as <b>attempted</b> with a recheck, and the resident can report with this code.</p>
        <div class="hanger" id="hanger-print">
          <div class="hanger-hole" aria-hidden="true" />
          <Logo size={34} />
          <h2>We came to check on you.</h2>
          <p>Volunteers are checking every home in your area. When you have signal, scan this code and tell us if you are OK or need help.</p>
          {qr ? <img src={qr} alt={`QR code for resident code ${attempt.token}`} class="hanger-qr" /> : <div class="hanger-qr" />}
          <div class="hanger-code"><span>Or open</span> <b>{location.host}/#/r</b> <span>and enter</span><b class="hcode">{attempt.token.slice(0, 4)}-{attempt.token.slice(4)}</b></div>
          <p class="hanger-langs">{LANGS.slice(1).map((l) => l.name).join(' · ')}</p>
          <p class="hanger-em"><Icon name="heartbeat" size={16} /> In an emergency, call 911.</p>
        </div>
        <div class="actions">
          <button class="btn ghost" onClick={() => { document.body.classList.add('print-hanger'); print(); document.body.classList.remove('print-hanger'); }}><Icon name="book" size={16} /> Print</button>
          <button class="btn primary" onClick={onClose}>Done, next door</button>
        </div>
      </div>
    </div>
  );
}

const NEED_KEYS = ['medication', 'power', 'water', 'food', 'medical_transport', 'evacuation', 'baby_supplies', 'mobility_help'] as const;
const firstLang = () => {
  try { const saved = localStorage.getItem('muster.resident.lang'); if (saved) return saved; } catch { /* ignore */ }
  const want = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2).toLowerCase());
  return want.find((w) => LANGS.some((l) => l.code === w)) ?? 'en';
};

/** Public page for residents. Works on any phone browser. No name, no free text, one tap. */
export function ResidentReport({ token: initial }: { token: string }) {
  const [token, setToken] = useState(initial.replace(/[^A-Z0-9]/gi, '').toUpperCase());
  const [status, setStatus] = useState<SelfStatus | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [people, setPeople] = useState(1);
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const [err, setErr] = useState('');
  const [code, setCode] = useState(firstLang);
  const L = langByCode(code).resident;
  const dir = langByCode(code).dir as 'ltr' | 'rtl';
  const pickLang = (c: string) => { setCode(c); try { localStorage.setItem('muster.resident.lang', c); } catch { /* ignore */ } };
  useEffect(() => { document.title = 'Check in · Muster'; document.documentElement.lang = code; }, [code]);
  const langBar = (
    <div class="res-langs" dir="ltr" role="group" aria-label="Language">
      {LANGS.map((l) => <button key={l.code} class={l.code === code ? 'on' : ''} onClick={() => pickLang(l.code)} lang={l.code}>{l.name}</button>)}
    </div>);

  async function send() {
    if (!status) return;
    setErr(''); setState('sending');
    try { await submitSelfReport({ token, status, needs: status === 'need' ? needs : [], people }); setState('done'); }
    catch (e) { setErr((e as Error).message.includes('permission') ? L.invalid : (e as Error).message); setState('form'); }
  }

  if (state === 'done') return (
    <main class="join"><div class="join-card center" dir={dir}>
      {langBar}
      <span class="done-tick"><Icon name="check" size={36} stroke={2.4} /></span>
      <h1>{L.thanks}</h1>
      <p class="muted">{status === 'ok' ? L.thanksOk : L.thanksNeed}</p>
      <p class="small muted">{L.emergency}</p>
    </div></main>
  );

  return (
    <main class="join">
      <div class="join-card resident" dir={dir}>
        <Logo size={36} />
        {langBar}
        <h1>{L.title}</h1>
        <p class="muted">{L.intro}</p>
        {token.length !== 8 && (
          <label class="field-l">{L.code}
            <input value={token} maxLength={9} placeholder="ABCD-1234" onInput={(e) => setToken((e.target as HTMLInputElement).value.replace(/[^A-Z0-9]/gi, '').toUpperCase())} />
          </label>)}
        <div class="res-choice">
          <button class={`res-btn ok ${status === 'ok' ? 'on' : ''}`} onClick={() => setStatus('ok')}><Icon name="check" size={26} stroke={2.4} /> {L.ok}</button>
          <button class={`res-btn need ${status === 'need' ? 'on' : ''}`} onClick={() => setStatus('need')}><Icon name="heartbeat" size={26} stroke={2.2} /> {L.need}</button>
        </div>
        {status === 'need' && (
          <>
            <p class="small muted">{L.whatNeed}</p>
            <div class="res-needs">{NEED_KEYS.map((k) => (
              <button key={k} class={needs.includes(k) ? 'on' : ''} onClick={() => setNeeds(needs.includes(k) ? needs.filter((x) => x !== k) : [...needs, k])}>{L.needs[k]}</button>))}
            </div>
          </>)}
        {status && (
          <label class="field-l">{L.people}
            <div class="stepper"><button type="button" onClick={() => setPeople(Math.max(0, people - 1))}>−</button><input value={people} readOnly /><button type="button" onClick={() => setPeople(Math.min(30, people + 1))}>+</button></div>
          </label>)}
        {err && <p class="error">{err}</p>}
        <button class="btn primary block" disabled={!status || token.length !== 8 || state === 'sending'} onClick={send}>{state === 'sending' ? L.sending : L.send}</button>
        <p class="small muted center">{L.emergency}</p>
      </div>
    </main>
  );
}
