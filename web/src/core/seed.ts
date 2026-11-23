// The neighbourhood: real buildings, addresses, streets and river for Marshall, NC (OpenStreetMap, ODbL).
// The households placed on it in demo mode are synthetic; the geography is not.
import hood from '../../../shared/neighbourhood.json';
import type { Building } from './payload';

export interface Neighbourhood {
  name: string; attribution: string; viewBox: [number, number]; metresPerUnit: number;
  staging: { name: string; x: number; y: number; lat: number; lon: number } | null;
  buildings: (Building & { lat: number; lon: number; kind: string; osmId: number; poly: [number, number][] })[];
  streets: { name: string; pts: [number, number][] }[];
  river: [number, number][][];
}

export const NEIGHBOURHOOD = hood as unknown as Neighbourhood;

export function demoBuildings(): Building[] {
  return NEIGHBOURHOOD.buildings;
}
