import { useState } from 'preact/hooks';
import { PHOTOS, Photo } from './brand';
import { Icon, type IconName } from './icons';
import { HouseholdCard, IconTile, MiniBoard, NoSignalCard, QrCard, RunSheetCard } from './mocks';
import { useCountUp, useCycle, useInView, useScrollProgress, useTypewriter } from './motion';
import { FaqList, FAQ } from './faq';

export function Landing() {
  return (
    <>
      <Hero />
      <EvidenceMarquee />
      <ProductFrame />
      <Statement />
      <Scenarios />
      <Bento />
      <HybridDemo />
      <FieldTiles />
      <Numbers />
      <Agencies />
      <section class="sec">
        <div class="sec-head reveal"><h2>Questions, answered.</h2><a class="btn-pill soft" href="#/faq">All questions <Icon name="arrow" size={16} /></a></div>
        <FaqList items={FAQ.slice(0, 6)} />
      </section>
      <FinalCta />
    </>
  );
}

/* 1. Hero: headline with inline icon tiles, then a shuffling stack of real product cards and photos. */
function Hero() {
  const [i] = useCycle(5, 2800);
  const cards = [
    <div class="stack-photo"><Photo p={PHOTOS.rescue} eager /><span class="stack-cap"><Icon name="pin" size={14} /> Marshall, NC · flood, day 2</span></div>,
    <HouseholdCard />,
    <NoSignalCard />,
    <div class="stack-photo"><Photo p={PHOTOS.alone} eager /><span class="stack-cap"><Icon name="clock" size={14} /> Lives alone · unchecked 26 h</span></div>,
    <div class="stack-qr"><QrCard /><p>No network at all? Records hop phone to phone.</p></div>,
  ];
  return (
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"><div class="glow-orb a" /><div class="glow-orb b" /><div class="grid-fade" /></div>
      <a class="hero-badge reveal" href="#/judges"><span class="dot-live" /> Built for #BuildHybridAI 2026<span class="hide-sm"> · Firebase AI Logic</span> <Icon name="arrow" size={14} /></a>
      <h1 class="hero-h reveal">
        Find them <IconTile name="house" tone="blue" size="lg" /> before
        <br />their <IconTile name="clock" tone="red" size="lg" /> clock
        <br />runs out. <IconTile name="pin" tone="ink" size="lg" />
      </h1>
      <p class="hero-sub reveal">After a disaster, many people die in the days after the storm: the oxygen runs out, the insulin goes warm, someone living alone is never checked.
        Muster finds those households first, even with every cell tower down.</p>
      <div class="hero-cta reveal">
        <a class="btn-pill solid lg" href="#/home">Open the volunteer app</a>
        <a class="btn-pill soft lg" href="#/how">See how it works <Icon name="arrow" size={18} /></a>
      </div>
      <div class="stack reveal" aria-label="Muster screens">
        {cards.map((c, k) => {
          const pos = (k - i + cards.length) % cards.length;
          return <div key={k} class={`stack-card p${pos}`} aria-hidden={pos !== 0}>{c}</div>;
        })}
      </div>
      <div class="hero-trust reveal">
        <span><Icon name="wifiOff" size={16} /> Works offline</span>
        <span><Icon name="lock" size={16} /> No names stored</span>
        <span><Icon name="phone" size={16} /> Any phone</span>
        <span><Icon name="sparkle" size={16} /> On-device + cloud AI</span>
      </div>
    </section>
  );
}

/* 2. Infinite marquee with a pause control. */
function EvidenceMarquee() {
  const [paused, setPaused] = useState(false);
  const items: [IconName, string][] = [
    ['heartbeat', 'Hurricane Maria: about 1 in 3 of 4,645 excess deaths came from interrupted care'],
    ['thermo', '2021 heat dome: 71% of those who died lived alone'],
    ['signal', 'Hurricane Helene: ~74% of cell sites offline at peak'],
    ['bolt', '2.7 million Americans rely on powered medical equipment at home'],
    ['house', '94% of heat-dome deaths happened at home'],
  ];
  return (
    <section class={`marquee ${paused ? 'paused' : ''}`} aria-label="Why it matters">
      <div class="marquee-track">
        {[0, 1].map((dup) => (
          <div class="marquee-row" key={dup} aria-hidden={dup === 1}>
            {items.map(([ic, t]) => <span key={t}><Icon name={ic} size={18} /> {t}</span>)}
          </div>))}
      </div>
      <button class="marquee-btn" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play ticker' : 'Pause ticker'}><Icon name={paused ? 'play' : 'pause'} size={14} /></button>
    </section>
  );
}

