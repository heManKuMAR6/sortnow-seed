/**
 * Framework-neutral renderer for schema v2. Finds host-marked slots, applies the winning experience,
 * and restores exactly what it changed. Adapters (React now, <seed-area> in M2) build on this.
 *
 * Host markup:  <div data-seed-slot="hero accent">…existing content…</div>
 * Base content is never removed. There is never a logo slot.
 */
import {selectPage, type CompiledPack, type Diagnostic, type ExperienceV2} from '../core/index.js';
import {runEffect, forgetEffect, type EffectHandle, type Motion} from './effects.js';
export {motionAllowed, type Motion} from './effects.js';

export interface MountOptions {
  root?: Document | Element;
  experiences: readonly unknown[];
  /** Exact snapshots from trusted host configuration. Never derive these from drafts. */
  approvals: readonly string[];
  packs: readonly CompiledPack[];
  brand?: unknown;
  /** Fixed clock for previews; omit for live mode. */
  now?: number;
  /** 'reduce' forces the static fallback; 'auto' follows the visitor's settings and screen. */
  motion?: Motion;
  onChange?: (state: {experience: ExperienceV2 | null; errors: Diagnostic[]}) => void;
  /** Decorate slots that appear after mounting (single-page app routes, late templates). Default true. */
  watch?: boolean;
}
export interface SeedMount {
  update(next?: Partial<Pick<MountOptions, 'experiences' | 'approvals' | 'now' | 'motion' | 'brand'>>): void;
  /** Plays the current experience's effect again (preview tooling). */
  replay(): void;
  /** Decorates any slots that were added since the last pass. Rarely needed: new slots are watched by default. */
  refresh(): void;
  destroy(): void;
  readonly current: ExperienceV2 | null;
}

const CORNER: Record<string, {top?: string; bottom?: string; start?: boolean; flip: string}> = {
  'top-end': {top: '0', flip: 'none'}, 'top-start': {top: '0', start: true, flip: 'scaleX(-1)'},
  'bottom-end': {bottom: '0', flip: 'scaleY(-1)'}, 'bottom-start': {bottom: '0', start: true, flip: 'scale(-1, -1)'},
};

