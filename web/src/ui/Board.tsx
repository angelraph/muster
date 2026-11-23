import { useMemo, useState } from 'preact/hooks';
import { oneLiner } from '../ai';
import { cloudRequest, generateRunSheet, translateLabels, type RunSheet } from '../cloud';
import { findDuplicates, mergeHouseholds } from '../core/merge';
import { toCloudHousehold } from '../core/payload';
import { assess, formatLeft } from '../core/rules';
import { demoBuildings } from '../core/seed';
import type { Assessment, Household } from '../core/types';
import { firebase, setLocalConfig } from '../firebase';
import { removeHousehold, saveHousehold } from '../store';
import { RegistryCard, RoutePlan, SelfReportsCard, TEAM_COLORS } from './BoardExtras';
import { Ics214Button } from './Ics214';
import { Chip, INCIDENT_LABEL, PRIORITY_TEXT, SourceChip, useAttempts, useHouseholds, useLiveConfig, useNow, useOnline, useRegistry, useSelfReports } from './common';
import { membership } from '../store';
import { useEffect } from 'preact/hooks';
import { DEFAULT_ROUTE } from '../core/route';
import { NEIGHBOURHOOD as HOOD } from '../core/seed';

const BUILDINGS = demoBuildings();
// One label per street, placed at the middle point of its longest segment.
const STREET_LABELS = (() => {
  const best = new Map<string, { name: string; x: number; y: number; n: number }>();
  for (const st of HOOD.streets) {
    const m = st.pts[Math.floor(st.pts.length / 2)];
    if (!m || m[0] < 10 || m[0] > 690 || m[1] < 10 || m[1] > 450) continue;
    if ((best.get(st.name)?.n ?? 0) < st.pts.length) best.set(st.name, { name: st.name, x: m[0], y: m[1], n: st.pts.length });
  }
  return [...best.values()];
})();
const byId = new Map(BUILDINGS.map((b) => [b.id, b]));
const RANK = { P1: 1, P2: 2, P3: 3 } as const;

