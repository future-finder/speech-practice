# Workspace maintenance guidelines

The current visual system is frozen. Do not redesign existing pages unless
explicitly requested. Preserve layout, typography, spacing, colors, component
anatomy and asset direction when adding or repairing functionality.

## Existing structure

- Desktop Practice retains the sidebar, reading workspace and Coach rail. At the
  1586 × 992 test viewport their widths are 258 / 878 / 328 px.
- Script / Focus, sentence navigation, Edit, player and Coach stay in the same
  positions across unrecorded, recorded and assessed states.
- Wallpaper is optional. Turning it off expands the application to the whole
  window, with proportional desktop scaling and existing responsive behavior.
- Main surfaces remain neutral white; sidebar and rail use subtle cool-neutral
  surfaces. Saturated colors identify controls and semantic states.
- Reading text stays regular-weight with a text-fitting phrase highlight. Coach
  uses continuous information rows rather than separate metric cards.
- Entry illustrations share one material family. Covers retain consistent light,
  framing and crops. Icons use the existing line-icon system.

## Copy and data

Use functional labels, accurate states and concise recovery instructions. Do not
add slogans or text that duplicates controls. Keep required field labels,
first-use information, consent and accessibility names.

Unavailable measurements remain unavailable. Recognition differences are not
pronunciation scores; estimated word gaps are not automatically speech errors.
Test fixtures never become default user data.

## Validation

Run the production build and appropriate regression tests. For visible changes,
capture Home, Library and unassessed / assessed Practice at the same viewport.
Outputs stay under ignored `docs/evidence/`. Private references are not a runtime
dependency.

```powershell
npm run build
npx playwright test tests/ui/appearance.spec.ts tests/ui/sidebar.spec.ts
node scripts/capture-reference.cjs review
node scripts/verify-reference-desktop.cjs
```

The screenshot script uses isolated demo data and offline route-only assessment
examples. These validate rendering, not provider accuracy or training outcomes.
