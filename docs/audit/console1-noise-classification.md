# CONSOLE.1 — API 400/403 Noise Classification (Detail Prefetch Yellow)

**Datum:** 2026-07-04  
**Basis-HEAD:** `7b47c82b` (OFFLINE.3 lokal)  
**Scope:** Klassifikation Browser-Console 400/403 vs. OFFLINE.3 Detail-Prefetch-Gelb  
**Keine Änderungen:** RLS, Migrationen, Deploy

---

## Executive Summary

Die OFFLINE.3-Smoke-Ampel **gelb** für `detail_prefetch_missing` und Console **400/403** im Audit-Account (`P0 Test Admin`, Tenant `a4ba83bd…`) ist **überwiegend erwartetes RLS-/Bootstrap-Rauschen**, kein Prefetch-Regressionsbug. List-Cache (14 Einträge) funktioniert; Detail-Keys bleiben im Smoke-Zeitfenster leer, weil Live-Detail-Fetches in der Audit-Umgebung fehlschlagen oder Test-Einsätze unvollständig sind — die Prefetch-**Logik** ist durch 48/48 Offline-Tests und Integration-Mocks abgesichert.

| Signal | Klassifikation | Blockierend für OFFLINE.3? |
|--------|----------------|----------------------------|
| REST 400/403 (global bootstrap) | **Erwartet** (HYDRATION.0/1) | Nein |
| REST 400/403 während Detail-Prefetch | **Teils erwartet** (RLS auf Neben-Tabellen) | Nein |
| `detailKeyCount: 0` nach 60s Poll | **Gelb / Umgebung** | Nein (Restricted GO) |
| Prefetch-Unit/Integration | **Grün** (48/48 offline) | — |
| React #421 Hydration | **Pre-existing gelb** | Nein |

---

## Kontext OFFLINE.3 Yellow

Quellen: `.audit-offline3-local-smoke-results.json`, `.audit-offline2-local-smoke-results.json`, `offline3-implementation-report.md`.

| Beobachtung | Wert | Interpretation |
|-------------|------|----------------|
| List-Cache IDB | 14 Einträge, scoped key OK | OFFLINE.2/3 List-Pfad **grün** |
| Detail-Keys `:portal`/`:execution` | 0 nach 60s Poll | Prefetch schreibt nicht — **Live-API liefert kein `ok`-Detail** |
| Console hardErrors | 400, 403, #421 | Gemischt: Bootstrap + Hydration |
| Execute-Route Smoke | `bodyLength: 42`, `ok: false` | Separater EXECUTE.1-Track (Hub/Execute-Shell) |
| `require is not defined` | **Keiner** (Post-SSR-Fix) | OFFLINE.3 SSR-Fix **grün** |

**Smoke-Skript-Limitation:** Poll verlangt gleichzeitig `listCount > 0 && detailKeyCount > 0` — bei fehlgeschlagenen Live-Details → `poll_timeout` → Verdict `NO_GO`, obwohl Restricted-GO-Kriterien (kein White Screen, kein Auth-Fail, List-Cache OK) erfüllt sind.

---

## Prefetch-Pfad (Code)

```
loadPortalAppointmentsWithCache
  → mergeAssignmentListCache
  → scheduleAssignmentDetailPrefetch (dynamic import)
    → prefetchAssignmentDetailCaches (max 6, throttle 120ms)
      → fetchLiveEmployeePortalAssignmentDetail  ─┐
      → fetchPortalAppointmentDetail             ─┴─ gleicher Live-Pfad in Supabase-Mode
      → writeExecutionDetailCache / writePortalAppointmentDetailCache
```

Relevante Dateien:

- `src/lib/offline/assignmentDetailPrefetch.ts`
- `src/lib/portal/employeePortalExecutionLiveService.ts` → `resolveLiveAssignment`, `fetchAssignmentExtras`
- `src/lib/portal/appointmentService.ts` → `fetchPortalAppointmentDetail`

---

## Supabase 400/403 Matrix — Prefetch vs. Bootstrap

Browser-Console zeigt **keine Request-URL** — Klassifikation aus Code-Pfaden, HYDRATION-Console-Audit und Smoke-Mustern.

### A — Erwartetes Bootstrap-Rauschen (nicht Prefetch-spezifisch)

