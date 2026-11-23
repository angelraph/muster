import { useEffect, useState } from 'preact/hooks';
import { GITHUB, Logo } from './brand';
import { Icon } from './icons';
import { useScrolled } from './motion';

const LINKS: [string, string][] = [['#/how', 'How it works'], ['#/features', 'Features'], ['#/agencies', 'For agencies'], ['#/faq', 'FAQ']];

export function SiteNav({ route }: { route: string }) {
  const scrolled = useScrolled(24);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  return (
    <header class={`snav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div class="snav-in">
        <a href="#/" class="snav-brand" aria-label="Muster home"><Logo size={30} /></a>
        <nav class="snav-links" aria-label="Main">
          {LINKS.map(([h, t]) => <a key={h} href={h} class={route === h.slice(1) ? 'on' : ''}>{t}</a>)}
        </nav>
        <div class="snav-cta">
          <a class="icon-btn hide-sm" href={GITHUB} target="_blank" rel="noopener" aria-label="Source code on GitHub"><Icon name="github" /></a>
          <a class="btn-pill ghost hide-sm" href="#/board">Coordinator</a>
          <a class={`btn-pill solid ${scrolled ? '' : 'soft'}`} href="#/home">Open app</a>
          <button class="icon-btn show-sm" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {open && (
        <div class="snav-sheet">
          {LINKS.map(([h, t]) => <a key={h} href={h}>{t}</a>)}
          <a href="#/judges">For judges</a>
          <a href="#/board">Coordinator board</a>
          <a href={GITHUB} target="_blank" rel="noopener">GitHub</a>
        </div>)}
    </header>
  );
}

const COLS: [string, [string, string][]][] = [
  ['Product', [['#/volunteer', 'Volunteer app'], ['#/board', 'Coordinator board'], ['#/features', 'Features'], ['#/how', 'How it works']]],
  ['Learn', [['#/faq', 'FAQ'], ['#/agencies', 'For response agencies'], ['#/judges', 'For judges'], ['#/about', 'About & credits']]],
  ['Trust', [['#/privacy', 'Privacy'], ['#/safety', 'Safety & limits'], [GITHUB, 'Source code'], [`${GITHUB}/blob/main/LICENSE`, 'Apache-2.0 license']]],
];

export function SiteFooter() {
  return (
    <footer class="sfoot">
      <div class="sfoot-in">
        <div class="sfoot-brand">
          <Logo size={34} />
          <p>Finds the households a disaster is about to harm, before their time runs out. Works with every cell tower down.</p>
          <p class="sfoot-note">Needs intake and logistics only. Not medical advice.</p>
        </div>
        {COLS.map(([h, links]) => (
          <div class="sfoot-col" key={h}>
            <h4>{h}</h4>
            {links.map(([href, t]) => <a key={t} href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}>{t}</a>)}
          </div>))}
      </div>
      <div class="sfoot-bar">
        <span>© 2026 Muster. Open source under Apache-2.0.</span>
        <span>Built with Firebase AI Logic for #BuildHybridAI 2026</span>
      </div>
      <div class="sfoot-giant" aria-hidden="true">Muster</div>
    </footer>
  );
}

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children?: preact.ComponentChildren }) {
  return (
    <section class="phero">
      <div class="glow-orb" aria-hidden="true" />
      <span class="eyebrow reveal">{eyebrow}</span>
      <h1 class="reveal">{title}</h1>
      {lead && <p class="lead reveal">{lead}</p>}
      {children}
    </section>
  );
}
