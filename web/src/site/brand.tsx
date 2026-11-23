import { Icon } from './icons';

/** Photos are served by Unsplash's image CDN (hotlinking is what the Unsplash License and API guidelines ask for). */
const U = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=72`;

export const PHOTOS = {
  rescue: { src: U('photo-1741081288260-877057e3fa27'), alt: 'Rescue workers in life jackets navigating floodwater in a boat' },
  shelter: { src: U('photo-1741110539426-fce3268c3c0d'), alt: 'Flooded houses while people gather to seek shelter' },
  alone: { src: U('photo-1695556746253-ab635cedac50'), alt: 'An older woman sitting alone on a bed at home' },
  wheelchair: { src: U('photo-1685657814797-83706c4e5279'), alt: 'A person in a wheelchair looking out of a window, alone in a room' },
  hands: { src: U('photo-1739932885175-5fdaa1bd5989'), alt: 'An older person holding the hand of a younger person' },
  street: { src: U('photo-1793648652549-0e4fa3b1b9dd'), alt: 'Two people in a small inflatable boat crossing a flooded street' },
  volunteers: { src: U('photo-1628717341663-0007b0ee2597'), alt: 'Volunteers packing relief supplies under a tent' },
  packing: { src: U('photo-1593113616828-6f22bca04804'), alt: 'Volunteers in gloves packing food into bags' },
  team: { src: U('photo-1776200816806-e3a579065d07'), alt: 'Four people gathered around a tablet, planning' },
} as const;

export function Photo({ p, class: cls, eager }: { p: { src: string; alt: string }; class?: string; eager?: boolean }) {
  return <img class={`photo ${cls ?? ''}`} src={p.src} alt={p.alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />;
}

/** Icon mark from the brand artwork, plus the wordmark drawn as text with the red pin in the "M". */
export function Logo({ size = 30, word = true }: { size?: number; word?: boolean }) {
  return (
    <span class="logo">
      <img src="/brand/icon-128.png" width={size} height={size} alt="" />
      {word && <span class="logo-word">Muster</span>}
    </span>
  );
}

export function Wordmark({ class: cls }: { class?: string }) {
  return (
    <span class={`wordmark ${cls ?? ''}`} aria-label="Muster">
      <span class="wm-m">M<span class="wm-pin"><Icon name="pin" size={28} stroke={2.6} /></span></span>uster
    </span>
  );
}

export const GITHUB = 'https://github.com/angelraph/muster';
