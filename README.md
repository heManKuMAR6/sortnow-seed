# SortNow SEED

**Scheduled Experiences & Extensible Design** — an open-source foundation for brand-consistent website experiences, usable by developers and coding agents.

Experimental alpha. One repository for the engine, adapters, tools, and examples. Seasonal experiences are the first example; the same engine supports promotions and product launches.

## Try it

Requires Node.js 22+ and npm. No account, API key, backend, or model subscription.

```sh
git clone https://github.com/heManKuMAR6/sortnow-seed.git
cd sortnow-seed
# Until the foundation PR is merged:
git switch feat/seed-foundation
npm ci --ignore-scripts
npm test
npm run demo
```

Open http://127.0.0.1:4173. Choose a date, approve the demo, then choose January 1, 2027 to see the normal design return. The demo uses React and local assets; its approval button is illustrative, not production authentication.

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
