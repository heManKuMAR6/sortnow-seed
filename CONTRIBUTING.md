# Contributing

Use a feature branch and a PR to main. Run npm ci --ignore-scripts, npm run check, and npm audit. Include behavior changes, validation evidence, and compatibility limitations in the PR. Tests must cover new trust boundaries and schedule behavior. Never commit credentials, real customer data, node_modules, or build artifacts. Keep the core framework-independent. UI adapters must preserve host content and escape untrusted text.
