# Using SEED on any platform

SEED needs two things from a site: the places it may decorate, and the reviewed configuration.

- **Slots:** add `data-seed-slot` to elements you already have: `banner`, `hero`, `accent` (corner decoration), or several separated by spaces. The overlay effect needs no slot. There is never a logo slot. If you cannot add attributes, wrap the markup in `<seed-area slots="hero">`.
- **Configuration:** a bundle (`seed.bundle.json` from the playground; `seed author` returns an authoring result whose experience must be placed in a bundle), the approvals file (exact snapshots, written only after owner review), and `brand.json`.

The base page is never removed. If anything is missing or wrong, the site keeps its normal design.

| Platform | How | Exercised in this repository |
| --- | --- | --- |
| Plain HTML | `<script type="module" src="seed-element.js">` + `<seed-root>` | Yes: `examples/plain-html`, browser tests |
| React | `SeedRoot` from `sortnow-seed/react` | Yes: playground pack preview, browser tests |
| Angular | Custom elements | Snippet only, not run here |
| Vue | Custom elements | Snippet only, not run here |
| Shopify themes | Theme asset + inline JSON | Snippet only, not run here |

## Plain HTML (no build step)

Copy `node_modules/sortnow-seed/dist/seed-element.js` next to your pages. It is about 21 KB gzipped, with no framework and no dependencies, and includes the installed packs.

```html
<script type="module" src="/seed-element.js"></script>

<seed-root bundle="/seed/seed.bundle.json" approvals="/seed/approvals.json" brand="/seed/brand.json"></seed-root>

<div data-seed-slot="banner"></div>
<section class="hero" data-seed-slot="hero accent">…your existing hero…</section>
```

- Configuration URLs must be on the page's own origin; anything else is refused.
- `<seed-root>` reports `data-state="active" | "base" | "error"` and fires `seed-change` and `seed-error` events.
- `preview-at="2026-12-12T18:00:00.000Z"` fixes the clock for previews. Omit it on a live site.
- `motion="reduce"` forces the static version.

Your CSS can use the theme colours: `background: var(--seed-accent, #a8462b)` falls back to your own colour when no theme is active.

## React

```jsx
import {SeedRoot} from 'sortnow-seed/react';
import {packs} from 'sortnow-seed/packs';
import bundle from './seed/seed.bundle.json';
import approvals from './seed/approvals.json';
import brand from './seed/brand.json';

<SeedRoot experiences={bundle.experiences} approvals={approvals} packs={packs} brand={brand} />
<section className="hero" data-seed-slot="hero accent">…</section>
```

- Server rendering and the first client render show the base page; SEED activates after mount.
- Slots that mount later, for example on route changes, are decorated automatically.
- Mark containers whose children are elements, not a single text node that React may replace.
- The older `SeedArea` component still serves colour-only (v1) experiences.

## Angular (not run here)

```ts
// main.ts
import 'sortnow-seed/seed-element.js';

// The component or module that uses the tags
@Component({ ..., schemas: [CUSTOM_ELEMENTS_SCHEMA] })
```

```html
<seed-root bundle="assets/seed/seed.bundle.json" approvals="assets/seed/approvals.json" brand="assets/seed/brand.json"></seed-root>
<section class="hero" data-seed-slot="hero accent">…</section>
```

For configuration you import in TypeScript, set it as a property instead: `rootEl.config = {experiences, approvals, brand}`.

## Vue (not run here)

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: tag => tag.startsWith('seed-') } } })
// main.js
import 'sortnow-seed/seed-element.js';
```

## Shopify themes (not run here)

1. Upload `seed-element.js` to the theme's **assets**.
2. In `layout/theme.liquid`, before `</head>`, add `<script type="module" src="{{ 'seed-element.js' | asset_url }}"></script>`.
3. Paste the reviewed configuration inline. Shopify serves assets from its CDN, so inline JSON avoids cross-origin files:

```liquid
<seed-root>
  <script type="application/json" data-seed="bundle">{% render 'seed-bundle' %}</script>
  <script type="application/json" data-seed="approvals">{% render 'seed-approvals' %}</script>
  <script type="application/json" data-seed="brand">{% render 'seed-brand' %}</script>
</seed-root>
```

4. Add `data-seed-slot="hero accent"` to the hero section's wrapper, and `data-seed-slot="banner"` to the announcement bar.

The `seed-*` snippets must contain **HTML-safe serialized JSON**, not the JSON files pasted unchanged. Even in `type="application/json"`, the HTML parser treats a literal `</script>` inside a message as the end of the element, before SEED can validate it. This applies to bundles, brands, and approvals alike.

When generating a snippet from a parsed JSON value, serialize it and escape every `<` as a JSON Unicode escape:

```js
const htmlSafeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
```

Use the resulting text as the snippet body. Do not HTML-entity-encode it (`&quot;` does not decode inside a script element). JSON parsing restores the original message and snapshot bytes, so approval matching is unchanged. Prefer same-origin JSON files or the `config` property when possible. Changing the bundle or artwork requires a new owner approval.
