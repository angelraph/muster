import { useState } from 'preact/hooks';
import { GITHUB, PHOTOS, Photo } from './brand';
import { PageHero } from './chrome';
import { FAQ, FaqList } from './faq';
import { Icon, type IconName } from './icons';
import { FinalCta } from './Landing';
import { HouseholdCard, IconTile, MiniBoard, NoSignalCard, QrCard, RunSheetCard } from './mocks';

const Step = ({ n, icon, title, children, art }: { n: number; icon: IconName; title: string; children: preact.ComponentChildren; art: preact.ComponentChildren }) => (
  <div class="step reveal">
    <div class="step-copy">
      <span class="step-n">0{n}</span>
      <h3><IconTile name={icon} tone="blue" size="sm" /> {title}</h3>
      <div class="step-text">{children}</div>
    </div>
    <div class="step-art">{art}</div>
  </div>
);

export function HowPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From a knock on the door to a run sheet." lead="Four steps, designed so the most important part (the doorstep) works with no signal, no cloud and no AI at all." />
      <section class="sec steps">
        <Step n={1} icon="door" title="Knock and capture" art={<NoSignalCard />}>
          <p>The volunteer picks the door on the list and says or types what they see. On phones with Gemini Nano, the note becomes a structured record <b>on the device</b>. Everywhere else, a large tap form.</p>
          <p>Names are never asked for. The note and any photo stay on the phone.</p>
        </Step>
        <Step n={2} icon="clock" title="Code computes the clock" art={<HouseholdCard />}>
          <p>Each household gets a time-to-harm from the agency's rulebook: "Oxygen: about 3 h left", "Dialysis: overdue by 1 day", "Heat: over 65, alone, no cooling, recheck every 6 h".</p>
          <p>Missing data means "unknown, recheck", never "safe".</p>
        </Step>
        <Step n={3} icon="qr" title="Sync, or hop by QR" art={<QrCard />}>
          <p>The moment any phone gets signal, its records sync. With no signal anywhere, records travel phone to phone as animated QR codes until someone reaches signal.</p>
        </Step>
        <Step n={4} icon="map" title="The board sees everything" art={<div class="stack-mini"><MiniBoard /><RunSheetCard /></div>}>
          <p>The coordinator board shows live clocks, homes nobody has checked, rechecks due and possible duplicate houses (found by code, confirmed by a person).</p>
          <p>Only here does the cloud help, writing per-team run sheets and the shift handover from structured records.</p>
        </Step>
      </section>
      <section class="sec">
        <div class="sec-head reveal"><h2>Where each AI mode runs</h2></div>
        <div class="table-wrap reveal">
          <table class="tbl">
            <thead><tr><th>Moment</th><th>Mode</th><th>Why</th></tr></thead>
            <tbody>
              <tr><td>Speech to text at the door</td><td>Platform on-device recognizer</td><td>The on-device model takes text, not audio. Typing always works.</td></tr>
              <tr><td>Note or label photo to record</td><td><span class="mk-src device">Only on device</span></td><td>No signal at the door; private medical details should not leave the phone.</td></tr>
              <tr><td>One-line summary on the board</td><td><span class="mk-src tap">Prefer on device</span></td><td>Keeps working if the shelter's link drops.</td></tr>
              <tr><td>Run sheets, handover, translation</td><td><span class="mk-src cloud">Only in cloud</span></td><td>Needs every volunteer's records at once.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <FinalCta />
    </>
  );
}

export function FeaturesPage() {
  const F: [IconName, string, string][] = [
    ['mic', 'Voice or typed intake', 'Say what you see. On-device AI turns it into fields you confirm.'],
    ['camera', 'Label photos', 'Insulin pens, prescription bottles and device plates fill fields offline.'],
    ['clock', 'Time-to-harm clock', 'Deadlines from a versioned, agency-owned rulebook. Code, not AI.'],
    ['eyeOff', 'Silence is a signal', 'Homes nobody has checked glow on the map until someone does.'],
    ['heartbeat', 'Recheck queue', 'Every urgent household has a revisit-by time. Overdue ones jump to the top.'],
    ['qr', 'QR handoff', 'Records hop phone to phone with no network at all.'],
    ['map', 'Coordinator board', 'Live clocks, priorities, duplicates and unchecked homes in Chrome.'],
    ['cloud', 'Cloud run sheets', 'Per-team stops, bring-lists and a shift handover, written by Gemini.'],
    ['globe', 'Label translation', 'Hazard labels in Spanish, French, Haitian Creole, Yoruba, Hausa, Igbo, Arabic.'],
    ['sliders', 'Remote Config', 'Switch incident type, rulebook version or the cloud kill switch.'],
    ['phone', 'Any phone', 'No-model phones get the same schema, rules and sync with big tap icons.'],
    ['lock', 'Private by design', 'No name field. Notes and photos never sync. Rules reject extra fields.'],
  ];
  return (
    <>
      <PageHero eyebrow="Features" title="Everything a response needs. Nothing it doesn't." lead="Built around one question: who will be harmed next, and how long do they have?" />
      <section class="sec">
        <div class="fgrid">
          {F.map(([ic, t, d], k) => (
            <div class="fcard reveal" key={t} style={{ transitionDelay: `${(k % 3) * 70}ms` }}>
              <IconTile name={ic} tone={['blue', 'red', 'violet', 'ink'][k % 4]} />
              <h3>{t}</h3><p>{d}</p>
            </div>))}
        </div>
      </section>
      <FinalCta />
    </>
  );
}

