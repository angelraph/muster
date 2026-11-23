// Coordinator's "Invite volunteers" card: the join code, a QR that opens the app with the code filled in,
// and a printable poster for the staging area. Volunteers still tap Join themselves.
import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { INCIDENT_ID, inviteUrl, readJoinCode } from '../store';
import { Icon } from '../site/icons';
import { Logo } from '../site/brand';

export function InviteCard({ volunteers }: { volunteers: number }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [qr, setQr] = useState('');
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { readJoinCode().then(setCode); }, []);
  useEffect(() => { if (code) QRCode.toDataURL(inviteUrl(code), { margin: 1, width: 560, errorCorrectionLevel: 'M' }).then(setQr); }, [code]);

  async function share() {
    if (!code) return;
    const url = inviteUrl(code);
    const text = `Join the Muster response (${INCIDENT_ID}). Open ${url} and tap Join. Code: ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Join the response', text, url }); return; }
      await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* the user closed the share sheet */ }
  }

  if (code === undefined) return <div class="card invite"><h3><Icon name="users" size={18} /> Invite volunteers</h3><p class="muted small">Loading…</p></div>;
  if (code === null) return (
    <div class="card invite"><h3><Icon name="users" size={18} /> Invite volunteers</h3>
      <p class="small muted">No join code is set on this incident. Add a <code>joinCode</code> field to <code>incidents/{INCIDENT_ID}</code> in the Firebase console.</p></div>);

  return (
    <div class="card invite">
      <h3><Icon name="users" size={18} /> Invite volunteers</h3>
      <div class="invite-row">
        {qr ? <img src={qr} alt={`QR code that opens the app with join code ${code}`} class="invite-qr" /> : <div class="invite-qr" />}
        <div class="invite-info">
          <span class="small muted">Join code</span>
          <b class="invite-code">{code}</b>
          <p class="small muted">Volunteers scan with their phone camera, or open the app and type the code. They need signal once. {volunteers > 0 && <>{volunteers} volunteer{volunteers === 1 ? ' has' : 's have'} reported so far.</>}</p>
          <div class="actions">
            <button class="btn small primary" onClick={share}><Icon name="arrowUpRight" size={14} /> {copied ? 'Copied' : 'Share link'}</button>
            <button class="btn small ghost" onClick={() => setShown(true)}>Show full screen</button>
          </div>
        </div>
      </div>
      <p class="small muted">Only share it with people you have briefed. Anyone with the code can add records; coordinators are promoted in the Firebase console, never by code.</p>
      {shown && (
        <div class="modal" role="dialog" aria-label="Invite poster" onClick={() => setShown(false)}>
          <div class="modal-body invite-poster" id="invite-print" onClick={(e) => e.stopPropagation()}>
            <Logo size={40} />
            <h2>Volunteers: join the response</h2>
            <p>Scan with your phone camera, then tap <b>Join</b>.</p>
            {qr && <img src={qr} alt={`QR code for join code ${code}`} />}
            <p class="invite-code big">{code}</p>
            <p class="small">Or open <b>{location.host}</b> → Open app → enter the code. No name, no account.</p>
            <div class="actions">
              <button class="btn ghost" onClick={() => { document.body.classList.add('print-invite'); print(); document.body.classList.remove('print-invite'); }}><Icon name="book" size={16} /> Print poster</button>
              <button class="btn primary" onClick={() => setShown(false)}>Close</button>
            </div>
          </div>
        </div>)}
    </div>
  );
}
