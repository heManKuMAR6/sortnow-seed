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

Not published to npm yet; the @sortnow namespace is provisional.

```sh
npm run build
npm pack
# From your React project:
npm install /absolute/path/to/sortnow-seed-0.1.0-alpha.1.tgz
```

```jsx
import { SeedArea } from '@sortnow/seed/react';
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
import { authorExperience } from '@sortnow/seed/authoring';

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

Effects and signature colours stay off until the integrator turns them on in `brand.json` (`"effects": "on"`, `"signatureColors": "allow"`, and `allowedSlots`). Explicit choices that the brand forbids return errors rather than being silently dropped. In the playground, choose **Theme pack** and download the result as a `.bundle.json`. `seed author EVENT_FILE BRAND_FILE` does the same from the command line. Render it with `mountSeed` from `@sortnow/seed/render` (see `examples/storefront`).

## Any website: plain HTML, React, Angular, Vue, Shopify

One self-contained script (`dist/seed-element.js`, about 13 KB gzipped, no framework) adds `<seed-root>`. Mark your own elements with `data-seed-slot="banner"`, `"hero accent"`, and so on:

```html
<script type="module" src="/seed-element.js"></script>
<seed-root bundle="/seed/seed.bundle.json" approvals="/seed/approvals.json" brand="/seed/brand.json"></seed-root>
<section class="hero" data-seed-slot="hero accent">…your hero…</section>
```

React apps use `SeedRoot` from `@sortnow/seed/react`. See [docs/platforms.md](docs/platforms.md) for React, Angular, Vue, and Shopify, and `npm run demo:html` for a framework-free example on port 4176.

## Architecture

- `packages/core`: typed contracts, validation, exact-content approval snapshots, deterministic selection.
- `packages/react`: explicit-area adapter, safe text rendering, lifecycle cleanup, SSR fallback.
- `packages/cli`: bounded JSON input and structured diagnostics for agents.
- `examples/playground`: working React integration and date preview.
- `examples/second-app`: differently structured app with server rendering and hydration (`npm run demo:second`, port 4174).
- `tests`: security regressions, scheduling boundaries, SSR, and CLI behavior.

## Development

`npm run check` builds, tests, and inspects package contents. `npm audit` checks known dependency advisories. Branch from `develop` as `feature/<name>` and open PRs against `develop`; `master` receives only production-ready releases from `develop`. Automated nightly review is configured separately in the owner's Codex app; it is not a GitHub-hosted merge service. Never merge absent or failing checks.

## Roadmap

Next: automated browser interaction tests and the [agent task comparison](docs/agent-task-comparison.md), then regional calendars and MCP. See [compatibility](docs/compatibility.md) for what has actually been exercised. AI authoring, Angular/Shopify adapters, hosted approvals, and enterprise controls are not implemented. No claim of universal compatibility or security certification.

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Brand-aware integration

```jsx
import { createPreset } from '@sortnow/seed';
import { SeedArea } from '@sortnow/seed/react';
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
