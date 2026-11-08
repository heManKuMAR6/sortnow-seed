# Security policy

This is an experimental alpha, not an audited security product. Report vulnerabilities privately through GitHub's private vulnerability reporting when enabled; otherwise contact the maintainer privately through their GitHub profile. Do not include secrets or exploit details in public issues.

## Trust boundaries

- Experience JSON is untrusted data. Strict allowed fields, six-digit hex colors, bounded text, and real UTC timestamps are validated before rendering.
- No eval, raw HTML, remote asset loading, executable themes, URL configuration, or arbitrary CSS. React renders messages as escaped text.
- Invalid collections fail closed to base content. Expiration is checked on selection; live React checks once per second and on visibility changes. Sleeping browsers cannot guarantee exact wall-clock execution.
- Approval snapshots bind exact content, but are NOT cryptographic signatures or authentication. The host must protect approval configuration with code review and access controls. An attacker who can write both drafts and approvals can authorize changes. Do not accept approvals from the same untrusted source as drafts.
- CLI snapshot creates review material only. It never publishes or grants permissions. CLI reads bounded regular files and never executes configuration.
- The library performs no network requests, telemetry, or credential storage. The demo binds localhost only. Inline React style attributes require compatible CSP; strict style-src users should assess integration before adoption.
- Server render and first live client render use base content to avoid hydration mismatch. Client activation can cause layout shift. Pricing, checkout, and legal claims must not depend on this client clock or display layer.
- CSS colors are syntactically constrained, not contrast-certified. `seed contrast` and `seed contrast-brand` report ratios as advice only and do not gate approval. Authors must review accessibility and content accuracy. No animations are included yet.

## Contributions and releases

Review dependency and workflow changes before running them with credentials. CI uses read-only permissions and no secrets. Never use pull_request_target to execute submitted code. Keep lockfiles and dependency audit results current. Publish npm only through `.github/workflows/release.yml`. A merge does not publish. The workflow runs only after a `v*` tag is pushed for a commit already on `master`, and only after a required reviewer approves the GitHub environment `npm` (the person who pushed the tag may approve that environment). It uses npm trusted publishing (OIDC) and provenance. No npm token is stored in this repository. Version 0.2.0-alpha.0 was published by hand before the workflow was in use; every later version must come from the workflow.0-alpha.0`. The trusted publisher for workflow `release.yml` and environment `npm` must be allowed to run `npm publish` directly; a new publisher otherwise allows only staged publish.

## Brand policy and previews

Optional brand policy restricts allowed areas and color values, including locked base tokens. Policy rejects incompatible approved content instead of changing its meaning. CSS variables are scoped to an opt-in wrapper; they are not a DOM sandbox. Draft previews use ephemeral approval snapshots only in an isolated demonstration pane and do not persist production approvals. Runtime accepts no arbitrary brand CSS or selectors. The host is responsible for access control and preserving sensitive descendants.
