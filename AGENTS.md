# SEED contributor entry point

Read [SEED_PROJECT_GUIDE.md](SEED_PROJECT_GUIDE.md) first. It is the maintained product, architecture, phase, security, and handoff record for humans and coding agents. Update it in the same PR when decisions or implementation status change.

Use targeted verification for changed behavior. Avoid redundant full-suite runs and dependency audits without a relevant change. Follow the existing feature-branch/PR workflow, preserve user work, and never auto-approve draft experiences or execute untrusted configuration.

`master` holds production-ready releases only. `develop` is the integration branch and the GitHub default. All new work starts from refreshed `develop` on a `feature/<name>` branch (or `fix/<name>`) and merges into `develop` by PR. `master` receives only release merges from `develop` once that code is production ready, by the founder's decision. Claim a bounded lane in the project guide before concurrent work. Before a context handoff, record branch/head, changed files, verification already run, blockers, and next action. Do not overwrite another agent's changes or repeat checks merely because ownership changed.
