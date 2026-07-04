# Production Smoke — OFFLINE.3 + Stabilization Sprint S1

**Datum:** 2026-07-04  
**Production URL:** https://caresuiteplus.app  
**OFFLINE.3 Code-Commit:** `7b47c82b` — `feat(offline): cache assignment details for offline execution`  
**S1 Code-Commit (SIGNATURE.2 + Audit-Docs):** `9aeb6080` — `fix(signature): normalize proof signature orientation`  
**Deploy-Trigger-Commit:** `97487aea` — `chore(deploy): release offline3 and stabilization sprint s1 [deploy]`  
**Smoke-Skripte (lokal, nicht committed):**
- `.audit-offline2-local-smoke.mjs` mit `AUDIT_WEB_URL=https://caresuiteplus.app`
- `.audit-offline3-local-smoke.mjs` (Detail-Prefetch-Poll)
- `.audit-hydration1-prod-smoke.mjs` (bundled S1-Regressionen)
- `.audit-offline2-prod-supplement.mjs` (SPA Detail-Klick + Office-Routen)

**Credentials:** `AUDIT_EMPLOYEE_USERNAME` / `AUDIT_EMPLOYEE_PASSWORD`, `AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD` aus `.env.local` (nicht geloggt).  
**Portal-Account:** Login **OK** (`employeeId=911a9b50-…`, `tenantId=a4ba83bd-…`, `P0 Test Admin`).

---

## Phase 1 — Pre-deploy Gate

| Check | Ergebnis |
|-------|----------|
| Branch | `main` = `origin/main` (`9aeb6080`) |
| HEAD vor Deploy | `9aeb6080` (OFFLINE.3 + S1 docs + SIGNATURE.2) |
| `origin/main..HEAD` (vor Deploy) | **leer** (sync) |
| Staged / modified tracked files | **keine** (nur untracked `.audit-*`) |
| Code-Änderungen im Deploy | **nein** (Empty-Commit-Trigger) |
| `signatureOrientation.ts` auf HEAD | **ja** (`src/lib/signatures/signatureOrientation.ts`) |
| Production Bundle vor Deploy | `entry-01c8e04ed273b93edeebc77fc3c3aa13.js` (OFFLINE.2) |
| Lokale Tests (Referenz) | **139/139 grün** |

**Gate:** **GRÜN**

---

## Phase 2 — Deploy Trigger

| Feld | Wert |
|------|------|
| Deploy-Commit | `97487aea` |
| Message | `chore(deploy): release offline3 and stabilization sprint s1 [deploy]` |
| `[deploy]` in Message | **ja** |
| Push `origin main` | **success** (`9aeb6080..97487aea`) |

---

## Phase 3 — Build Monitor

| Feld | Wert |
|------|------|
| Entry-JS vor Deploy | `entry-01c8e04ed273b93edeebc77fc3c3aa13.js` |
| Entry-JS nach Deploy | `entry-2ead9648c4646820365b991f81d04629.js` |
| Bundle-Wechsel | **ja** (~105 s nach Push, Poll Attempt 7) |
| Build-Status (indirekt) | **success** (Production HTML + Bundle-Inhalt) |
| OFFLINE.3 im Bundle | `useOfflineAssignmentPrefetch`, `portal_detail`, `execution_detail` — **FOUND** |
| SIGNATURE.2 im Bundle | `needsSignatureOrientationCorrection`, `signatureOrientation` — **FOUND** |
| OFFLINE.2 List-Cache im Bundle | `writeAssignmentListCache` — **FOUND** |

---

## Phase 4 — Production Smoke (Playwright)

**Zeitstempel Hauptlauf:** 2026-07-04T03:31–03:39Z

### A — OFFLINE.3: MP Online (Einsatzliste)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Login / Portal | **grün** | `/portal/employee/assignments` lädt (~1296 Zeichen Body) |
| Mehrere Einsätze sichtbar | **grün** | **14 Einträge**, AKTIV 5 / GESAMT 14 |
| Sortierreihenfolge | **grün** | `sortOrder.ok === true` |
| Kein Cache-Banner online | **grün** | `cachedBannerWhileOnline: false` |
| White Screen | **grün** | nein |

**A Gesamt:** **grün**