export function mountSeed(options: MountOptions): SeedMount {
  const opts = {...options, motion: options.motion ?? 'auto'};
  const root = opts.root ?? document;
  const doc = (root as Element).ownerDocument ?? (root as Document);
  const undo: (() => void)[] = [];
  let key = '', current: ExperienceV2 | null = null, effect: EffectHandle | null = null, timer: ReturnType<typeof setInterval> | undefined;
  let active: {e: ExperienceV2; pack: CompiledPack; vars: Record<string, string>} | null = null, pending = false;

  const restore = () => {
    effect?.cancel(); effect = null;
    while (undo.length) undo.pop()!();
    current = null; active = null;
  };
  const setStyle = (el: HTMLElement, prop: string, value: string) => {
    const before = el.style.getPropertyValue(prop), priority = el.style.getPropertyPriority(prop), hadStyle = el.hasAttribute('style');
    el.style.setProperty(prop, value);
    undo.push(() => {
      before ? el.style.setProperty(prop, before, priority) : el.style.removeProperty(prop);
      if (!hadStyle && !el.getAttribute('style')) el.removeAttribute('style');
    });
  };
  const setAttr = (el: Element, name: string, value: string) => {
    const before = el.getAttribute(name);
    el.setAttribute(name, value);
    undo.push(() => before === null ? el.removeAttribute(name) : el.setAttribute(name, before));
  };
  const add = (parent: Element, child: Element, first = false) => {
    first ? parent.prepend(child) : parent.append(child);
    undo.push(() => child.remove());
  };
  const positioned = (el: HTMLElement) => { if (doc.defaultView?.getComputedStyle(el).position === 'static') setStyle(el, 'position', 'relative'); };
  const part = (name: string, tag = 'span') => { const el = doc.createElement(tag); el.setAttribute('data-seed-part', name); return el; };
  const art = (name: string, asset: {svg: string; aspect: number}) => {
    const el = part(name);
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = asset.svg; // package-shipped, sanitized, and hashed at build time
    Object.assign(el.style, {display: 'block', aspectRatio: String(asset.aspect), pointerEvents: 'none'});
    return el;
  };

  const slotsIn = (scope: ParentNode) => Array.from(scope.querySelectorAll<HTMLElement>('[data-seed-slot]'));
  /** Decorates slots the current experience has not touched yet. Safe to call repeatedly. */
  function decorateNew() {
    pending = false;
    if (!active) return;
    for (const el of slotsIn(root)) if (el.getAttribute('data-seed-experience') !== active.e.id) decorate(el, active.e, active.pack, active.vars);
  }
  function render(e: ExperienceV2, pack: CompiledPack) {
    const vars: Record<string, string> = {'--seed-background': e.palette.background, '--seed-foreground': e.palette.foreground, '--seed-accent': e.palette.accent};
    // Signature colours the experience did not choose (or the brand denied) fall back to the brand accent.
    for (const [name, hex] of Object.entries(pack.signatureColors)) vars[`--seed-sig-${name}`] = e.signatureColors.includes(name) ? hex : e.palette.accent;
    active = {e, pack, vars};
    for (const el of slotsIn(root)) decorate(el, e, pack, vars);
    effect = runEffect(doc, e, pack, vars, opts.motion);
  }
  function decorate(el: HTMLElement, e: ExperienceV2, pack: CompiledPack, vars: Record<string, string>) {
    {
      const names = (el.getAttribute('data-seed-slot') ?? '').split(/\s+/);
      const used = names.filter(n => n === 'banner' || n === 'hero' || n === 'accent').filter(n => e.slots[n as 'banner'] !== undefined);
      if (!used.length) return;
      setAttr(el, 'data-seed-experience', e.id);
      for (const [k, v] of Object.entries(vars)) setStyle(el, k, v);
      const tint = el.getAttribute('data-seed-mode') !== 'variables';
      if (tint && (used.includes('banner') || used.includes('hero'))) { setStyle(el, 'background-color', e.palette.background); setStyle(el, 'color', e.palette.foreground); }
      if (used.includes('banner')) {
        const s = e.slots.banner!, bar = part('banner', 'div');
        Object.assign(bar.style, {display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', fontWeight: '600', borderBottom: `3px solid ${e.palette.accent}`});
        if (s.icon) { const icon = art('icon', pack.icons[s.icon]); Object.assign(icon.style, {width: '1.25em', flex: 'none'}); bar.append(icon); }
        const text = doc.createElement('span'); text.textContent = s.message; bar.append(text);
        add(el, bar, true);
      }
      if (used.includes('hero')) {
        const s = e.slots.hero!;
        if (s.message) {
          const msg = part('message', 'p'); msg.textContent = s.message;
          Object.assign(msg.style, {margin: '0 0 0.75rem', fontWeight: '600', color: e.palette.accent, position: 'relative', zIndex: '1'});
          add(el, msg, true);
        }
        if (s.illustration) {
          positioned(el);
          // Narrow heroes have no free side, so the artwork becomes a faint background instead of covering text.
          const place = el.getBoundingClientRect().width < 640 ? 'background' : s.placement ?? 'end';
          const ill = art('illustration', pack.illustrations[s.illustration]);
          Object.assign(ill.style, place === 'background'
            ? {position: 'absolute', left: '50%', top: '50%', width: 'min(70%, 560px)', transform: 'translate(-50%, -50%)', opacity: '0.16', zIndex: '0'}
            : {position: 'absolute', bottom: '8%', [place === 'end' ? 'insetInlineEnd' : 'insetInlineStart']: '4%', width: 'min(34%, 340px)', zIndex: '0'});
          add(el, ill);
        }
      }
      if (used.includes('accent')) {
        positioned(el);
        const s = e.slots.accent!, c = CORNER[s.corner], deco = art('decoration', pack.decorations[s.decoration]);
        Object.assign(deco.style, {position: 'absolute', width: 'clamp(72px, 11vw, 140px)', transform: c.flip, zIndex: '1'});
        if (c.top) deco.style.top = c.top; else deco.style.bottom = c.bottom!;
        deco.style.setProperty(c.start ? 'inset-inline-start' : 'inset-inline-end', '0');
        add(el, deco);
      }
    }
  }
  // New slots (route changes, late templates) are decorated in place without restarting the effect.
  const ownNode = (n: Node) => n instanceof Element && (n.hasAttribute('data-seed-part') || n.hasAttribute('data-seed-overlay') || !!n.closest('[data-seed-part]'));
  const observer = opts.watch !== false && typeof MutationObserver !== 'undefined' ? new MutationObserver(records => {
    if (!active || pending) return;
    const fresh = records.some(r => r.type === 'attributes'
      ? (r.target as Element).hasAttribute('data-seed-slot')
      : Array.from(r.addedNodes).some(n => n instanceof Element && !ownNode(n) && (n.hasAttribute('data-seed-slot') || !!n.querySelector('[data-seed-slot]'))));
    if (fresh) { pending = true; queueMicrotask(decorateNew); }
  }) : null;
  observer?.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-seed-slot']});

  function apply() {
    const now = opts.now ?? Date.now();
    const sel = selectPage(opts.experiences, opts.approvals, now, {packs: opts.packs, brand: opts.brand});
    const next = sel.experience ? JSON.stringify(sel.experience) + opts.motion : '';
    if (next !== key) {
      restore();
      key = next;
      if (sel.experience && sel.pack) { current = sel.experience; render(sel.experience, sel.pack); }
    }
    opts.onChange?.({experience: current, errors: sel.errors});
  }
  const live = () => {
    clearInterval(timer); timer = undefined;
    doc.removeEventListener('visibilitychange', apply);
    if (opts.now === undefined) { timer = setInterval(apply, 1000); doc.addEventListener('visibilitychange', apply); }
  };
  live(); apply();
  return {
    update(next = {}) { Object.assign(opts, next); if ('now' in next) live(); apply(); },
    replay() {
      if (!current || !doc.defaultView) return;
      forgetEffect(doc.defaultView, current.id);
      key = ''; apply();
    },
    refresh() { decorateNew(); },
    destroy() { observer?.disconnect(); clearInterval(timer); doc.removeEventListener('visibilitychange', apply); restore(); key = ''; },
    get current() { return current; },
  };
}
