// Full-screen card the volunteer hands to the resident. Questions in the resident's language, big tap answers,
// English underneath for the volunteer. Phrases ship with the app, so it works with no signal.
import { useState } from 'preact/hooks';
import { FLOW, LANG_REVIEW, LANGS, langByCode, nextQuestion, type Answer, type Answers, type Lang } from '../core/language';
import { Icon } from '../site/icons';

const EN = LANGS[0];
const PREF = 'muster.lang';

export function LanguageCard({ onDone, onClose }: { onDone: (a: Answers) => void; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [stage, setStage] = useState<'pick' | 'consent' | 'q' | 'thanks'>('pick');
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<Answers[]>([]);
  const last = (() => { try { return localStorage.getItem(PREF); } catch { return null; } })();
  const L: Lang = langByCode(code ?? 'en');
  const q = nextQuestion(answers);
  const asked = FLOW.filter((f) => !f.when || f.when(answers)).length;
  const done = Object.keys(answers).length;

  function pick(c: string) { setCode(c); setStage('consent'); try { localStorage.setItem(PREF, c); } catch { /* ignore */ } }
  function answer(v: Answer) {
    if (!q) return;
    const next = { ...answers, [q.id]: v };
    setHistory([...history, answers]); setAnswers(next);
    if (!nextQuestion(next)) setStage('thanks');
  }
  function back() {
    if (stage === 'thanks' || (stage === 'q' && history.length)) { setAnswers(history[history.length - 1] ?? {}); setHistory(history.slice(0, -1)); setStage('q'); return; }
    if (stage === 'q') { setStage('consent'); return; }
    setStage('pick');
  }

  const opts: { label: string; sub?: string; v: Answer; tone?: string }[] = !q ? [] :
    q.kind === 'count' ? [1, 2, 3, 4, 5, 6].map((n) => ({ label: n === 6 ? '6+' : String(n), v: n })) :
    q.kind === 'days' ? [0, 1, 2, 3].map((n) => ({ label: n === 3 ? '3+' : String(n), sub: L.card.days, v: n })) :
    q.kind === 'when' ? (['today', 'yesterday', 'twoDays', 'threeDays'] as const).map((k, i) => ({ label: L.card[k], sub: L.code === 'en' ? undefined : EN.card[k], v: i })) :
    [{ label: L.card.yes, sub: L.code === 'en' ? undefined : 'Yes', v: 'yes', tone: 'yes' }, { label: L.card.no, sub: L.code === 'en' ? undefined : 'No', v: 'no', tone: 'no' }, { label: L.card.unsure, sub: L.code === 'en' ? undefined : 'Not sure', v: 'unsure' }];

  return (
    <div class="modal langcard-wrap" role="dialog" aria-label="Resident language card">
      <div class="langcard" dir={stage === 'pick' ? 'ltr' : (L.dir as 'ltr' | 'rtl')}>
        <div class="langcard-top" dir="ltr">
          {stage !== 'pick' ? <button class="btn small ghost" onClick={back}>← Back</button> : <span class="small muted">Hand the phone to the resident</span>}
          {stage === 'q' && <span class="small muted">{done + 1} / {asked}</span>}
          <button class="btn small ghost" onClick={onClose} aria-label="Close language card"><Icon name="close" size={16} /></button>
        </div>

        {stage === 'pick' && (
          <div class="langcard-body">
            <span class="lc-globe"><Icon name="globe" size={34} /></span>
            <h2>Choose your language</h2>
            <div class="lc-langs">
              {LANGS.map((l) => (
                <button key={l.code} class={`lc-lang ${l.code === last ? 'last' : ''}`} onClick={() => pick(l.code)} dir={l.dir as 'ltr' | 'rtl'}>
                  <b>{l.name}</b>{l.english !== l.name && <span>{l.english}</span>}
                </button>))}
            </div>
            <p class="small muted lc-note" dir="ltr">Works with no signal: every phrase is stored on this device. {LANG_REVIEW}</p>
          </div>)}

        {stage === 'consent' && (
          <div class="langcard-body">
            <span class="lc-globe"><Icon name="users" size={34} /></span>
            <h2>{L.card.hello}</h2>
            <p class="lc-big">{L.card.consent}</p>
            {L.code !== 'en' && <p class="small muted" dir="ltr">{EN.card.consent}</p>}
            <div class="lc-answers two">
              <button class="lc-ans yes" onClick={() => setStage('q')}><b>{L.card.agree}</b></button>
              <button class="lc-ans" onClick={onClose}><b>{L.card.decline}</b></button>
            </div>
          </div>)}

        {stage === 'q' && q && (
          <div class="langcard-body">
            <div class="lc-progress" dir="ltr"><i style={{ width: `${(done / asked) * 100}%` }} /></div>
            <h2 class="lc-q">{L.card.q[q.id]}</h2>
            {L.code !== 'en' && <p class="small muted" dir="ltr">{EN.card.q[q.id]}</p>}
            <p class="small muted">{L.card.point}</p>
            <div class={`lc-answers ${opts.length > 4 ? 'grid3' : opts.length === 4 ? 'two' : ''}`}>
              {opts.map((o) => (
                <button key={String(o.v)} class={`lc-ans ${o.tone ?? ''}`} onClick={() => answer(o.v)}>
                  <b>{o.label}</b>{o.sub && <span>{o.sub}</span>}
                </button>))}
            </div>
          </div>)}

        {stage === 'thanks' && (
          <div class="langcard-body">
            <span class="done-tick"><Icon name="check" size={36} stroke={2.4} /></span>
            <h2>{L.card.thanks}</h2>
            {L.code !== 'en' && <p class="small muted" dir="ltr">{EN.card.thanks}</p>}
            <div class="lc-answers" dir="ltr">
              <button class="lc-ans yes" onClick={() => onDone(answers)}><b>Volunteer: check the answers</b><span>Fills the form. You confirm every field before saving.</span></button>
            </div>
          </div>)}
      </div>
    </div>
  );
}
