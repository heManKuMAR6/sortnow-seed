# M1 design — theme packs, schema v2, bundle, renderer, effects

Status: **design for review**. No runtime code is in this PR. Owner: Claude. Reviewer: Codex. Decision maker: founder.
Milestone: M1 "Christmas and Black Friday" in the plan of record ([SEED_PROJECT_GUIDE.md](../SEED_PROJECT_GUIDE.md)).
Demo that ends M1: a realistic storefront where Santa flies past on desktop. It is previewed, approved, active on schedule, restored afterwards, and shows a static fallback under reduced motion.

## 1. Goals and non-goals

Goals:
- An occasion changes a site **visibly and gracefully**: illustrations, icons, decorations, and one tasteful effect, not only colours.
- Artwork matches **any brand** without generating images.
- Everything stays **data in config, code in the package**. Approval still binds exactly what the owner saw.
- Schema v1 experiences, brand files, approvals, and the React `SeedArea` keep working unchanged.

Non-goals for M1: the web component (M2), occasion calendar data (M3), brand import (M4), AI (M5), mobile effects (static fallback only), custom uploaded artwork, server delivery, signatures.

## 2. Where this fits

```text
Pack source (repo: packs/<id>/)          Owner config (host repo)
  pack.json + SVG files                    brand.json      (extended, backward compatible)
        │ build-packs (sanitize, hash)      seed.bundle.json (experiences, v1 and v2)
        ▼                                   approvals.json  (unchanged: exact snapshots)
  compiled packs inside @sortnow/seed              │
        │                                          ▼
        └──────────────► core: validate → approve → schedule → select (one winner per page)
                                                   │
                                                   ▼
                          renderer (new, framework-neutral DOM):
                          slots → palette variables → illustrations/icons/decorations → overlay effect
                                                   │
                          adapters: React SeedArea (now), <seed-area> web component (M2)
```

## 3. Decision: theme packs are package code, config only references them

A pack is authored as `packs/<id>/pack.json` plus SVG files. A build step (`scripts/build-packs.mjs`) sanitizes and hashes it, then emits `packages/packs/<id>.ts`, which ships inside the npm package.

Why: config never carries markup, so the "configuration is data, never executable code" rule holds. Artwork is reviewed in PRs like any code. A site can only show artwork that shipped in the package version it installed.

### Pack manifest (`pack.json`, packVersion 1)

```jsonc
{
  "packVersion": 1,
  "id": "christmas",                  // ^[a-z][a-z0-9-]{0,31}$
  "version": "1.0.0",                 // semver of this pack's content
  "name": "Christmas",
  "occasions": ["christmas"],         // for M3's calendar suggestions; informational in M1
  "license": "CC0-1.0",               // every asset original or CC0; source recorded below
  "signatureColors": { "santa-red": "#c8102e", "gold": "#d4a017" },
  "illustrations": {
    "santa-sleigh": { "file": "santa-sleigh.svg", "label": "Santa's sleigh", "source": "original, SortNow" }
  },
  "icons":       { "gift": { "file": "gift.svg", "label": "Gift" } },
  "decorations": { "holly-corner": { "file": "holly-corner.svg" } },
  "particles":   { "snowflake": { "file": "snowflake.svg" } },
  "copy": {
    "hero":   ["Wishing you a warm holiday season."],
    "banner": ["Happy holidays from all of us."]
  },
  "effects": {
    "flyby":     { "assets": ["santa-sleigh"] },
    "particles": { "assets": ["snowflake"] }
  }
}
```

Copy templates are suggestions for authoring only. The runtime shows the experience's own approved text. Packs never contain prices, discounts, legal claims, or links.

### Brand tinting (the core trick)

