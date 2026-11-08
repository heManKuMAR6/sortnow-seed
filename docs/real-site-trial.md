# Real-site trial plan

Status: **planned, site not chosen yet.** Owner: founder (site choice, permission, approvals) with Claude (integration). Grokbot does an independent check when assigned, and Codex reviews any SEED changes the trial causes.

## Why

Every SEED demo so far was built for SEED. One site that wasn't will show whether installation, slot marking, styling, approval, and cleanup work in practice, and how long they take. This is the last big unknown before an alpha release and before showing SEED to pilot customers.

## Choosing the site

The site must be one the founder owns or has **written permission** to modify, with a **staging or preview URL**. Nothing goes to production during the trial, and going live afterwards is the owner's decision.

Good candidates, best first:

| Option | Tests | Notes |
| --- | --- | --- |
| A real business site with a staging copy (a friend's store, an agency client) | Everything, including owner reactions | Most valuable; needs written permission |
| A free Shopify development store with a standard theme | The Shopify recipe (unverified so far) | Zero risk to a live store; tests the platform the brief names |
| The founder's own site, or a site built from a popular template (Next.js, Astro, WordPress) | Install friction on a stack not built for SEED | Fast to start; less signal from a real owner |

The site should have a hero section and ideally an announcement bar. A framework other than plain HTML or React would also test the universality claim.

## Steps (target: about half a day)

| # | Step | What we record |
| --- | --- | --- |
| 0 | Permission in writing, staging URL, how deploys work, who approves | Access method and constraints |
| 1 | Baseline: screenshots of key pages on desktop and phone; Lighthouse (LCP, CLS, JS size); response headers including CSP | Starting numbers |
| 2 | Brand: `npx seed init` on the site's CSS or tokens file, then review the mapping | Whether roles mapped correctly; edits needed |
| 3 | Install: one script tag (or npm) plus `data-seed-slot` on the hero and announcement bar; brand and bundle files | **Minutes taken, files and lines changed**, anything that fought us |
| 4 | Plan: Plan by market for the site's audience, choosing Black Friday, Christmas, and New Year; download the bundle | Whether the defaults fit this business |
| 5 | Preview on staging with `preview-at`; the owner reviews each theme | Owner's first reaction (1–5) and comments |
| 6 | Approve the chosen exact versions into the approvals file; activate by date on staging | Approval friction |
| 7 | Checks while active: layout shift, text contrast, phone, reduced motion, CSP, console errors, effect once per visit, clicks still work | Issues with severity |
| 8 | Restore: date after the occasion; compare against baseline screenshots and DOM | Exact restore: yes or no |
| 9 | Optional: `seed ai-draft` with the owner's description, once API credits exist | AI proposal quality (1–5) |
| 10 | Debrief with the owner: would you use this next season? Would you pay? What was missing? | Willingness and objections |

## Success criteria

- A developer goes from nothing to a themed preview in **60 minutes or less**.
- Host markup changes are **5 lines or fewer** besides the script tag and config files.
- **No layout shift, no console or CSP errors**, and the page stays fully clickable during effects.
- Restoring after the occasion leaves the **page identical to the baseline**.
- The owner rates at least one theme **4 or higher** as on-brand and would keep it live.

Anything that misses becomes a bounded SEED fix (Claude implements, Codex reviews), not a redesign.

## Risks to watch

- **CSP** blocks the script or JSON. Fix with the documented `connect-src` and `script-src` changes, or inline JSON.
- **Theme CSS** overrides SEED's tint, such as a hero background image. Use variables mode plus CSS mapping.
- **Framework re-renders** replace slot contents (text-only slot containers).
- Cookie banners or sticky headers overlap the effect layer.
- **Brand import** misreads unusual token names.

## Timeline

Black Friday is 2026-11-27.

- **Week of 2026-11-09:** choose the site and run the trial.
- **2026-11-16 to 20:** fixes.
- **About 2026-11-23:** alpha release decision.
- **2026-11-27 onward:** Black Friday and Christmas live on the trial site, if the owner wants.

## What Claude needs from the founder

1. Which site, and the permission to use it.
2. Access: a repository (a branch Claude can push to, or a ZIP of the theme), or a staging URL plus a way to deploy.
3. The site's framework or platform.
4. Who reviews and approves the themes.
