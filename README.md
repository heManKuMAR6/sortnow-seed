# SortNow SEED

**Scheduled Experiences & Extensible Design** — an open-source foundation for brand-consistent website experiences, usable by developers and coding agents.

Read **[SEED_PROJECT_GUIDE.md](SEED_PROJECT_GUIDE.md)** for the complete concept, architecture, phases, decisions, limitations, and agent handoff.

Experimental alpha. One repository for the engine, adapters, tools, and examples. Seasonal experiences are the first example; the same engine supports promotions and product launches.

## Try it

Requires Node.js 22+ and npm. No account, API key, backend, or model subscription.

```sh
git clone https://github.com/heManKuMAR6/sortnow-seed.git
cd sortnow-seed
npm ci --ignore-scripts
npm run demo
```

Open http://127.0.0.1:4173. Compare original and proposed designs, select a seasonal/promotion/launch preset, approve the exact version, then choose January 1, 2027 to see restoration. Draft preview is isolated from saved approvals. The demo uses React and local assets; its approval button is illustrative, not production authentication.

## Install into another project

```sh
npm install sortnow-seed
```

`sortnow-seed@0.2.0-alpha.0` is on npm (pre-1.0 alpha). To try unreleased changes from this repository instead, pack it locally:

```sh
npm run build
npm pack
# From your project:
npm install /absolute/path/to/sortnow-seed-<version>.tgz
```

```jsx
import { SeedArea } from 'sortnow-seed/react';
import experiences from './experiences.json';
import approvals from './reviewed-approvals.json';

<SeedArea experiences={experiences} approvals={approvals} area="hero">
  <YourExistingHero />
</SeedArea>
```

SEED styles only its wrapper; existing child styles may override inherited colors. Only explicit banner and hero areas are supported. Live mode begins after mount and checks time every second; `previewAt={Date.parse('2026-12-15T12:00:00.000Z')}` uses a fixed preview clock. Omitting valid approvals preserves the base website.

## Agent interface

```sh
node dist/cli/index.js validate examples/winter.json
node dist/cli/index.js inspect examples/winter.json 2026-12-15T12:00:00.000Z
node dist/cli/index.js snapshot examples/winter.json
node dist/cli/index.js help
node dist/cli/index.js schema experience
node dist/cli/index.js validate-brand examples/playground/brand.json
node dist/cli/index.js contrast examples/winter.json
node dist/cli/index.js contrast-brand examples/playground/brand.json
node dist/cli/index.js samples
node dist/cli/index.js schema event
node dist/cli/index.js author event.json examples/playground/brand.json
```

All commands are read-only and return JSON. Exit 0 means the command succeeded; exit 1 means invalid arguments, file, or configuration. Errors carry a code, path, and message, and CLI-level errors add a hint. `schema` (`experience` or `brand`) prints structural JSON Schema; `validate` remains authoritative for real dates and schedule order. Contrast reports are advisory: they exit 0 even when a pair misses its minimum, so read `meetsMinimums`, and they certify nothing. Inspect is a schedule preview, never approval. After reviewing exact content, the owner stores the snapshot string in trusted approval configuration. Editing any field invalidates the stored snapshot. See [SECURITY.md](SECURITY.md) for the authorization boundary.

## Configuration

