/**
 * Framework-neutral custom elements. One script tag works in plain HTML, Angular, Vue, Svelte, and
 * platform themes such as Shopify, because every framework can render custom elements and data attributes.
 *
 *   <seed-root bundle="/seed/seed.bundle.json" approvals="/seed/approvals.json" brand="/seed/brand.json"></seed-root>
 *   <section data-seed-slot="hero accent">…your hero…</section>       (or wrap it: <seed-area slots="hero">)
 *
 * Configuration is loaded only from the page's own origin, or from inline
 * <script type="application/json" data-seed="bundle|approvals|brand"> children. Any problem fails closed:
 * the site keeps its base design and the element reports data-state="error".
 */
import {mountSeed, type Motion, type SeedMount} from '../render/index.js';
import {validateBundle, validateBrand, type CompiledPack, type Diagnostic} from '../core/index.js';
import {packs as installedPacks} from '../packs/index.js';

export interface SeedConfig { experiences: readonly unknown[]; approvals: readonly string[]; brand: unknown }
const MAX_JSON = 256 * 1024;
const owners = new WeakMap<Document, SeedRootElement>();

/** Resolves a configuration URL and accepts it only on the page's own origin over http(s). */
export function sameOriginUrl(value: string, base: string, pageUrl = base): string | null {
  try {
    const url = new URL(value, base), page = new URL(pageUrl);
    return url.origin === page.origin && (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}
/** Checks loaded configuration. Approvals must be exact snapshot strings from a reviewed file. */
export function checkConfig(bundle: unknown, approvals: unknown, brand: unknown): {ok: true; config: SeedConfig} | {ok: false; errors: Diagnostic[]} {
  const b = validateBundle(bundle);
  if (!b.ok) return {ok: false, errors: b.errors.map(e => ({...e, path: `bundle.${e.path}`}))};
  if (!Array.isArray(approvals) || approvals.length > 100 || !approvals.every(a => typeof a === 'string'))
    return {ok: false, errors: [{path: 'approvals', code: 'APPROVALS', message: 'Approvals must be an array of at most 100 exact snapshot strings.'}]};
  const policy = validateBrand(brand);
  if (!policy.ok) return {ok: false, errors: policy.errors.map(e => ({...e, path: `brand.${e.path}`}))};
  return {ok: true, config: {experiences: b.value.experiences, approvals: [...approvals], brand: policy.value}};
}

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement;

export class SeedRootElement extends Base {
  static observedAttributes = ['preview-at', 'motion', 'bundle', 'approvals', 'brand'];
  #mount: SeedMount | null = null;
  #config: SeedConfig | null = null;
  #packs: readonly CompiledPack[] = installedPacks;
  #generation = 0;

  /** For frameworks that import configuration directly instead of loading files. */
  set config(value: SeedConfig | null) {
    this.#generation++;
    if (value === null) { this.#config = null; this.#stop(); this.setAttribute('data-state', 'base'); return; }
    const checked = checkConfig({bundleVersion: 1, experiences: value?.experiences}, value?.approvals, value?.brand);
    if (!checked.ok) { this.#error(checked.errors); return; }
    this.#config = checked.config; this.#apply();
  }
  get config() { return this.#config; }
  set packs(value: readonly CompiledPack[]) { this.#packs = value; this.#mount?.destroy(); this.#mount = null; this.#apply(); }
  get packs() { return this.#packs; }
  get current() { return this.#mount?.current?.id ?? null; }
  replay() { this.#mount?.replay(); }

  connectedCallback() {
    this.hidden = true;
    if (this.#config) this.#apply(); else void this.#load();
  }
  disconnectedCallback() { this.#generation++; this.#stop(); }
  attributeChangedCallback(name: string) {
    if (['bundle', 'approvals', 'brand'].includes(name)) {
      if (this.isConnected) { this.#config = null; void this.#load(); }
    } else this.#mount?.update({now: this.#now(), motion: this.#motion()});
  }
  #stop() {
    this.#mount?.destroy(); this.#mount = null;
    if (owners.get(this.ownerDocument) === this) owners.delete(this.ownerDocument);
  }

  #now(): number | undefined {
    const value = this.getAttribute('preview-at');
    // An unreadable preview time fails closed (no experience) rather than falling back to the live clock.
    return value === null ? undefined : Date.parse(value);
  }
  #motion(): Motion { return this.getAttribute('motion') === 'reduce' ? 'reduce' : 'auto'; }

  async #load() {
    const generation = ++this.#generation;
    this.#stop(); this.setAttribute('data-state', 'base');
    try {
      const doc = this.ownerDocument, base = doc.baseURI;
      const read = async (name: string): Promise<unknown> => {
        const inline = this.querySelector(`script[type="application/json"][data-seed="${name}"]`);
        if (inline) {
          const text = inline.textContent ?? '';
          if (new TextEncoder().encode(text).byteLength > MAX_JSON) return fail(`${name} exceeds ${MAX_JSON} bytes.`);
          return JSON.parse(text);
        }
        const src = this.getAttribute(name);
        if (src === null) return fail(`Provide a ${name} attribute or inline JSON.`);
        const href = sameOriginUrl(src, base, doc.URL);
        if (!href) return fail(`Only same-origin configuration is loaded: ${src}`);
        const response = await fetch(href, {credentials: 'same-origin', mode: 'same-origin', redirect: 'error', headers: {Accept: 'application/json'}});
        if (!response.ok) return fail(`Could not load ${src} (${response.status}).`);
        const text = await boundedText(response, src);
        return JSON.parse(text);
      };
      const [bundle, approvals, brand] = await Promise.all([read('bundle'), read('approvals'), read('brand')]);
      if (generation !== this.#generation || !this.isConnected) return;
      const checked = checkConfig(bundle, approvals, brand);
      if (!checked.ok) return this.#error(checked.errors);
      this.#config = checked.config;
      this.#apply();
    } catch (error) {
      if (generation === this.#generation) this.#error([{path: '$', code: 'LOAD', message: error instanceof Error ? error.message : 'Unable to load configuration.'}]);
    }
  }
  #apply() {
    if (!this.isConnected || !this.#config) return;
    const {experiences, approvals, brand} = this.#config;
    if (this.#mount) { this.#mount.update({experiences, approvals, brand, now: this.#now(), motion: this.#motion()}); return; }
    // Defer one microtask so slots parsed or upgraded in the same pass are present.
    queueMicrotask(() => {
      if (this.#mount || !this.isConnected || this.#config === null) return;
      const owner = owners.get(this.ownerDocument);
      if (owner && owner !== this) return this.#error([{path: '$', code: 'DUPLICATE_ROOT', message: 'Only one seed-root may control a document.'}]);
      owners.set(this.ownerDocument, this);
      const c = this.#config;
      this.#mount = mountSeed({root: this.ownerDocument, experiences: c.experiences, approvals: c.approvals, brand: c.brand, packs: this.#packs, now: this.#now(), motion: this.#motion(),
        onChange: ({experience, errors}) => {
          this.setAttribute('data-state', experience ? 'active' : 'base');
          this.dispatchEvent(new CustomEvent('seed-change', {bubbles: true, detail: {experience: experience?.id ?? null, errors}}));
        }});
    });
  }
  #error(errors: Diagnostic[]) {
    this.#config = null; this.#stop();
    this.setAttribute('data-state', 'error');
    this.dispatchEvent(new CustomEvent('seed-error', {bubbles: true, detail: {errors}}));
  }
}
async function boundedText(response: Response, source: string): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_JSON) { await reader.cancel(); return fail(`${source} exceeds ${MAX_JSON} bytes.`); }
      text += decoder.decode(value, {stream: true});
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
function fail(message: string): never { throw new Error(message); }

/** Optional wrapper for markup you cannot add attributes to. Prefer data-seed-slot on your own element. */
export class SeedAreaElement extends Base {
  static observedAttributes = ['slots'];
  connectedCallback() { if (!this.style.display) this.style.display = 'block'; this.#sync(); }
  attributeChangedCallback() { this.#sync(); }
  #sync() { const slots = this.getAttribute('slots'); slots ? this.setAttribute('data-seed-slot', slots) : this.removeAttribute('data-seed-slot'); }
}

export function defineSeedElements(registry: CustomElementRegistry = customElements) {
  if (!registry.get('seed-root')) registry.define('seed-root', SeedRootElement);
  if (!registry.get('seed-area')) registry.define('seed-area', SeedAreaElement);
}
