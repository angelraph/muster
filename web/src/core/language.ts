// Resident language card: questions shown in the resident's language, answers tapped by the resident,
// turned into a draft record by code. No AI, no network: the phrases ship with the app.
import card from '../../../shared/language-card.json';
import type { Extraction, Need, Tri } from './types';

export type Lang = (typeof card.languages)[number];
export const LANGS: Lang[] = card.languages;
export const LANG_REVIEW = card.review;
export const langByCode = (code: string): Lang => LANGS.find((l) => l.code === code) ?? LANGS[0];

export type QId = keyof Lang['card']['q'];
export type Kind = 'count' | 'yesno' | 'days' | 'when';
export type Answer = number | 'yes' | 'no' | 'unsure';
export type Answers = Partial<Record<QId, Answer>>;

/** Question order. `when` says whether a follow-up is asked, given the answers so far. */
export const FLOW: { id: QId; kind: Kind; when?: (a: Answers) => boolean }[] = [
  { id: 'people', kind: 'count' },
  { id: 'over65', kind: 'yesno' },
  { id: 'baby', kind: 'yesno' },
  { id: 'device', kind: 'yesno' },
  { id: 'power', kind: 'yesno' },
  { id: 'dialysis', kind: 'yesno' },
  { id: 'dialysisWhen', kind: 'when', when: (a) => a.dialysis === 'yes' },
  { id: 'insulin', kind: 'yesno' },
  { id: 'insulinCold', kind: 'yesno', when: (a) => a.insulin === 'yes' },
  { id: 'water', kind: 'days' },
  { id: 'leave', kind: 'yesno' },
];

/** Hours since the last dialysis session for each "when" option. 3+ days is scored as 72 h, the minimum it could be. */
export const WHEN_HOURS = [6, 24, 48, 72] as const;

export const nextQuestion = (a: Answers): (typeof FLOW)[number] | null =>
  FLOW.find((q) => !(q.id in a) && (!q.when || q.when(a))) ?? null;

const tri = (v: Answer | undefined): Tri => (v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'unknown');
const atLeastOne = (v: Answer | undefined): number => (v === 'yes' ? 1 : v === 'no' ? 0 : -1);

/** Merge the resident's answers into the volunteer's draft. Only answered questions change anything. */
export function applyAnswers(draft: Extraction, a: Answers): Extraction {
  const d: Extraction = { ...draft, needs: [...draft.needs] };
  const addNeed = (n: Need) => { if (!d.needs.includes(n)) d.needs.push(n); };
  if (typeof a.people === 'number') { d.adults = a.people; d.livesAlone = a.people === 1 ? 'yes' : 'no'; }
  if ('over65' in a) d.over65 = atLeastOne(a.over65);
  if ('baby' in a) d.infantsUnder1 = atLeastOne(a.baby);
  if (a.device === 'yes') d.deviceType = d.deviceType === 'none' || d.deviceType === 'unknown' ? 'other_powered_medical' : d.deviceType;
  else if (a.device === 'no') d.deviceType = 'none';
  else if (a.device === 'unsure') d.deviceType = 'unknown';
  if ('power' in a) d.devicePower = a.power === 'yes' ? 'ok' : a.power === 'no' ? 'none' : 'unknown';
  if (a.power === 'no' && a.device === 'yes') addNeed('power');
  if ('dialysis' in a) d.dialysis = tri(a.dialysis);
  if (typeof a.dialysisWhen === 'number') d.dialysisLastSessionHoursAgo = WHEN_HOURS[a.dialysisWhen] ?? -1;
  if ('insulin' in a) d.insulin = tri(a.insulin);
  if ('insulinCold' in a) d.insulinRefrigerated = tri(a.insulinCold);
  if (typeof a.water === 'number') { d.waterDaysLeft = a.water; if (a.water < 1) addNeed('water'); }
  if ('leave' in a) { d.mobilityLimited = tri(a.leave); if (a.leave === 'yes') addNeed('evacuation'); }
  return d;
}
