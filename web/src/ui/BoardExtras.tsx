import { useState } from 'preact/hooks';
import type { Building, CloudHousehold } from '../core/payload';
import type { TeamPlan } from '../core/plan';
import { formatMin } from '../core/route';
import { clearRegistry, saveRegistry, type Attempt, type RegistryEntry, type SelfReport } from '../store';
import { Icon } from '../site/icons';
import { RISK_LABEL } from './common';

export const TEAM_COLORS = ['#38bdf8', '#a78bfa', '#f59e0b', '#22c55e', '#f472b6', '#facc15', '#2dd4bf', '#fb7185'];

const NEED_LABEL: Record<string, string> = { medication: 'Medicine', power: 'Power for a device', water: 'Water', food: 'Food', medical_transport: 'Ride to treatment', evacuation: 'Help to leave', baby_supplies: 'Baby supplies', mobility_help: 'Help moving' };

export function SelfReportsCard({ reports, attempts, label, now }: { reports: SelfReport[]; attempts: Attempt[]; label: (id: string) => string; now: number }) {
  const open = attempts.filter((a) => !reports.some((r) => r.token === a.token));
  const sorted = [...reports].sort((a, b) => Number(b.status === 'need') - Number(a.status === 'need') || b.at - a.at);
  return (
    <div class="card">
      <h3><Icon name="door" size={18} /> Door-hangers & resident check-ins</h3>
      <p class="small muted">No answer is never treated as safe. {attempts.length} hanger(s) left · {reports.length} resident(s) checked in · {open.length} still silent.</p>
      {sorted.length === 0 && <p class="muted small">No check-ins yet. When a volunteer marks "Nobody answered", the resident gets a code to report from any phone.</p>}
      {sorted.map((r) => (
        <div class="selfrep" key={r.token}>
          <span class={`mk-src ${r.status === 'need' ? 'refused' : 'device'}`}>{r.status === 'need' ? 'Needs help' : 'OK'}</span>
          <b>{label(r.buildingId)}</b>
          <span class="muted small">{r.people} in home · {Math.round((now - r.at) / 60000)} min ago</span>
          {r.needs.length > 0 && <span class="small">{r.needs.map((n) => NEED_LABEL[n] ?? n).join(', ')}</span>}
        </div>))}
      {open.length > 0 && <p class="small muted">Silent: {open.slice(0, 12).map((a) => label(a.buildingId)).join(' · ')}{open.length > 12 ? ' …' : ''}</p>}
    </div>
  );
}

// ---------- Agency registry import ----------
const RISK_WORDS: [string, RegExp][] = [['oxygen', /oxygen|o2|concentrator/i], ['ventilator', /vent/i], ['dialysis', /dialysis|renal|kidney/i], ['insulin', /insulin|diabet/i], ['mobility', /mobil|wheelchair|bed.?bound|walker/i], ['other', /cpap|suction|powered|device|dme/i]];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(road)\b/g, 'rd').replace(/\b(street)\b/g, 'st').replace(/\b(lane)\b/g, 'ln').replace(/\b(avenue)\b/g, 'ave').replace(/\s+/g, ' ').trim();

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

interface Preview { entries: RegistryEntry[]; rows: number; unmatched: string[]; kept: string[]; dropped: string[] }

export function buildRegistry(text: string, buildings: Building[]): Preview {
  const [head = [], ...rows] = parseCsv(text);
  const h = head.map((x) => x.trim().toLowerCase());
  const ai = h.findIndex((x) => /address|street|building|location/.test(x));
  const ri = h.map((x, i) => (/risk|device|condition|need|equipment|dme|category/.test(x) ? i : -1)).filter((i) => i >= 0);
  if (ai < 0) throw new Error('No address column found. Add a column named "address".');
  const byLabel = new Map(buildings.map((b) => [norm(b.label), b.id]));
  const merged = new Map<string, Set<string>>(); const unmatched: string[] = [];
  for (const r of rows) {
    const id = byLabel.get(norm(r[ai] ?? ''));
    if (!id) { unmatched.push(r[ai] ?? '(blank)'); continue; }
    const text = ri.map((i) => r[i] ?? '').join(' ');
    const risks = RISK_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
    const set = merged.get(id) ?? new Set<string>(); (risks.length ? risks : ['other']).forEach((x) => set.add(x)); merged.set(id, set);
  }
  const now = Date.now();
  return {
    entries: [...merged.entries()].map(([buildingId, s]) => ({ buildingId, risks: [...s].slice(0, 6), importedAt: now })),
    rows: rows.length, unmatched,
    kept: [head[ai], ...ri.map((i) => head[i])].filter(Boolean),
    dropped: head.filter((_, i) => i !== ai && !ri.includes(i)),
  };
}