/* 3. A large framed product preview with auto-advancing tabs. */
function ProductFrame() {
  const tabs = ['At the door', 'Coordinator', 'Handoff'] as const;
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  const [t, setT] = useCycle(3, 5200, seen);
  return (
    <section class="sec" id="product">
      <div class="frame reveal" ref={ref}>
        <div class="frame-bar">
          <span class="frame-dots"><i /><i /><i /></span>
          <div class="frame-tabs" role="tablist">
            {tabs.map((x, k) => (
              <button role="tab" aria-selected={t === k} class={t === k ? 'on' : ''} key={x} onClick={() => setT(k)}>
                {x}{t === k && <span class="tab-progress" key={`p${t}`} />}
              </button>))}
          </div>
          <span class="frame-url"><Icon name="lock" size={12} /> muster-hybrid.web.app</span>
        </div>
        <div class="frame-body">
          {t === 0 && (
            <div class="fv fv-door">
              <div class="fv-col">
                <h3>Which door?</h3>
                <div class="fv-doors">{['44 Hill Street', '100 Hill Street', '129 Hill Street', '137 Hill Street', '141 Hill Street', '201 Hill Street', '229 Hill Street', '257 Hill Street', '297 Hill Street'].map((d, k) => <span class={k === 3 ? 'sel' : k < 2 ? 'done' : ''} key={d}>{d}</span>)}</div>
                <p class="fv-dim">Dashed doors: nobody has checked them yet.</p>
              </div>
              <NoSignalCard />
            </div>)}
          {t === 1 && (
            <div class="fv fv-board">
              <MiniBoard />
              <div class="fv-list">
                <HouseholdCard tone="overdue" street="Hill Street" note="tapped" hazard="Oxygen, power unknown" source="tap" />
                <HouseholdCard street="North Main Street" note="upstairs" hazard="Dialysis session due" startMs={3 * 3600e3} source="tap" />
                <HouseholdCard tone="soon" street="Skyway Drive" note="end house" hazard="Baby formula running out" startMs={11 * 3600e3} />
              </div>
            </div>)}
          {t === 2 && (
            <div class="fv fv-hand">
              <div class="fv-phone a"><QrCard /></div>
              <div class="fv-beam" aria-hidden="true"><i /><i /><i /></div>
              <div class="fv-phone b">
                <div class="fv-scan"><Icon name="camera" size={28} /><span>Scanning teammate…</span><div class="fv-bar"><i /></div></div>
              </div>
              <p class="fv-cap">No signal anywhere. A volunteer heading back to signal scans everyone else and carries their records.</p>
            </div>)}
        </div>
      </div>
    </section>
  );
}

/* 4. Scroll-linked statement: words light up as you read. */
function Statement() {
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const a = 'Help arrives after the storm.'.split(' ');
  const b = 'But oxygen batteries, insulin and heat do not wait for a knock on the door. Nobody knows who is at risk, how long they have, or which doors were never knocked on.'.split(' ');
  const all = [...a, ...b];
  return (
    <section class="sec statement" ref={ref}>
      <h2 class="st-h">{a.map((w, k) => <span key={k} style={{ opacity: Math.min(1, 0.18 + Math.max(0, p * 1.6 * all.length - k) / 3) }}>{w} </span>)}</h2>
      <p class="st-p">{b.map((w, k) => <span key={k} style={{ opacity: Math.min(1, 0.18 + Math.max(0, p * 1.6 * all.length - (k + a.length)) / 3) }}>{w} </span>)}</p>
    </section>
  );
}

/* 5. Typewriter heading over a drifting carousel of real situations. */
function Scenarios() {
  const [ref, seen] = useInView<HTMLElement>(0.2);
  const text = useTypewriter(['Oxygen running out', 'Insulin going warm', 'Dialysis missed', 'Alone in the heat', 'Formula for half a day'], seen);
  const cards: { p: (typeof PHOTOS)[keyof typeof PHOTOS]; icon: IconName; t: string; d: string }[] = [
    { p: PHOTOS.alone, icon: 'thermo', t: 'Lives alone, no cooling', d: 'Recheck every 6 h until cooler' },
    { p: PHOTOS.rescue, icon: 'lungs', t: 'Oxygen without power', d: 'About 2 h 58 m of battery left' },
    { p: PHOTOS.hands, icon: 'pill', t: 'Insulin unrefrigerated', d: 'Supply for 2 days' },
    { p: PHOTOS.street, icon: 'heartbeat', t: 'Dialysis overdue', d: 'Last session 3 days ago' },
    { p: PHOTOS.shelter, icon: 'baby', t: 'Baby under 1', d: 'Formula for half a day' },
    { p: PHOTOS.wheelchair, icon: 'users', t: 'Cannot walk out unaided', d: 'Needs evacuation help' },
  ];
  return (
    <section class="sec scen" ref={ref}>
      <h2 class="type-h"><Icon name="search" size={34} stroke={2.2} /> <span>{text}</span><span class="caret" /></h2>
      <p class="sec-lead">Each household gets a deadline computed from the responding agency's rulebook. <b>The AI never decides who gets help first.</b></p>
      <div class="drift">
        <div class="drift-track">
          {[0, 1].map((d) => cards.map((c) => (
            <figure class="scard" key={`${d}${c.t}`} aria-hidden={d === 1}>
              <Photo p={c.p} />
              <figcaption><IconTile name={c.icon} tone="glass" size="sm" /><div><b>{c.t}</b><span>{c.d}</span></div></figcaption>
            </figure>)))}
        </div>
      </div>
    </section>
  );
}

