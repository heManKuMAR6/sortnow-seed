# Agent task comparison protocol

**Status: not run. There are no results yet.** Do not cite this page as evidence of time saved or of agents preferring SEED.

## Question

For a repeated campaign change on an existing React site, does a coding agent using SEED finish with fewer defects and less effort than the same agent implementing the change directly?

## Setup

- Fixtures: `examples/playground` and `examples/second-app`, ideally plus a site the experimenter did not write. Results from our own fixtures favour SEED, so report them as such.
- Conditions: **direct** (ordinary code edits, no SEED) and **SEED** (`seed help` available, with the area already integrated). Measure first-time SEED integration separately as a setup cost.
- Use the same model, settings, prompt wording, and starting commit in both conditions. Run each task at least five times per condition, in a clean checkout.

## Tasks

1. Add a campaign that starts and ends at given UTC instants and restores the original afterward.
2. Change the campaign message after it has been approved.
3. Add a campaign that the brand rules should reject, such as a forbidden area or an off-palette color.
4. Replace the first campaign with a different one on the same site.

## Measures

- **Defects:** wrong boundary behaviour, leftover styling after expiry, changes to content outside the permitted area, a publication that skipped approval, and contrast below the agreed minimum.
- **Effort:** wall-clock time, tokens, tool calls, human interventions, and lines changed.
- **Repeat cost:** task 4 compared with task 1.

Score defects with a checklist written before any runs, and have the scorer not know the condition where possible.

## Reporting

Publish the prompts, commit, model, every run including failures, and the raw counts. Report small samples as counts, without percentages or significance claims. A SEED loss or tie is a valid result and goes in the guide.
