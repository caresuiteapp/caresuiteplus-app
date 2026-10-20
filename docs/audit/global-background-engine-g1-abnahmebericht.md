# Global Background Engine G.1 — Abnahmebericht

Datum: 2026-06-23

## 1. Ausgangsbefund

- Light-Mode nutzte `AnimatedLightPaperBackground` mit 120s SMIL-SVG (34 Layer).
- Chromium/RN-Web: unzuverlässige Layer-Animation, Blinken, keine echte Multi-Element-Orbit-Bewegung.
- `LightGalaxyOrbitNebulaBackground` existierte als unwired Legacy (10 Canvas-Loops, dunkle Palette, lokales `Date.now()`).
- Root-Mount in `app/_layout.tsx` war bereits korrekt (einmalig, kein Route-Key).

## 2. Warum die alte Lösung fehlgeschlagen ist

- SMIL/CSS-Keyframes auf SVG-Gruppen sind in Chromium nicht zuverlässig.
- 120s Loop statt geforderter 240s.
- Keine globale Zeitbasis — Remount/Injection konnte Timeline resetten.
- Paper-Texture wirkte statisch / als Wallpaper, nicht als unabhängige Space-Layer.

## 3. Neue Engine-Architektur

- **Single Canvas + ein rAF-Loop** (`GlobalPersistentSpaceMotionBackground.tsx`).
- **Globale Zeitbasis** (`src/lib/background/backgroundTime.ts`) via `globalThis.__careSuiteBackgroundStartTime` und `performance.now()`.
- **Deterministische Szene** (`persistentSpaceMotionScene.ts`): 6 große, 10 mittlere, 24 kleine Kreise, 12 Linien, 2 Nebel-Layer.
- Zeichenreihenfolge: Base-Gradient → Nebel → Kreise → Linien → Readability-Wash.

## 4. Root-/Shell-Integration

- `GlobalAnimatedBackground` (Light, animated, Web) → `GlobalPersistentSpaceMotionBackground`.
- Fallback: `StaticLightPaperBackground` (Native, reduced motion, `animated=false`).
- `useIsOfficeRoute` / deprecated `isOfficeRoute` Prop entfernt.

## 5. Persistenz über Route-Wechsel

- Background-Komponente bleibt in `RootShell` gemountet.
- Animation-Phase aus globaler Startzeit — Remount der Modul-Shell betrifft Background nicht.
- Browser-Check (unauthentifiziert): Canvas `data-loop-ms="240000"`, `globalThis.__careSuiteBackgroundStartTime` gesetzt, Pixel-Sampling zeigt Bewegung über 2s.

**Einschränkung:** Vollauthentifizierte Modul-Routen (`/assist`, `/pflege`, …) in dieser Session nicht getestet (Login erforderlich). Auth-Shell zeigt Engine bereits korrekt.

## 6. 240-Sekunden-Loop

- `BACKGROUND_LOOP_MS = 240_000`.
- Integer Speed-Multiplikatoren pro Element für nahtlose Periodik.
- Unit-Tests: `t=0` ≈ `t=240000` für repräsentative Kreise; `t=30s` / `t=120s` ≠ `t=0`.

## 7. Layer-Struktur

| Layer | Count |
|-------|-------|
| Große Kreise | 6 |
| Mittlere Kreise | 10 |
| Kleine Partikel | 24 |
| Linien | 12 |
| Nebel | 2 |
| Readability-Wash | 1 (Center-Calming) |

## 8. Bewegungslogik große Kreise

- Lissajous: `sin/cos(phase * speedX/Y + phase)` mit `speedX/Y ∈ {1,2}`.
- Scale- und Opacity-Puls (0.18–0.55).

## 9. Bewegungslogik kleine Kreise

- Höhere Geschwindigkeiten (`speedX` 3–6).
- Eigene Amplituden und Phasen pro Partikel.

## 10. Bewegungslogik Linien

- Drift + Rotation + Längenvariation, eigene Parameter pro Linie.

## 11. Kein-Blinken-Schutz

- Kein React-State pro Frame.
- Config einmal beim Modul-Load.
- Kein innerHTML-Re-Injection.
- Vollständiger Redraw pro Frame nach `clearRect`.

## 12. Reduced Motion

- `usePrefersReducedMotion()` → `StaticLightPaperBackground`.

## 13. Performance-Schutz

- DPR cap 1.5.
- Ein Canvas, ein rAF.
- Pause bei `document.hidden`.
- RAF + Listener cleanup on unmount.

## 14. Browser-/Screenshot-Abnahme

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Canvas Engine aktiv | Ja (`persistent-space-canvas`, loop 240000) |
| Bewegung sichtbar | Ja (Pixel-Sample Δ nach 2s) |
| Hell / Space-Anmutung | Ja (Screenshot Login) |
| Blinken / Verschwinden | Nicht beobachtet in Session |
| Auth-Modul-Routen | Nicht geprüft (Login blockiert) |
| t=30/120/239/250s Screenshots | Teilweise — `zentrale-t0.png` auf Auth-Shell |

Screenshot: `docs/audit/global-background-engine-g1-screenshots/zentrale-t0.png`

## 15. Tests / Typecheck

- **Vitest:** 38 Tests in Background-Suite — alle bestanden (inkl. 15 neue G.1-Tests).
- **Typecheck:** Projektweite `tsc` meldet vorbestehende RN-Web-Style-Typfehler (`100vw`/`100vh` in StyleSheet) — gleiches Muster wie `StaticLightPaperBackground`; keine neue G.1-spezifische Logik-Fehler.

Logs: `.audit-test-global-background-engine-g1.log`, `.audit-typecheck-global-background-engine-g1.log` (nicht committed).

## 16. Nicht ausgeführt

- Keine Dashboard-Fachänderung
- Kein K.6
- Keine Rechnungen / Rechnungsnummern
- Kein Deploy
- Keine Migration
- Keine produktiven Daten
