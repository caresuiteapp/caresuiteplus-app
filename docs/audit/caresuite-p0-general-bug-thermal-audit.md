# CareSuite+ — P0 Quick Audit: Allgemeine Fehler, Legacy-Daten & Endgeräte-Hitze

**Datum:** 2026-07-06  
**Branch:** `main`  
**HEAD:** `d294da36c82e55e50bf6081164fa095195dd3f97` — chore(deploy): production release K.1 client portal refactor [deploy]  
**Methode:** Git-Precheck, statische Code-Analyse (Thermal/Polling/Realtime/GPS/Demo-Daten), Vitest-Suite (relevante Tests), Smoke-Check (Typecheck)

---

## 1. Git-Precheck

| Punkt | Befund |
|-------|--------|
| Branch | `main` |
| HEAD | `d294da36` |
| Lokale Änderungen (tracked) | **Keine** vor Audit-Start; **2 Hotfixes** während Audit (uncommitted, siehe §6) |
| Staged | **Keine** |
| Untracked | ~76 Audit-Artefakte (`.audit-*`, Screenshots, `docs/audit/messaging-*`) — nicht gestaged, nicht überschrieben |
| Deploy-/Production-relevant | Keine staged Änderungen; lokale Fixes noch **nicht** committed/deployed |

---

## 2. Geprüfte Bereiche

Statische Prüfung + Abgleich mit PERF.1-/Thermal-Audits (2026-06-29 / 2026-07-01) und Vitest-Strukturtests:

| Bereich | Prüfung | Ergebnis |
|---------|---------|----------|
| Login / Auth / Mandantenstart | Root-Layout, Auth-Stack, Session-Routing | OK — Office-Background gated; Auth transparent |
| Office Dashboard | Polling/Realtime, Demo-Daten | OK — visibility-aware Polling (PERF.1) |
| Office Klient:innen / Mitarbeitende / Einsätze | Entity-Listen, Routen | Kein neuer P0 in Static Scan |
| Office Nachrichten | `officemessagerealtime.ts` | OK — Dedup + visibility-aware Demo-Poll |
| Office Dokumente / Signaturen | Demo-Kontext `documentContext.ts` | OK — Demo nur bei `isDemoMode()` |
| Mitarbeiter:innenportal | Portal-Layout, Live-Einsatz, GPS | **P0 gefunden** → repariert (§5) |
| Klient:innenportal | Greeting, Sidebar, Live-Tracking | OK — AVENTA-Fallback behoben (K.1); Polling visibility-aware |
| Live-Einsatz / Einsatzabschluss | `useLiveVisitTimers`, GPS-Singleton | OK — 1s-Tick pausiert bei hidden Tab |
| Nachrichtenmodul | Realtime + Focus-Context | OK — Context memoized, Cleanup vorhanden |
| Einstellungen / Unternehmensdaten | Tenant-Services | Kein Demo-Leak in UI-Strings |
| Mobile / Tablet / Desktop | Performance-Profile, Backgrounds | **P0 Portal-Background** → repariert |
| Browser Smoke (Live) | Kein Dev-Server / keine Prod-Session in dieser Session | **Nicht durchgeführt** — siehe §9 |

---

## 3. Gefundene Probleme (P0 / P1 / P2)

### P0

| ID | Problem | Bereich | Status |
|----|---------|---------|--------|
| P0-T1 | **Portal-Shell animierte Canvas/RAF-Hintergründe auf Mobile** — `app/portal/_layout.tsx` → `ShellAnimatedBackgroundLayer` mit `animated=true` (Default), während `app/_layout.tsx` Mobile/Heavy-Effects korrekt deaktiviert | Mitarbeiter-/Klient:innenportal Mobile | **Repariert** |
| P0-T2 | **Keine echte Geräte-Thermal-Validierung** nach Fix | Mobile/Tablet Release | **Offen / Blocker** |

### P1

| ID | Problem | Bereich | Status |
|----|---------|---------|--------|
| P1-T1 | **Map-Polling bei verstecktem Tab** — `useVisibleMapPolling` prüfte `document.hidden` nur beim Effect-Start | Office/Portal Live-Karten | **Repariert** |
| P1-B1 | **~300 vorbestehende TypeScript-Fehler** — Smoke/`npm run typecheck` schlägt fehl | CI / Qualität | Offen (pre-existing) |
| P1-D1 | Demo-Firmennamen (`CareSuite Demo Pflegedienst GmbH`) in Template-Seeds | Dokumente (Demo-Modus) | OK by design — nicht in Live/Supabase |
| P1-L1 | `console.warn` in `resolvePortalContext` bei RLS-Fehlern | Portal (Prod-Konsole) | Offen — kein User-sichtbarer Bug |

### P2

