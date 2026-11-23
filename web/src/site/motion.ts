// Motion helpers. Everything respects prefers-reduced-motion: users who ask for less motion get the final state.
import { useEffect, useRef, useState } from 'preact/hooks';

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Adds `is-in` to every `.reveal` element inside the page once it scrolls into view. */
export function useRevealAll(dep: unknown = null) {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)')];
    if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

/** True once the element has been on screen. */
export function useInView<T extends HTMLElement>(threshold = 0.3): [preact.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (reducedMotion() || !('IntersectionObserver' in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

/** Cycles 0..n-1 every `ms` while `active`. */
export function useCycle(n: number, ms: number, active = true): [number, (i: number) => void] {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || reducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms, active, i]);
  return [i, setI];
}

/** Types each phrase, holds, deletes, moves on. */
export function useTypewriter(phrases: string[], active = true): string {
  const [text, setText] = useState(reducedMotion() ? phrases[0] : '');
  useEffect(() => {
    if (!active || reducedMotion()) return;
    let p = 0, c = 0, del = false, t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = phrases[p];
      if (!del) { c++; setText(full.slice(0, c)); if (c === full.length) { del = true; t = setTimeout(tick, 1600); return; } t = setTimeout(tick, 55); }
      else { c--; setText(full.slice(0, c)); if (c === 0) { del = false; p = (p + 1) % phrases.length; t = setTimeout(tick, 250); return; } t = setTimeout(tick, 28); }
    };
    t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [active]);
  return text;
}

/** Counts from 0 to `to` once `start` is true. */
export function useCountUp(to: number, start: boolean, ms = 1400): number {
  const [v, setV] = useState(reducedMotion() ? to : 0);
  useEffect(() => {
    if (!start || reducedMotion()) { if (start) setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [start, to]);
  return v;
}

/** 0..1 progress of an element through the viewport, for scroll-linked effects. */
export function useScrollProgress<T extends HTMLElement>(): [preact.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [p, setP] = useState(reducedMotion() ? 1 : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect(); const vh = innerHeight;
        setP(Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.35))));
      });
    };
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  return [ref, p];
}

export function useScrolled(px = 40): boolean {
  const [s, setS] = useState(false);
  useEffect(() => { const f = () => setS(scrollY > px); f(); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f); }, []);
  return s;
}
