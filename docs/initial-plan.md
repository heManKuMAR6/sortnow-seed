# SEED architecture and roadmap

SEED is one SortNow repository for reusable website experiences, not a separate repository per campaign. The initial implementation has a framework-independent TypeScript core, React adapter, and JSON CLI. Future adapters and authoring services must consume the same validated contracts.

Current supported primitives: exact UTC schedule windows, priority and per-area selection, exact-content approval snapshots held by a trusted host, bounded text, hex color themes, and wrapper-local rendering. Seasonal, promotional, and launch experiences compose these primitives.

Next milestones: JSON Schema export, browser interaction coverage, accessibility diagnostics, more integration fixtures, regional calendar authoring, then an optional MCP interface and AI drafting service. Future hosted approval services must authenticate reviewers server-side and bind approval to immutable artifacts. A client-side snapshot is not a substitute for authorization.

The first pilot should compare two successive campaigns across three willing agencies. Measure integration time, repeat work, defects, support effort, and willingness to pay for managed multi-site previews and approvals. Do not claim universal support or commercial validation before evidence.
