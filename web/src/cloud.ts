// Cloud jobs: they need every volunteer's records at once, which no single device has.
// Input is ONLY the whitelisted CloudHousehold shape (core/payload.ts) - checked again here at runtime.
import { getGenerativeModel, InferenceMode, Schema } from 'firebase/ai';
import { firebase, type LiveConfig } from './firebase';
import { assertCloudSafe, type CloudHousehold } from './core/payload';
import { planTeams, type TeamPlan } from './core/plan';
import { routeStops } from './core/route';
import { demoBuildings } from './core/seed';

const COORD = new Map(demoBuildings().map((b) => [b.id, { x: b.x, y: b.y }]));
import { parseModelJson } from './core/normalize';
import { byteLength, logCall } from './ledger';

const RUNSHEET_SCHEMA = Schema.object({
  properties: {
    teams: Schema.array({
      items: Schema.object({
        properties: {
          team: Schema.string(),
          briefing: Schema.string(),
          bring: Schema.array({ items: Schema.string() }),
          stops: Schema.array({
            items: Schema.object({ properties: { ref: Schema.string(), why: Schema.string() } }),
          }),
        },
      }),
    }),
    handover: Schema.string(),
  },
});

export interface RunSheet {
  teams: { team: string; briefing: string; bring: string[]; stops: { ref: string; why: string }[] }[];
  handover: string;
  source: string | undefined;
  droppedRefs: string[];
}

export function cloudRequest(households: CloudHousehold[], teams: number, incidentType: string) {
  const plan = planTeams(households, teams).map((t) => ({ ...t, stops: routeStops(t.stops, (id) => (id ? COORD.get(id) ?? null : null)) }));
  const request = { incidentType, generatedFor: 'relief coordinator', teams: plan };
  assertCloudSafe(request);
  return { request, plan };
}

export async function generateRunSheet(households: CloudHousehold[], teams: number, cfg: LiveConfig): Promise<RunSheet> {
  if (!cfg.cloudEnabled) throw new Error('Cloud is switched off by the coordinator (Remote Config: cloud_enabled = false).');
  const f = firebase();
  if (!f) throw new Error('Firebase not configured: add your project config to use the cloud.');
  const { request, plan } = cloudRequest(households, teams, cfg.incidentType);

  const model = getGenerativeModel(f.ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: cfg.cloudModel,
      generationConfig: { responseMimeType: 'application/json', responseSchema: RUNSHEET_SCHEMA, temperature: 0.2 },
    },
  });
  const prompt = `You are writing field run sheets for disaster relief teams. Stop order and arrival times (etaMin = minutes from now, slackMin = minutes to spare before harm, late = will arrive after the deadline) are already decided by code - keep them exactly, and mention any stop that is late.
For each team: a 2-sentence briefing, a short "bring" list of supplies/equipment implied by the stops (e.g. generator or battery pack for powered medical devices, water, baby formula, cooling packs, wheelchair-capable vehicle), and for each stop a one-line "why" a volunteer can read at the door.
Then a "handover" paragraph (max 6 sentences) for the next shift: what is overdue, what is unknown and must be asked, and where nobody has been yet.
In the input, -1 or "unknown" means nobody could find out - say "unknown", never assume.
Use only refs that appear in the input, and only in each stop's "ref" field: never write a ref code in a briefing, "why" or handover. In prose, describe a stop by its hazard (e.g. "the oxygen stop") or its order ("stop 2").
No names. Not medical advice.
INPUT:
${JSON.stringify(request)}`;

  const t0 = performance.now();
  let res;
  try { res = await model.generateContent(prompt); }
  catch (e) { logCall({ task: 'runsheet', mode: 'ONLY_IN_CLOUD', source: 'error', ms: Math.round(performance.now() - t0), bytesUp: byteLength(prompt), doorstep: false, reason: (e as Error).message }); throw e; }
  logCall({ task: 'runsheet', mode: 'ONLY_IN_CLOUD', source: 'in_cloud', ms: Math.round(performance.now() - t0), bytesUp: byteLength(prompt), doorstep: false,
    reason: `Run sheets need every volunteer's records at once (${households.length} households), which no single device has. Structured fields only.` });
  const raw = parseModelJson(res.response.text()) as Omit<RunSheet, 'source' | 'droppedRefs'> | null;
  if (!raw?.teams) throw new Error('Cloud reply was not a valid run sheet.');

  // Hallucination guard: a stop that code did not plan is removed and reported.
  const valid = new Set(plan.flatMap((t: TeamPlan) => t.stops.map((s) => s.ref)));
  const droppedRefs: string[] = [];
  for (const t of raw.teams) {
    t.stops = (t.stops ?? []).filter((s) => (valid.has(s.ref) ? true : (droppedRefs.push(s.ref), false)));
    t.bring ??= [];
  }
  return { ...raw, source: res.response.inferenceSource, droppedRefs };
}

/** Translate a short volunteer phrase list for the coordinator. Only structured labels, never notes. */
export async function translateLabels(labels: string[], target: string, cfg: LiveConfig): Promise<string[]> {
  if (!cfg.cloudEnabled) throw new Error('Cloud is switched off by the coordinator.');
  const f = firebase();
  if (!f) throw new Error('Firebase not configured.');
  assertCloudSafe({ labels });
  const model = getGenerativeModel(f.ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: cfg.cloudModel, generationConfig: { responseMimeType: 'application/json', responseSchema: Schema.array({ items: Schema.string() }) } },
  });
  const prompt = `Translate each string to ${target}. Keep order. Return a JSON array of strings.\n${JSON.stringify(labels)}`;
  const t0 = performance.now();
  const res = await model.generateContent(prompt);
  logCall({ task: 'translate', mode: 'ONLY_IN_CLOUD', source: 'in_cloud', ms: Math.round(performance.now() - t0), bytesUp: byteLength(prompt), doorstep: false,
    reason: `Hazard labels translated to ${target} for the coordinator. Labels only, never notes.` });
  const out = parseModelJson(res.response.text());
  return Array.isArray(out) && out.length === labels.length ? out.map(String) : labels;
}