export function Board() {
  const [cfg, refreshCfg] = useLiveConfig();
  const now = useNow();
  const online = useOnline();
  const list = useHouseholds();
  const [selected, setSelected] = useState<string | null>(null);
  const [teams, setTeams] = useState(2);
  const [showPayload, setShowPayload] = useState(false);
  const [sheet, setSheet] = useState<RunSheet | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [lines, setLines] = useState<Record<string, { text: string; source?: string }>>({});
  const [lang, setLang] = useState('');
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const attempts = useAttempts();
  const reports = useSelfReports();
  const registry = useRegistry();
  const [isCoord, setIsCoord] = useState(false);
  useEffect(() => { membership().then((r) => setIsCoord(r === 'coordinator')); }, []);

  const rows = useMemo(() => list
    .map((h) => ({ h, a: assess(h, cfg.incidentType, cfg.rulebook, h.reportedAt, now) }))
    .sort((x, y) => (Number(y.a.overdue) - Number(x.a.overdue)) || RANK[x.a.priority] - RANK[y.a.priority] ||
      (x.a.deadline ?? Infinity) - (y.a.deadline ?? Infinity)), [list, now, cfg]);

  const visited = new Set(list.map((h) => h.buildingId).filter(Boolean));
  const unvisited = BUILDINGS.filter((b) => !visited.has(b.id));
  const attemptedIds = new Set(attempts.map((a) => a.buildingId));
  const knownIds = new Set(registry.map((r) => r.buildingId));
  const selfBy = new Map(reports.map((r) => [r.buildingId, r]));
  const knownUnchecked = unvisited.filter((b) => knownIds.has(b.id) && !selfBy.has(b.id)).length;
  const p1 = rows.filter((r) => r.a.priority === 'P1').length;
  const overdue = rows.filter((r) => r.a.overdue).length;
  const recheckDue = rows.filter((r) => r.a.nextCheckBy <= now).length;
  const dups = findDuplicates(list);
  const onDevice = list.filter((h) => h.source === 'on_device').length;
  const tapped = list.filter((h) => h.source === 'tap').length;
  const cloudPayload = list.map((h) => toCloudHousehold(h, h.buildingId ? byId.get(h.buildingId) : undefined, cfg.incidentType, cfg.rulebook, now));
  const plan = useMemo(() => (list.length ? cloudRequest(cloudPayload, teams, cfg.incidentType).plan : []), [list, teams, cfg, Math.floor(now / 60000)]);
  const stopLabel = (c: { building: string | null; ref: string }) => (c.building ? byId.get(c.building)?.label ?? c.ref : c.ref);
  const bLabel = (id: string | null) => (id ? byId.get(id)?.label ?? id : 'Unmapped');
  const status = (b: string): { cls: string; a?: Assessment } => {
    const r = rows.find((x) => x.h.buildingId === b);
    if (!r) {
      const self = selfBy.get(b);
      if (self) return { cls: self.status === 'need' ? 'selfneed' : 'selfok' };
      return { cls: `${attemptedIds.has(b) ? 'attempted' : 'unvisited'} ${knownIds.has(b) ? 'known' : ''}` };
    }
    return { cls: r.a.overdue ? 'overdue' : r.a.priority, a: r.a };
  };

  async function runSheet() {
    setErr(''); setBusy('Asking the cloud…');
    try { setSheet(await generateRunSheet(cloudPayload, teams, cfg)); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  }

  async function explain(h: Household) {
    const ch = toCloudHousehold(h, h.buildingId ? byId.get(h.buildingId) : undefined, cfg.incidentType, cfg.rulebook, now);
    setLines((l) => ({ ...l, [h.id]: { text: '…' } }));
    try { const r = await oneLiner(JSON.stringify(ch)); setLines((l) => ({ ...l, [h.id]: r })); }
    catch (e) { setLines((l) => ({ ...l, [h.id]: { text: (e as Error).message } })); }
  }

  async function translateAll(target: string) {
    setLang(target); if (!target) { setTranslated({}); return; }
    const labels = [...new Set(rows.flatMap((r) => r.a.hazards.flatMap((z) => [z.label, ...(z.ask ? [z.ask] : [])])))];
    try { const out = await translateLabels(labels, target, cfg); setTranslated(Object.fromEntries(labels.map((l, i) => [l, out[i]]))); }
    catch (e) { setErr((e as Error).message); }
  }
  const tr = (s: string) => translated[s] ?? s;

  return (
    <div class="board">
      <header class="topbar">
        <div><b>Muster</b> coordinator · {INCIDENT_LABEL[cfg.incidentType]} · rulebook {cfg.rulebook.version} · {online ? 'online' : 'offline'}</div>
        <ConfigSwitches cfg={cfg} onRefresh={refreshCfg} />
      </header>

      {list.some((h) => h.reportedBy.startsWith('vol-')) && (
        <p class="demo-note">Demo residents are synthetic (made up for rehearsal). The map, streets and addresses are real: {HOOD.name}, from OpenStreetMap. Real records replace these as volunteers report.</p>)}
      <div class="kpis">
        <Kpi n={list.length} label="households found" />
        <Kpi n={p1} label="urgent" kind="P1" />
        <Kpi n={overdue} label="past time-to-harm" kind="overdue" />
        <Kpi n={unvisited.length - selfBy.size} label={knownUnchecked ? `homes nobody has checked · ${knownUnchecked} known-risk` : 'homes nobody has checked'} kind="unvisited" />
        <Kpi n={recheckDue} label="rechecks due now" />
        <Kpi n={0} label="cloud calls from doorsteps" kind="device" />
      </div>
      <p class="small muted">Captured on device: {onDevice} · tapped: {tapped} · no answer, hanger left: {attempts.length} · residents checked in: {reports.length}. Doorstep notes and photos stayed on volunteers' phones.</p>

      <div class="grid2">
        <div class="card">
          <h3>{HOOD.name} <span class="muted small">real streets & buildings · grey glow = unchecked · red ring = known risk · amber = no answer · dotted = team routes</span></h3>
          <svg viewBox="0 0 700 460" class="map" role="img" aria-label={`Map of ${HOOD.name}`}>
            {HOOD.river.map((r, i) => <polyline key={`r${i}`} class="river" points={r.map((p) => p.join(',')).join(' ')} />)}
            {HOOD.streets.map((st, i) => <polyline key={`s${i}`} class="street" points={st.pts.map((p) => p.join(',')).join(' ')} />)}
            {STREET_LABELS.map((l) => <text key={l.name} x={l.x} y={l.y} class="streetname">{l.name}</text>)}
            {BUILDINGS.map((b) => b.poly && <polygon key={`f${b.id}`} class="footprint" points={b.poly.map((p) => p.join(',')).join(' ')} />)}
            {plan.map((t, i) => (
              <polyline key={t.team} class="route-line" stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                points={[DEFAULT_ROUTE.depot, ...t.stops.map((st) => (st.building ? byId.get(st.building) : undefined)).filter(Boolean) as { x: number; y: number }[]].map((p) => `${p.x},${p.y}`).join(' ')} />))}
            <g class="depot-g"><rect x={DEFAULT_ROUTE.depot.x - 7} y={DEFAULT_ROUTE.depot.y - 7} width="14" height="14" rx="3" class="depot" />
              <text x={DEFAULT_ROUTE.depot.x + 11} y={DEFAULT_ROUTE.depot.y + 4} class="depot-t">{HOOD.staging?.name ?? 'Staging point'}</text></g>
            {BUILDINGS.map((b) => {
              const s = status(b.id);
              return (
                <g key={b.id} class={`bld ${s.cls} ${selected === b.id ? 'sel' : ''}`} onClick={() => setSelected(b.id)}>
                  <circle cx={b.x} cy={b.y} r="7" class="dot" />
                  {s.a?.deadline != null && <text x={b.x} y={b.y - 11} class="clock">{formatLeft(s.a.deadline - now).replace('overdue ', '-')}</text>}
                  <title>{b.label}</title>
                </g>);
            })}
            <text x="694" y="454" class="attrib" text-anchor="end">{HOOD.name} · map {HOOD.attribution}</text>
          </svg>
        </div>

        <div class="card scroll">
          <h3>Households by time to harm</h3>
          {rows.length === 0 && <p class="muted">No reports yet. Volunteers' records appear here as soon as any phone reaches signal.</p>}
          {rows.map(({ h, a }) => (
            <div class={`hh ${a.overdue ? 'overdue' : a.priority} ${selected === h.buildingId ? 'sel' : ''}`} key={h.id} onClick={() => setSelected(h.buildingId)}>
              <div class="hh-top">
                <Chip kind={a.overdue ? 'overdue' : a.priority}>{a.overdue ? 'Overdue' : PRIORITY_TEXT[a.priority]}</Chip>
                <b>{h.buildingId ? byId.get(h.buildingId)?.label : 'Unmapped'}</b>
                {h.descriptor && <span class="muted">· {h.descriptor}</span>}
                <SourceChip source={h.source} />
              </div>
              {a.deadline !== null && <div class="clockline">Time to harm: <b>{formatLeft(a.deadline - now)}</b></div>}
              {a.hazards.map((z) => <div key={z.code}>• {tr(z.label)}{z.ask && <span class="ask"> · Ask: {tr(z.ask)}</span>}</div>)}
              <div class="small muted">
                Seen {formatLeft(now - h.reportedAt)} ago · {h.visits} visit(s) · recheck {a.nextCheckBy <= now ? <b>now</b> : `in ${formatLeft(a.nextCheckBy - now)}`}
              </div>
              <div class="small">
                <button class="link" onClick={(e) => { e.stopPropagation(); explain(h); }}>Summarise</button>
                {lines[h.id] && <span> {lines[h.id].text} <SourceChip source={lines[h.id].source} /></span>}
              </div>
            </div>))}
        </div>
      </div>

      {dups.length > 0 && (
        <div class="card warn">
          <h3>Possible duplicates ({dups.length})</h3>
          {dups.map((d) => (
            <div class="row" key={d.keep.id + d.drop.id}>
              <span>{byId.get(d.keep.buildingId ?? '')?.label}: {d.reasons.join(', ')}</span>
              <button class="btn small" onClick={async () => { await saveHousehold(mergeHouseholds(d.keep, d.drop)); await removeHousehold(d.drop.id); }}>Merge</button>
            </div>))}
          <p class="small muted">Found by code (same building, different volunteers, no conflicting facts). You confirm every merge.</p>
        </div>)}

      <div class="grid2">
        <SelfReportsCard reports={reports} attempts={attempts} label={(id) => bLabel(id)} now={now} />
        <RegistryCard buildings={BUILDINGS} registry={registry} canWrite={isCoord || !firebase()} />
      </div>

      <div class="card">
        <h3>Run sheets for the next shift <Chip kind="cloud">Cloud</Chip></h3>
        <p class="small muted">Only the cloud sees every volunteer's records at once. Stop order is decided by code; the cloud writes the briefings, the bring-lists and the handover.</p>
        <div class="actions">
          <label>Teams <input type="number" min={1} max={8} value={teams} onInput={(e) => setTeams(Number((e.target as HTMLInputElement).value) || 1)} /></label>
          <button class="btn ghost" onClick={() => setShowPayload(!showPayload)}>{showPayload ? 'Hide' : 'Show'} exactly what is sent</button>
          <button class="btn primary" disabled={!!busy || !list.length} onClick={runSheet}>{busy || 'Generate run sheets'}</button>
          <Ics214Button list={list} attempts={attempts} reports={reports} label={bLabel} cfg={cfg} now={now} teams={teams} />
          <select value={lang} onChange={(e) => translateAll((e.target as HTMLSelectElement).value)}>
            <option value="">Labels: English</option><option>Spanish</option><option>French</option><option>Haitian Creole</option><option>Yoruba</option><option>Hausa</option><option>Igbo</option><option>Arabic</option>
          </select>
        </div>
        <RoutePlan plan={plan} label={stopLabel} />
        {!cfg.cloudEnabled && <p class="error">Cloud is switched off by the coordinator (Remote Config). Everything else keeps working.</p>}
        {showPayload && <pre class="payload">{JSON.stringify(cloudRequest(cloudPayload, teams, cfg.incidentType).request, null, 2)}</pre>}
        {err && <p class="error">{err}</p>}
        {sheet && (
          <div class="sheets">
            <div class="small">Answered: <SourceChip source={sheet.source} /> {sheet.droppedRefs.length > 0 && <span class="error">Removed {sheet.droppedRefs.length} stop(s) the cloud invented.</span>}</div>
            {sheet.teams.map((t) => (
              <div class="sheet" key={t.team}>
                <h4>{t.team}</h4>
                <p>{t.briefing}</p>
                {t.bring.length > 0 && <p><b>Bring:</b> {t.bring.join(', ')}</p>}
                <ol>{t.stops.map((s) => {
                  const h = list.find((x) => x.id.startsWith(s.ref));
                  return <li key={s.ref}><b>{h?.buildingId ? byId.get(h.buildingId)?.label : s.ref}</b>{h?.descriptor ? ` (${h.descriptor})` : ''}: {s.why}</li>;
                })}</ol>
              </div>))}
            <div class="sheet"><h4>Shift handover</h4><p>{sheet.handover}</p></div>
            <button class="btn ghost" onClick={() => print()}>Print run sheets</button>
          </div>)}
      </div>

      <div class="card">
        <h3>Homes nobody has checked ({unvisited.length})</h3>
        <p class="small muted">In the 2021 Pacific Northwest heat dome, 7 in 10 people who died in Multnomah County lived alone. No report is not good news.</p>
        <div class="doors">{unvisited.map((b) => <span class="door" key={b.id}>{b.label}</span>)}</div>
      </div>
    </div>
  );
}

function Kpi({ n, label, kind = '' }: { n: number; label: string; kind?: string }) {
  return <div class={`kpi ${kind}`}><div class="n">{n}</div><div class="l">{label}</div></div>;
}

function ConfigSwitches({ cfg, onRefresh }: { cfg: ReturnType<typeof useLiveConfig>[0]; onRefresh: () => void }) {
  if (firebase()) {
    return <div class="small">Remote Config: {cfg.incidentType} · cloud {cfg.cloudEnabled ? 'on' : 'off'} <button class="link" onClick={onRefresh}>refresh</button></div>;
  }
  return (
    <div class="small cfg">
      Demo switches (Remote Config stand-in):
      <select value={cfg.incidentType} onChange={(e) => setLocalConfig({ incidentType: (e.target as HTMLSelectElement).value as never })}>
        {Object.entries(INCIDENT_LABEL).map(([k, v]) => <option value={k} key={k}>{v}</option>)}
      </select>
      <label><input type="checkbox" checked={cfg.cloudEnabled} onChange={(e) => setLocalConfig({ cloudEnabled: (e.target as HTMLInputElement).checked })} /> cloud</label>
    </div>
  );
}
