# CareSuite+ — Premium Design System (Arbeitspakete 021–040)

Ein zusammenhängender Design-Pass für die Premium-Visual-Identity: zentrale Tokens, erweiterte Oberflächeneffekte und eine interne Showcase-Route.

## Überblick

| WP | Thema | Umsetzung |
|----|-------|-----------|
| 021 | Gradient-Registry | `src/theme/gradients.ts` |
| 022 | Glass-Tokens | `src/theme/designTokens.ts` → `glass` |
| 023 | Sheen-Tokens | `src/theme/designTokens.ts` → `sheen` |
| 024 | Elevation v2 | `src/theme/designTokens.ts` → `elevationV2` |
| 025 | Display-Typografie | `src/theme/typographyScale.ts` → `display` |
| 026 | Hero-Varianten | `src/theme/typographyScale.ts` → `hero`, `heroMuted` |
| 027 | PremiumCard Sheen | `sheen` prop mit `LinearGradient` |
| 028 | Theme-Barrel | `src/theme/index.ts` exportiert neue Tokens |
| 029 | Showcase: Farben | `app/design-system/index.tsx` |
| 030 | Showcase: Typografie | Design-System-Screen |
| 031 | Showcase: Buttons | Design-System-Screen |
| 032 | Showcase: Karten | Default / Elevated / Sheen |
| 033 | Showcase: Badges | Alle Varianten |
| 034 | Showcase: Tokens | Glass, Elevation v2 Demo |
| 035 | Route-Registry | `APP_ROUTES` → `/design-system` |
| 036 | Expo-Route | `app/design-system/` |
| 037 | Navigation-Link Start | `PUBLIC_ENTRIES` |
| 038 | Navigation-Link Fundament | Button auf FundamentScreen |
| 039 | Dokumentation | Dieses Dokument |
| 040 | Verifikation | `npm run typecheck` |

## Token-Schichten

### Gradients (`gradients.ts`)

Zentrale Verläufe für Karten (`card.default`, `card.elevated`), Primary-Actions, Sheen-Overlays und Glass-Panels. Komponenten referenzieren diese statt hardcodierter Hex-Werte.

### Extended Tokens (`designTokens.ts`)

- **glass** — Blur-Stufen, Opacity, Border und Hintergrund für halbtransparente Panels
- **sheen** — Rim-Höhe, Opacity-Stufen, Gradient-Ankerpunkte
- **elevationV2** — Erweitert `elevation` um `floating`, `glass`, `cyanGlow`, `inset`

### Typography Scale (`typographyScale.ts`)

Display- und Hero-Stufen für Screen-Überschriften. Bestehende `typography`-Tokens (h1–caption) bleiben unverändert für Fließtext und UI-Labels.

## PremiumCard Sheen (WP 027)

```tsx
<PremiumCard accentColor={colors.orange} sheen>
  <Text>Glossy Oberfläche</Text>
</PremiumCard>
```

Mit `sheen={true}` ersetzt ein `LinearGradient`-Overlay die einzeilige Top-Rim-Linie durch einen subtilen Glanzverlauf (`gradients.sheen.subtle`).

## Design-System-Route

- **Pfad:** `/design-system`
- **Gruppe:** `system`
- **Auth:** nicht erforderlich
- **Einstieg:** Startscreen-Kachel oder Fundament-Button

Die Showcase-Seite demonstriert Farben, Typografie, Buttons, Karten (inkl. Sheen), Badges und Extended Tokens — als Referenz für Modul- und Feature-Screens.

## Abhängigkeiten

- `expo-linear-gradient` (bereits in PremiumCard/Button genutzt)
- `expo-blur` (vorbereitet für zukünftige Glass-Komponenten; Tokens definiert)

## Bekannte Grenzen (nach WP 040)

- Glass-Blur noch nicht als eigene `GlassPanel`-Komponente extrahiert
- `elevationV2` in Showcase demonstriert, aber noch nicht flächendeckend in allen Screens
- Keine Dark/Light-Theme-Umschaltung (Premium Dark only)
- Animations-Tokens (`motion`) unverändert — Sheen ist statisch

## Nächste Schritte (→ WP 041+)

- `GlassPanel`-Komponente mit `expo-blur`
- Sheen auf `ModuleTile` und `PremiumKpiCard`
- Theme-aware Komponenten-Storybook oder automatisierte Screenshot-Tests