export function AgenciesPage() {
  return (
    <>
      <PageHero eyebrow="For response agencies" title="Your rulebook. Your incident. Your call." lead="Muster never hard-codes clinical thresholds. You set them, version them, and push them to every phone." />
      <section class="sec split">
        <div class="split-copy reveal">
          <h2>Run it from one console</h2>
          <ul class="checks">
            <li><Icon name="check" size={18} /> <span><b>Incident type.</b> Flood, hurricane, heat wave, earthquake or wildfire. The intake form reorders itself (a heat wave asks about cooling first).</span></li>
            <li><Icon name="check" size={18} /> <span><b>Rulebook version.</b> A JSON document of thresholds. Every record stores which version assessed it.</span></li>
            <li><Icon name="check" size={18} /> <span><b>Cloud kill switch.</b> Turn off all cloud AI instantly. Everything else keeps working.</span></li>
            <li><Icon name="check" size={18} /> <span><b>Join codes.</b> Volunteers join with a code, anonymously. You promote coordinators.</span></li>
          </ul>
        </div>
        <div class="split-demo reveal">
          <pre class="code">{`{
  "incident_type": "heat_wave",
  "cloud_enabled": true,
  "rulebook_json": {
    "version": "county-2026.11",
    "oxygen": { "urgent_hours": 4 },
    "heat":   { "recheck_hours": 6 }
  }
}`}</pre>
          <p class="fv-dim">Remote Config parameters (illustrative values).</p>
        </div>
      </section>
      <section class="sec">
        <div class="ph-band reveal"><Photo p={PHOTOS.volunteers} /><div><h3>Ready for your next deployment</h3><p>Open source (Apache-2.0), runs on Firebase, installs as a web app or an Android APK. Fork it and make it yours.</p><a class="btn-pill solid" href={GITHUB} target="_blank" rel="noopener"><Icon name="github" size={18} /> View on GitHub</a></div></div>
      </section>
      <FinalCta />
    </>
  );
}

export function FaqPage() {
  const groups = [...new Set(FAQ.map((x) => x.group))];
  const [g, setG] = useState('All');
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions, answered." lead="Everything about offline use, AI, privacy and safety." />
      <section class="sec">
        <div class="seg-tabs reveal">{['All', ...groups].map((x) => <button key={x} class={g === x ? 'on' : ''} onClick={() => setG(x)}>{x}</button>)}</div>
        <FaqList key={g} items={g === 'All' ? FAQ : FAQ.filter((x) => x.group === g)} />
        <p class="center fv-dim reveal">Still curious? <a href={`${GITHUB}/issues`} target="_blank" rel="noopener">Open an issue on GitHub</a>.</p>
      </section>
    </>
  );
}

const Doc = ({ children }: { children: preact.ComponentChildren }) => <section class="sec doc reveal">{children}</section>;

export function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Privacy" title="Private by construction." lead="Not a policy promise: the data model makes it impossible to store what we never collect." />
      <Doc>
        <h2>What Muster never stores</h2>
        <ul class="checks">
          <li><Icon name="check" size={18} /> <span><b>Names.</b> There is no name field. Households are a map pin plus a short descriptor.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Voice notes and transcripts.</b> They stay in the volunteer's browser or phone and never sync.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Photos.</b> Label photos are read on the device and never uploaded.</span></li>
        </ul>
        <h2>What does sync</h2>
        <p>Only the confirmed, structured fields: counts by age group, device type and power, dialysis and insulin status, supplies in days, mobility, needs, and the time of the visit. Firestore security rules reject any record that contains other fields.</p>
        <h2>Who can see it</h2>
        <p>Only members of the incident who joined with its code. Volunteers sign in anonymously. Coordinators are promoted by the responding agency.</p>
        <h2>Cloud AI</h2>
        <p>The cloud sees structured records only, and only when a coordinator asks for run sheets, a handover or a translation. You can preview exactly what is sent with "Show exactly what is sent". The agency can switch cloud AI off.</p>
        <h2>Cookies and tracking</h2>
        <p>None. Muster uses no analytics and no advertising cookies. Photos on this website load from Unsplash's image service.</p>
      </Doc>
    </>
  );
}