/* 6. Bento of six capabilities, each with its own small animation. */
function Bento() {
  return (
    <section class="sec" id="features">
      <div class="sec-head center reveal"><h2>One app for the whole response.</h2><p class="sec-lead">From the doorstep to the shelter, with or without a signal.</p></div>
      <div class="bento">
        <article class="bt reveal">
          <h3>Doorstep intake, offline</h3><p>Speak or type. Gemini Nano fills a fixed record on the phone. You confirm every field.</p>
          <div class="bt-art art-type"><div class="typing">Grandma on oxygen, battery maybe three hours…</div><div class="mk-chips"><span class="mk-chip in d1">Oxygen</span><span class="mk-chip in d2">~3 h left</span><span class="mk-chip in d3">Aged 65+</span></div></div>
        </article>
        <article class="bt reveal">
          <h3>Label photo</h3><p>Point the camera at an insulin pen or a device plate. Fields fill in. The photo stays on the phone.</p>
          <div class="bt-art art-scan"><div class="pen"><span>INSULIN</span></div><div class="scanline" /></div>
        </article>
        <article class="bt reveal">
          <h3>Time-to-harm clock</h3><p>Code computes a deadline per household from a versioned rulebook. Unknown is never “safe”.</p>
          <div class="bt-art art-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="ring-bg" /><circle cx="60" cy="60" r="50" class="ring-fg" /></svg><div class="ring-t"><b>2h 58m</b><span>oxygen</span></div></div>
        </article>
        <article class="bt reveal">
          <h3>Silence is a signal</h3><p>Every known building is on the map. Homes nobody has checked glow until someone does.</p>
          <div class="bt-art art-grid">{Array.from({ length: 40 }, (_, k) => <i key={k} style={{ animationDelay: `${(k * 137) % 2400}ms` }} class={[5, 13, 22, 30].includes(k) ? 'hot' : [2, 9, 17, 26, 35].includes(k) ? 'done' : ''} />)}</div>
        </article>
        <article class="bt reveal">
          <h3>QR handoff</h3><p>With no network at all, records travel phone to phone as animated QR codes.</p>
          <div class="bt-art art-qr"><QrCard small /><span class="hop"><Icon name="arrow" size={18} /></span><span class="ph"><Icon name="phone" size={34} /></span></div>
        </article>
        <article class="bt reveal">
          <h3>Remote Config switch</h3><p>Flip flood to heat wave and every phone's intake form changes at its next signal.</p>
          <div class="bt-art art-switch"><span class="sw-l">Flood</span><span class="sw"><i /></span><span class="sw-r">Heat wave</span></div>
        </article>
      </div>
    </section>
  );
}

/* 7. Split: copy on the left, a live "agent" style demo on the right. */
function HybridDemo() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const [s] = useCycle(4, 2200, seen);
  return (
    <section class="sec split">
      <div class="split-copy reveal">
        <span class="eyebrow">Hybrid inference</span>
        <h2>Every AI mode has a physical reason.</h2>
        <ul class="modes">
          <li><IconTile name="phone" tone="blue" size="sm" /><div><b>Only on device</b><span>At the door. No signal, and a stranger's medical situation should not be uploaded. No cloud fallback, ever.</span></div></li>
          <li><IconTile name="layers" tone="ink" size="sm" /><div><b>Prefer on device</b><span>One-line summaries on the board keep working if the shelter link drops.</span></div></li>
          <li><IconTile name="cloud" tone="violet" size="sm" /><div><b>Only in the cloud</b><span>Run sheets and handovers need every volunteer's records at once.</span></div></li>
        </ul>
        <a class="btn-pill soft" href="#/how">How it works <Icon name="arrow" size={16} /></a>
      </div>
      <div class="split-demo reveal" ref={ref}>
        <div class="demo-bubble">Grandma on oxygen, concentrator dead, spare battery maybe 3 hours. Baby 8 months.</div>
        <div class={`demo-step ${s >= 1 ? 'show' : ''}`}><span class="spin" /> Reading on this device…</div>
        <div class={`demo-step ${s >= 2 ? 'show' : ''}`}>
          <div class="mk-chips"><span class="mk-chip in">Oxygen · no power</span><span class="mk-chip in">Battery ~3 h</span><span class="mk-chip in">Baby under 1</span></div>
          <span class="mk-src device">On this device · 0 bytes uploaded</span>
        </div>
        <div class={`demo-step ${s >= 3 ? 'show' : ''}`}><RunSheetCard /></div>
      </div>
    </section>
  );
}