### B — IndexedDB (List + Detail Prefetch)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| `CareSuiteOfflineDB` + `assignments` Store | **grün** | 8 Stores (OFFLINE.1 Schema) |
| List-Cache nicht leer | **grün** | `listCount: 14`, scoped key `{tenantId}:{employeeId}:list` |
| `cachedAt` gesetzt | **grün** | `2026-07-04T03:32:14.167Z` |
| Detail-Prefetch-Keys (`portal_detail` / `execution_detail`) | **gelb** | `detailKeyCount: 0` nach 60 s Poll — Live-Detail-Fetches im Audit-Account mit REST 400/403 (CONSOLE.1) |
| Bundle enthält Prefetch-Hook | **grün** | `useOfflineAssignmentPrefetch` live |

**B Gesamt:** **grün** (List-Cache) / Detail-Prefetch **gelb**

### C — MP Offline (Einsatzliste)

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Liste erscheint | **grün** | 14 Einträge, kein endloses Laden |
| Offline-Banner (OFFLINE.1) | **grün** | Korrekter Offline-Text sichtbar |
| Zwischengespeichert-Hinweis | **grün** | „💾 Zwischengespeicherte Daten (Stand: 04.07.2026, 05:32)“ |
| White Screen / Infinite Loading | **grün** | nein (`bodyLength: 1543`) |

**C Gesamt:** **grün**

### D — Offline Detail A/B/C + Partial Cache

| Prüfung | Ampel | Details |
|---------|-------|---------|
| SPA-Klick Detail offline (A/B/C) | **gelb** | `page.goto` offline → `chrome-error://` (SPA-Limitation ohne SW); kein Detail-Cache in IDB |
| Partial-Cache-Hinweis | **gelb** | Nicht beobachtet — kein Detail-Prefetch in Prod-Smoke |
| Kein Daten-Mixing | **grün** | `noDataMixing.ok === true` |
| Kein White Screen auf Detail-Route (online Execute) | **grün** | Execute-Pfad rendert Shell (~1386 Zeichen) |

**D Gesamt:** **gelb**

### E — Leerer Cache offline

| Prüfung | Ampel | Details |
|---------|-------|---------|
| Cache geleert (`cleared: 1`) | **grün** | Scoped List-Key entfernt |
| Offline ohne Cache | **grün** | „Einsätze konnten nicht geladen werden“ + Offline-Banner — ehrlich, kein White Screen (`bodyLength: 567`) |

**E Gesamt:** **grün**

---

## Phase 5 — S1 Regression Matrix

| Bereich | Ampel | Details |
|---------|-------|---------|
| **CONSOLE.1** 400/403 | **gelb** | REST 400/403 in Console — **erwartet** (RLS/Bootstrap-Rauschen, siehe `console1-noise-classification.md`); **kein neuer** Hydration-/Runtime-Crash |
| **CONSOLE.1** Hydration | **gelb** | #418 (2×), #421 (7×), #422 (1×) — pre-existing, nicht blockierend |
| **EXECUTE.1** Hub `/portal/employee/execution` | **gelb** | Nicht in diesem Lauf re-getestet; historisch leerer Body + #421 (nicht operativer Pfad) |
| **EXECUTE.1** Execute-Pfad `/assignments/{id}/execute` | **grün** | Erreichbar, kein White Screen (`bodyLength: 1386` mit Test-Einsatz `8efc…dac8`; Hydration-Lauf `413` Zeichen mit Guard-UI „Einsatz nicht zugewiesen“ — Shell OK) |
| **SIGNATURE.2** Proof / Nachweis-Prüfung | **grün** | `/assist/nachweise/review` — 11 Einträge, Preview-Panel lädt |
| **SIGNATURE.2** Landscape-Orientierung in Leistungsnachweis | **gelb** | Code + Bundle verifiziert (`needsSignatureOrientationCorrection`); **kein** Browser-Nachtest mit Portrait-PNG in Production |
| **SIGNATURE.1** Drawn signature as image | **grün** | Nachweis-Prüfung-Route weiterhin nutzbar (Regression grün) |
| **ZEIT.1** MP Arbeitszeit | **grün** | Status heute, kein Profil-Fehlerbanner |
| **ZEIT.2** Office Team-Arbeitszeit | **grün** | `/business/office/time-tracking` — Team/Arbeitszeit/Live-Marker OK |
| **ABSENCE.1** | **gelb** | UI + Antrag-Formular laden; Submit/Approval-Flow in diesem Lauf **nicht** ausgeführt |
| **PROFILE.1** | **grün** | Profil-Route nutzbar (~887 Zeichen); **14-Tab-E2E** in diesem Bundled-Smoke nicht vollständig durchgeklickt |
| **OFFLINE.1** Banner | **grün** | Online kein Banner; offline sichtbar |

