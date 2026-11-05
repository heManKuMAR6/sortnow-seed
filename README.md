# SortNow SEED

**Scheduled Experiences & Extensible Design** — an open-source foundation for brand-consistent website experiences, usable by developers and coding agents.

Read **[SEED_PROJECT_GUIDE.md](SEED_PROJECT_GUIDE.md)** for the complete concept, architecture, phases, decisions, limitations, and agent handoff.

Experimental alpha. One repository for the engine, adapters, tools, and examples. Seasonal experiences are the first example; the same engine supports promotions and product launches.

## Try it

Requires Node.js 22+ and npm. No account, API key, backend, or model subscription.

```sh
git clone https://github.com/heManKuMAR6/sortnow-seed.git
cd sortnow-seed
# Until the brand experience PR is merged:
git switch feat/brand-experiences
npm ci --ignore-scripts
npm test
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
```

All commands return JSON. Exit 0 means success; exit 1 means invalid arguments, file, or configuration. Inspect is a schedule preview, never approval. After reviewing exact content, the owner stores the snapshot string in trusted approval configuration. Editing any field invalidates the stored snapshot. See [SECURITY.md](SECURITY.md) for the authorization boundary.

## Configuration

See [examples/winter.json](examples/winter.json). UTC timestamps use `YYYY-MM-DDTHH:mm:ss.sssZ`; start is inclusive, end exclusive. Higher priority wins per area, with ASCII ID ordering to resolve ties. IDs must be unique. Up to 100 experiences and approvals are accepted. Invalid collections fail closed. Regional calendar conversion and recurring rules are future work.

## Architecture

- `packages/core`: typed contracts, validation, exact-content approval snapshots, deterministic selection.
- `packages/react`: explicit-area adapter, safe text rendering, lifecycle cleanup, SSR fallback.
- `packages/cli`: bounded JSON input and structured diagnostics for agents.
- `examples/playground`: working React integration and date preview.
- `tests`: security regressions, scheduling boundaries, SSR, and CLI behavior.

## Development

`npm run check` builds, tests, and inspects package contents. `npm audit` checks known dependency advisories. Work on feature branches and open PRs against `main`. Automated nightly review is configured separately in the owner's Codex app; it is not a GitHub-hosted merge service. Never merge absent or failing checks.

## Roadmap

Next: browser interaction tests, machine-readable JSON Schema, contrast diagnostics, a second integration fixture, then regional calendars and MCP. AI authoring, Angular/Shopify adapters, hosted approvals, and enterprise controls are not implemented. No claim of universal compatibility or security certification.

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
