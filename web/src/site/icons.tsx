// Small stroke icon set, drawn for Muster. 24px grid, currentColor.
import type { JSX } from 'preact';

const P: Record<string, JSX.Element> = {
  house: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pin: <><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  wifiOff: <><path d="M3 3l18 18" /><path d="M8.5 16.4a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 4.2-2.4M14.8 10.5A10 10 0 0 1 19 12.9" /><path d="M2 9.4a15 15 0 0 1 4-2.5M10.5 6.1A15 15 0 0 1 22 9.4" /><circle cx="12" cy="19.5" r=".8" fill="currentColor" /></>,
  qr: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M17 20.5h3.5V18M14.5 20.5v-2" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.3" /></>,
  cloud: <><path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18.5Z" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  shield: <><path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  drop: <><path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" /></>,
  heart: <><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" /></>,
  heartbeat: <><path d="M3 12h4l2-4 4 8 2-4h6" /></>,
  thermo: <><path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0Z" /><path d="M12 9v6" /></>,
  battery: <><rect x="2.5" y="7.5" width="17" height="9" rx="2" /><path d="M21.5 10.5v3M6 10.5v3" /></>,
  users: <><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M16 5.5a3.3 3.3 0 0 1 0 6.3M18 14a6 6 0 0 1 3 5.5" /></>,
  map: <><path d="m3.5 6.5 5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5Z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  arrowUpRight: <><path d="M7 17 17 7M8 7h9v9" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  pill: <><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="m9.2 8 5.6 8" /></>,
  baby: <><circle cx="12" cy="8" r="3.5" /><path d="M6 20a6 6 0 0 1 12 0" /><path d="M10.6 8.2h.01M13.4 8.2h.01" /></>,
  lungs: <><path d="M12 4v8M12 10c-1.5 0-2 1.3-3 1.3S7 8 5.5 8 3 12 3 15.5 4.5 20 6.5 20s4-1.5 4-4V11M12 10c1.5 0 2 1.3 3 1.3S17 8 18.5 8 21 12 21 15.5 19.5 20 17.5 20s-4-1.5-4-4V11" /></>,
  sparkle: <><path d="M12 3.5 13.6 9l5.4 1.5-5.4 1.6L12 17.5l-1.6-5.4L5 10.5 10.4 9Z" /><path d="M18.5 16.5 19 18l1.5.5L19 19l-.5 1.5L18 19l-1.5-.5L18 18Z" /></>,
  bolt: <><path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9.5 6a17 17 0 0 1-3 3.6M6.4 7.6A16 16 0 0 0 2.5 12c1 1.5 4.5 6 9.5 6a9 9 0 0 0 3.7-.8" /><path d="M9.9 10a3 3 0 0 0 4.2 4.2" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  book: <><path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2Z" /><path d="M4.5 20.5V5.5M8.5 7.5h6" /></>,
  github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></>,
  pause: <><path d="M9 5v14M15 5v14" /></>,
  play: <><path d="M7 4.5v15l12-7.5Z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></>,
  door: <><path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17" /><circle cx="14.8" cy="12.5" r=".9" fill="currentColor" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.3 3.6 8.5S14.5 17.9 12 20.5C9.5 17.9 8.4 15.2 8.4 12S9.5 6.1 12 3.5Z" /></>,
  layers: <><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></>,
  signal: <><path d="M5 19v-3M9.5 19v-6M14 19v-9M18.5 19V6" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, stroke = 1.7, class: cls }: { name: IconName; size?: number; stroke?: number; class?: string }) {
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[name]}</svg>
  );
}
