// "No answer" is not "safe". The volunteer leaves a door-hanger with a one-time code; the resident reports later.
import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { submitSelfReport, type Attempt, type SelfStatus } from '../store';
import { Icon } from '../site/icons';
import { Logo } from '../site/brand';

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

const NEEDS: [string, string][] = [['medication', 'Medicine'], ['power', 'Power for a medical device'], ['water', 'Water'], ['food', 'Food'], ['medical_transport', 'A ride to treatment'], ['evacuation', 'Help to leave'], ['baby_supplies', 'Baby supplies'], ['mobility_help', 'Help moving']];

/** Public page for residents. Works on any phone browser. No name, no free text, one tap. */
export function ResidentReport({ token: initial }: { token: string }) {
  const [token, setToken] = useState(initial.replace(/[^A-Z0-9]/gi, '').toUpperCase());
  const [status, setStatus] = useState<SelfStatus | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [people, setPeople] = useState(1);
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const [err, setErr] = useState('');
  useEffect(() => { document.title = 'Check in · Muster'; }, []);

  async function send() {
    if (!status) return;
    setErr(''); setState('sending');
    try { await submitSelfReport({ token, status, needs: status === 'need' ? needs : [], people }); setState('done'); }
    catch (e) { setErr((e as Error).message.includes('permission') ? 'This code was already used or is not valid.' : (e as Error).message); setState('form'); }
  }

  if (state === 'done') return (
    <main class="join"><div class="join-card center">
      <span class="done-tick"><Icon name="check" size={36} stroke={2.4} /></span>
      <h1>Thank you.</h1>
      <p class="muted">{status === 'ok' ? 'We have marked your home as OK. Stay safe.' : 'The response team can see what you need and will come as soon as they can.'}</p>
      <p class="small muted">In an emergency, call 911.</p>
    </div></main>
  );

  return (
    <main class="join">
      <div class="join-card resident">
        <Logo size={36} />
        <h1>Check in with the response team</h1>
        <p class="muted">A volunteer knocked while you were out or could not come to the door. Your answer goes only to the local response team. We never ask for your name.</p>
        {token.length !== 8 && (
          <label class="field-l">Code from the door-hanger
            <input value={token} maxLength={9} placeholder="ABCD-1234" onInput={(e) => setToken((e.target as HTMLInputElement).value.replace(/[^A-Z0-9]/gi, '').toUpperCase())} />
          </label>)}
        <div class="res-choice">
          <button class={`res-btn ok ${status === 'ok' ? 'on' : ''}`} onClick={() => setStatus('ok')}><Icon name="check" size={26} stroke={2.4} /> We are OK</button>
          <button class={`res-btn need ${status === 'need' ? 'on' : ''}`} onClick={() => setStatus('need')}><Icon name="heartbeat" size={26} stroke={2.2} /> We need help</button>
        </div>
        {status === 'need' && (
          <>
            <p class="small muted">What do you need? Tap all that apply.</p>
            <div class="res-needs">{NEEDS.map(([k, t]) => (
              <button key={k} class={needs.includes(k) ? 'on' : ''} onClick={() => setNeeds(needs.includes(k) ? needs.filter((x) => x !== k) : [...needs, k])}>{t}</button>))}
            </div>
          </>)}
        {status && (
          <label class="field-l">People in the home
            <div class="stepper"><button type="button" onClick={() => setPeople(Math.max(0, people - 1))}>−</button><input value={people} readOnly /><button type="button" onClick={() => setPeople(Math.min(30, people + 1))}>+</button></div>
          </label>)}
        {err && <p class="error">{err}</p>}
        <button class="btn primary block" disabled={!status || token.length !== 8 || state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
        <p class="small muted center">In an emergency, call 911.</p>
      </div>
    </main>
  );
}
