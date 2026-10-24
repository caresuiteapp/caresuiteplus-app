# Web/Desktop icon system

## Rendering contracts

| Use | Component | Size / appearance |
| --- | --- | --- |
| Desktop widgets, launcher cards, module artwork | `DesktopCatalogArtwork.web` | Existing outer stage; visible motif fills 88% of its shorter edge, aspect ratio preserved |
| Existing decorative symbol slots | `SemanticArtwork` | Explicit symbol mapping; Web renders artwork or vectors, native retains original Text and props |
| Buttons, navigation, compact statuses | `WebActionIcon.web` | 24-unit viewBox; 16 / 20 / 24 / 32 px roles; 1.8 rounded stroke; currentColor |
| Legacy Space module/KPI artwork | `SpaceKpiIcon.web`, `SpaceModuleIcon.web` | Entire drawing scales from a 40 px design plane into the existing shell |
| Inline icon and label | `SemanticIconLabel` | Decorative Web icon plus visible text; original inline native label |

Do not scale the card, widget, button or entire screen to fix icon size. Do not apply global `svg` or `img` overrides: charts, maps, signatures, logos and uploaded images have separate contracts. Accessible names belong to the surrounding control; decorative imagery must not become an additional keyboard stop.

## Asset measurements

The original catalogue uses unequal transparent canvas padding. For example, a 64 px stage previously showed the QM document folder at roughly 20 px and the handbook at 56 px. The normalized viewport gives both a 56.32 px visible longest edge without increasing the stage.

`desktopArtworkAssets.web.ts` records dimensions, body bounds (alpha >= 32), protected shadow bounds (alpha >= 4), and byte counts for 98 source files. The renderer centres the body and expands the viewport when a future shadow requires it. Existing PNG pixels remain unchanged. Fixed stages select a source with sufficient actual motif pixels for a 2x rendering where available; responsive stages select the best meaningful resolution. Unknown/custom sources keep the existing contain behavior.

Regenerate measurements after changing artwork:

```sh
python3 scripts/generate-desktop-artwork-metadata.py
python3 scripts/generate-desktop-artwork-metadata.py --check
```

The new `assets/healthos/widgets-premium/web/document-catalog-3d.png` is a Web-only replacement for the flatter catalogue illustration. The native catalogue continues to reference its original asset.

## Validation and scope

The icon release gate runs before the existing Web production verification chain. Additional local geometry checks use the existing Node runtime:

```sh
npm run verify:web-icons:release
node --test scripts/checks/desktop-artwork-geometry.node.test.mjs scripts/checks/space-icon-geometry-web.node.test.mjs
```

The standalone Node tests require a Node version supporting TypeScript stripping; the production gate uses the repository's existing Vitest/esbuild setup instead.

Coverage includes desktop catalogue/workflow suggestions, page heroes, shared cards and states, navigation, and the Web workspace action renderers. User-authored emojis, emoji pickers, data/status text, diagrams and native-only renderers are intentionally retained. Native fallbacks discard Web-only sizing/color props and preserve their original Text rendering.

Visual asset review covers all 98 sources on light/dark backgrounds and 32/64/96 px samples, including QM before/after geometry. This is a source-artwork review, not a browser layout or authenticated end-to-end acceptance. Broad/narrow containers, font zoom, hover/focus states and actual app navigation still require a browser check against the built preview.
