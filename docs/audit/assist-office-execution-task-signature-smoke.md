# Assist Office Durchführung — Task/Signature Fix Smoke Audit

**Datum:** 2026-07-03  
**Scope:** Assist Office `VisitExecutionScreen` only (5 uncommitted fix files)  
**Deploy / Commit:** Nein — reine Verifikation im Working Tree

---

## 1. Executive Summary

Office-Durchführung erhält **Legacy-Fallback für Aufgaben-Updates**, **sichtbare Fehler-Rückmeldung**, **Desktop-taugliche Reason-Chips**, **Signatur-Persistenz-Wiring** (0156-ready) und **Close-Validation** mit Session + persisted Signature.

H5 Employee Portal Execute bleibt unberührt.

---

## 2. Pre-Scope Verification

| Prüfung | Ergebnis |
|---------|----------|
| Nur 5 Fix-Dateien geändert (Assist Office) | Siehe Abschnitt 3 |
| H5 bereits committed | Ja (nicht in Working-Tree-Diff) |
| `EmployeePortalVisitExecutionScreen` unverändert | Ja |
| `EmployeePortalVisitTasksPanel` unverändert | Ja |
| `EmployeePortalVisitSignaturePanel` unverändert | Ja |
| `finalizeVisitProof` unverändert | Ja |
| Budget / WFM / Migrations / RLS unverändert | Ja |

**Hinweis:** Zusätzlich zum Fix existieren unrelated lokale Änderungen (Audit-Docs, Screenshots, Checklist-JSON) — nicht Teil dieses Fixes.

---

## 3. Geänderte Fix-Dateien (Working Tree)

| Datei | Änderung |
|-------|----------|
| `src/lib/assist/visitExecutionService.ts` | Legacy `assignment_tasks`-Fallback wenn `assist_visit_tasks` fehlt; Status-Mapping visit→assignment; Fehler nicht verschlucken |
| `src/lib/assist/repositories/visitRepository.supabase.ts` | `updateTask`: Prefetch + 0-Row Guard; Begründungspflicht für Abweichungs-Status |
| `src/screens/assist/VisitExecutionScreen.tsx` | Task/Doc-Fehlerfeedback; Signatur-Payload + Persistenz-Callback; Close-Readiness mit session + persisted |
| `src/components/assist/VisitSignatureSection.tsx` | 0156-Persistenz via `saveVisitSignaturePersistent`; Session nur Fallback; sichtbare Warnungen |
| `src/components/assist/VisitTasksPanel.tsx` | Reason-Chips Desktop (`Pressable` + web `onClick`) |

---

## 4. Signature Persistence Review

| Kriterium | Bewertung | Details |
|-----------|-----------|---------|
| Tenant-Safety | OK | `tenantId` aus `useServiceTenantId()` an Persistenz übergeben |
| Visit-ID korrekt | OK | `visit.id` aus Disposition-Detail, nicht Route-Roh-ID allein |
| Kein Employee-Portal-Session-Annahme | OK | Business-Auth + Office-Screen; Session-Store nur Fallback |
| DB-Fehler sichtbar | OK | `persistWarning` InfoBanner + Screen-Feedback |
| Kein Cross-Visit-Overwrite | OK | Session-Store keyed by `visitId` |
| Session nur Fallback | OK | Persistenz wenn `isAssistExecutionPersistenceReady` |
| Minimal Guard nötig | Nein | Kein zusätzlicher Guard eingebaut |

**Review-Funktion:** `saveVisitSignaturePersistent` in `assistVisitSignaturePersistenceService.ts` — INSERT mit `tenant_id`, `visit_id`, Storage-Upload; Fehler propagieren nach UI.

---

## 5. Unit Tests

**Datei:** `src/__tests__/assist/visitExecutionService.test.ts`

| Test | Abdeckung |
|------|-----------|
| Legacy-Fallback bei fehlender `assist_visit_tasks`-Zeile | Ja |
| 0-Row / DB-Fehler nicht als Erfolg | Ja |
| `not_possible`/`partial` → `not_done` + Reason | Ja |
| Legacy-Fehler nicht verschluckt | Ja |
| Close-Readiness: offene Pflichtaufgaben | Ja |
| Close-Readiness: Session-Signatur | Ja |
| Close-Readiness: Doku + Signatur Pflicht | Ja |

---

## 6. Browser Smoke

**Script:** `scripts/audit/assistOfficeExecutionSmoke.mjs`  
**Login:** Business/Office (`AUDIT_BUSINESS_EMAIL` / `AUDIT_BUSINESS_PASSWORD`)  
**Route:** `/assist/assignments/{id}/execute` (+ Alias `/assist/durchfuehrung/{id}`)  
**Test-Visit:** `70f800b8-a04f-44ae-846f-dcc7f6f6497a` (Heinz-Peter Reinhardt, P0) sofern erreichbar

**Checks:**
- Seite lädt (Durchführung / Zeiterfassung)
- Aufgaben-Panel + Erledigt-Klick
- Reason-Chips Desktop (Teilweise/Nicht möglich)
- Unterschrift-Sektion sichtbar
- Reload-Stabilität
- Close-Validation (Doku/Signatur/Pflichtaufgaben)
- Einsatzdetails-Tab
- Redirect-Alias

**Ergebnis:** `docs/audit/assist-office-execution-smoke-results.json` — **grün**

| Check | Ergebnis |
|-------|----------|
| Page loads | ja |
| Tasks panel | ja |
| Reason chips (browser) | nein — Test-Visit ohne offene Aufgaben-Buttons; Code-Fix via Unit-Test abgedeckt |
| Signature section | ja |
| Reload stable | ja |
| Close validation | ja |
| Assignment detail | ja |
| Redirect alias | ja |
| Runtime errors | nein |

**Test-Visit:** `ade25ab2-5bae-42ac-89f4-9c42137671cb` (P0-E2E Testeinsatz, status arrived, via Business-RLS)

**Hinweis:** Assignment `70f800b8…` (Heinz-Peter Reinhardt) ist für Audit-Business-User via RLS nicht sichtbar (completed / fremder Mandanten-Scope).

---

## 7. Red Zones — Unberührt

| Bereich | Status |
|---------|--------|
| Employee Portal Execute | Unberührt |
| H5 Smoke / H5 Files | Unberührt |
| `finalizeVisitProof` | Unberührt |
| Budget / WFM Write | Unberührt |
| Migrations / RLS | Unberührt |

---

## 8. Ja/Nein-Matrix (Abnahme)

| Feld | Wert |
|------|------|
| scope_only_5_fix_files | ja (Fix-Dateien); unrelated docs/screenshots separat |
| employee_portal_untouched | ja |
| finalizeVisitProof_untouched | ja |
| signature_persistence_review_pass | ja |
| minimal_guard_added | nein (kein Risiko gefunden) |
| unit_tests_added | ja (`visitExecutionService.test.ts`, `visitTasksPanelReasonChips.test.ts`) |
| unit_tests_pass | ja (10/10 new + 7/7 regression subset) |
| browser_smoke_executed | ja |
| browser_smoke_pass | ja (grün; reason chips browser nein wegen Testdaten) |
| commit_made | nein |
| deploy_made | nein |

---

## 9. Screenshots

`docs/audit/assist-office-execution-smoke-screenshots/`

- `01-execution-initial.png`
- `02-reason-chips.png`
- `03-after-reload.png`
- `04-assignment-detail.png`