SVG `fill` and `stroke` values may only be:
- `var(--seed-background)`, `var(--seed-foreground)`, `var(--seed-accent)` — brand roles;
- `var(--seed-sig-<name>)` — a pack signature colour (Santa's red), see brand policy below;
- `none`, `currentColor`.

Hex literals are rejected by the build. So one illustration renders in each site's palette. Signature colours keep icons recognisable (a blue Santa is wrong), but the brand decides whether they may appear.

### SVG sanitizer (build time, allowlist)

- Elements: `svg g path circle ellipse rect line polyline polygon defs linearGradient radialGradient stop title`.
- Attributes: geometry (`d cx cy r rx ry x y x1 y1 x2 y2 width height points viewBox transform`), paint as above, `opacity fill-opacity stroke-width stroke-linecap stroke-linejoin gradientUnits offset stop-color id` (ids are rewritten with a per-asset prefix to avoid page collisions).
- Rejected: `script`, `style`, `foreignObject`, `image`, `use` with external references, any `on*` attribute, `href`/`xlink:href` other than local `#id`, `url(` other than local gradient ids, and comments or processing instructions.
- Limits: 12 KB per file before compression, 30 KB per pack after gzip.
- Output: a canonical serialized string plus `sha256` per asset and a pack hash over the canonical manifest and assets.

The renderer inserts only these package-shipped strings, never strings from config.

## 4. Decision: experience schema v2

The current `validateExperience` dispatches on `schemaVersion`. v1 is unchanged.

```jsonc
{
  "schemaVersion": 2,
  "id": "christmas-20261201-america-new-york",
  "startsAt": "2026-12-01T05:00:00.000Z",
  "endsAt": "2026-12-26T05:00:00.000Z",
  "priority": 10,
  "pack": { "id": "christmas", "version": "1.0.0", "hash": "sha256-…" },
  "palette": { "background": "#e7eee4", "foreground": "#1d3029", "accent": "#7a4e23" },
  "signatureColors": ["santa-red"],     // subset of pack.signatureColors the owner chose
  "slots": {
    "banner":  { "message": "Happy holidays from all of us.", "icon": "gift" },
    "hero":    { "message": "Wishing you a warm holiday season.", "illustration": "santa-sleigh", "placement": "end" },
    "accent":  { "decoration": "holly-corner", "corner": "top-end" },
    "overlay": { "effect": "flyby", "asset": "santa-sleigh", "direction": "ltr", "durationMs": 4000 }
  }
}
```

Rules:
- At least one slot. Each slot is optional, so there are no `areas`; the declared slots are the areas.
- `message` uses the existing plain-text rules (1–240 characters).
- `icon`, `illustration`, `decoration`, and `asset` must exist in the referenced pack, of the right kind.
- `placement`: `start | end | background`. `corner`: `top-start | top-end | bottom-start | bottom-end`.
- `overlay` (at most one effect per experience):
  - `flyby`: `asset` (an illustration listed in the pack's flyby assets), `direction` `ltr | rtl`, `durationMs` 2000–6000.
  - `particles`: `particle` (a pack particle), `density` `light | medium`, `durationMs` 3000–8000.
- Unknown fields anywhere are rejected (`UNKNOWN_FIELD`), as in v1.
- **Snapshot** remains the canonical JSON of the validated value. It includes `pack.version` and `pack.hash`, so a package upgrade that changes artwork invalidates approval.

**Pack mismatch fails closed.** If the installed package does not contain the exact pack id, version, and hash, the experience is not rendered. Selection reports `PACK_MISMATCH` and the base site shows. Upgrading artwork therefore requires re-approval, which is the intended guarantee: you see what you approved.

## 5. Decision: one coherent winner per page

v1 selects independently per area. For v2, the renderer selects **one** experience for the whole page: the highest-priority approved, active, brand-allowed, pack-resolvable one. That experience fills every slot it declares, and the other slots keep base content. This prevents a Black Friday banner from mixing with a Christmas hero.

v1 experiences keep their per-area behaviour. When v1 and v2 are both active, the v2 winner takes the slots it declares, and v1 continues to compete only for `banner` and `hero` slots the v2 winner leaves empty. This keeps existing sites unchanged until they adopt v2.

## 6. Decision: brand policy extension (backward compatible)

New optional fields in `brand.json`:

```jsonc
{
  "allowedSlots": ["banner", "hero", "accent", "overlay"], // default: allowedAreas
  "effects": "off",                // "off" (default) | "on": effects are opt-in by the integrator
  "signatureColors": "allow"       // "allow" | "deny" (default "deny": fall back to accent)
}
```

The veto stays a veto. An experience is not rendered if it uses a slot outside `allowedSlots`, uses an overlay while `effects` is `off`, uses signature colours while they are denied, or has palette values that fail the existing v1 rules. Existing brand files without these fields validate as before. Effects and signature colours are off until the integrator turns them on.

## 7. Decision: the renderer (`@sortnow/seed/render`, framework-neutral)

```ts
mountSeed({
  root: document,                 // where to find slots
  experiences, approvals, brand,  // the same inputs as today
  now?: number,                   // fixed preview clock; omit for live
}): { update(now?: number): void; destroy(): void }
```

- **Slots in the host page:** `<div data-seed-slot="hero">…existing content…</div>`. The integrator marks them once. There is never a logo slot. Base content is never removed.
- **Palette:** sets `--seed-background/foreground/accent` and `--seed-sig-*` on each active slot element, never on `:root`. This matches today's scoped variables.
- **Additions:** the renderer appends its own elements (`<span data-seed-part="illustration">`, icon, message, decoration). On restore it removes exactly what it added. Decorative art is `aria-hidden="true"` and messages are real text.
- **Overlay:** one fixed `div` appended to `body` with `pointer-events: none`, `contain: strict`, `position: fixed; inset: 0`, and a high `z-index`. It is removed when the effect ends. It never shifts layout.
- **SSR:** unchanged rule. The server and first client render show base content, and the renderer activates after mount.
- **React:** `SeedArea` stays as it is in M1. The playground demo uses `mountSeed` through a ref. M2 rebuilds `SeedArea` and adds `<seed-area>` on the same renderer.

## 8. Decision: effects library (M1: flyby and particles)

Effects are implemented with the Web Animations API on SVG elements. There is no canvas, no timers driving layout, and no dependency.

| Rule | Value |
| --- | --- |
| Effects per page view | at most 1, from the winning experience |
| Frequency | once per visit (`sessionStorage`, wrapped in try/catch; if storage fails, run once per page load) |
| Duration | flyby 2–6 s, particles 3–8 s, then the overlay is removed |
| Interaction | `pointer-events: none`; never blocks clicks, focus, or scrolling |
| Reduced motion | `prefers-reduced-motion: reduce` → no animation; the static hero illustration and decoration only |
| Device | desktop first: runs only when `(min-width: 1024px) and (pointer: fine)` matches; otherwise static fallback |
| Hidden page | pauses on `visibilitychange`, finishes or cancels on return |
| Particles | 40 elements or fewer; transform and opacity animation only |
| Flashing | nothing flashes more than 3 times per second |
| Print | overlay and decorations hidden under `@media print` |
| Budget | renderer plus effects ≤ 8 KB gzip; no long task over 50 ms; layout shift 0 |

## 9. Decision: the bundle file

`seed.bundle.json` is what authoring produces and what a host commits (and, later, what the enterprise backend serves):

```jsonc
{ "bundleVersion": 1, "experiences": [ /* v1 and/or v2 experiences */ ] }
```

- Approvals stay in a separate host-owned file of exact snapshots. A bundle never carries approvals, so a downloaded or generated bundle cannot approve itself.
- Pack assets are not copied into the bundle. They are referenced by id, version, and hash and ship in the package.
- The draft export from PR #7 writes a bundle containing one experience. `seed validate` accepts a bundle as well as single experiences.
- `bundleVersion` 2 is reserved for later server delivery: custom assets with hashes, signatures, and server time. M1 rejects unknown fields rather than accept a signature it cannot verify.

## 10. Authoring and agent surface

- `authorExperience` gains optional `pack` and `slots` input. With them it emits a v2 draft, and without them it emits v1 exactly as today. Palette resolution and locked tokens are unchanged.
- New read-only CLI commands: `seed packs` (list) and `seed pack ID` (assets, effects, copy, signature colours). `seed schema experience` exports the v2 schema too.
- Still no approve or publish command.

## 11. M1 packs

| Pack | Illustrations | Icons | Decorations | Particles | Effect in the demo |
| --- | --- | --- | --- | --- | --- |
| christmas | santa-sleigh, tree, gift-stack | gift, star, snowflake | holly-corner | snowflake | flyby: Santa crossing the page |
| black-friday | shopping-bag, price-tag | tag, bag, bolt | ribbon-corner | confetti | particles: brief confetti |

The artwork is original SVG, drawn for brand tinting. The founder reviews the artwork before M1 is called done, and any asset can be replaced by commissioned art without schema changes.

## 12. Delivery plan (after this design is approved)

1. **PR A — core:** schema v2 validation, snapshot, page-level selection, `PACK_MISMATCH`, brand extension, bundle validation, JSON Schemas, CLI `packs`/`pack`. Tests: v1 unchanged, v2 rejection paths, snapshot changes on any pack/slot edit, mismatch fails closed, brand vetoes.
2. **PR B — packs:** `build-packs` sanitizer and hashing, the christmas and black-friday packs. Tests: sanitizer rejects every forbidden construct, hashes are deterministic, packs stay within budget.
3. **PR C — renderer, effects, demo:** `mountSeed`, flyby, particles, a storefront page in the playground, and browser tests. The browser tests cover approve → effect runs once → reduced-motion fallback → expiry restores the base with no leftover nodes → no console or CSP errors.
4. **Grokbot (when assigned):** performance budget, layout shift, and reduced-motion checks on the PR C demo.

Each PR updates the guide. Targeted tests only, per the owner's preference.

## 13. Open questions for review

1. **Page-level winner (section 5):** agree, or keep per-slot selection?
2. **Signature colours:** is "deny by default, brand opt-in" right, or should packs never carry fixed colours?
3. **Packs in the main package or `@sortnow/seed-packs`?** The proposal is the main package for M1 and splitting when there are more than a few packs.
4. **v1/v2 coexistence rules (section 5):** acceptable, or should v2 hosts drop v1 entirely?
5. **Effects default `off` in brand policy:** the proposal is that integrators opt in once, then owners choose per experience.

## 14. Security and privacy review notes

- Config still carries no HTML, CSS, URLs, or code. The new fields are ids and enumerations validated against compiled packs.
- Package artwork is sanitized at build, hashed, and pinned by approved experiences. It is inserted only from package memory.
- The overlay cannot capture input. The renderer only removes nodes it created. No network requests, no telemetry.
- `sessionStorage` holds one boolean key per experience id and nothing personal.
- Known limit, unchanged: same-origin code can bypass client behaviour, and snapshots are not authentication.
