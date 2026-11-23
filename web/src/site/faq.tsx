import { useState } from 'preact/hooks';
import { Icon } from './icons';

export interface QA { q: string; a: preact.ComponentChildren; group: string }

export const FAQ: QA[] = [
  { group: 'Basics', q: 'What is Muster?', a: 'An offline-first app for disaster volunteers and coordinators. Volunteers record what they find at each door; Muster computes how long each household has before harm (oxygen, insulin, dialysis, heat, water) and keeps a recheck queue so nobody falls off the list.' },
  { group: 'Basics', q: 'Does it really work with no signal?', a: 'Yes. After one visit with signal the app opens with no network at all. Records are saved on the phone and sync the moment any signal appears. If nobody has signal, records can hop phone to phone as QR codes.' },
  { group: 'Basics', q: 'What phones does it run on?', a: 'Any Android phone or any browser. Phones that support on-device AI (Gemini Nano) get voice and photo intake; every other phone gets a large tap form with the same rules and the same sync. The banner always says which mode you are in.' },
  { group: 'AI', q: 'Does the AI decide who gets help first?', a: 'No. The AI only turns a spoken or typed note into structured fields, which the volunteer confirms. Priorities and deadlines are computed by plain code from the agency\'s versioned rulebook.' },
  { group: 'AI', q: 'When does Muster use the cloud?', a: 'Only at the coordinator level, for work that needs every volunteer\'s records at once: run sheets per team, the shift handover, and translating labels. Doorstep notes and photos are never sent to the cloud, and the coordinator can switch cloud AI off entirely.' },
  { group: 'AI', q: 'What happens if the on-device model is not ready?', a: 'Muster refuses to fall back to the cloud for doorstep data. It opens the tap form instead and says so.' },
  { group: 'Privacy', q: 'Does Muster store names?', a: 'No. There is no name field at all. A household is a map pin plus a short description such as "blue door, 2F". Our security rules reject any record with extra fields.' },
  { group: 'Privacy', q: 'Where do voice notes and photos go?', a: 'Nowhere. They stay on the volunteer\'s phone. Only the confirmed, structured fields sync. A unit test checks that no cloud request can contain a transcript or a photo.' },
  { group: 'Safety', q: 'Is this medical advice?', a: 'No. Muster does needs intake and logistics. The thresholds are set by the responding agency in Remote Config, and the demo ships clearly labelled example values.' },
  { group: 'Safety', q: 'What if a field is unknown?', a: 'Unknown is never treated as safe. A missing critical fact (for example, whether a device has power) makes the household urgent, sets a two-hour recheck, and shows the exact question to ask.' },
  { group: 'Agencies', q: 'Can we use our own thresholds?', a: 'Yes. The rulebook is a versioned JSON document delivered by Remote Config. Change it once and every phone picks it up at its next signal. Each record keeps the rulebook version it was assessed with.' },
  { group: 'Agencies', q: 'How do volunteers join an incident?', a: 'They open the app and enter the join code you give them. They need signal once. Coordinators are promoted in the Firebase console.' },
  { group: 'Project', q: 'Is Muster open source?', a: 'Yes, under the Apache-2.0 license. The code is on GitHub.' },
  { group: 'Project', q: 'How can judges try it?', a: <>See the <a href="#/judges">For judges</a> page: a hosted link, a demo join code, synthetic households and App Check debug-token steps.</> },
];

export function FaqList({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div class="faq">
      {items.map((x, i) => (
        <div class={`faq-item reveal ${open === i ? 'open' : ''}`} key={x.q}>
          <button class="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{x.q}</span><span class="faq-ic"><Icon name={open === i ? 'minus' : 'plus'} size={18} /></span>
          </button>
          <div class="faq-a" role="region"><div><p>{x.a}</p></div></div>
        </div>))}
    </div>
  );
}
