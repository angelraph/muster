import { useEffect, useState } from 'preact/hooks';
import { localConfig, loadLiveConfig, firebase, type LiveConfig } from '../firebase';
import { onConfigChange, subscribeHouseholds } from '../store';
import type { Household, Priority } from '../core/types';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    addEventListener('online', a); addEventListener('offline', b);
    return () => { removeEventListener('online', a); removeEventListener('offline', b); };
  }, []);
  return on;
}

export function useHouseholds(): Household[] {
  const [list, setList] = useState<Household[]>([]);
  useEffect(() => subscribeHouseholds(setList), []);
  return list;
}

export function useLiveConfig(): [LiveConfig, () => void] {
  const [cfg, setCfg] = useState<LiveConfig>(localConfig());
  const refresh = () => { loadLiveConfig().then(setCfg); };
  useEffect(() => {
    refresh();
    const off = onConfigChange(refresh);
    const t = setInterval(refresh, firebase() ? 30_000 : 2_000);
    addEventListener('online', refresh);
    return () => { off(); clearInterval(t); removeEventListener('online', refresh); };
  }, []);
  return [cfg, refresh];
}

export const PRIORITY_TEXT: Record<Priority, string> = { P1: 'Urgent', P2: 'Soon', P3: 'Routine' };

export function Chip({ kind, children }: { kind: string; children: preact.ComponentChildren }) {
  return <span class={`chip chip-${kind}`}>{children}</span>;
}

export function SourceChip({ source }: { source: string | undefined }) {
  if (source === 'on_device') return <Chip kind="device">On this device</Chip>;
  if (source === 'in_cloud') return <Chip kind="cloud">Cloud</Chip>;
  if (source === 'tap') return <Chip kind="tap">Tapped by volunteer</Chip>;
  return null;
}

export const INCIDENT_LABEL: Record<string, string> = {
  flood: 'Flood', hurricane: 'Hurricane', heat_wave: 'Heat wave', earthquake: 'Earthquake', wildfire: 'Wildfire',
};

import { subscribeAttempts, subscribeRegistry, subscribeSelfReports, type Attempt, type RegistryEntry, type SelfReport } from '../store';
export function useAttempts(): Attempt[] { const [l, s] = useState<Attempt[]>([]); useEffect(() => subscribeAttempts(s), []); return l; }
export function useSelfReports(): SelfReport[] { const [l, s] = useState<SelfReport[]>([]); useEffect(() => subscribeSelfReports(s), []); return l; }
export function useRegistry(): RegistryEntry[] { const [l, s] = useState<RegistryEntry[]>([]); useEffect(() => subscribeRegistry(s), []); return l; }

export const RISK_LABEL: Record<string, string> = { oxygen: 'Oxygen', ventilator: 'Ventilator', dialysis: 'Dialysis', mobility: 'Mobility', insulin: 'Insulin', other: 'Powered device' };
