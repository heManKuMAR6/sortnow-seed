/**
 * The fixed effects library. Configuration can only choose an effect and set bounded parameters.
 * Rules: one effect per page view, once per visit, overlay never takes input or shifts layout,
 * reduced motion and small or touch screens get no animation (the static artwork stays).
 */
import type {CompiledPack, ExperienceV2} from '../core/index.js';

export type Motion = 'auto' | 'reduce';
export interface EffectHandle { readonly finished: Promise<void>; cancel(): void }
const VISIT_KEY = 'seed-effect:visit';
/** Page-view guard for when session storage is unavailable or blocked. */
const playedThisPage = new WeakSet<Window>();

export function motionAllowed(win: Window, motion: Motion): boolean {
  if (motion === 'reduce' || typeof win.matchMedia !== 'function') return false;
  return !win.matchMedia('(prefers-reduced-motion: reduce)').matches && win.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
}
/**
 * At most one effect per visit, whichever theme is showing: a second theme in the same visit stays static.
 * Without session storage it is at most one per page view.
 */
function firstThisVisit(win: Window, id: string): boolean {
  if (playedThisPage.has(win)) return false;
  try {
    const store = win.sessionStorage;
    if (store.getItem(VISIT_KEY)) return false;
    store.setItem(VISIT_KEY, id);
  } catch { /* storage unavailable: the page-view guard still applies */ }
  playedThisPage.add(win);
  return true;
}
/** Preview tooling only: allows the effect to play again in this visit. */
export function forgetEffect(win: Window) { playedThisPage.delete(win); try { win.sessionStorage.removeItem(VISIT_KEY); } catch { /* ignore */ } }

/** Small deterministic generator so particle layouts are stable for a given experience. */
function random(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function art(doc: Document, svg: string, aspect: number, width: string): HTMLSpanElement {
  const el = doc.createElement('span');
  // Package-shipped artwork, sanitized and hashed at build time. Configuration never supplies markup.
  el.innerHTML = svg;
  Object.assign(el.style, {position: 'absolute', display: 'block', width, aspectRatio: String(aspect), willChange: 'transform, opacity'});
  return el;
}

export function runEffect(doc: Document, e: ExperienceV2, pack: CompiledPack, vars: Record<string, string>, motion: Motion): EffectHandle | null {
  const win = doc.defaultView, overlay = e.slots.overlay;
  if (!win || !doc.body || !overlay || !motionAllowed(win, motion) || !firstThisVisit(win, e.id)) return null;
  const layer = doc.createElement('div');
  layer.setAttribute('data-seed-overlay', overlay.effect);
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483000', overflow: 'hidden', contain: 'strict'});
  for (const [k, v] of Object.entries(vars)) layer.style.setProperty(k, v);
  const animations: Animation[] = [];
  if (overlay.effect === 'flyby') {
    const asset = pack.illustrations[overlay.asset];
    if (overlay.direction === 'rtl') layer.style.transform = 'scaleX(-1)';
    const sleigh = art(doc, asset.svg, asset.aspect, 'clamp(180px, 22vw, 320px)');
    Object.assign(sleigh.style, {top: '12%', left: '0'});
    layer.append(sleigh);
    animations.push(sleigh.animate([
      {transform: 'translate(-110%, 48px) rotate(5deg)'},
      {transform: 'translate(42vw, -6px) rotate(-2deg)', offset: 0.5},
      {transform: 'translate(calc(100vw + 40px), -44px) rotate(-7deg)'},
    ], {duration: overlay.durationMs, easing: 'cubic-bezier(.42,.05,.58,.95)', fill: 'forwards'}));
  } else {
    const asset = pack.particles[overlay.particle], next = random(e.id);
    const count = overlay.density === 'light' ? 18 : 34;
    for (let i = 0; i < count; i++) {
      const size = 10 + next() * 14;
      const flake = art(doc, asset.svg, asset.aspect, `${size.toFixed(1)}px`);
      Object.assign(flake.style, {top: '-32px', left: `${(next() * 100).toFixed(2)}vw`, opacity: '0'});
      layer.append(flake);
      const duration = Math.round(overlay.durationMs * (0.55 + next() * 0.45));
      const drift = (next() - 0.5) * 18, spin = (next() - 0.5) * 540;
      animations.push(flake.animate([
        {transform: 'translate(0, 0) rotate(0deg)', opacity: 0},
        {opacity: 0.95, offset: 0.12},
        {opacity: 0.95, offset: 0.8},
        {transform: `translate(${drift.toFixed(1)}vw, calc(100vh + 64px)) rotate(${spin.toFixed(0)}deg)`, opacity: 0},
      ], {duration, delay: Math.round((overlay.durationMs - duration) * next()), easing: 'linear', fill: 'forwards'}));
    }
  }
  doc.body.append(layer);
  const motionQuery = win.matchMedia('(prefers-reduced-motion: reduce)');
  const motionChange = () => { if (motionQuery.matches) cancel(); };
  const visibility = () => { for (const a of animations) doc.hidden ? a.pause() : a.play(); };
  let done = false;
  const cleanup = () => {
    if (done) return; done = true;
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('beforeprint', cancel);
    motionQuery.removeEventListener('change', motionChange);
    layer.remove();
  };
  function cancel() { for (const a of animations) a.cancel(); cleanup(); }
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('beforeprint', cancel);
  motionQuery.addEventListener('change', motionChange);
  visibility();
  const finished = Promise.all(animations.map(a => a.finished)).then(cleanup, cleanup);
  return {finished, cancel};
}