| ID | Problem | Status |
|----|---------|--------|
| P2-P1 | Kalender-Grids ohne Virtualisierung bei sehr großen Event-Mengen | Empfehlung, kein Fix |
| P2-C1 | Interne `TODO`-Kommentare in Wizard-Komponenten (nicht UI-sichtbar) | Akzeptiert |
| P2-V1 | Vitest-Gesamtsuite: ~334 pre-existing Failures | Bekannt |

---

## 4. Thermal- / Performance-Befund

### Bereits abgesichert (PERF.1, unverändert gültig)

- `useVisibilityAwarePolling` / `createVisibilityAwareInterval` für Live-Refresh, Assist-Live, Portal-Live-Tracking
- GPS-Singleton `useSingleGeolocationWatch` — ein `watchPosition` pro Session-Key
- Realtime Dedup via `channelManager` + Cleanup in `useManagedSupabaseChannel`
- `useLiveVisitTimers` — 1s-Tick nur bei aktivem Einsatz, pausiert bei hidden Tab
- Root `app/_layout.tsx`: `backgroundAnimated = shouldUseHeavyEffects(perf) && !perf.isMobile`
- `PerformanceProvider` + `performanceCss.ts` — Blur/Heavy-Effects auf Mobile Safari aus
- Canvas-Backgrounds (`GlobalPersistentSpaceMotionBackground`) — `visibilitychange` pausiert RAF

### Neue Befunde (dieser Audit)

1. **Portal-Layout bypass:** Portal-Routen nutzen eigenes `ShellAnimatedBackgroundLayer` **ohne** Performance-Gate → permanenter 60fps Canvas-Loop auf iPhone/Android Web/PWA → **Hauptursache für wiederholte Hitze-Meldungen im Portal**.
2. **Map sichtbar + Tab hidden:** Live-Karten konnten 15s-Polling im Hintergrund weiterlaufen.

### Messpunkte (Browser-Simulation)

| Messpunkt | Ergebnis |
|-----------|----------|
| Konsolenfehler (Live-Browser) | Nicht gemessen — keine Session |
| Netzwerk-Request-Schleifen | Code: keine neuen unbounded Loops; Portal-Poll + Realtime mit Cleanup |
| Re-Render-Stürme | Keine `setState`-in-Render-Pfade; Provider memoized |
| Timer/Subscription-Leaks | 2 Lücken gefunden → gefixt (§6) |
| Tab hidden | Fixes pausieren Polling/Animation |
| 3 Min Idle | Nicht live gemessen |
| Portal ↔ Office Wechsel | Nicht live gemessen |

---

## 5. Root Causes

| Root Cause | Auswirkung | Fix |
|------------|------------|-----|
| **Asymmetrisches Background-Gating** — Office über Root-Layout gated, Portal über separates Layout ungated | Dauer-CPU/GPU auf Mobile im Portal | `ShellAnimatedBackgroundLayer`: `shouldUseHeavyEffects` + `!isMobile` + `useHydrated` |
| **Map-Poll ohne Tab-Visibility-Reaktion** | Hintergrund-Network/CPU bei Live-Karte | `useVisibleMapPolling`: `visibilitychange` + `AppState` |
| **Fehlende Geräte-Validierung** | Hitze-Risiko nicht quantifizierbar | Echtes iPhone/iPad/Android erforderlich |

Demo-/Legacy-Daten: Kein Leak von Helferhasen+/AVENTA/Musterpflege in produktive UI-Strings gefunden (nur Tests/Docs). Klient:innen-Greeting nutzt `resolveClientPortalHeroLines` — Tenant nie als Name.

---

## 6. Geänderte Dateien (Audit-Hotfixes, uncommitted)

| Datei | Änderung |
|-------|----------|
| `src/components/ui/effects/ShellAnimatedBackgroundLayer.tsx` | Performance-Gate wie Root-Layout — statischer Light-Paper-/Static-Fallback auf Mobile |
| `src/components/maps/useVisibleMapPolling.ts` | Polling pausiert bei hidden Tab / inactive AppState |
| `src/__tests__/portal/portalAnimatedBackground.test.ts` | Regression: Shell muss `shouldUseHeavyEffects` nutzen |
| `src/__tests__/maps/useVisibleMapPolling.test.ts` | Neu: Visibility-Gate-Strukturtest |

---

## 7. Tests

| Test | Ergebnis |
|------|----------|
| `vitest run src/__tests__/performance/perf1Thermal.test.ts` | **7/7 PASS** |
| `vitest run src/__tests__/portal/portalAnimatedBackground.test.ts` | **9/9 PASS** (inkl. neuer Gate-Test) |
| `vitest run src/__tests__/maps/useVisibleMapPolling.test.ts` | **1/1 PASS** |
| `vitest run src/__tests__/portal/clientPortalGreeting.test.ts` | **2/2 PASS** |
| `npm run smoke` (enthält typecheck) | **FAIL** — pre-existing TS (~300 Fehler, u.a. Portal/Pflege-Screens) |
| Browser Smoke Desktop/Mobile/Tablet | **Nicht durchgeführt** (keine laufende App-Session) |
| Playwright E2E | **Nicht ausgeführt** in dieser Session |

