# Changelog

All notable changes to `@sortnow/seed`. This project is pre-1.0: minor versions may change contracts, and every change that affects stored experiences or approvals is called out.

## 0.2.0-alpha.0 (unreleased)

Everything below was merged to `develop` between 2026-11-05 and 2026-11-08.

### Added
- **Theme packs** (`@sortnow/seed/packs`): Christmas, Black Friday, New Year, Diwali, Lunar New Year, Valentine's Day, Eid, Halloween, and Celebration. Original CC0 artwork, tinted with each site's brand colours, sanitized and hashed at build time.
- **Schema v2** experiences with slots (banner, hero, accent, overlay), pack pinning by id, version, and hash, and page-level selection. A changed pack fails closed until re-approved.
- **Renderer** (`@sortnow/seed/render`): framework-neutral `mountSeed`. It decorates slots, including ones that appear later, and restores exactly what it changed.
- **Effects**: fly-by and particles. They play once per visit, never take input, and are skipped for reduced motion and on small or touch screens.
- **Any website**: `<seed-root>` and `<seed-area>` custom elements in one self-contained `dist/seed-element.js` (about 21 KB gzipped), plus React `SeedRoot`.
- **Authoring** (`@sortnow/seed/authoring`): calendar authoring with IANA time zones, pack-based drafts with defaults, the occasion catalogue for US, IN, AE, and SG, the planner, and yearly re-planning.
- **Brand onboarding**: `importBrand` and `seed init FILE` read colours from CSS or design tokens and propose a brand policy.
- **Optional AI drafting** (`@sortnow/seed/ai`, `seed ai-draft`): a Claude model proposes a design constrained to installed packs. Needs the optional `@anthropic-ai/sdk` peer and the owner's own credentials.
- **CLI**: `author`, `samples`, `occasions`, `plan`, `replan`, `init`, `packs`, `pack`, `ai-draft`, and v2 and bundle support in `validate` and `snapshot`.
- **Bundle files** (`seed.bundle.json`) that never carry approvals.

### Changed
- Brand policy gains the optional `allowedSlots`, `effects` (default off), and `signatureColors` (default deny). Existing brand files are unchanged.
- `temporal-polyfill` is a runtime dependency of the authoring entry only. The runtime, renderer, React adapter, and custom elements do not load it.

### Compatibility
- Schema v1 experiences, approvals, `selectExperience`, and React `SeedArea` behave as in 0.1.0.
- This version is not released. The release that publishes it uses the `alpha` dist-tag (`npm install @sortnow/seed@alpha`) and does not move `latest`.

## 0.1.0-alpha.1

Foundation: schema v1 validation, exact-content approval snapshots, UTC scheduling, brand policy with presets, React `SeedArea`, the read-only JSON CLI, the playground, and the second example app.
