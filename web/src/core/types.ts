// Shapes shared with the Android app. Source of truth: /shared/extraction.schema.json

export type Tri = 'yes' | 'no' | 'unknown';
export type DeviceType =
  | 'none' | 'oxygen_concentrator' | 'ventilator' | 'cpap' | 'suction' | 'other_powered_medical' | 'unknown';
export type Need =
  | 'water' | 'food' | 'shelter' | 'power' | 'medication' | 'medical_transport'
  | 'evacuation' | 'baby_supplies' | 'mobility_help' | 'sanitation';
export type IncidentType = 'flood' | 'hurricane' | 'heat_wave' | 'earthquake' | 'wildfire';

/** What a volunteer confirms at the door. There is no name field, on purpose. */
export interface Extraction {
  descriptor: string;
  adults: number;
  over65: number;
  children: number;
  infantsUnder1: number;
  livesAlone: Tri;
  deviceType: DeviceType;
  devicePower: 'ok' | 'none' | 'unknown';
  deviceBatteryHours: number;
  dialysis: Tri;
  dialysisLastSessionHoursAgo: number;
  insulin: Tri;
  insulinRefrigerated: Tri;
  insulinSupplyDays: number;
  hasCooling: Tri;
  mobilityLimited: Tri;
  waterDaysLeft: number;
  infantFormulaDaysLeft: number;
  needs: Need[];
}

export type CaptureSource = 'on_device' | 'tap';

/** The record that syncs to Firestore. */
export interface Household extends Extraction {
  id: string;
  incidentId: string;
  buildingId: string | null;
  reportedAt: number; // ms, time of the latest visit
  reportedBy: string; // anonymous volunteer uid
  source: CaptureSource;
  rulebookVersion: string;
  visits: number;
}

export interface Rulebook {
  version: string;
  label: string;
  priority: { p1WithinHours: number; p2WithinHours: number };
  recheckHours: { P1: number; P2: number; P3: number };
  unknownCriticalRecheckHours: number;
  poweredDevice: { assumedBatteryHoursWhenUnknown: number; safetyMarginHours: number };
  dialysis: { maxHoursBetweenSessions: number };
  insulin: { unrefrigeratedDays: number; unrefrigeratedDaysInHeat: number };
  heat: { incidentTypes: string[]; minAgeBand: 'over65'; recheckHours: number };
  supplies: { warnBelowDays: number };
}

export type Priority = 'P1' | 'P2' | 'P3';

export type HazardCode =
  | 'powered_device' | 'powered_device_unknown'
  | 'dialysis' | 'dialysis_unknown'
  | 'insulin'
  | 'heat_isolated' | 'heat_unknown'
  | 'infant_formula' | 'water'
  | 'assisted_evacuation';

export interface Hazard {
  code: HazardCode;
  deadline: number | null; // ms
  /** True when we could not find out - never treated as safe. */
  unknown: boolean;
  /** Plain-language line for volunteers and coordinators. */
  label: string;
  /** Question to ask on the next visit, if any. */
  ask?: string;
}

export interface Assessment {
  priority: Priority;
  deadline: number | null;
  overdue: boolean;
  nextCheckBy: number;
  hazards: Hazard[];
}

export const EMPTY_EXTRACTION: Extraction = {
  descriptor: '', adults: -1, over65: -1, children: -1, infantsUnder1: -1,
  livesAlone: 'unknown', deviceType: 'none', devicePower: 'unknown', deviceBatteryHours: -1,
  dialysis: 'unknown', dialysisLastSessionHoursAgo: -1,
  insulin: 'unknown', insulinRefrigerated: 'unknown', insulinSupplyDays: -1,
  hasCooling: 'unknown', mobilityLimited: 'unknown',
  waterDaysLeft: -1, infantFormulaDaysLeft: -1, needs: [],
};