export const SAMPLE_REGISTRY = `address,full_name,phone,date_of_birth,equipment,notes
324 Baileys Branch Road,EXAMPLE ONLY - not a real resident,555-0101,1941-03-02,Oxygen concentrator,fictional row
229 Hill Street,EXAMPLE ONLY - not a real resident,555-0102,1938-11-19,Home dialysis,fictional row
76 North Main Street,EXAMPLE ONLY - not a real resident,555-0103,1950-07-07,Ventilator (BiPAP),fictional row
145 Skyway Drive,EXAMPLE ONLY - not a real resident,555-0104,1944-01-28,Wheelchair; bed-bound,fictional row
39 South Main Street,EXAMPLE ONLY - not a real resident,555-0105,1959-05-15,Insulin (type 1),fictional row
75 Sprinkle Drive,EXAMPLE ONLY - not a real resident,555-0106,1936-09-09,Oxygen concentrator + CPAP,fictional row
1 Nowhere Lane,EXAMPLE ONLY - not a real resident,555-0107,1940-02-02,Oxygen,outside the area
`;

export function RegistryCard({ buildings, registry, canWrite }: { buildings: Building[]; registry: RegistryEntry[]; canWrite: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = (text: string) => { setErr(''); try { setPreview(buildRegistry(text, buildings)); } catch (e) { setErr((e as Error).message); } };
  const label = (id: string) => buildings.find((b) => b.id === id)?.label ?? id;
  const sample = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([SAMPLE_REGISTRY], { type: 'text/csv' })); a.download = 'sample-at-risk-registry.csv'; a.click(); };
  return (
    <div class="card">
      <h3><Icon name="users" size={18} /> At-risk registry</h3>
      <p class="small muted">Import the agency's list of residents who rely on powered medical equipment (for example from HHS emPOWER or a utility's medical-baseline list). The file is read <b>in this browser</b>. Only the building and a risk category sync to volunteers; names, phones and dates of birth never leave this device.</p>
      {registry.length > 0 && (
        <div class="reg-live"><b>{registry.length}</b> known-risk homes are on every volunteer's list:{' '}
          {registry.slice(0, 8).map((r) => `${label(r.buildingId)} (${r.risks.map((x) => RISK_LABEL[x] ?? x).join(', ')})`).join(' · ')}{registry.length > 8 ? ' …' : ''}</div>)}
      <div class="actions">
        <label class="btn ghost"><Icon name="layers" size={16} /> Choose CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) load(await f.text()); }} />
        </label>
        <button class="btn ghost" onClick={() => load(SAMPLE_REGISTRY)}>Try the sample</button>
        <button class="link small" onClick={sample}>Download sample CSV</button>
        {registry.length > 0 && canWrite && <button class="link small" onClick={() => clearRegistry(registry.map((r) => r.buildingId))}>Remove all</button>}
      </div>
      {err && <p class="error">{err}</p>}
      {preview && (
        <div class="reg-prev">
          <p><b>{preview.entries.length}</b> homes matched from {preview.rows} rows{preview.unmatched.length ? `, ${preview.unmatched.length} not in this area (${preview.unmatched.slice(0, 3).join(', ')})` : ''}.</p>
          <p class="small"><span class="ok-t">Kept:</span> {preview.kept.join(', ')} → building + risk category only</p>
          <p class="small"><span class="no-t">Stays on this device:</span> {preview.dropped.join(', ') || 'nothing else'}</p>
          <div class="actions">
            <button class="btn primary" disabled={busy || !canWrite || !preview.entries.length} onClick={async () => { setBusy(true); try { await saveRegistry(preview.entries); setPreview(null); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>
              Put {preview.entries.length} homes on volunteers' lists
            </button>
            <button class="btn ghost" onClick={() => setPreview(null)}>Cancel</button>
          </div>
          {!canWrite && <p class="small muted">Only a coordinator can publish the registry.</p>}
        </div>)}
    </div>
  );
}

// ---------- Route plan (code) ----------
export function RoutePlan({ plan, label }: { plan: TeamPlan[]; label: (h: CloudHousehold) => string }) {
  if (!plan.length) return null;
  const late = plan.flatMap((t) => t.stops).filter((s) => s.late).length;
  return (
    <div class="route-plan">
      <div class="small muted">Stop order and arrival times are computed by code: earliest deadline first, counting travel at 12 km/h and 8 min per stop. {late ? <b class="ask">{late} stop(s) will be reached after their deadline: add a team.</b> : 'Every stop is reached before its deadline.'}</div>
      <div class="route-teams">
        {plan.map((t, i) => (
          <div class="route-team" key={t.team} style={{ borderTopColor: TEAM_COLORS[i % TEAM_COLORS.length] }}>
            <b>{t.team}</b> <span class="muted small">{t.stops.length} stops</span>
            <ol>{t.stops.map((s) => (
              <li key={s.ref} class={s.late ? 'late' : ''}>
                <span>{label(s)}</span>
                <span class="small">ETA {formatMin(s.etaMin ?? 0)}{s.slackMin != null ? ` · ${s.slackMin >= 0 ? `${formatMin(s.slackMin)} to spare` : `${formatMin(-s.slackMin)} late`}` : s.overdue ? ' · already overdue' : ''}</span>
              </li>))}
            </ol>
          </div>))}
      </div>
    </div>
  );
}
