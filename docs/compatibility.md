# Compatibility

This page separates what has been exercised from what is only declared. Absence from the "Exercised" table means unknown, not unsupported. No customer-owned site has been integrated yet.

## Exercised

| Surface | Evidence | Limit |
| --- | --- | --- |
| Node.js 22 | CI runs the build and test suite on it | Linux runner only; Phase 3 PR #3 CI passed before consolidation into main |
| Node.js 25.8 on macOS | Local targeted tests and CLI | One machine |
| React 19.3.1 | Tests, plus both example apps | The only React version installed in this repo |
| React server rendering with hydration | `examples/second-app`: `renderToString` then `hydrateRoot`, no console errors in Chromium | One app, manual browser check |
| Client-only rendering | `examples/playground`: `createRoot` | One app, manual browser check |
| Chromium (desktop app browser pane) | Manual pass over both apps, including 375px width for the second app | Not automated; no Firefox or Safari |
| CSP without inline scripts | Both demo servers send `script-src 'self'` and `style-src 'self' 'unsafe-inline'` | Inline style attributes need `'unsafe-inline'` |

## Declared, not exercised

- **React 18:** `peerDependencies` allows `>=18 <20`, and the adapter uses only `useState` and `useEffect`, but nothing has run against React 18.
- **Node.js 23 and 24:** `engines` allows them. They are not in CI.
- **Windows:** the CLI's FIFO test is skipped there and `O_NONBLOCK` is not available. Nothing has run on Windows.
- **Frameworks:** Next.js, Remix, Vite, and others are untested. `packages/react` carries a `'use client'` directive, but no React Server Components setup has been run.

## Host requirements

- Each area needs an explicit `SeedArea` wrapper. Only `banner` and `hero` exist.
- `SeedArea` adds a `div`. Layouts that depend on a direct parent-child relationship, such as grid or flex children, may need adjusting.
- In `variables` mode, existing CSS must opt in using `var(--seed-background, ...)`, `var(--seed-foreground, ...)`, and `var(--seed-accent, ...)`. Without that mapping nothing changes visually.
- A strict `style-src` without `'unsafe-inline'` blocks the inline style attribute that carries the tokens. Assess this before adopting.
- Activation happens after mount, so it can cause layout shift in `wrapper` mode, which adds a message and padding. The clock is the browser's, so do not use SEED to enforce pricing, rights, or legal deadlines.

## Not supported

Arbitrary-site restyling, Angular, Shopify, and non-React adapters do not exist. Logos and typography stay host-owned, and there is no automatic DOM protection.

## Agent contract stability

`seed help` reports `protocolVersion: 1`. Commands are read-only, and no approve or publish command exists. JSON Schemas describe structure only, so `seed validate` remains authoritative for real dates, schedule order, and UTF-16 message length. The project is an alpha and has no compatibility guarantee yet.
