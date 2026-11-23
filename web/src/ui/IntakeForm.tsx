// The tap form. Works on every phone, model or not. Fields and their order follow the incident
// template from Remote Config (a heat wave asks about cooling first, a flood about water and evacuation).
import type { DeviceType, Extraction, IncidentType, Need, Tri } from '../core/types';

type Key = keyof Extraction;
interface Props { value: Extraction; onChange: (e: Extraction) => void; incident: IncidentType; highlight?: Set<Key> }

const TEMPLATES: Record<string, Key[]> = {
  heat_wave: ['over65', 'livesAlone', 'hasCooling', 'deviceType', 'devicePower', 'deviceBatteryHours', 'dialysis', 'dialysisLastSessionHoursAgo', 'insulin', 'insulinRefrigerated', 'insulinSupplyDays', 'waterDaysLeft', 'adults', 'children', 'infantsUnder1', 'infantFormulaDaysLeft', 'mobilityLimited', 'needs'],
  default: ['deviceType', 'devicePower', 'deviceBatteryHours', 'dialysis', 'dialysisLastSessionHoursAgo', 'insulin', 'insulinRefrigerated', 'insulinSupplyDays', 'adults', 'over65', 'children', 'infantsUnder1', 'infantFormulaDaysLeft', 'livesAlone', 'mobilityLimited', 'waterDaysLeft', 'hasCooling', 'needs'],
};

const LABEL: Partial<Record<Key, string>> = {
  adults: 'Adults (18-64)', over65: 'Aged 65+', children: 'Children (1-17)', infantsUnder1: 'Babies under 1',
  livesAlone: 'Lives alone?', deviceType: 'Powered medical device', devicePower: 'Device has power?',
  deviceBatteryHours: 'Battery / backup left (hours)', dialysis: 'On dialysis?', dialysisLastSessionHoursAgo: 'Last dialysis (hours ago)',
  insulin: 'Uses insulin?', insulinRefrigerated: 'Insulin kept cold?', insulinSupplyDays: 'Insulin supply (days)',
  hasCooling: 'Working cooling (AC/fan)?', mobilityLimited: 'Cannot walk out unaided?', waterDaysLeft: 'Drinking water (days)',
  infantFormulaDaysLeft: 'Baby formula (days)', needs: 'Needs',
};
const DEVICES: [DeviceType, string][] = [['none', 'None'], ['oxygen_concentrator', 'Oxygen'], ['ventilator', 'Ventilator'], ['cpap', 'CPAP'], ['suction', 'Suction'], ['other_powered_medical', 'Other'], ['unknown', '?']];
const NEEDS: [Need, string][] = [['water', 'Water'], ['food', 'Food'], ['medication', 'Medicine'], ['medical_transport', 'Medical transport'], ['evacuation', 'Evacuation'], ['shelter', 'Shelter'], ['power', 'Power'], ['baby_supplies', 'Baby supplies'], ['mobility_help', 'Mobility help'], ['sanitation', 'Sanitation']];
const COUNT_KEYS: Key[] = ['adults', 'over65', 'children', 'infantsUnder1'];
const AMOUNT_KEYS: Key[] = ['deviceBatteryHours', 'dialysisLastSessionHoursAgo', 'insulinSupplyDays', 'waterDaysLeft', 'infantFormulaDaysLeft'];

function visible(k: Key, v: Extraction): boolean {
  if (k === 'devicePower' || k === 'deviceBatteryHours') return v.deviceType !== 'none' && v.deviceType !== 'unknown' && (k !== 'deviceBatteryHours' || v.devicePower !== 'ok');
  if (k === 'dialysisLastSessionHoursAgo') return v.dialysis === 'yes';
  if (k === 'insulinRefrigerated' || k === 'insulinSupplyDays') return v.insulin === 'yes';
  if (k === 'infantFormulaDaysLeft') return v.infantsUnder1 > 0;
  return true;
}