/* 8. Photo tiles with UI overlays and named live cursors. */
function FieldTiles() {
  return (
    <section class="sec">
      <div class="sec-head reveal"><div><h2>Built for the people at the door.</h2><p class="sec-lead">Cheap phones, gloves, rain, darkness, no signal. Large tap targets, a tap form for phones without AI, and honest banners.</p></div></div>
      <div class="tiles">
        <div class="tile t-wide reveal"><Photo p={PHOTOS.street} /><div class="tile-ui"><HouseholdCard street="South Main Street" note="blue door" hazard="Oxygen: power status unknown" tone="urgent" source="tap" /></div><span class="cursor c1">Volunteer 2</span></div>
        <div class="tile reveal"><Photo p={PHOTOS.volunteers} /><div class="tile-ui sm"><div class="mk-pill"><Icon name="check" size={14} /> Synced 7 households</div></div></div>
        <div class="tile reveal"><Photo p={PHOTOS.hands} /><div class="tile-ui sm"><div class="mk-pill red"><Icon name="clock" size={14} /> Recheck due now</div></div><span class="cursor c2">Coordinator</span></div>
        <div class="tile reveal"><Photo p={PHOTOS.team} /><div class="tile-ui sm"><div class="mk-pill violet"><Icon name="cloud" size={14} /> Run sheets ready</div></div></div>
        <div class="tile reveal"><Photo p={PHOTOS.rescue} /><div class="tile-ui sm"><div class="mk-pill"><Icon name="wifiOff" size={14} /> No signal · saved on phone</div></div></div>
        <div class="tile t-wide reveal"><Photo p={PHOTOS.packing} /><div class="tile-ui"><RunSheetCard /></div><span class="cursor c3">Team 1</span></div>
      </div>
    </section>
  );
}

/* 9. Evidence with count-up numbers. */
function Numbers() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const n1 = useCountUp(4645, seen), n2 = useCountUp(71, seen), n3 = useCountUp(74, seen), n4 = useCountUp(2.7, seen);
  return (
    <section class="sec nums" ref={ref}>
      <blockquote class="reveal">
        <p>“About a third of Hurricane Maria's excess deaths were attributed to delayed or interrupted medical care.”</p>
        <cite>Kishore et al., New England Journal of Medicine, 2018</cite>
      </blockquote>
      <div class="nums-grid">
        <div class="num reveal"><b>{Math.round(n1).toLocaleString('en-US')}</b><span>estimated excess deaths after Hurricane Maria</span></div>
        <div class="num reveal"><b>{Math.round(n2)}%</b><span>of 2021 heat-dome deaths in Multnomah County lived alone</span></div>
        <div class="num reveal"><b>{Math.round(n3)}%</b><span>of cell sites offline in NC counties after Hurricane Helene</span></div>
        <div class="num reveal"><b>{n4.toFixed(1)}M</b><span>Medicare beneficiaries rely on powered medical equipment at home</span></div>
      </div>
    </section>
  );
}

/* 10. Centered CTA flanked by floating need icons. */
function Agencies() {
  const left: IconName[] = ['lungs', 'pill', 'thermo', 'drop'];
  const right: IconName[] = ['baby', 'heartbeat', 'battery', 'users'];
  return (
    <section class="sec agencies">
      <div class="float-col l" aria-hidden="true">{left.map((n, k) => <span key={n} class={`fl f${k}`}><IconTile name={n} tone={['blue', 'red', 'ink', 'violet'][k]} size="lg" /></span>)}</div>
      <div class="ag-copy reveal">
        <h2><span class="dim">Running a response?</span><br />Muster follows your rulebook.</h2>
        <p>Thresholds are set by the responding agency and shipped through Remote Config. Switch incident type, update the rulebook, or switch off all cloud AI, from one console.</p>
        <a class="btn-pill soft" href="#/agencies">For response agencies <Icon name="arrow" size={16} /></a>
      </div>
      <div class="float-col r" aria-hidden="true">{right.map((n, k) => <span key={n} class={`fl f${k}`}><IconTile name={n} tone={['red', 'blue', 'violet', 'ink'][k]} size="lg" /></span>)}</div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section class="sec final">
      <h2 class="reveal">Find them before<br />their clock runs out.</h2>
      <p class="sec-lead reveal">Open Muster on any phone or in Chrome. It keeps working when the towers don't.</p>
      <a class="mega-btn reveal" href="#/home">Open Muster <Icon name="arrowUpRight" size={40} stroke={2} /></a>
    </section>
  );
}
