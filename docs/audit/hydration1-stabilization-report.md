# HYDRATION.1 — Stabilization Report

**Datum:** 2026-07-04  
**Phase:** HYDRATION.1 — SSR/CSR-Stabilization  
**Start-HEAD:** `cdfa7591` (`docs(audit): add zeit2 production smoke report`)  
**Deploy:** **Nein** (nicht angefragt)

---

## 1. Zusammenfassung

Minimale Hydration-Fixes ohne Design-, Business-Logic- oder ZEIT.2-Funktionsänderungen. Fokus: stabile SSR/CSR-Grenzen für Viewport-Entscheidungen, Root-Background und Tageszeit-Gruß.

---

## 2. Root Causes (Kurz)

| ID | Ursache | Fix |
|----|---------|-----|
| RC-1 | `useWindowDimensions` → unterschiedliche Shell/Background-Subtrees SSR vs. Client | `useHydrationSafeWindowDimensions` (1280×800 bis Mount) |
| RC-2 | `getGreeting()` / `snapshot.greeting` im JSX | `useClientGreeting` / `useClientGreetingLine` |
| RC-3 | `navigator.onLine` im Connectivity-Initialstate | Immer online bis `useEffect` |
| RC-4 | `backgroundAnimated` vor Hydration | `hydrated &&` in `RootShell` |
| RC-5 | Execute-Hub RN-Web Styles | **Nicht geändert** (separater Defekt) |

Details: `docs/audit/hydration1-root-cause-audit.md`

---

## 3. Geänderte / neue Dateien

### Neu

| Datei | Zweck |
|-------|-------|
| `src/hooks/useHydrated.ts` | Client-Mount-Gate |
| `src/hooks/useHydrationSafeWindowDimensions.ts` | Stabile Viewport-Werte bis Hydration |
| `src/hooks/useClientGreeting.ts` | Hydration-sicherer Tagesgruß |
| `src/lib/platform/ssrLayoutDefaults.ts` | SSR-Konstanten 1280×800 |
| `src/lib/dashboard/timeOfDayGreeting.ts` | Extrahierte Gruß-Logik |
| `src/__tests__/platform/hydrationSafeDefaults.test.ts` | Unit-Tests für Defaults |
| `docs/audit/hydration1-root-cause-audit.md` | Root-Cause-Audit |
| `docs/audit/hydration1-stabilization-report.md` | Dieser Report |

### Geändert

| Datei | Änderung |
|-------|----------|
| `app/_layout.tsx` | Background-Animation erst nach Hydration |
| `src/lib/performance/PerformanceProvider.tsx` | Hydration-safe Width |
| `src/hooks/useDeviceClass.ts` | Hydration-safe Width |
| `src/hooks/usePlatformLayout.ts` | Hydration-safe Dimensions |
| `src/hooks/useConnectivity.ts` | SSR-konsistenter Initialstate |
| `src/lib/dashboard/liveDashboardSnapshot.ts` | Shared `getTimeOfDayGreeting` |
| `src/components/layout/platform/platformshell.tsx` | Hydration-safe Width |
| `src/components/layout/portal/PortalShellLayout.tsx` | Hydration-safe Width |
| `src/components/dashboard/DashboardHero.tsx` | `useClientGreeting` |
| `src/components/office/OfficeDashboardHero.tsx` | `useClientGreeting` |
| `src/components/portal/PortalDashboardHero.tsx` | `useClientGreeting` |
| `src/components/dashboard/OfficeDashboardView.tsx` | `useClientGreetingLine` |
| `src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx` | Greeting + Width |
| `src/components/healthos/assist/HealthOSAssistOperationsView.tsx` | Hydration-safe Width |
| `src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx` | Hydration-safe Width |

---

## 4. Tests & Checks

| Check | Ergebnis |
|-------|----------|
| `npm run typecheck` | **Vorhandene Repo-Fehler** (659 Zeilen, nicht hydration-bedingt) — keine neuen Fehler in geänderten Dateien |
| `hydrationSafeDefaults.test.ts` | **5/5 grün** |
| `responsiveShellR1.test.ts` | **14/14 grün** |
| `perf1Thermal.test.ts` | **7/7 grün** |
| `zeit2OfficeTeamTimekeeping.test.ts` | **18/18 grün** |
| `wfmAbsenceP1.test.ts` | **18/18 grün** |
| `wfmAbsenceApprovalWorkflow.test.ts` | **9/9 grün** |
| `wfmAbsencePortalDateSubmit.test.ts` | **5/5 grün** |
| `employeePortalProfileLive.test.ts` | **24/24 grün** |
| `zeit1EmployeeResolverScreens.test.ts` | **4/4 grün** |
| `offlineIdb.test.ts` | **6/6 grün** |
| `signatureDisplay.test.ts` | **10/10 grün** |
| `signatureCanvasCoords.test.ts` | **9/9 grün** |
| Browser-Smoke (Production) | **Nicht ausgeführt** — lokaler Dev-Smoke empfohlen vor Deploy |

**Gesamt Regression-Lauf (12 Suites):** 129/129 Tests grün.

---

## 5. Verbleibende Gelb-Punkte

| Punkt | Status |
|-------|--------|
| Execute-Hub `/portal/employee/execution` | Unverändert defekt (#421 + leerer Body) |
| Supabase 400/403 Console-Noise | CONSOLE.1 — nicht HYDRATION.1 |
| `toLocaleString('de-DE')` in diversen Screens | Niedrige Priorität — kein Kern-Shell-Pfad |
| Mobile Desktop-first Flash bis Mount (~1 Frame) | Akzeptiert — kein Layout-Redesign |
| Production Hydration-Verifikation | Nach Deploy mit non-minified Dev oder Playwright-Smoke |

---

## 6. Risiko-Einschätzung

| Aspekt | Bewertung |
|--------|-----------|
| Regressionsrisiko | **Niedrig** — zentralisierte Hooks, keine Business-Logic |
| UX-Impact | **Minimal** — kurzer Desktop-Default auf Mobile bis Hydration |
| ZEIT.2 / WFM | **Unberührt** — Regression-Suites grün |
| OFFLINE.2-Vorbereitung | **Verbessert** — stabilere SSR-Grenzen |

---

## 7. Commit

Message: `fix(hydration): stabilize ssr client render boundaries`  
**Hash:** `f4b11c9b8931452114f22ff9b28738d409f9c5af`  
**Kein `[deploy]`**

---

## 8. Empfehlung

HYDRATION.1 abgeschlossen → **OFFLINE.2** kann als nächster Track starten, sofern lokaler Web-Dev-Smoke (Console ohne #418/#421/#422 auf Kernrouten) bestätigt wird.

Parallel optional: **CONSOLE.1** für Supabase-Noise.

---

## Referenzen

- HYDRATION.0: `docs/audit/hydration-console-audit.md`
- Root Cause: `docs/audit/hydration1-root-cause-audit.md`