See [examples/winter.json](examples/winter.json). UTC timestamps use `YYYY-MM-DDTHH:mm:ss.sssZ`; start is inclusive, end exclusive. Higher priority wins per area, with ASCII ID ordering to resolve ties. IDs must be unique. Up to 100 experiences and approvals are accepted. Invalid collections fail closed. To author from local dates, see [calendar authoring](#calendar-authoring). Recurring rules and holiday data are future work.

## Use a draft in your own site

In the playground, author an experience and choose **Download draft JSON**. Downloading doesn't approve or publish anything. Then follow the [integration recipe](docs/integration-recipe.md) to validate the file, map SEED's variables into your hero, and approve it separately. [examples/existing-project](examples/existing-project) has the files to copy, starting with no approvals.

## Calendar authoring

Pick an event, an IANA time zone, and a date range. SEED compiles them into a draft experience in UTC. Review and approval work the same as for any other experience.

```js
import { authorExperience } from 'sortnow-seed/authoring';

const result = authorExperience({
  name: 'Anniversary sale',
  timeZone: 'America/New_York', // You choose this; SEED never infers it.
  startDate: '2027-03-14',
  lastDate: '2027-03-14', // Included in the event.
  preset: 'promotion',
  message: 'Ten years of thoughtful objects.',
  areas: ['hero'],
}, brand);
// result.experience.startsAt: 2027-03-14T05:00:00.000Z
// result.experience.endsAt:   2027-03-15T04:00:00.000Z (a 23-hour day: clocks change)
```

The event runs from the start of the first day through the end of the last day in that zone. Invalid input returns `{ ok: false, errors }` with a path and message per problem. The result is always a draft: `approvalSnapshot` and owner review remain separate, and editing any date, zone, theme, or content invalidates an earlier approval. Only dates are accepted for now, not local times. Zone rules come from the host's `Intl` data, so no network is needed. The sample events are invented examples, not a holiday database.

### Theme packs: artwork and effects without writing JSON

Add `pack` to the same input and SEED builds a full design from that pack: a banner icon, a hero illustration, a corner decoration, one effect, and the pack's signature colours. Each choice defaults from the pack and from what your brand policy allows; set any of them yourself or pass `"none"`.

```js
const result = authorExperience({
  name: 'Christmas', timeZone: 'America/New_York', startDate: '2026-12-01', lastDate: '2026-12-25',
  preset: 'seasonal', message: 'Wishing you a warm and joyful holiday season.', areas: ['banner', 'hero'],
  pack: 'christmas',          // see: seed packs
  // illustration: 'tree', icon: 'gift', decoration: 'holly-corner', effect: 'flyby', signatureColors: true
}, brand);
```

Effects and signature colours stay off until the integrator turns them on in `brand.json` (`"effects": "on"`, `"signatureColors": "allow"`, and `allowedSlots`). Explicit choices that the brand forbids return errors rather than being silently dropped. In the playground, choose **Theme pack** and download the result as a `.bundle.json`. `seed author EVENT_FILE BRAND_FILE` does the same from the command line. Render it with `mountSeed` from `sortnow-seed/render` (see `examples/storefront`).

## Bring your own brand

Point SEED at the stylesheet or design-tokens file that defines your colours. It never scans your project.

```sh
npx seed init src/styles/theme.css     # or tokens.json (W3C $value, Style Dictionary, or nested)
```

SEED reads colour values only (hex, rgb, hsl, and `var()` references between colour variables). It maps background, text, and accent by name, or infers them from the colours when names don't say. It derives seasonal, promotion, and launch palettes as gentle tints of your own colours, keeps your text colour locked, and darkens any accent that would not be readable (4.5:1), noting each change. The output is a draft `brand.json` for you to review and save. Effects and pack signature colours stay off until you set `"effects": "on"` and `"signatureColors": "allow"`. In the playground, use **Your brand** to paste CSS, preview every pack in your colours, and download `brand.json`.

## Optional AI drafting

Describe your site and SEED asks a Claude model (default `claude-opus-5-5`) to propose a design for an event. The model can only choose from the installed packs: every design field in its structured output is an enum of real asset ids. SEED then authors the draft through the same brand rules and validation as a person would. If SEED rejects the proposal (an asset from another pack, an effect your brand has off), the errors go back to the model once for a correction. The result is always a draft with a short rationale; you preview and approve it yourself.

```sh
npm install @anthropic-ai/sdk          # optional; only needed for AI drafting
export ANTHROPIC_API_KEY=...           # or: ant auth login
npx seed ai-draft request.json brand.json
# request.json: {"description": "...", "name": "Christmas", "timeZone": "America/New_York",
#                "startDate": "2026-12-01", "lastDate": "2026-12-25", "areas": ["banner", "hero"], "pack": "christmas"}
```

What to know:
- The description and event details are sent to Anthropic with your credentials, and each draft is one or two paid calls.
- Visitors' browsers never call a model. The runtime package, React adapter, and `seed-element.js` contain no AI code.
- Server-side refusal fallback is on (`fallbacks: "default"`), so a policy decline can be retried on another model chosen by the API.

## Plan by market: upcoming occasions

Choose the markets your audience is in (US, India, UAE, Singapore) and SEED lists what is coming up, with theme windows, suggested packs, and the source for each date. **SEED never selects occasions for you.** Religious, national, and cultural days appear only as choices, and moon-sighting or almanac dates (Diwali, Eid, Lunar New Year) are marked to confirm locally. Years without published dates are not listed rather than guessed.

```js
import {upcomingOccasions, planExperiences} from 'sortnow-seed/authoring';
upcomingOccasions({markets: ['IN', 'AE'], from: '2026-11-08', days: 120});
planExperiences({markets: ['IN', 'AE'], from: '2026-11-08', timeZone: 'Asia/Dubai', areas: ['banner', 'hero'],
  occasions: ['national-day-ae-2026', 'christmas-2026']}, brand); // -> one draft bundle; overlaps reported
```

CLI: `seed occasions IN,AE 2026-11-08 120` and `seed plan PLAN_FILE BRAND_FILE`. Next year, run `seed replan PLAN_FILE BRAND_FILE` (or **Plan the same occasions next year** in the playground): the same occasions move to their new dates, your message and pack choices carry over, occasions whose dates are not published yet are listed as waiting, and every new draft needs a fresh approval. In the playground, use **Plan by market**. Installed packs: Christmas, Black Friday, New Year, Diwali, Lunar New Year, Valentine's Day, Eid, Halloween, and Celebration (for national days, using brand colours and bunting rather than flags).

## Any website: plain HTML, React, Angular, Vue, Shopify

One self-contained script (`dist/seed-element.js`, about 13 KB gzipped, no framework) adds `<seed-root>`. Mark your own elements with `data-seed-slot="banner"`, `"hero accent"`, and so on:

```html
<script type="module" src="/seed-element.js"></script>
<seed-root bundle="/seed/seed.bundle.json" approvals="/seed/approvals.json" brand="/seed/brand.json"></seed-root>
<section class="hero" data-seed-slot="hero accent">…your hero…</section>
```

React apps use `SeedRoot` from `sortnow-seed/react`. See [docs/platforms.md](docs/platforms.md) for React, Angular, Vue, and Shopify, and `npm run demo:html` for a framework-free example on port 4176.

## Architecture

- `packages/core`: typed contracts, validation, exact-content approval snapshots, deterministic selection.
- `packages/react`: explicit-area adapter, safe text rendering, lifecycle cleanup, SSR fallback.
- `packages/cli`: bounded JSON input and structured diagnostics for agents.
- `examples/playground`: working React integration and date preview.
- `examples/second-app`: differently structured app with server rendering and hydration (`npm run demo:second`, port 4174).
- `tests`: security regressions, scheduling boundaries, SSR, and CLI behavior.

## Releases

`sortnow-seed` is published on npm by the maintainer account `hemankumar6` (2FA required for publishing). See [CHANGELOG.md](CHANGELOG.md).

- **0.2.0-alpha.0** (2026-11-08) was published by hand from `develop` commit `d260cfa`, without provenance. It is `latest`. Placeholder versions `0.0.0-bootstrap.0` and `0.0.0-stage` exist from creating the package and are being deprecated.
- **From 0.2.0-alpha.1 on,** releases go only through `.github/workflows/release.yml`: a reviewed workflow with npm trusted publishing and provenance. Never run `npm publish` by hand again.

To release the next version:
1. Merge a release PR from `develop` into `master`. The version in `package.json` must be unpublished (currently `0.2.0-alpha.1`).
2. **Right before tagging,** on the npm package settings add a trusted publisher: GitHub user `heManKuMAR6`, repository `sortnow-seed`, workflow `release.yml`, environment `npm`, with direct `npm publish` ticked. Configurations created after 2026-09-03 default to staged publish only, and a new configuration expires if unused for 2 days. This is only needed once.
3. Tag the `master` commit `v<version>` (for example `v0.2.0-alpha.1`) and push the tag. Approve the waiting `npm` environment run in GitHub.
4. The workflow publishes with the `alpha` dist-tag. To make it the default install: `npm dist-tag add sortnow-seed@<version> latest`.

The workflow pins Node `22.23.4` and npm `11.21.2` to meet npm's trusted-publishing requirement (npm CLI 11.5.1 or later, Node 22.14.0 or later). `npm run smoke:install` checks that a fresh project can install and use the package. See [docs/enterprise-design.md](docs/enterprise-design.md) for the planned hosted mode.

## Development

`npm run check` builds, tests, and inspects package contents. `npm audit` checks known dependency advisories. Branch from `develop` as `feature/<name>` and open PRs against `develop`; `master` receives only production-ready releases from `develop`. Automated nightly review is configured separately in the owner's Codex app; it is not a GitHub-hosted merge service. Never merge absent or failing checks.

## Roadmap

Next: automated browser interaction tests and the [agent task comparison](docs/agent-task-comparison.md), then regional calendars and MCP. See [compatibility](docs/compatibility.md) for what has actually been exercised. AI authoring, Angular/Shopify adapters, hosted approvals, and enterprise controls are not implemented. No claim of universal compatibility or security certification.

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Brand-aware integration

```jsx
import { createPreset } from 'sortnow-seed';
import { SeedArea } from 'sortnow-seed/react';
// brand: see examples/playground/brand.json. settings: id, UTC dates, priority, areas, message.
const draft = createPreset('seasonal', brand, settings);
<SeedArea brand={brand} experiences={[draft]} approvals={reviewedSnapshots}
  area="hero" mode="variables">
  <YourExistingHero />
</SeedArea>
```

Map existing styles once:

```css
.hero {
  background: var(--seed-background, #ffffff);
  color: var(--seed-foreground, #1d3029);
}
.hero a { color: var(--seed-accent, #234b3d); }
```

`variables` mode only sets scoped tokens, without adding message text or wrapper layout styling. Default `wrapper` mode retains the original appearance behavior. Brand policy can veto an approved experience; it never silently recolors it. Protected color tokens use base brand values when authoring presets. Logos and typography remain host-owned; there is no automatic DOM protection mechanism.
