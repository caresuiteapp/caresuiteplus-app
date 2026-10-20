# Production Smoke — OFFLINE.2 Assignment List Cache

**Datum:** 2026-07-04  
**Production URL:** https://caresuiteplus.app  
**OFFLINE.2 Code-Commit:** `c5d491cb` — `fix(offline): persist employee assignment list cache at runtime`  
**Vorgänger-Commits:** `b95c2655` (multi-entry cache), `b98f3743` / `d3c26592` (assignment cache fallback)  
**Deploy-Trigger-Commit:** `360a9a4d` — `chore(deploy): release offline2 assignment cache [deploy]`  
**Smoke-Skripte (lokal, nicht committed):**
- `.audit-offline2-local-smoke.mjs` mit `AUDIT_WEB_URL=https://caresuiteplus.app` → `.audit-offline2-local-smoke-results.json`
- `.audit-offline2-prod-testd.mjs` (Test D — SPA-Klick statt `page.goto` offline)
- `.audit-offline2-prod-supplement.mjs` (Regressionen PROFILE/ABSENCE/ZEIT.2)

---

## Phase 1 — Pre-deploy Gate

| Check | Ergebnis |
|-------|----------|
| Branch | `main` = `origin/main` (`c5d491cb`) |
| HEAD | `c5d491cb` (OFFLINE.2 hotfix auf main) |
| `origin/main..HEAD` (vor Deploy) | **leer** (sync) |
| Staged / modified tracked files | **keine** |
| Untracked `.audit-*` | vorhanden, **nicht** staged |
| Code-Änderungen im Deploy | **nein** (Empty-Commit-Trigger) |
| Production Bundle vor Deploy | `entry-932739f8765ce5d28b6f10039f68a997.js` (HYDRATION.1) |

**Gate:** **GRÜN**

---

## Phase 2 — Deploy Trigger

| Feld | Wert |
|------|------|
| Deploy-Commit | `360a9a4d` |
| Message | `chore(deploy): release offline2 assignment cache [deploy]` |
| `[deploy]` in Message | **ja** |
| Push `origin main` | **success** (`c5d491cb..360a9a4d`) |

---

## Phase 3 — Build Monitor

| Feld | Wert |
|------|------|
| Entry-JS vor Deploy | `entry-932739f8765ce5d28b6f10039f68a997.js` |
| Entry-JS nach Deploy | `entry-01c8e04ed273b93edeebc77fc3c3aa13.js` |
| Bundle-Wechsel | **ja** (~100 s nach Push, Poll Attempt 10) |
| Build-Status (indirekt) | **success** (Production HTML + Bundle-Inhalt) |
| OFFLINE.2 im Bundle | `AssignmentCache`, `writeAssignmentListCache`, `WriteAssignmentListCache` — **FOUND** |

---

## Phase 4 — Production Smoke (Playwright)

**Credentials:** `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD`, `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD` aus `.env.local` (nicht geloggt).  
**Portal-Account:** Login **OK** (`employeeId=911a9b50-…`, `tenantId=a4ba83bd-…`).  
**Zeitstempel Hauptlauf:** 2026-07-04T02:27:28Z

### A — MP Online (Einsatzliste)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Login / Portal | **grün** | `/portal/employee/assignments` lädt (~1296 Zeichen Body) |
| Mehrere Einsätze sichtbar | **grün** | **14 Einträge**, AKTIV 5 / GESAMT 14 |
| Sortierreihenfolge | **grün** | `sortOrder.ok === true` (heute → kommend → vergangen) |
| Kein Cache-Banner online | **grün** | `cachedBannerWhileOnline: false` |
| White Screen | **grün** | nein |

**A Gesamt:** **grün**

### B — IndexedDB (Assignment List Cache)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| `CareSuiteOfflineDB` + `assignments` Store | **grün** | DB mit 8 Stores (OFFLINE.1 Schema) |
| List-Cache nicht leer | **grün** | `listCount: 14` |
| List-Key tenant/employee-scoped | **grün** | Key `{tenantId}:{employeeId}:list` |
| `cachedAt` gesetzt | **grün** | `2026-07-04T02:27:48.690Z` |
| Detail-Prefetch-Keys (portal_detail / execution_detail) | **gelb** | `detailKeyCount: 0` — nur `kind: list` in IDB nach ~45 s Poll; Prefetch-Hook aktiv, Detail-Schreibungen für Test-Einsätze in diesem Lauf nicht beobachtet |
| Mehrere IDB-Records (list + details) | **gelb** | 1 Record (List-Aggregat mit 14 Items) — by design für List-Cache |

**B Gesamt:** **grün** (List-Cache-Kernziel) / Detail-Prefetch **gelb**

### C — MP Offline (Einsatzliste)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Liste erscheint | **grün** | 14 Einträge, kein endloses „wird geladen…“ |
| Offline-Banner (OFFLINE.1) | **grün** | „Keine Verbindung. Zwischengespeicherte Einsatzdaten können eingesehen werden…“ |
| Zwischengespeichert-Hinweis | **grün** | „💾 Zwischengespeicherte Daten (Stand: 04.07.2026, 04:27)“ |
| White Screen / Infinite Loading | **grün** | nein (`bodyLength: 1543`) |

**C Gesamt:** **grün**