export function IntakeForm({ value: v, onChange, incident, highlight }: Props) {
  const set = <K extends Key>(k: K, val: Extraction[K]) => onChange({ ...v, [k]: val });
  const keys = TEMPLATES[incident] ?? TEMPLATES.default;

  return (
    <div class="form">
      <label class="field wide">
        <span>Where is the door? <small>(no names)</small></span>
        <input value={v.descriptor} maxLength={60} placeholder="e.g. blue door, 2nd floor"
          onInput={(e) => set('descriptor', (e.target as HTMLInputElement).value)} />
      </label>
      {keys.filter((k) => visible(k, v)).map((k) => {
        const hl = highlight?.has(k) ? ' hl' : '';
        if (k === 'needs') {
          return (
            <div class={`field wide${hl}`} key={k}><span>{LABEL[k]}</span>
              <div class="seg wrap">{NEEDS.map(([n, l]) => (
                <button type="button" class={v.needs.includes(n) ? 'on' : ''}
                  onClick={() => set('needs', v.needs.includes(n) ? v.needs.filter((x) => x !== n) : [...v.needs, n])}>{l}</button>))}
              </div>
            </div>);
        }
        if (k === 'deviceType') {
          return (
            <div class={`field wide${hl}`} key={k}><span>{LABEL[k]}</span>
              <div class="seg wrap">{DEVICES.map(([d, l]) => (
                <button type="button" class={v.deviceType === d ? 'on' : ''} onClick={() => set('deviceType', d)}>{l}</button>))}</div>
            </div>);
        }
        if (k === 'devicePower') {
          return (
            <div class={`field${hl}`} key={k}><span>{LABEL[k]}</span>
              <div class="seg">{(['ok', 'none', 'unknown'] as const).map((p) => (
                <button type="button" class={v.devicePower === p ? 'on' : ''} onClick={() => set('devicePower', p)}>{p === 'ok' ? 'Yes' : p === 'none' ? 'No' : '?'}</button>))}</div>
            </div>);
        }
        if (COUNT_KEYS.includes(k) || AMOUNT_KEYS.includes(k)) {
          const n = v[k] as number; const step = COUNT_KEYS.includes(k) ? 1 : k === 'deviceBatteryHours' || k === 'dialysisLastSessionHoursAgo' ? 1 : 0.5;
          return (
            <div class={`field${hl}`} key={k}><span>{LABEL[k]}</span>
              <div class="stepper">
                <button type="button" onClick={() => set(k, (n <= 0 ? -1 : Math.max(0, n - step)) as never)}>−</button>
                <input inputMode="decimal" value={n < 0 ? '' : String(n)} placeholder="?"
                  onInput={(e) => { const t = (e.target as HTMLInputElement).value; const x = Number(t); set(k, (t === '' || !Number.isFinite(x) || x < 0 ? -1 : x) as never); }} />
                <button type="button" onClick={() => set(k, ((n < 0 ? 0 : n) + step) as never)}>+</button>
              </div>
            </div>);
        }
        const t = v[k] as Tri;
        return (
          <div class={`field${hl}`} key={k}><span>{LABEL[k]}</span>
            <div class="seg">{(['yes', 'no', 'unknown'] as Tri[]).map((x) => (
              <button type="button" class={t === x ? 'on' : ''} onClick={() => set(k, x as never)}>{x === 'unknown' ? '?' : x === 'yes' ? 'Yes' : 'No'}</button>))}</div>
          </div>);
      })}
    </div>
  );
}

/** Fields the volunteer should try to answer before leaving the door. */
export function askKeys(v: Extraction): Set<Key> {
  const s = new Set<Key>();
  if (v.deviceType !== 'none' && v.deviceType !== 'unknown') {
    if (v.devicePower === 'unknown') s.add('devicePower');
    if (v.devicePower === 'none' && v.deviceBatteryHours < 0) s.add('deviceBatteryHours');
  }
  if (v.dialysis === 'yes' && v.dialysisLastSessionHoursAgo < 0) s.add('dialysisLastSessionHoursAgo');
  if (v.insulin === 'yes' && v.insulinRefrigerated === 'unknown') s.add('insulinRefrigerated');
  if (v.over65 > 0) { if (v.livesAlone === 'unknown') s.add('livesAlone'); if (v.hasCooling === 'unknown') s.add('hasCooling'); }
  if (v.infantsUnder1 > 0 && v.infantFormulaDaysLeft < 0) s.add('infantFormulaDaysLeft');
  return s;
}