---

## Phase 6 — Bekannte Gelb-Punkte

| Signal | Blocking? |
|--------|-----------|
| Hydration #418/#421/#422 auf MP/Office | **Nein** — pre-existing |
| Detail-Prefetch ohne IDB-Einträge in Prod-Smoke (Audit-Account) | **Nein** für Restricted GO; Detail-Offline **gelb** |
| Hard-Navigation (`page.goto`) offline auf Detail-URL | **Nein** — dokumentierte SPA-Limitation |
| Supabase REST 400/403 Console-Noise | **Nein** — CONSOLE.1 klassifiziert als erwartet |
| Execute-Hub `/portal/employee/execution` | **Nein** — nicht operativer Pfad |
| SIGNATURE.2 Landscape-PNG Browser-Nachtest | **Nein** — Unit-Tests 30/30 grün |

---

## Phase 7 — Final Verdict

### **Restricted GO** (OFFLINE.3 + S1)

| Kriterium | Status |
|-----------|--------|
| Netlify Bundle gewechselt | **ja** |
| OFFLINE.3 + S1 Code live (`9aeb6080` + neues Bundle) | **ja** |
| List-Cache online → IDB (14 Items) | **ja** |
| Offline-Liste aus Cache | **ja** |
| Ehrlicher Empty-State ohne Cache | **ja** |
| Detail-Prefetch / Offline-Detail in Prod | **gelb** (Audit-Umgebung, nicht blockierend) |
| Kern-Regressionen (ZEIT, PROFILE, ABSENCE-UI, OFFLINE.1, SIGNATURE.1 Review) | **grün** |
| Kein White Screen auf MP-Hauptflows | **ja** |
| Neue Runtime-Blocker | **nein** |

**Kein Production NO-GO:** OFFLINE.3 List-Cache + Prefetch-Code deployed; S1-Audit-Docs und SIGNATURE.2-Orientierungsfix live.  
**Kein vollständiges GO:** Detail-Prefetch/Offline-Detail gelb; Hydration/Console-Rauschen gelb; Execute-Hub und SIGNATURE.2-Landscape nicht browser-verifiziert.

---

## Entscheidungsmatrix (Abschluss — 14 Felder)

| # | Feld | Wert |
|---|------|------|
| 1 | Production URL | https://caresuiteplus.app |
| 2 | OFFLINE.3 + S1 Code-Commit | `9aeb6080` (`7b47c82b` OFFLINE.3 + `9aeb6080` SIGNATURE.2) |
| 3 | Deploy-Trigger-Commit | `97487aea` |
| 4 | Build Status | **success** (Bundle-Wechsel bestätigt) |
| 5 | Bundle before → after | `entry-01c8e04e…` → `entry-2ead9648…` |
| 6 | A — MP Online (Liste) | **grün** |
| 7 | B — IndexedDB List + Detail Prefetch | **grün** / Detail-Prefetch **gelb** |
| 8 | C — MP Offline Liste | **grün** |
| 9 | D — Offline Detail A/B/C + Partial | **gelb** |
| 10 | E — Empty Cache offline | **grün** |
| 11 | S1 Regressionen (CONSOLE/ZEIT/ABSENCE/PROFILE/OFFLINE.1) | **grün** / CONSOLE Hydration **gelb** |
| 12 | SIGNATURE.2 / EXECUTE.1 | SIGNATURE Review **grün**, Landscape **gelb**; Execute-Pfad **grün**, Hub **gelb** |
| 13 | Neue OFFLINE.3/S1 Runtime-Blocker | **nein** |
| 14 | Final verdict | **Restricted GO** |

---

**Status:** Audit-Dokument committed in separatem Commit (ohne `[deploy]`).