export function SafetyPage() {
  return (
    <>
      <PageHero eyebrow="Safety & limits" title="Honest about what it is, and what it isn't." />
      <Doc>
        <div class="callout"><Icon name="shield" size={22} /><p><b>Muster is not medical advice.</b> It supports needs intake and logistics. Clinical thresholds are set by the responding agency; the demo ships labelled example values.</p></div>
        <h2>Design rules that keep people safe</h2>
        <ul class="checks">
          <li><Icon name="check" size={18} /> <span><b>The AI never ranks people.</b> Priorities come from code and the rulebook.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Unknown is never safe.</b> Missing critical facts make a household urgent with a short recheck.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Humans confirm.</b> Volunteers confirm every extracted field. Coordinators confirm every merge.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Fail closed.</b> If the on-device model is unavailable, doorstep data goes to the tap form, not the cloud.</span></li>
          <li><Icon name="check" size={18} /> <span><b>Cloud output is checked.</b> Stops the cloud invents are removed and flagged.</span></li>
        </ul>
        <h2>Known limits</h2>
        <ul class="plain">
          <li>On-device Gemini Nano is available only on supported devices and has been validated mainly in English.</li>
          <li>Offline voice depends on the browser or phone offering on-device speech recognition.</li>
          <li>The demo map and households are synthetic.</li>
          <li>Muster does not replace 911 or local emergency services. In immediate danger, call them.</li>
        </ul>
      </Doc>
    </>
  );
}

export function JudgesPage() {
  return (
    <>
      <PageHero eyebrow="For judges" title="Try Muster in five minutes." lead="Everything you need to see hybrid inference working on Web and Android." />
      <Doc>
        <ol class="judge-steps">
          <li><b>Open the app.</b> <a href="#/home">Volunteer app</a> or <a href="#/board">coordinator board</a>. Join with the demo code provided in the submission.</li>
          <li><b>Load synthetic households.</b> On the coordinator board, use "Load demo households" to fill the map.</li>
          <li><b>Generate run sheets.</b> Press "Show exactly what is sent", then "Generate run sheets". The result is labelled <span class="mk-src cloud">Cloud</span>.</li>
          <li><b>Try doorstep intake.</b> In Chrome with on-device AI enabled, type a note and press "Read on this device". The result is labelled <span class="mk-src device">On this device</span>.</li>
          <li><b>Go offline.</b> Turn on airplane mode. Capture a household, then reconnect and watch it sync.</li>
        </ol>
        <h2>App Check debug token (local runs)</h2>
        <p>Firebase AI Logic requires App Check. When you run the web app locally, it prints a debug token in the browser console. Add it in <b>Firebase console → App Check → Apps → muster-web → Manage debug tokens</b>.</p>
        <h2>Source</h2>
        <p><a href={GITHUB} target="_blank" rel="noopener">github.com/angelraph/muster</a> · Apache-2.0</p>
      </Doc>
    </>
  );
}

export function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Account for everyone." lead="To muster is to gather people and call the roll. After a disaster, a town musters to find out who is missing. That is the whole idea." />
      <Doc>
        <h2>Why we built it</h2>
        <p>In Hurricane Maria, about a third of an estimated 4,645 excess deaths were attributed to delayed or interrupted medical care. In the 2021 heat dome, 71% of those who died in Multnomah County lived alone. In Hurricane Helene, about 74% of cell sites in affected North Carolina counties were offline at peak. Muster is built for exactly that gap.</p>
        <h2>Sources</h2>
        <ul class="plain">
          <li>Kishore N. et al. Mortality in Puerto Rico after Hurricane Maria. NEJM, 2018.</li>
          <li>Multnomah County. Health impacts from excessive heat events, final report, 2021.</li>
          <li>FCC Disaster Information Reporting System data, Hurricane Helene, 2024.</li>
          <li>HHS emPOWER program data on electricity-dependent Medicare beneficiaries.</li>
        </ul>
        <h2>Credits</h2>
        <p>Photography from <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>, used under the Unsplash License. Built with Firebase, Firebase AI Logic, Gemini and Preact.</p>
      </Doc>
    </>
  );
}

export function NotFound() {
  return (
    <section class="nf">
      <div class="glow-orb" aria-hidden="true" />
      <span class="nf-code">404</span>
      <h1>This door isn't on the map.</h1>
      <p class="lead">The page you're looking for doesn't exist. Every other door is still being checked.</p>
      <div class="hero-cta"><a class="btn-pill solid lg" href="#/">Back home</a><a class="btn-pill soft lg" href="#/home">Open the app</a></div>
    </section>
  );
}
