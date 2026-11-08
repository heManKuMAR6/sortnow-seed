# Enterprise backend design (M6)

Status: **design for review**. Nothing here is built yet. Owner: Claude. Reviewer: Codex. Decisions: founder.

This covers point 7 of the founder's brief: a backend attached, and the second of the two modes, open source and enterprise.

## 1. Principles

1. **The open-source runtime never depends on us.** Files committed with a site keep working forever: bundle, approvals, and brand. The enterprise service is an optional delivery and team layer on the same contracts.
2. **One set of contracts.** The same schema v1 and v2, packs, bundle format, and snapshot rules apply everywhere. The backend never invents a second format.
3. **Visitors never call AI.** Models run only when someone authors a draft.
4. **Approval becomes authenticated, not looser.** In the hosted product, an approval is a signed record by a person with the approver role, still bound to the exact snapshot.
5. **Fail closed.** Any delivery or verification problem shows the site's base design.

## 2. The gap to close first: one operation layer

Today the CLI, the playground, and future tools call core functions directly. Before any server work, define the operations once in a new module, `sortnow-seed/operations`. Each operation is a typed function with JSON in, JSON out, coded errors, and a declared permission:

| Operation | Permission | Notes |
| --- | --- | --- |
| `validate`, `inspect`, `listPacks`, `listOccasions` | read | Read-only. |
| `importBrand`, `author`, `plan`, `replan`, `proposeWithAI` | draft | Always produce drafts. |
| `snapshot`, `approve`, `revoke` | approve | Hosted `approve` writes a signed approval record. |
| `publish` | publish | Issues a signed bundle to delivery. |

The CLI, an MCP server for agents, and the backend API become thin wrappers over this layer. Agents get read and draft by default. Approve and publish must be granted explicitly to a named service account, and are off by default.

## 3. Hosted components

```text
              owners, editors, approvers (SSO)              agents (MCP, scoped service accounts)
                          │                                            │
                          ▼                                            ▼
   ┌─────────────────────── Control plane API (operations layer) ───────────────────────┐
   │ orgs · sites · roles · brands · plans · immutable draft versions · approvals ·     │
   │ revocations · append-only audit log · hosted AI drafting (org spend caps)          │
   └───────────────────────────────┬────────────────────────────────────────────────────┘
                                   │ publish (approved snapshots only)
                                   ▼
          Signer (keys in a KMS, one key per site, rotation by keyId)
                                   │
                                   ▼
          Delivery: GET https://cdn.seed.sortnow.example/v1/sites/{siteId}/seed.json
          (short TTL, CDN cached, no cookies, no visitor data)
                                   │
                                   ▼
          Visitor browser: <seed-root src=".../seed.json" public-key="...">  → verify → render, or base on any failure
```

### Roles

| Role | Can |
| --- | --- |
| Viewer | Read plans, drafts, audit. |
| Editor | Create and edit drafts, plans, and brand proposals; run AI drafting within org caps. |
| Approver | Approve or revoke exact draft versions. Optional org policy: the approver must differ from the author (two-person rule). |
| Owner | Manage members, sites, keys, spend caps, and policies; can publish. |
| Agent (service account) | Read and draft by default; approve or publish only if an owner grants it. |

## 4. Signed delivery: bundle version 2

Version 2 is reserved in the bundle format today. It adds fields that the open-source runtime will verify when present:

```jsonc
{
  "bundleVersion": 2,
  "siteId": "site_123",
  "issuedAt": "2026-12-01T05:00:00.000Z",   // server time
  "expiresAt": "2026-12-01T05:10:00.000Z",  // short TTL; stale bundles fall back to base
  "experiences": [ /* v1/v2 experiences, unchanged */ ],
  "approvals": [ /* exact snapshots that the signed approval records cover */ ],
  "keyId": "k_2026_11",
  "signature": "base64url Ed25519 over the canonical JSON of every field above"
}
```

- **Verification:** `<seed-root>` gains `src` (same-origin or an allow-listed SEED delivery origin) and `public-key`. It verifies the signature with Web Crypto Ed25519, checks `siteId` and `expiresAt`, and only then mounts. Unsigned v2 bundles or bad signatures fail closed.
- **Trusted time:** the runtime computes `serverOffset = issuedAt - clientNowAtFetch` and schedules with `clientNow + serverOffset`. This removes most clock-skew problems without a live call per page. Long-lived pages refetch when the TTL ends.
- **Revocation:** publishing a new bundle without the experience takes effect within one TTL, about 10 minutes. An owner kill switch issues `experiences: []` for a site immediately.
- **Approvals are still exact-content:** a signed bundle carries approvals only for snapshots that have signed approval records in the control plane, so authentication is added on top of the existing guarantee.
- The open-source file path (bundle v1 plus a separate approvals file) is unchanged.

## 5. Data model (control plane)

| Entity | Key fields |
| --- | --- |
| Organization | id, name, plan, spend caps, approval policy, data region |
| Site | id, org, origins (for CSP and `src` allow-listing), public keys, brand reference |
| Member | user, org, role, SSO subject |
| Brand | version, policy JSON (same schema), imported-from record |
| Plan | markets, occasions, overrides (same as `PlanInput`), created by |
| DraftVersion | immutable experience JSON, snapshot hash, author, source (person, AI, agent), AI proposal and rationale |
| Approval | draft version, snapshot hash, approver, time, signature |
| Revocation | approval, by, time, reason |
| Publication | site, bundle hash, keyId, issuedAt, expiresAt |
| AuditEvent | append-only: actor, action, target, time, request id |

## 6. Security and privacy

- **Tenant isolation:** isolation on every query, per-site signing keys in a KMS, private keys never exported, and keys rotated by keyId with overlap.
- **Delivery content:** bundles contain no personal data. Delivery is cookie-less and logs no visitor identifiers.
- **Hosted AI:** server-held model credentials, per-org spend caps and rate limits, owner-supplied descriptions retained per org policy, and an opt-out of retention.
- **Identity and audit:** SSO (SAML or OIDC), least-privilege roles, and audit export.
- **Hosts:** a host adds the delivery origin to CSP `connect-src`. Any failure (network, CSP, signature, expiry) shows the base design.
- **Data region:** India and UAE customers may need in-region hosting. This is decided before launch, not retrofitted.

## 7. Phasing (each ends in a demo)

| Phase | Scope | Demo |
| --- | --- | --- |
| E1 (open source) | Operation layer; CLI rebuilt on it; MCP server with read and draft tools | An agent plans and drafts Christmas through MCP and cannot approve |
| E2 (open source) | Bundle v2 signing tool (`seed sign` with a local key) and runtime verification in `<seed-root>` and React | A tampered bundle shows the base site; a valid one renders |
| E3 (hosted MVP) | Orgs, sites, roles, draft versions, approvals, audit, publish to delivery | An editor drafts, an approver approves, the site updates within the TTL, revoke restores it |
| E4 (hosted) | Hosted AI drafting with caps, fleet (many sites, shared plans), SSO, self-hosted container | One plan published to three sites with different brands |

E1 and E2 strengthen the open-source product on their own and come first. E3 and E4 should start once there are pilot customers asking for team approval or hosted delivery.

## 8. Open decisions for the founder

1. Enterprise licence: closed SaaS, source-available, or open core with a commercial self-host licence.
2. Default approval policy for organizations: is the two-person rule on or off by default?
3. Hosting regions at launch: US, India, UAE.
4. Pricing unit: per site, per published occasion, or per seat.
5. Delivery domain and CDN provider.
