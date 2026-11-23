// Accuracy test: 30 synthetic doorstep notes with hand-labelled answers, run on this device and in the cloud.
import { useEffect, useState } from 'preact/hooks';
import data from '../../../shared/eval/doorstep-notes.json';
import { deviceModelState, evalExtract, prepareDeviceModel } from '../ai';
import { scoreNote, summarise, type NoteScore, type Summary } from '../core/eval';
import type { Extraction } from '../core/types';
import { useLiveConfig } from './common';
import { Icon } from '../site/icons';

type Where = 'device' | 'cloud';
interface Run { where: Where; at: number; scores: NoteScore[]; ms: number[]; errors: number; summary: Summary }
const KEY = 'muster.eval.v1';
const NOTES = data.notes as { id: string; note: string; truth: Partial<Extraction> }[];

const load = (): Partial<Record<Where, Run>> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function EvalPage() {
  const [cfg] = useLiveConfig();
  const [runs, setRuns] = useState(load);
  const [busy, setBusy] = useState<Where | null>(null);
  const [progress, setProgress] = useState(0);
  const [dev, setDev] = useState('checking');
  const [err, setErr] = useState('');
  useEffect(() => { deviceModelState().then(setDev); document.title = 'Accuracy test · Muster'; }, []);

  async function run(where: Where) {
    setErr(''); setBusy(where); setProgress(0);
    const scores: NoteScore[] = [], ms: number[] = []; let errors = 0;
    try {
      if (where === 'device' && dev !== 'available') await prepareDeviceModel(() => {});
      for (let i = 0; i < NOTES.length; i++) {
        const n = NOTES[i];
        try {
          const r = await evalExtract(n.note, where, cfg.cloudModel);
          scores.push(scoreNote(n.id, r.data, n.truth, cfg.incidentType, cfg.rulebook)); ms.push(r.ms);
        } catch (e) {
          errors++;
          if (i === 0) throw e;
        }
        setProgress(i + 1);
      }
      const r: Run = { where, at: Date.now(), scores, ms, errors, summary: summarise(scores, ms) };
      const next = { ...runs, [where]: r }; setRuns(next); localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) { setErr(`${where === 'device' ? 'On-device' : 'Cloud'} run stopped: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ notes: NOTES.length, runs }, null, 2)], { type: 'application/json' }));
    a.download = 'muster-accuracy.json'; a.click();
  };

  const cols: [Where, string][] = [['device', 'On this device (Gemini Nano)'], ['cloud', `Cloud (${cfg.cloudModel})`]];
  return (
    <div class="board">
      <header class="topbar"><div><b>Accuracy test</b> · {NOTES.length} synthetic doorstep notes with hand-labelled answers · same prompt and schema on both</div></header>
      <div class="card">
        <p class="small muted">Measures how well each model turns a spoken-style note into the household record. <b>Stated-field accuracy</b> scores only what the note says (the hard part). <b>Priority agreement</b> runs the rulebook on the extraction and on the true answer. An <b>unsafe miss</b> is a truly urgent household that the extraction would not mark urgent. Volunteers confirm every field, so this is the first draft, not the final record.</p>
        <div class="actions">
          <button class="btn primary" disabled={!!busy} onClick={() => run('device')}><Icon name="phone" size={16} /> {busy === 'device' ? `On device… ${progress}/${NOTES.length}` : 'Run on this device'}</button>
          <button class="btn primary" disabled={!!busy} onClick={() => run('cloud')}><Icon name="cloud" size={16} /> {busy === 'cloud' ? `Cloud… ${progress}/${NOTES.length}` : 'Run in the cloud'}</button>
          {(runs.device || runs.cloud) && <button class="btn ghost" onClick={exportJson}>Export results</button>}
          <span class="small muted">On-device model here: {dev}</span>
        </div>
        {err && <p class="error">{err}</p>}
      </div>
      <div class="eval-grid">
        {cols.map(([w, title]) => {
          const r = runs[w];
          return (
            <div class="card" key={w}>
              <h3>{title}</h3>
              {!r ? <p class="muted small">Not run yet.</p> : (
                <>
                  <div class="kpis eval-k">
                    <div class="kpi"><div class="n">{pct(r.summary.statedAcc)}</div><div class="l">stated-field accuracy</div></div>
                    <div class="kpi"><div class="n">{pct(r.summary.priorityAgree)}</div><div class="l">priority agreement</div></div>
                    <div class={`kpi ${r.summary.unsafeMisses ? 'overdue' : ''}`}><div class="n">{r.summary.unsafeMisses}</div><div class="l">unsafe misses</div></div>
                    <div class="kpi"><div class="n">{r.summary.avgMs}<small> ms</small></div><div class="l">avg time per note</div></div>
                  </div>
                  <p class="small muted">All-field accuracy {pct(r.summary.fieldAcc)} · {r.summary.n} scored · {r.errors} errors · {new Date(r.at).toLocaleString()}</p>
                  <details><summary class="small">Per-note results</summary>
                    <table class="tbl eval-t"><thead><tr><th>Note</th><th>Stated</th><th>Priority</th><th>Wrong fields</th></tr></thead>
                      <tbody>{r.scores.map((s) => <tr key={s.id} class={s.unsafeMiss ? 'late' : ''}><td>{s.id}</td><td>{pct(s.statedAcc)}</td><td>{s.gotPriority}{s.priorityOk ? '' : ` (want ${s.wantPriority})`}</td><td class="small">{s.wrong.join(', ') || '—'}</td></tr>)}</tbody>
                    </table>
                  </details>
                </>)}
            </div>);
        })}
      </div>
    </div>
  );
}
