# CareSuite+ — Barrierefreiheit (Arbeitspaket 018)

## Ziel

Zentrale Accessibility-Tokens und ein Hook für System-Font-Scale — ohne Layout-Brüche bei großen Schriftgrößen.

## Tokens (`src/theme/accessibility.ts`)

| Export | Wert / Zweck |
|--------|--------------|
| `accessibility.minTouchSize` | 44 pt — WCAG 2.5.5 / iOS HIG |
| `accessibility.recommendedTouchSize` | 48 pt — Material-Empfehlung |
| `accessibility.maxFontScale` | 1.5 — Cap für Layout-Stabilität |
| `buttonHeights.sm` / `.md` | 44 / 48 — Mindest-Button-Höhen |
| `scaleFontSize(base, fontScale, maxScale?)` | Skalierte Schriftgröße |
| `minTouchHeight(requested)` | Erzwingt Touch-Minimum |
| `getFontScaleTier(fontScale)` | `normal` / `large` / `extraLarge` |

## Hook (`src/hooks/useAccessibility.ts`)

```typescript
const { fontScale, fontScaleTier, buttonHeights, scaleFontSize, minTouchHeight } =
  useAccessibility();
```

Liest `fontScale` aus `useWindowDimensions()` (Fallback: `PixelRatio.getFontScale()`).

## Anwendung

- **`PremiumButton`**: `buttonHeights` für Mindesthöhe; `scaleFontSize` für Label
- Weitere interaktive UI-Komponenten können dieselben Tokens nutzen

## Bekannte Grenzen (nach WP 018)

- Screenreader-Labels (`accessibilityLabel`) noch nicht flächendeckend
- Reduzierte Bewegung (`reduceMotion`) folgt in späteren UX-Paketen
- Kontrast-Audit für alle Farbkombinationen ausstehend
