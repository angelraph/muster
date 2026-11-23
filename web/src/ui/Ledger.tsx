import { useEffect, useState } from 'preact/hooks';
import { clearLedger, formatBytes, stats, subscribeLedger, type LedgerEntry } from '../ledger';
import { Icon } from '../site/icons';

export function useLedger(): LedgerEntry[] {
  const [l, setL] = useState<LedgerEntry[]>([]);
  useEffect(() => subscribeLedger(setL), []);
  return l;
}

const TASK: Record<string, string> = { extract: 'Doorstep intake', summary: 'Household summary', runsheet: 'Run sheets', translate: 'Label translation', ics214: 'ICS-214 log', eval: 'Accuracy test' };
const SRC: Record<string, [string, string]> = { on_device: ['On this device', 'device'], in_cloud: ['Cloud', 'cloud'], refused: ['Refused (fail closed)', 'refused'], error: ['Error', 'refused'] };

/** Pill for the app bar: the one number that matters, plus a door into the full ledger. */
export function LedgerPill() {
  const list = useLedger();
  const [open, setOpen] = useState(false);
  const s = stats(list);
  return (
    <>
      <button class="ledger-pill" onClick={() => setOpen(true)} title="Inference Ledger: every AI call on this device">
        <Icon name="shield" size={14} /> <b>{formatBytes(s.doorstepBytesUp)}</b> <span class="hide-sm">doorstep data uploaded</span>
      </button>
      {open && <LedgerModal list={list} onClose={() => setOpen(false)} />}
    </>
  );
}

function LedgerModal({ list, onClose }: { list: LedgerEntry[]; onClose: () => void }) {
  const s = stats(list);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), stats: s, calls: list }, null, 2)], { type: 'application/json' }));
    a.download = `muster-inference-ledger-${Date.now()}.json`; a.click();
  };
  return (
    <div class="modal" role="dialog" aria-label="Inference Ledger" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal-body ledger">
        <div class="ledger-head">
          <div><h3>Inference Ledger</h3><p class="small muted">Every AI call this device made: where it ran, how long it took, what left the device, and why. Stored only on this device.</p></div>
          <button class="icon-x" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div class="ledger-stats">
          <div class="ls hero"><b>{formatBytes(s.doorstepBytesUp)}</b><span>doorstep data uploaded</span></div>
          <div class="ls"><b class="c-device">{s.onDevice}</b><span>on this device{s.avgDeviceMs ? ` · ${s.avgDeviceMs} ms avg` : ''}</span></div>
          <div class="ls"><b class="c-cloud">{s.cloud}</b><span>in the cloud{s.avgCloudMs ? ` · ${s.avgCloudMs} ms avg` : ''}</span></div>
          <div class="ls"><b>{s.refused}</b><span>refused, fail closed</span></div>
          <div class="ls"><b>{formatBytes(s.cloudBytesUp)}</b><span>structured data to cloud</span></div>
        </div>
        <div class="ledger-list">
          {list.length === 0 && <p class="muted center">No AI calls yet. Capture a household or generate run sheets and they appear here.</p>}
          {list.map((e) => (
            <div class="le" key={e.id}>
              <div class="le-top">
                <span class={`mk-src ${SRC[e.source][1]}`}>{SRC[e.source][0]}</span>
                <b>{TASK[e.task] ?? e.task}</b>
                <code>{e.mode}</code>
                <span class="muted small">{new Date(e.at).toLocaleTimeString()} · {e.ms} ms · {formatBytes(e.bytesUp)} up · {e.online ? 'online' : 'offline'}</span>
              </div>
              <div class="small muted">{e.reason}</div>
            </div>))}
        </div>
        <div class="actions">
          <button class="btn ghost" onClick={download}><Icon name="arrowUpRight" size={16} /> Export JSON</button>
          <button class="btn ghost" onClick={() => confirm('Clear the ledger on this device?') && clearLedger()}>Clear</button>
          <button class="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
