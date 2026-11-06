# Add a SEED draft to an existing React site

This takes a draft from the playground to your own hero. Your site keeps its base appearance until a person approves the exact draft. The finished files are in [examples/existing-project](../examples/existing-project).

Your site needs React 18 or 19 and a bundler that can import JSON. React 19.3.1 is the only version tested so far; see [compatibility](compatibility.md).

## 1. Author and download a draft

In a SEED checkout, run `npm ci --ignore-scripts`, then `npm run demo`, and open http://127.0.0.1:4173. Create your event, then choose **Download draft JSON**.

Downloading doesn't approve or publish anything. The file contains only the experience.

**Colors come from the playground's sample brand.** To use your own, edit `examples/playground/brand.json` first and restart the demo. If you pass your own `brand` to `SeedArea` later, a draft with other colors is blocked and the base appearance stays.

## 2. Install the package from a local tarball

SEED isn't on npm yet. In the SEED checkout:

```sh
npm run build
npm pack
```

In your project, using the real path:

```sh
npm install /absolute/path/to/sortnow-seed-0.1.0-alpha.1.tgz
```

## 3. Add the draft and an empty approvals file

```text
src/seed/draft.json               the file you downloaded, renamed
src/seed/reviewed-approvals.json  contains only: []
```

## 4. Validate it

```sh
npx seed validate src/seed/draft.json
```

`"ok":true` and exit code 0 mean the file is well formed. It doesn't mean the draft is approved.

## 5. Connect your hero

Wrap your hero in the [example component](../examples/existing-project/CampaignHero.jsx). Adjust the import paths if your files are elsewhere:

```jsx
import { SeedArea } from '@sortnow/seed/react';
import draft from './seed/draft.json';
// Starts as []. Only a person adds to this file, after reviewing the exact draft. Never generate it from draft.json.
import approvals from './seed/reviewed-approvals.json';

export function CampaignHero({ children }) {
  return (
    <SeedArea experiences={[draft]} approvals={approvals} area="hero" mode="variables">
      {children}
    </SeedArea>
  );
}
```

Then map the variables in your existing CSS, keeping your current colors as the fallbacks:

```css
.hero {
  background: var(--seed-background, #ffffff);
  color: var(--seed-foreground, #1d3029);
}
.hero a {
  color: var(--seed-accent, #234b3d);
}
```

- The draft's `areas` must include `hero`.
- `SeedArea` adds a `div` around your hero, which can matter if a parent uses grid or flex.
- This mode changes colors only and doesn't display the draft's message. To show the message, use `<SeedArea area="banner" ...>` with no `mode`, on a draft whose `areas` include `banner`.

Your site should look exactly the same at this point, because nothing is approved.

## 6. Review, then approve separately

The owner reads the exact content of `draft.json`, including dates, colors, and message. To preview it, use the playground or temporarily pass `previewAt` with the snapshot in a non-production build.

After review, create the approval text:

```sh
npx seed snapshot src/seed/draft.json
```

Copy the `snapshot` value from the output into the array in `reviewed-approvals.json`, exactly as printed, and commit it through your normal code review:

```json
["{\"schemaVersion\":1,\"id\":\"winter-season-20261201-utc\", ...}"]
```

Once deployed, the experience activates in its scheduled window and the base appearance returns when it ends. Any later edit to `draft.json` stops matching the snapshot, so the base appearance stays until someone approves the new version.

## 7. Revoke

Remove the string from `reviewed-approvals.json`, leaving `[]`, and deploy. The base appearance returns for visitors who load the new build; open tabs keep the old build until they reload.

## Limits of snapshot approval

- **A snapshot isn't authentication.** It records exact content, with no signature and no record of who approved it. Anyone who can edit both files can approve their own change.
- **Protect the approvals file yourself.** Use required code review or file ownership rules, and keep it out of reach of whatever writes drafts, including agents and generated changes.
- **Schedules run on the visitor's clock.** Don't rely on them for pricing, rights, or legal deadlines.
- **Activation happens in the browser after load.** Server output and the first render use the base appearance.
