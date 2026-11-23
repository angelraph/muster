// App home: the same first screen as the Android app, so laptop and phone volunteers see one product.
import { useEffect, useState } from 'preact/hooks';
import { deviceModelState, type DeviceModelState } from '../ai';
import { assess } from '../core/rules';
import { NEIGHBOURHOOD } from '../core/seed';
import { volunteerId } from '../store';
import { Icon } from '../site/icons';
import { INCIDENT_LABEL, useAttempts, useHouseholds, useLiveConfig, useNow, useSelfReports } from './common';

export function AppHome() {
  const [cfg] = useLiveConfig();
  const now = useNow(5000);
  const list = useHouseholds();
  const attempts = useAttempts();
  const reports = useSelfReports();
  const [me, setMe] = useState('');
  const [model, setModel] = useState<DeviceModelState>('unavailable');
  useEffect(() => { volunteerId().then(setMe); deviceModelState().then(setModel); }, []);

  const rows = list.map((h) => assess(h, cfg.incidentType, cfg.rulebook, h.reportedAt, now));
  const visited = new Set(list.map((h) => h.buildingId).filter(Boolean));
  const ai = model === 'available';
  const stats: [string | number, string, string][] = [
    [rows.filter((a) => a.priority === 'P1' || a.overdue).length, 'urgent', 'c-p1'],
    [rows.filter((a) => a.overdue).length, 'overdue', 'c-over'],
    [NEIGHBOURHOOD.buildings.length - visited.size - reports.length, 'unchecked', ''],
    [list.filter((h) => h.reportedBy === me).length, 'by you', 'c-device'],
    [attempts.length, 'no answer', 'c-amber'],
    [list.length, 'households', ''],
  ];

  return (
    <div class="vol apphome">
      <span class="ah-eyebrow">{(INCIDENT_LABEL[cfg.incidentType] ?? cfg.incidentType).toUpperCase()} RESPONSE · {NEIGHBOURHOOD.name.toUpperCase()}</span>
      <h1 class="ah-title">Find them before their clock runs out.</h1>
      <p class="muted ah-sub">Check every door. Muster works out who has the least time, even with no signal.</p>
      <div class="ah-stats">
        {stats.map(([n, l, c]) => <div class="ah-stat" key={l}><b class={c}>{n}</b><span>{l}</span></div>)}
      </div>
      <a class="btn primary block ah-go" href="#/volunteer"><Icon name="door" size={20} /> Go to the next door</a>
      <div class="ah-row">
        <a class="btn ghost" href="#/board"><Icon name="map" size={18} /> Coordinator board</a>
        <a class="btn ghost" href="#/volunteer?handoff"><Icon name="qr" size={18} /> QR handoff</a>
      </div>
      <div class="card ah-ai">
        <h3><Icon name="shield" size={18} /> {ai ? 'On-device AI ready' : 'Tap mode on this device'}</h3>
        <p class="muted small">{ai
          ? 'Speak or type at the door. Gemini Nano fills the record on this device. Nothing is uploaded.'
          : 'This browser has no on-device AI, so you tap the answers. Same rules, same sync, nothing leaves the device until it syncs.'}</p>
      </div>
      <p class="small muted">Map data {NEIGHBOURHOOD.attribution}. Needs intake and logistics only. Not medical advice.</p>
    </div>
  );
}
