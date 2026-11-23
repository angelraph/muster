// Product mock-ups built from real UI pieces, used on the marketing pages.
import { useEffect, useState } from 'preact/hooks';
import { Icon, type IconName } from './icons';
import { reducedMotion, useCycle } from './motion';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(x).padStart(2, '0')}s`;
}

/** A household card whose countdown really ticks. */
export function HouseholdCard({ street = '8 River Rd', note = 'green gate, ground floor', hazard = 'Oxygen concentrator without power', startMs = 2 * 3600e3 + 58 * 60e3, tone = 'urgent', source = 'device' }:
  { street?: string; note?: string; hazard?: string; startMs?: number; tone?: 'urgent' | 'soon' | 'overdue'; source?: 'device' | 'tap' | 'cloud' }) {
  const [left, setLeft] = useState(startMs);
  useEffect(() => { if (reducedMotion()) return; const t = setInterval(() => setLeft((l) => (l > 1000 ? l - 1000 : startMs)), 1000); return () => clearInterval(t); }, []);
  const label = tone === 'overdue' ? 'Overdue' : tone === 'soon' ? 'Soon' : 'Urgent';
  return (
    <div class={`mk-hh tone-${tone}`}>
      <div class="mk-hh-top">
        <span class={`mk-tag ${tone}`}>{label}</span>
        <b>{street}</b><span class="mk-dim">· {note}</span>
      </div>
      <div class="mk-clock"><Icon name="clock" size={16} /> Time to harm <b>{tone === 'overdue' ? '−0h 12m' : fmt(left)}</b></div>
      <div class="mk-haz"><Icon name="lungs" size={15} /> {hazard}</div>
      <div class="mk-hh-foot">
        <span class={`mk-src ${source}`}>{source === 'device' ? 'On this device' : source === 'cloud' ? 'Cloud' : 'Tapped by volunteer'}</span>
        <span class="mk-dim">recheck in 1h 30m</span>
      </div>
    </div>
  );
}

export function NoSignalCard() {
  return (
    <div class="mk-phone">
      <div class="mk-status"><span>9:41</span><span class="mk-nosig"><Icon name="wifiOff" size={14} /> No signal</span></div>
      <div class="mk-banner"><Icon name="shield" size={16} /> On-device AI ready. Doorstep notes never leave this phone.</div>
      <div class="mk-note">“Grandma on oxygen, concentrator dead, battery maybe three hours. Baby 8 months.”</div>
      <div class="mk-chips">
        <span class="mk-chip in">Oxygen · no power</span><span class="mk-chip in">Battery ~3 h</span><span class="mk-chip in">Baby under 1</span><span class="mk-chip in">Aged 65+</span>
      </div>
      <div class="mk-row"><span class="mk-src device">On this device</span><span class="mk-btn">Save household</span></div>
    </div>
  );
}

/** Animated QR made of cells that shuffle, like frames of a multi-part handoff. */
export function QrCard({ small }: { small?: boolean }) {
  const [frame] = useCycle(5, 650);
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21);
    const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7;
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x < 7 ? x : x - 14, ly = y < 7 ? y : y - 14;
      return lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    }
    return ((x * 7 + y * 13 + frame * 17 + x * y) % 5) < 2;
  });
  return (
    <div class={`mk-qr ${small ? 'small' : ''}`}>
      <div class="mk-qr-grid">{cells.map((on, i) => <i key={i} class={on ? 'on' : ''} />)}</div>
      {!small && <div class="mk-qr-cap"><Icon name="qr" size={15} /> Frame {frame + 1} of 5 · 7 households</div>}
    </div>
  );
}

export function MiniBoard() {
  const homes = Array.from({ length: 36 }, (_, i) => i);
  const status = (i: number) => (i === 4 ? 'over' : [9, 17, 22].includes(i) ? 'p1' : [12, 28].includes(i) ? 'p2' : [2, 15, 31].includes(i) ? 'p3' : 'unv');
  return (
    <div class="mk-board">
      <div class="mk-kpis">
        {([['7', 'found'], ['4', 'urgent'], ['1', 'overdue'], ['54', 'unchecked']] as const).map(([n, l], i) => (
          <div key={l} class={`mk-kpi k${i}`}><b>{n}</b><span>{l}</span></div>))}
      </div>
      <div class="mk-map">{homes.map((i) => <i key={i} class={`h ${status(i)}`} />)}</div>
    </div>
  );
}

export function RunSheetCard() {
  return (
    <div class="mk-sheet">
      <div class="mk-sheet-h"><b>Team 1 run sheet</b><span class="mk-src cloud">Cloud</span></div>
      <p>Start with the oxygen cases on River Rd. Bring a generator and water.</p>
      <ol>
        <li><b>8 River Rd</b> · oxygen, about 2 h left</li>
        <li><b>11 Mill St</b> · dialysis due, needs a ride</li>
        <li><b>16 Church Ln</b> · formula and water low</li>
      </ol>
    </div>
  );
}

export function IconTile({ name, tone = 'blue', size = 'md' }: { name: IconName; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span class={`itile ${tone} ${size}`}><Icon name={name} size={size === 'lg' ? 30 : size === 'sm' ? 16 : 22} stroke={2} /></span>;
}