### D — Offline Detail A/B/C (kein Daten-Mixing)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| SPA-Klick auf Einsatz A (offline) | **gelb** | Route `/assignments/8efc…/dac8` erreicht; ehrliche Meldung „Keine Verbindung. Zwischengespeicherte Einsatzdetails…“ — **kein** Detail-Cache in IDB |
| `page.goto` Detail offline (Skript-Default) | **gelb** | `chrome-error://` — erwartete SPA-Limitation ohne SW (kein Hard-Navigation offline) |
| B/C via Klick | **gelb** | Nicht vollständig (Scroll/Visibility nach A); kein Daten-Mixing bei A |
| Kein White Screen | **grün** | Detail-Route zeigt Fehler-UI statt Blank |

**D Gesamt:** **gelb** (List-Offline OK; Detail-Offline ohne Prefetch-Cache ehrlich blockiert)

### E — Leerer Cache offline

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Cache geleert (`cleared: 1`) | **grün** | Scoped List-Key entfernt |
| Offline ohne Cache | **grün** | „Einsätze konnten nicht geladen werden“ + Offline-Banner — ehrlich, kein White Screen (`bodyLength: 567`) |

**E Gesamt:** **grün**

---

## Phase 5 — Regression Matrix

| Bereich | Ampel | Details |
|---------|-------|---------|
| **OFFLINE.1** Banner | **grün** | Online kein Banner; offline sichtbar mit korrektem Text |
| **HYDRATION** Console | **gelb** | #418 (2×), #421 (4×), #422 (1×) — pre-existing, nicht blockierend |
| **ZEIT.1** MP Arbeitszeit | **grün** | Status heute, kein Profil-Fehlerbanner |
| **ZEIT.2** Office Team-Arbeitszeit | **grün** | `/business/office/time-tracking` — Team/Live-Marker OK (Supplement-Lauf) |
| **ABSENCE.1** | **grün** | Abwesenheits-UI + Antrag-Formular laden |
| **PROFILE.1** | **grün** | Profil-Route nutzbar |
| **SIGNATURE.1** | **gelb** | Nicht im Haupt-Smoke verifiziert; HYDRATION.1 Prod-Smoke zuletzt **grün** (`/assist/nachweise/review`) |
| **Execute-Pfad** | **grün** | `/assignments/{id}/execute` erreichbar (~413 Zeichen), kein White Screen |

---

## Phase 6 — Bekannte Gelb-Punkte

| Signal | Blocking? |
|--------|-----------|
| Hydration #418/#421/#422 auf MP | **Nein** — pre-existing |
| Detail-Prefetch ohne IDB-Einträge in Prod-Smoke | **Nein** für List-Cache GO; Detail-Offline **gelb** |
| Hard-Navigation (`page.goto`) offline auf Detail-URL | **Nein** — dokumentierte SPA-Limitation (OFFLINE.1) |
| Supabase REST 400/403 Console-Noise | **Nein** — pre-existing |

---

## Phase 7 — Final Verdict

### **Restricted GO** (OFFLINE.2 Assignment List Cache)

| Kriterium | Status |
|-----------|--------|
| Netlify Bundle gewechselt | **ja** |
| OFFLINE.2 Code live (`c5d491cb` + neues Bundle) | **ja** |
| List-Cache online → IDB (14 Items) | **ja** |
| Offline-Liste aus Cache | **ja** |
| Ehrlicher Empty-State ohne Cache | **ja** |
| Detail-Offline mit Prefetch | **gelb** (nicht in IDB beobachtet) |
| Kern-Regressionen (ZEIT.1/2, PROFILE, ABSENCE, OFFLINE.1) | **grün** |
| Kein White Screen auf MP-Hauptflows | **ja** |

**Kein Production NO-GO:** List-Cache-Kernfunktion live und verifiziert.  
**Kein vollständiges GO:** Detail-Prefetch/Offline-Detail noch gelb; Hydration-Rauschen weiterhin gelb.

---

## Entscheidungsmatrix (Abschluss — 14 Felder)

| # | Feld | Wert |
|---|------|------|
| 1 | Production URL | https://caresuiteplus.app |
| 2 | OFFLINE.2 Code-Commit | `c5d491cb` |
| 3 | Deploy-Trigger-Commit | `360a9a4d` |
| 4 | Build Status | **success** (Bundle-Wechsel bestätigt) |
| 5 | Bundle before → after | `entry-932739f8…` → `entry-01c8e04e…` |
| 6 | A — MP Online (Liste) | **grün** |
| 7 | B — IndexedDB List Cache | **grün** (Detail-Prefetch **gelb**) |
| 8 | C — MP Offline Liste | **grün** |
| 9 | D — Offline Detail A/B/C | **gelb** |
| 10 | E — Empty Cache offline | **grün** |
| 11 | Regressionen (OFFLINE.1/HYDRATION/ZEIT/ABSENCE/PROFILE) | **grün** / HYDRATION **gelb** |
| 12 | SIGNATURE.1 / Execute | Execute **grün**, SIGNATURE **gelb** (nicht re-verifiziert) |
| 13 | Neue OFFLINE.2 Runtime-Blocker | **nein** |
| 14 | Final verdict | **Restricted GO** |

---

**Status:** Audit-Dokument committed in separatem Commit (ohne `[deploy]`).
