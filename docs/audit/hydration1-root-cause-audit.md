# HYDRATION.1 — Root-Cause Audit

**Datum:** 2026-07-04  
**Basis:** HYDRATION.0 (`docs/audit/hydration-console-audit.md`), Codebase-Grep, gezielte Hotspot-Analyse  
**HEAD (Start):** `cdfa7591` — `docs(audit): add zeit2 production smoke report`  
**Scope:** SSR/CSR-Stabilisierung — keine Design-, Business-Logic- oder RLS-Änderungen

---

## 1. Pre-Check (Step 0)

| Check | Ergebnis |
|-------|----------|
| `git status --short` | Nur untracked `.audit-expo-8090-zeit2-export-fix.log` |
| `git log --oneline -5` | cdfa7591 → c90ea191 → b367d591 → e53bf2b2 → 678aada9 |
| `git rev-parse HEAD` | `cdfa759195cd929c7120bcd22564cdfc58d5d0fc` |
| `git stash list` | 8 Einträge (nicht angefasst) |

---

## 2. Identifizierte Root Causes

### RC-1 — Viewport-abhängiges Shell-Rendering (Priorität: **Hoch**)

| Komponente | Mechanismus | React-Codes | Risiko |
|------------|-------------|-------------|--------|
| `PerformanceProvider`, `useDevicePerformance` | `useWindowDimensions()` — SSR liefert andere Breite als Client | #418, #422 | Globales Layout-/Background-Mismatch |
| `app/_layout.tsx` `RootShell` | `backgroundAnimated` aus Perf-Profil + `isMobile` | #418, #422 | Unterschiedlicher Background-Subtree (Static vs. Motion) |
| `useDeviceClass`, `usePlatformLayout` | Breakpoint-Entscheidungen im ersten Render | #418, #422 | Compact vs. Desktop Shell — unterschiedliche DOM-Struktur |
| `platformshell.tsx`, `PortalShellLayout.tsx` | Direktes `useWindowDimensions` für Rail/Sidebar/Right-Panel | #418, #422 | Office/MP Shell-Struktur divergiert |
| `HealthOS*View.tsx` | `resolveHealthOSShellBreakpoint(width)` im Render | #418, #421 | KPI-Spalten / Section-Layout |

**Geplanter Fix:** `useHydrationSafeWindowDimensions` — stabile SSR-Breite (1280px) bis `useHydrated()`; zentral in Hooks und Shell-Komponenten.

### RC-2 — Tageszeit-Gruß im Render (Priorität: **Mittel**)

| Komponente | Mechanismus | React-Codes | Risiko |
|------------|-------------|-------------|--------|
| `liveDashboardSnapshot.ts` `getGreeting()` | `new Date().getHours()` — Server-TZ/Stunde ≠ Client | #418 | Text-Mismatch in Hero/Subtitle |
| `DashboardHero`, `OfficeDashboardHero`, `PortalDashboardHero` | `{snapshot.greeting}` direkt im JSX | #418 | Sichtbarer Text-Unterschied |
| `OfficeDashboardView`, `HealthOSOfficeCommandCenterView` | Subtitle mit `snapshot.greeting` | #418 | Section-Header-Mismatch |

**Geplanter Fix:** `HYDRATION_SAFE_GREETING` + `useClientGreeting` / `useClientGreetingLine` — neutraler Platzhalter bis Mount, dann Client-Update.

### RC-3 — Connectivity-Bootstrap (Priorität: **Niedrig–Mittel**)

| Komponente | Mechanismus | React-Codes | Risiko |
|------------|-------------|-------------|--------|
| `useConnectivity` | `readInitialConnectivityState()` las `navigator.onLine` im Client-Initialstate | #418 | Offline-Banner flackert / fehlt falsch |
| `EmployeePortalShell` | `{isOffline ? <OfflineNotice /> : null}` | #418 | Conditional subtree |

**Geplanter Fix:** Web-Initialstate immer `isConnected: true`; Sync erst in `useEffect`.

### RC-4 — Reduced-Motion / Perf-Profil (Priorität: **Niedrig**)

| Komponente | Mechanismus | React-Codes | Risiko |
|------------|-------------|-------------|--------|
| `usePrefersReducedMotion` | Startet `false`, kann nach Mount `true` werden | #418 (begleitend) | Nur Re-Render nach Hydration — kein Erstrender-Mismatch wenn Width gated |
| `devicePerformance.ts` | `matchMedia`/`navigator` in Profil-Ableitung | — | Bereits über Hook-Default abgefedert |

**Geplanter Fix:** Kein separater Fix nötig — RC-1-Gating deckt Background-Entscheid mit ab; `RootShell` zusätzlich `hydrated &&` für Animation.

### RC-5 — RN-Web Style-Arrays / Execute-Hub (Priorität: **Hoch**, separater Defekt)

| Komponente | Mechanismus | React-Codes | Risiko |
|------------|-------------|-------------|--------|
| `/portal/employee/execution` Hub | `CSSStyleDeclaration` indexed setter | #421 | Leerer Body — **nicht** in HYDRATION.1 Scope (kein operativer Pfad) |

**Geplanter Fix:** Keine Änderung in HYDRATION.1 (bekannter separater Defekt laut HYDRATION.0).

### RC-6 — Auth/Supabase Console (Priorität: **N/A für HYDRATION.1**)

Auth-Race und REST 400/403 → **CONSOLE.1**, nicht HYDRATION.1.

---

## 3. Betroffene Routen → Root Cause Mapping

| Route | Primäre RCs | Erwartete Verbesserung |
|-------|-------------|------------------------|
| `/` | RC-1, RC-2 | Background + ggf. Hero stabil |
| `/office` | RC-1, RC-2 | Shell-Struktur + Command-Center-Subtitle |
| `/assist` | RC-1 | Shell + HealthOS Breakpoints |
| `/portal/employee` | RC-1, RC-3 | Portal Shell + Offline-Banner |
| `/portal/employee/arbeitszeit` | RC-1, RC-3 | Wie MP-Kern |
| Execute-Hub | RC-5 | **Unverändert** |
| Assignment Execute | RC-1 (begleitend) | Leichte Verbesserung möglich |

---

## 4. Geplante minimale Fixes (Step 2)

1. **Neue Utilities:** `useHydrated`, `useHydrationSafeWindowDimensions`, `ssrLayoutDefaults`, `timeOfDayGreeting`, `useClientGreeting`
2. **Hooks:** `useDeviceClass`, `usePlatformLayout`, `PerformanceProvider`, `useConnectivity`
3. **Root:** `app/_layout.tsx` — `backgroundAnimated` erst nach Hydration
4. **Shells:** `platformshell.tsx`, `PortalShellLayout.tsx`, HealthOS Views
5. **Heroes:** Dashboard/Office/Portal Hero + OfficeDashboardView + HealthOS Office CC
6. **Tests:** `hydrationSafeDefaults.test.ts`

**Explizit ausgeschlossen:** `suppressHydrationWarning`, Execute-Hub-Fix, CONSOLE.1, OFFLINE.2, Deploy.

---

## 5. Akzeptanzkriterien

- Keine neuen #418/#421/#422 auf Kernrouten in lokalem Web-Smoke (non-minified Dev)
- Bestehende Regression-Suites grün
- Kein Layout-Redesign — kurzer Desktop-first Flash auf Mobile bis Mount akzeptiert

---

## Referenzen

- `docs/audit/hydration-console-audit.md` (HYDRATION.0)
- `docs/audit/hydration1-stabilization-report.md` (Ergebnis, nach Step 5)
