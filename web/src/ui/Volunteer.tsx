import { useEffect, useMemo, useState } from 'preact/hooks';
import { deviceModelState, extractOnDevice, prepareDeviceModel, type DeviceModelState } from '../ai';
import { assess, formatLeft } from '../core/rules';
import { demoBuildings } from '../core/seed';
import { EMPTY_EXTRACTION, type Extraction, type Household } from '../core/types';
import { listen, localSpeechState, installLocalSpeech, type SpeechState } from '../speech';
import { INCIDENT_ID, keepPrivateNote, saveHousehold, volunteerId } from '../store';
import { Chip, INCIDENT_LABEL, PRIORITY_TEXT, SourceChip, useHouseholds, useLiveConfig, useNow, useOnline } from './common';
import { askKeys, IntakeForm } from './IntakeForm';
import { Handoff } from './Handoff';

const BUILDINGS = demoBuildings();

type Step = 'pick' | 'capture' | 'confirm' | 'saved';

export function Volunteer() {
  const [cfg] = useLiveConfig();
  const online = useOnline();
  const now = useNow();
  const all = useHouseholds();
  const [model, setModel] = useState<DeviceModelState>('unavailable');
  const [progress, setProgress] = useState<number | null>(null);
  const [speech, setSpeech] = useState<SpeechState>('unsupported');
  const [me, setMe] = useState('');
  const [step, setStep] = useState<Step>('pick');
  const [building, setBuilding] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; mimeType: 'image/jpeg' | 'image/png'; url: string } | null>(null);
  const [draft, setDraft] = useState<Extraction>(EMPTY_EXTRACTION);
  const [source, setSource] = useState<'on_device' | 'tap'>('tap');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [stopMic, setStopMic] = useState<null | (() => void)>(null);
  const [lastSaved, setLastSaved] = useState<Household | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => { deviceModelState().then(setModel); localSpeechState().then(setSpeech); volunteerId().then(setMe); }, []);

  const aiReady = model === 'available';
  const mine = all.filter((h) => h.reportedBy === me);
  const recheck = useMemo(() => all
    .map((h) => ({ h, a: assess(h, cfg.incidentType, cfg.rulebook, h.reportedAt, now) }))
    .filter(({ a }) => a.nextCheckBy <= now + 30 * 60_000)
    .sort((x, y) => x.a.nextCheckBy - y.a.nextCheckBy), [all, now, cfg]);

  const preview = assess(draft, cfg.incidentType, cfg.rulebook, now, now);
  const asks = askKeys(draft);

  async function enableModel() {
    setError('');
    try { setProgress(0); await prepareDeviceModel((p) => setProgress(p)); setModel(await deviceModelState()); }
    catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setProgress(null); }
  }

  async function readOnDevice() {
    setError(''); setBusy('Reading on this device…');
    try {
      const r = await extractOnDevice(note, photo ?? undefined);
      setDraft({ ...r.data, descriptor: r.data.descriptor || draft.descriptor });
      setSource('on_device'); setStep('confirm');
    } catch (e) {
      // Fail closed: no cloud fallback for doorstep data. Open the tap form instead.
      setError(`On-device model unavailable (${(e as Error).message}). Nothing was sent anywhere - fill the form by tapping.`);
      setSource('tap'); setStep('confirm');
    } finally { setBusy(''); }
  }

  function toggleMic() {
    if (stopMic) { stopMic(); setStopMic(null); return; }
    const base = note ? note + ' ' : '';
    try { setStopMic(() => listen((t) => setNote(base + t))); } catch (e) { setError((e as Error).message); }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    // Re-encode to JPEG (on-device model accepts JPEG/PNG inline data) and shrink to keep within token limits.
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = bmp.width * scale; c.height = bmp.height * scale;
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    setPhoto({ base64: url.split(',')[1], mimeType: 'image/jpeg', url });
  }

  async function save() {
    const existing = all.find((h) => h.buildingId === building && h.reportedBy === me);
    const h: Household = {
      ...draft,
      id: existing?.id ?? crypto.randomUUID(),
      incidentId: INCIDENT_ID,
      buildingId: building,
      reportedAt: Date.now(),
      reportedBy: me,
      source,
      rulebookVersion: cfg.rulebook.version,
      visits: (existing?.visits ?? 0) + 1,
    };
    if (note) keepPrivateNote(h.id, note); // stays in this browser only
    const { synced: s } = saveHousehold(h);
    setSynced(false); s.then(setSynced);
    setLastSaved(h); setStep('saved');
  }

  function reset(next: Step = 'pick') {
    stopMic?.(); setStopMic(null);
    setNote(''); setPhoto(null); setDraft(EMPTY_EXTRACTION); setError(''); setBuilding(null); setSource('tap'); setStep(next);
  }

  function revisit(h: Household) {
    reset('confirm');
    const { id: _i, incidentId: _n, buildingId, reportedAt: _r, reportedBy: _b, source: _s, rulebookVersion: _v, visits: _c, ...ex } = h;
    setBuilding(buildingId); setDraft(ex as Extraction);
  }

  const buildingLabel = (id: string | null) => BUILDINGS.find((b) => b.id === id)?.label ?? 'Unmapped location';

  return (
    <div class="vol">
      <header class={`banner ${aiReady ? 'ok' : 'tap'}`}>
        <div>
          <strong>{INCIDENT_LABEL[cfg.incidentType] ?? cfg.incidentType}</strong> · {online ? 'Signal' : 'No signal'}
          {' · '}{mine.length} captured by you
        </div>
        <div class="small">
          {aiReady && 'On-device AI ready. Doorstep notes are read on this device and never uploaded.'}
          {model === 'downloadable' && 'On-device AI can be installed on this device.'}
          {model === 'downloading' && 'On-device AI is downloading…'}
          {(model === 'unavailable' || model === 'no-api') && 'No AI on this device. Tap mode. Nothing leaves this device until it syncs.'}
          {model === 'no-firebase' && 'Demo mode (Firebase not configured). Tap mode only.'}
        </div>
        {(model === 'downloadable' || model === 'downloading') && (
          <button class="btn small" onClick={enableModel} disabled={progress !== null}>
            {progress !== null ? `Downloading ${Math.round(progress * 100)}%` : 'Install on-device AI'}
          </button>)}
      </header>

      {error && <p class="error">{error}</p>}

      {step === 'pick' && (
        <section>
          {recheck.length > 0 && (
            <div class="card warn">
              <h3>Recheck due ({recheck.length})</h3>
              {recheck.slice(0, 5).map(({ h, a }) => (
                <button class="row" onClick={() => revisit(h)} key={h.id}>
                  <Chip kind={a.priority}>{PRIORITY_TEXT[a.priority]}</Chip>
                  <span>{buildingLabel(h.buildingId)}</span>
                  <span class="muted">{a.nextCheckBy < now ? `overdue ${formatLeft(now - a.nextCheckBy)}` : `in ${formatLeft(a.nextCheckBy - now)}`}</span>
                </button>))}
            </div>)}
          <h2>Which door?</h2>
          <div class="doors">
            {BUILDINGS.map((b) => {
              const visited = all.some((h) => h.buildingId === b.id);
              return <button class={`door ${visited ? 'visited' : ''}`} key={b.id} onClick={() => { setBuilding(b.id); setStep(aiReady ? 'capture' : 'confirm'); }}>{b.label}</button>;
            })}
          </div>
          <div class="actions">
            <button class="btn ghost" onClick={() => { setBuilding(null); setStep(aiReady ? 'capture' : 'confirm'); }}>Not on the list</button>
            <button class="btn ghost" onClick={() => setShowHandoff(true)}>QR handoff (no signal)</button>
          </div>
        </section>)}

      {step === 'capture' && (
        <section>
          <h2>{buildingLabel(building)}</h2>
          <p class="muted">Say or type what you see. Names are not needed.</p>
          <textarea rows={5} value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
            placeholder="e.g. Grandma on oxygen, concentrator dead, spare battery maybe three hours. Baby 8 months, formula for half a day. No clean water." />
          <div class="actions">
            {speech === 'local' && <button class={`btn ${stopMic ? 'rec' : 'ghost'}`} onClick={toggleMic}>{stopMic ? 'Stop' : 'Speak'}</button>}
            {speech === 'downloadable' && <button class="btn ghost" onClick={async () => setSpeech((await installLocalSpeech()) ? 'local' : 'unsupported')}>Enable offline voice</button>}
            <label class="btn ghost">Photo of label
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto((e.target as HTMLInputElement).files?.[0])} />
            </label>
          </div>
          {photo && <img class="thumb" src={photo.url} alt="Label photo (stays on this device)" />}
          <div class="actions">
            <button class="btn primary" disabled={!!busy || (!note && !photo)} onClick={readOnDevice}>{busy || 'Read on this device'}</button>
            <button class="btn ghost" onClick={() => { setSource('tap'); setStep('confirm'); }}>Tap instead</button>
            <button class="btn ghost" onClick={() => reset()}>Back</button>
          </div>
          <p class="small muted">Voice is offered only when this browser can recognise speech on the device. The note and photo never leave this device.</p>
        </section>)}

      {step === 'confirm' && (
        <section>
          <h2>{buildingLabel(building)} <SourceChip source={source} /></h2>
          <div class={`card assess ${preview.priority}`}>
            <div class="big">
              <Chip kind={preview.priority}>{PRIORITY_TEXT[preview.priority]}</Chip>
              {preview.deadline !== null && <span> Time to harm: <b>{formatLeft(preview.deadline - now)}</b></span>}
            </div>
            {preview.hazards.map((z) => <div key={z.code}>• {z.label}</div>)}
            {preview.hazards.length === 0 && <div class="muted">No time-critical need found yet. That does not mean safe.</div>}
            {asks.size > 0 && <div class="ask">Ask before you leave: highlighted fields.</div>}
          </div>
          {source === 'on_device' && <p class="small muted">Filled on this device. Check every field: you are the source of truth.</p>}
          <IntakeForm value={draft} onChange={setDraft} incident={cfg.incidentType} highlight={asks} />
          <div class="actions sticky">
            <button class="btn primary" onClick={save}>Save household</button>
            <button class="btn ghost" onClick={() => reset()}>Cancel</button>
          </div>
        </section>)}

      {step === 'saved' && lastSaved && (
        <section class="center">
          <h2>Saved</h2>
          <p>{synced ? 'Synced to the coordinator.' : `Saved on this device. ${online ? 'Syncing…' : 'It will sync as soon as any signal appears.'}`}</p>
          <p class="muted small">Next check: {formatLeft(assess(lastSaved, cfg.incidentType, cfg.rulebook, lastSaved.reportedAt, now).nextCheckBy - now)} from now.</p>
          <button class="btn primary" onClick={() => reset()}>Next door</button>
        </section>)}

      {showHandoff && <Handoff mine={mine} onClose={() => setShowHandoff(false)} />}
    </div>
  );
}