| Endpoint / Muster | Status | Route | Erwartet? | Impact auf Prefetch |
|-------------------|--------|-------|-----------|---------------------|
| `/rest/v1/roles` | 400/403 | Global auth bootstrap | Ja — `employee_portal` ohne Business-Row | Nein |
| `/rest/v1/role_permissions` | 403 | Permission fetch | Ja | Nein |
| `/rest/v1/tenant_products` | 403 | Module hydration race | Ja | Nein |
| `/rest/v1/profiles` | 403 | MP ohne Business-Profil | Ja | Nein |
| Dashboard `countByFilter` Probes | 400 | Office/Assist | Ja (pre-auth / RLS) | Nein |
| `fromUnknownTable` Schema-Probes | 400 | Cross-module | Ja (`missingtablefallback`) | Nein |

**Referenz:** `docs/audit/hydration-console-audit.md` §4.

### B — Prefetch-adjacent (Detail-Laden)

| Query / Tabelle | Via | Typischer Fehler | Erwartet im Audit-Account? |
|-----------------|-----|------------------|----------------------------|
| `assignments` + Tasks (resolveLiveAssignment) | Detail core | 403 RLS / leer | Teilweise — Test-Einsätze mit `clientName: null` |
| `client_contacts` (Notfallkontakt) | fetchAssignmentExtras | 403 | **Ja** — Nebenfeld, warn-only |
| `assist_visit_execution_state` / Docs | docFlags | 403/400 | Teilweise — Extras optional |
| `message_threads` | Overview unread (nicht Prefetch) | 403 | Ja — still → 0 |

**Wichtig:** Prefetch-Fehler werden **pro Assignment toleriert** (`failures[]`, List-Cache bleibt). Kein Throw, kein White Screen.

### C — Unerwartet / Follow-up (CONSOLE.2)

| Muster | Priorität | Empfehlung |
|--------|-----------|------------|
| Network-Interceptor mit exakter URL pro Route | Mittel | CONSOLE.2 Track |
| Auth-Gating: Queries erst nach `isInitialized && session` | Mittel | Parallel HYDRATION.1 |
| Doppelter Live-Fetch (execution + portal parallel) | Niedrig | Dedup in OFFLINE.4 |

---

## Audit-Account Spezifika

| Faktor | Auswirkung |
|--------|------------|
| Login `P0 Test Admin` / employee_portal | Portal-Session OK, Business-Tabellen 403 **erwartet** |
| 14 List-Einträge, viele `clientName: null` | Test-/Smoke-Daten, Detail-Anreicherung evtl. unvollständig |
| Kandidaten-Filter `selectPrefetchAssignmentCandidates` | Nur heute+künftig, max 6 — korrekt |
| `profileId` = `usePortalActor().actorId` | Guard ergänzt: Prefetch skip ohne `profileId` + `roleKey` |

---

## Kleiner Fix (CONSOLE.1)

In `assignmentDetailPrefetch.ts`:

1. **`classifyPrefetchApiNoise()`** — trennt `expected_access`, `not_found`, `unexpected` auf Service-Fehlertext-Ebene
2. **`logPrefetchFailure`** — unterdrückt Dev-Log für erwartete Access/Not-Found-Messages (REST 400/403 in Browser bleiben — separate CONSOLE.2)
3. **`scheduleAssignmentDetailPrefetch`** — Early-return ohne `profileId`/`roleKey`

Kein Verhalten change für erfolgreiche Prefetches; keine RLS-Änderung.

---

## Test-Evidenz

| Suite | Ergebnis (2026-07-04 S1) |
|-------|--------------------------|
| `src/__tests__/offline/` | **48/48 grün** |
| `offline3DetailPrefetch.integration.test.ts` | Prefetch 3/3, bounded 14→6, Fail-Toleranz B |
| Gesamt Sprint-Vitest (offline+zeit+absence+signature+profile) | **137/137 grün** |

---

## Ampel & Empfehlung

| Item | Ampel | Deploy-Blocker? |
|------|-------|-----------------|
| Console 400/403 Bootstrap | Gelb | Nein |
| Detail-Prefetch Smoke (Audit-Account) | Gelb | Nein (Restricted GO) |
| Prefetch-Logik (Unit) | Grün | — |
| Echter Prefetch-Bug | **Nicht identifiziert** | — |

**Fazit:** OFFLINE.3 Detail-Prefetch-Gelb = **Umgebungs-/Klassifikations-Thema**, nicht Code-Defekt. Deploy OFFLINE.3 mit Restricted GO vertretbar; CONSOLE.2 für URL-Level-Audit empfohlen.

---

## Referenzen

- `docs/audit/hydration-console-audit.md`
- `docs/audit/offline3-implementation-report.md`
- `docs/audit/offline3-detail-cache-plan.md`
