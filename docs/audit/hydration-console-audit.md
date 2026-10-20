# HYDRATION.0 — React Hydration & Supabase Console Audit

**Datum:** 2026-07-03  
**Production URL:** https://caresuiteplus.app  
**Phase:** HYDRATION.0 (Read-only Audit)  
**Methode:** Production-Browser-Smoke (Playwright), Codebase-Grep, Referenz-Audits  
**Ergebnis-Artefakte (lokal, nicht committed):** `.audit-zeit1-browser-results.json` (Refresh 2026-07-03T09:13:56Z), `.audit-hydration0-run.log`

**Explizit ausgeschlossen:** Code-Änderungen, Deploy, Migrationen, RLS, ZEIT.1, OFFLINE.1

---

## 1. Executive Summary

CareSuite+ Production ist **funktional stabil** — alle geprüften Hauptflows (Office, Assist, Mitarbeiterportal inkl. ZEIT.1-Arbeitszeit) laden ohne White Screen und ohne blockierte Interaktion. Gleichzeitig erscheinen **persistente, reproduzierbare** React-Hydration-Signale (**#418**, **#421**, **#422**) sowie **wiederholte Supabase REST 400/403** in der Browser-Console.

| Signal | Gefunden | Blockierend | White Screen |
|--------|----------|-------------|--------------|
| React #418 | **Ja** | **Nein** | **Nein** |
| React #421 | **Ja** | **Nein** | **Nein** |
| React #422 | **Ja** | **Nein** | **Nein** |
| Supabase 400 | **Ja** | **Nein** | **Nein** |
| Supabase 403 | **Ja** | **Nein** | **Nein** |
| CSSStyleDeclaration (RN-Web) | **Ja** (Execute-Hub) | **Nein** (Assignment-Pfad OK) | **Nein** |

**Klassifikation gesamt:** **Gelb / nicht-blockierend** — kein ZEIT.1-Regressionssignal, kein Production-NO-GO allein deshalb. Hydration und Console-Noise sind **technische Schuld**, die vor oder parallel zu OFFLINE.1 adressiert werden sollte, aber **OFFLINE.1 nicht zwingend blockiert**.

**Wahrscheinlichste Root Cause (Hydration):** SSR/CSR-Mismatch durch **viewport-/performance-abhängiges Rendering** (`useWindowDimensions`, `PerformanceProvider`, `getGreeting()` mit `new Date().getHours()`) plus **React-Native-Web-Style-Hydration** (`CSSStyleDeclaration` indexed setter → #421).

**Wahrscheinlichste Root Cause (Console):** **Auth-Bootstrap-Race** und **Kontext-Queries** (Office/Assist-Dashboard-Probes, Permission-Fetches) bevor Session/Portal-Kontext vollständig; dazu **erwartete RLS-Ablehnungen** für `employee_portal` auf Office-Tabellen.

---

## 2. Betroffene Routen

| Route | Kontext | UI nutzbar | Hydration | Supabase 400/403 | Anmerkung |
|-------|---------|------------|-----------|------------------|-----------|
| `/` | Public | Ja | #418, #422 | Ja | Home/Entry, kein White Screen |
| `/office` | Public → Office (auth) | Ja (6/6 Sektionen) | #418, #422 | Ja | Command Center vollständig |
| `/assist` | Public → Assist (auth) | Ja (6/6 Sektionen) | #418, #422 | Ja | Operations-Dashboard vollständig |
| `/portal/employee` | MP (post-login) | Ja | #418, #421, #422 | Ja | „Heute“, Einsätze sichtbar |
| `/portal/employee/profile` | MP | Ja | #418, #421, #422 | Ja | Profil ohne Resolver-Fehler |
| `/portal/employee/arbeitszeit` | MP | Ja | #418, #421, #422 | Ja | ZEIT.1 grün — kein Profil-Fehlerbanner |
| `/portal/employee/times` | MP | Ja | #418, #421, #422 | Ja | Fahrten & Zeiten (~2779 Zeichen Body) |
| `/portal/employee/arbeitszeit/urlaub` | MP | Ja | #418, #421, #422 | Ja | Urlaub-UI |
| `/portal/employee/arbeitszeit/abwesenheiten` | MP | Ja | #418, #421, #422 | Ja | Abwesenheits-UI |
| `/portal/employee/execution` | MP | **Nein** (leerer Body) | #421 + CSSStyleDeclaration | Ja | Hub-Route bekannt defekt; **nicht** operativer Pfad |
| `/portal/employee/assignments/{id}/execute` | MP | Ja (~413 Zeichen) | Nicht separat isoliert | Ja | Operativer Execute-Pfad **grün** |

**Lokal:** Kein separater Localhost-Lauf in HYDRATION.0 (Expo-Dev nicht als Gate gefordert; Production-Smoke als Referenz).

---

## 3. Hydration Error Matrix

| Route | #418 | #421 | #422 | Timing | Sichtbarer Impact | Reproduzierbar |
|-------|------|------|------|--------|-------------------|----------------|
| `/` | Ja | — | Ja | Initial load | Keiner | Ja |
| `/office` | Ja | — | Ja | Initial load / Navigation | Keiner | Ja |
| `/assist` | Ja | — | Ja | Initial load / Navigation | Keiner | Ja |
| `/portal/employee` | Ja | Ja | Ja | Post-login initial + Navigation | Keiner | Ja |
| `/portal/employee/profile` | Ja | Ja | Ja | Route navigation | Keiner | Ja |
| `/portal/employee/arbeitszeit` | Ja | Ja | Ja | Route navigation | Keiner | Ja |
| `/portal/employee/times` | Ja | Ja | Ja | Route navigation | Keiner | Ja |
| `/portal/employee/arbeitszeit/urlaub` | Ja | Ja | Ja | Route navigation | Keiner | Ja |
| `/portal/employee/arbeitszeit/abwesenheiten` | Ja | Ja | Ja | Route navigation | Keiner | Ja |
| `/portal/employee/execution` | — | Ja | — | Navigation | Leerer Body + CSSStyleDeclaration | Ja |
| Assignment Execute | Ja* | Ja* | Ja* | Navigation | Keiner (funktional) | Ja |

\*Gleiche Session-Runtime-Errors wie MP-Routen; Execute-UI selbst nutzbar.

### React-Fehlercodes (Decode)

| Code | Bedeutung | Beobachtung |
|------|-----------|-------------|
| **#418** | Hydration failed — initial UI ≠ server HTML | Mehrfach pro Navigation, global |
| **#421** | Suspense boundary update before hydration finished | Vor allem MP + Execute-Hub |
| **#422** | Hydration error, recovered via client render | Begleitend zu #418 |

### Zusätzliches Runtime-Signal

```
TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration': Indexed property setter is not supported.
```

- **Route:** primär `/portal/employee/execution` (Hub)
- **Impact:** Leerer Body auf Hub; **Assignment-Execute-Pfad** (`/assignments/{id}/execute`) unbeeinträchtigt
- **Hypothese:** React-Native-Web Style-Array-Hydration (bekanntes RN-Web-Muster)

---

## 4. Supabase 400/403 Matrix

Console-Messages enthalten **keine URL** (`Failed to load resource: the server responded with a status of 400/403`). Klassifikation aus Code-Pfaden, prior Smokes und Request-Mustern.

| Endpoint / Tabelle (identifiziert) | Status | Route(n) | Kontext | Blockierend | UI-Fehler | Erwartet vs. Bug |
|-----------------------------------|--------|----------|---------|-------------|-----------|------------------|
| `/rest/v1/roles` | 400/403 | Global bootstrap | Business + MP | Nein | Nein | **Teilweise erwartet** — `employee_portal` nicht in `roles`-Tabelle |
| `/rest/v1/role_permissions` | 403 | Auth bootstrap | Office / Assist | Nein | Nein | **Erwartet** wenn Rolle nicht auflösbar |
| `/rest/v1/role_permission_sets` | 403 | Permission fetch | Office | Nein | Nein | **Erwartet** für fehlende Tenant-Overrides |
| `/rest/v1/tenant_products` | 403 | Module hydration | Alle authentifizierten | Nein | Nein | **Race** — vor Tenant-Kontext |
| `/rest/v1/profiles` | 403 | Auth bootstrap | MP (portal-only) | Nein | Nein | **Erwartet** — kein Business-Profil |
| `/rest/v1/clients`, `/employees`, `/assignments`, … | 400/403 | `/`, `/office`, `/assist` Dashboard counts | Public / pre-auth | Nein | Nein | **Erwartet** ohne Session |
| `/rest/v1/message_threads` | 403 | MP Overview | MP | Nein | Nein | **Prüfen** — RLS vs. premature query; UI zeigt 0 Nachrichten |
| `/rest/v1/wfm_work_sessions` | 400 | MP Arbeitszeit | MP | Nein | Nein | **Nicht ZEIT.1** — Resolver fix verifiziert; evtl. leere/Filter-400 |
| `/rest/v1/production_tasks`, `/qm_documents`, `/portal_requests` | 400 | Office Command Center | Office | Nein | Nein | **Probe/Filter** — `countByFilter` head requests |
| Diverse `fromUnknownTable` Probes | 400 | Cross-module | Assist/Office | Nein | Nein | **Schema/RLS-Probe** — `missingtablefallback` fängt ab |

**Magnitude (Production-Smoke-Referenz):** ~8–15× HTTP 400 und ~5–8× HTTP 403 pro MP-Session über alle Routen (`.audit-zeit1-browser-results.json`, `production-smoke-healthos-h3-h5-results.json`: 46–59 Console-Errors gesamt).

**Blockierende Supabase-Fehler:** **Keine** auf Hauptflows (UI rendert, Daten wo erwartet).

---

## 5. Reproduktionsschritte

### 5.1 Production — Hydration (Public)

1. Browser → https://caresuiteplus.app/ (Hard Reload)
2. DevTools → Console
3. **Erwartung:** Minified React error #418, #422 (mehrfach); UI vollständig
4. Wiederholen für `/office`, `/assist` (ohne Login: Redirect/Gast — gleiche Hydration-Signale)

### 5.2 Production — Hydration + Console (Mitarbeiterportal)

1. Credentials aus `.env.local`: `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD` (nicht loggen)
2. Playwright-Skript: `.audit-zeit1-browser-smoke.mjs` mit `AUDIT_WEB_URL=https://caresuiteplus.app`
3. Nach Login nacheinander navigieren:
   - `/portal/employee`
   - `/portal/employee/profile`
   - `/portal/employee/arbeitszeit`
   - `/portal/employee/times`
   - `/portal/employee/arbeitszeit/urlaub`
   - `/portal/employee/arbeitszeit/abwesenheiten`
4. **Erwartung:** #418 + #421 + #422; 400/403 Console-Noise; **kein** „Kein Mitarbeiterprofil…“
5. Execute: `/portal/employee/assignments/d68152bd-978a-4733-9c94-463f4a375316/execute` → UI OK

### 5.3 Production — Execute-Hub (bekanntes Nebenproblem)

1. `/portal/employee/execution` öffnen
2. **Erwartung:** Leerer Body, CSSStyleDeclaration-TypeError, #421
3. **Workaround:** Assignment-Execute-URL verwenden (operativ)

### 5.4 Dev-Reproduktion (optional, HYDRATION.1)

1. `npx expo start --web` (nicht-minified)
2. Gleiche Routen — React zeigt dann **volle** Hydration-Mismatch-Messages statt #418/#422
3. React DevTools → Components mit unterschiedlichem SSR/CSR-Text (z. B. Tagesgruß)

---

## 6. Root-Cause-Hypothesen

### 6.1 Hydration — Code-Hotspots (read-only)

| Muster | Datei(en) | Mechanismus | Priorität |
|--------|-----------|-------------|-----------|
| Viewport-Breakpoints im Render | `PerformanceProvider.tsx`, `devicePerformance.ts`, `HealthOS*Shell*.tsx`, `platformshell.tsx` | `useWindowDimensions()` — SSR-Default vs. Client-Breite → unterschiedliche Klassen/Layouts | **Hoch** |
| Reduced-Motion / matchMedia | `useprefersreducedmotion.ts`, `devicePerformance.ts` | Initial `false`, nach `useEffect` ggf. `true` → `GlobalAnimatedBackground` Toggle in `_layout.tsx` | **Hoch** |
| Tageszeit-Gruß | `liveDashboardSnapshot.ts`, `officeDashboard.ts`, `dashboard.ts` | `new Date().getHours()` im Snapshot — SSR-Zeitzone ≠ Client | **Mittel** |
| Datumsformatierung im Render | `notificationcenter.tsx`, `officebroadcastslist.tsx`, `EmployeePortalTimesScreen.tsx` | `toLocaleString('de-DE')` — Locale/Timezone-Mismatch | **Mittel** |
| RN-Web Styles | React-Native-Web + Style-Arrays | `CSSStyleDeclaration` indexed setter → #421, Execute-Hub-Crash | **Hoch** (Hub) |
| Store-Mutation im Render (behoben?) | `employeePortalVisitTrackingService.ts` | Kommentar „React #421“ — `readOnlyTrackingEntry` existiert | **Niedrig** (Guard vorhanden) |
| Auth/Session Mismatch | `AuthProvider.tsx` | Portal vs. Supabase Session — unterschiedlicher initialer User-State | **Mittel** |

### 6.2 Supabase 400/403 — Code-Hotspots

| Muster | Datei(en) | Mechanismus | Priorität |
|--------|-----------|-------------|-----------|
| Permission-Fetch vor Rolle | `permissionRepository.ts`, `AuthProvider.tsx` | `roles`/`role_permissions` für `employee_portal` | **Hoch** |
| Module-Hydration Race | `moduleAccessHydration.ts` | `tenant_products` vor vollständigem Bootstrap | **Mittel** |
| Dashboard Parallel-Counts | `officeDashboardRepository.supabase.ts` | ~15 parallele `countByFilter` — RLS/400 bei fehlendem Zugriff | **Mittel** |
| Public-Route Live-Queries | Auth-Gates in Layout/Services | Queries ohne Session auf `/`, `/office`, `/assist` | **Erwartet** |
| MP Message-Threads | `employeePortalExecutionLiveService.ts` | `message_threads` unread count — 403 still → 0 | **Prüfen** |

**Nicht ZEIT.1:** `resolveEmployeeIdForUser` Fix verifiziert — Arbeitszeit-UI ohne Profil-Fehlerbanner.

---

## 7. Kritikalität

| Kategorie | Elemente | Bewertung |
|-----------|----------|-----------|
| **Blockierend** | — | Keine auf Hauptflows |
| **Nicht-blockierend** | #418/#422 global, MP #421, Supabase 400/403 | Gelb — Console-Rauschen, React recovert |
| **Kosmetisch** | Hydration-Warnungen ohne Layout-Sprung | Ja |
| **Test-Script-Noise** | `.audit-zeit1-browser-smoke.mjs` markiert Routes „rot“ wegen strikter React-Error-Regel | Manuell überschreiben (wie ZEIT.1-Smoke) |
| **Separates Defekt** | `/portal/employee/execution` Hub leer | Nicht HYDRATION-only — RN-Web + Routing |

---

## 8. Empfohlene Fix-Phasen

### HYDRATION.1 (empfohlen als nächster Track)

1. **Dev-Modus-Repro** mit non-minified React — exakte DOM-Diffs identifizieren
2. **PerformanceProvider / RootShell:** SSR-safe defaults; `useWindowDimensions` erst nach `mounted` für layout-kritische Zweige
3. **`getGreeting()` / relative Zeiten:** statischer SSR-Placeholder + Client-Replace in `useEffect`
4. **RN-Web Styles:** Style-Array-Hydration an Execute-Hub und globalen Shell-Komponenten prüfen
5. **Acceptance:** Keine #418/#421/#422 auf `/`, `/office`, `/assist`, MP-Kernrouten; Execute-Hub entweder fixen oder deprecaten

### CONSOLE.1 (parallel oder direkt nach HYDRATION.1)

1. **Network-Interceptor-Audit** — exakte 400/403 URLs pro Route dokumentieren
2. **Auth-Gating:** Supabase-Queries erst nach `isInitialized && (session || portalSession)`
3. **`fetchRuntimePermissions`:** Early-return für `employee_portal` ohne `roles`-Row
4. **Dashboard Probes:** Fehlgeschlagene counts nicht als Console-Error (head + graceful degrade)
5. **Acceptance:** ≤N erwartete 403 pro Kontext, 0 unerwartete 400

### Optional später

- Execute-Hub `/portal/employee/execution` → Redirect auf Assignments oder Fix
- ESLint-Regel: kein `Date.now()` / `new Date()` in Render-Pfad

---

## 9. Was bewusst nicht geändert wurde

- Kein App-Code, keine Migrationen, keine RLS
- Kein ZEIT.1-Rollback oder -Touch
- Kein OFFLINE.1 (IndexedDB/Outbox)
- Kein Deploy / kein `[deploy]`
- Kein Commit der Audit-Artefakte (`.audit-*`)

---

## 10. Empfehlung: Fix before OFFLINE.1?

| Option | Empfehlung | Begründung |
|--------|------------|------------|
| **OFFLINE.1 sofort freigeben** | **Ja, mit Gelb-Akzeptanz** | Hydration/Console blockieren MP-Execute nicht; ZEIT.1 grün |
| **HYDRATION.1 vor OFFLINE.1** | **Optional, nicht zwingend** | Reduziert Debug-Rauschen während Offline-Entwicklung |
| **CONSOLE.1 vor OFFLINE.1** | **Sinnvoll parallel** | Falsche 403/400 erschweren Sync-Diagnose — aber nicht blockierend |
| **Production Deploy-Gate** | **Unverändert Restricted GO** | Gleiche Bewertung wie `zeit1-production-smoke.md` |

**Fazit:** **OFFLINE.1 kann trotz gelber Console starten.** HYDRATION.1 + CONSOLE.1 als **parallele Qualitäts-Tracks** empfohlen, nicht als harte Vorbedingung.

---

## Referenzen

- `docs/audit/zeit1-production-smoke.md` — Hydration/Console als gelb dokumentiert
- `docs/audit/production-smoke-healthos-h3-h5-assist-fix.md` — #418/#422, 59 Console-Errors
- `docs/audit/production-office-route-hotfix-resmoke.md` — #418/#422 auf `/` und `/office`
- `docs/audit/timekeeping-system-audit-and-blueprint.md` — ZEIT.1 Kontext
- `docs/audit/offline-first-portal-execution-blueprint.md` — OFFLINE.0/1 Scope

---

## Abschlussbericht (Kurz)

| Feld | Wert |
|------|------|
| Audit fertig | **Ja** |
| Code geändert | **Nein** (nur dieses Dokument) |
| Hydration #418 | **Ja** |
| Hydration #421 | **Ja** |
| Hydration #422 | **Ja** |
| Blockierend | **Nein** |
| White Screen (Hauptflows) | **Nein** |
| Betroffene Hauptrouten | `/`, `/office`, `/assist`, alle MP-ZEIT.1-Routen |
| Supabase 400 | **Ja** |
| Supabase 403 | **Ja** |
| Blockierende Supabase-Fehler | **Nein** |
| Wahrscheinlichste Root Cause | Viewport/Performance SSR-Mismatch + RN-Web Styles; Auth-Race/RLS-Probes für Console |
| Empfohlene nächste Phase | **HYDRATION.1** + **CONSOLE.1** parallel; **OFFLINE.1 freigeben** |
| Commit-Readiness Audit-Dokument | **Ja** |
| Deploy-Readiness | **Nein** (kein Deploy angefragt) |