**Neu verursachte Test-Failures:** Keine.

---

## 8. Offene Risiken

- **Thermisch:** Fix adressiert wahrscheinlichste Portal-Ursache, aber **ohne echtes Gerät nicht freigebbar**.
- **Typecheck:** Weiterhin rot — Release-Risiko für undetected TS-Regressions.
- **Live-Einsatz 1s-Timer:** Bewusst UX-kritisch während aktiver Einsätze — akzeptiert, pausiert bei hidden.
- **Screensaver / Voice-Aufnahme:** Intervalle nur bei aktivem Feature — OK.
- **Globale Vitest-Failures:** Maskieren potenzielle Regressionen.

---

## 9. Echte Geräteprüfung

**Durchgeführt: Nein**

- Kein iPhone, Android-Gerät oder iPad in dieser Audit-Session verfügbar.
- Playwright/Browser-Simulation ersetzt **keine** reale Thermal-Prüfung (CPU-Sensor, Akku, Wärme nach 2–5 Min Portal-Nutzung).
- **Release bleibt für Mobile/Tablet thermisch nicht freigegeben**, bis echte Geräte geprüft wurden.

---

## 10. Empfehlung

**RELEASE BLOCKED** (Mobile/Tablet thermisch + Typecheck rot)

Desktop/Web Office: nach Code-Fix wahrscheinlich OK, aber Portal-Mobile **zwingend** auf echtem Gerät retesten (5 Min Portal scrollen + optional Live-Einsatz + Tab-Wechsel).

---

# CARESUITE+ P0 QUICK AUDIT — ABSCHLUSS

## Ergebnis

**RELEASE BLOCKED**

## Hauptbefund

Portal-Routen liefen auf Mobile mit **permanent animiertem Canvas-Hintergrund** (60fps RAF), obwohl Office-Routen dasselbe bereits deaktiviert hatten — wahrscheinlichster Thermal-Blocker für Mitarbeiter-/Klient:innenportal. Zusätzlich Map-Polling ohne Tab-Pause. Beides minimal repariert. Keine Demo-/AVENTA-Daten-Leaks in UI gefunden.

## Thermal-Befund

PERF.1-Infrastruktur (Polling, GPS, Realtime) weiterhin solide. **Kritishe Lücke:** Portal-Background ungated → repariert. **Echte Geräte-Thermal-Prüfung fehlt** — Mobile-Freigabe nicht möglich.

## Gefundene P0

- P0-T1: Portal `ShellAnimatedBackgroundLayer` — Dauer-Animation auf Mobile (**repariert**)
- P0-T2: Keine echte Geräte-Thermal-Validierung (**offen**)

## Gefundene P1

- P1-T1: Map-Polling bei hidden Tab (**repariert**)
- P1-B1: Vorbestehende TypeScript-Fehler (~300) — Smoke fail
- P1-L1: `console.warn` bei Portal-Context-RLS (kosmetisch)

## Repariert

- `src/components/ui/effects/ShellAnimatedBackgroundLayer.tsx`
- `src/components/maps/useVisibleMapPolling.ts`
- `src/__tests__/portal/portalAnimatedBackground.test.ts`
- `src/__tests__/maps/useVisibleMapPolling.test.ts`

## Nicht repariert / offen

- Echte iPhone/iPad/Android Thermal-Retest
- Vorbestehende Typecheck-Fehler
- Kalender-Virtualisierung (P2)
- Live-Browser-Smoke aller 14 Prüfbereiche

## Tests

- PERF.1 + Portal-Background + Map-Polling + Greeting: **17/17 PASS**
- Smoke/Typecheck: **FAIL** (pre-existing)
- Browser/Playwright: **nicht ausgeführt**

## Risiko

Portal-Hitze-Fix ist logisch korrekt und regression-getestet, aber **ohne Hardware-Validierung** bleibt Mobile ein Hard-Blocker. Typecheck-Rot erhöht Regressionsrisiko.

## Nächster sinnvoller Schritt

1. Auf **echtem iPhone/Android** 5 Min Klient:innenportal + Mitarbeiterportal (Nachrichten, Live-Karte falls aktiv) — Gerät soll kühl/bleiben.
2. Bei OK: Hotfixes committen (ohne `[deploy]` bis Freigabe).
3. Parallel: Typecheck-Top-Fehler in Portal/Pflege-Screens triagieren.
