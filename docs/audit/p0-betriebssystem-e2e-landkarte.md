# P0 Betriebssystem E2E — Systemlandkarte

Datum: 2026-06-25  
Basis-Commit: `dc8e2315` (lokal erweitert, nicht deployed)  
Mandant Referenz: Helferhasen+ `56180c22-b894-4fab-b55e-a563c94dd6e7`

---

## 1. Preflight

| Check | Ergebnis |
|-------|----------|
| `git status` | Uncommitted P0-Änderungen (Audit-Docs, Assist-Workflow, Problem-Inbox) |
| Service-Mode Live | `EXPO_PUBLIC_SUPABASE_URL` + Anon-Key erforderlich; Demo-Pfade via `getServiceMode()` / `guardLiveDemoFeature` getrennt |
| Deploy-Regel | Kein Netlify-Deploy ohne `[deploy]` in Commit-Message |

---

## 2. Route-/Modul-Inventar (Kern-P0)

| Oberfläche | Pfad-Muster | Anzahl Routen (ca.) |
|------------|-------------|---------------------|
| Office | `app/office/**`, `app/business/office/**` | ~200 |
| Assist | `app/assist/**` | 33 |
| Mitarbeiterportal | `app/portal/employee/**` | 23 |
| Klientenportal | `app/portal/client/**` | 16 |

**P0-kritische Routen:**

- Planung: `app/assist/einsaetze/**`, `app/office/appointments/**`, `app/office/kalender.tsx`
- Durchführung MP: `app/portal/employee/assignments/[id]/execute.tsx`, `execution/index.tsx`
- Nachweis: `app/assist/nachweise/**`, `app/portal/employee/(tabs)/documents.tsx`
- Office-Kontrolle: `app/assist/live-status.tsx`, `app/business/office/dashboard.tsx`
- Klient: `app/portal/client/(tabs)/documents.tsx`, `appointments/**`, `budget/index.tsx`

---

## 3. Domäne × Oberfläche × Service × Tabelle × SoT × Sync × Status

| Domäne | Oberfläche | Service / Modul | Kanonische Tabelle(n) | SoT Write | Read-Overlay | Status | Entscheidung P0 |
|--------|------------|-----------------|----------------------|-----------|--------------|--------|-----------------|
| Einsatzstatus | MP, Assist, Office | `transitionAssistExecutionStatus`, `assignmentRepository` | `assignments.status`, `assist_time_events` | `assignments` | `resolveAssignmentExecutionSnapshot` | 🟢 | Write kanonisch; Read über Snapshot/Overlay |
| Aufgaben | MP | `employeePortalExecutionLiveService` | `assignment_tasks` | `assignment_tasks` | `overlayVisitDispositionFromAssignment` | 🟢 | Portal schreibt assignment_tasks |
| Zeiten | MP | `saveVisitTimeEvent`, `calculateVisitTimes` | `assist_time_events` | `assist_time_events` | Snapshot + WFM | 🟢 | finalizeVisit awaited WFM-Sync |
| Dokumentation | MP, Office | `saveVisitDocumentation` | `assist_visit_documentation`, `assignments.documentation_notes` | Dual-Write | Enrichment | 🟢 | Fehler wenn visitId nicht auflösbar |
| Signatur | MP | `saveClientSignature` | `assist_visit_signatures` + Storage | DB + Storage | Enrichment | 🟢 | `proof_template_key` Fallback wenn Katalog fehlt |
| Nachweis | MP, Assist | `generateServiceRecord`, `persistEmployeePortalVisitProof` | `assist_visit_proofs` | Proof + Hash | Problem-Inbox | 🟢 | Vollständigkeitsprüfung bei Idempotenz |
| PDF / Portal-Dok | Assist, KP | `assistProofPortalDocumentService`, `assistProofApprovalService` | Storage, `client_documents` | Bei Freigabe | KP Read | 🟡 | Kette implementiert; Live-PDF-Backfill offen |
| Budget | Office, KP | `clientBudgetTransactionService` | `client_budget_transactions` | Reservierung/Usage | UI-Projektion | 🟢 | `markAssignmentExecuted` in `endService` ergänzt |
| Arbeitszeit | MP, Office WFM | `wfmAssistAdapter` | `workforce_time_events` | Nach Finalize | WFM-Aggregation | 🟢 | Sync nicht mehr per void |
| Office-Listen | Assist Kalender/Live | `visitRepository`, `overlayVisitDispositionListFromAssignments` | `assist_visits` + Overlay | — | assignments-Snapshot | 🟢 | List-Overlay aktiv |
| Problem-Inbox | Assist Live | `assistExecutionProblemInboxService` | assignments + proofs | — | Query | 🟢 | Deutsche Statuswerte korrigiert |
| Schema Live | Alle | Resolver-Fallbacks | `assist_service_catalog_items` | — | — | 🔴 | Tabelle auf Production fehlt — Fallback aktiv |

Legende: 🟢 stabilisiert · 🟡 teilweise · 🔴 Blocker/Risiko

---

## 4. Kritische Code-Suche (Kernpfad)

| Muster | Befund P0-relevant |
|--------|-------------------|
| `void upsertAssistVisitExecutionState` | Entfernt in `finalizeVisit`; verbleibt in `markArrived` (nicht P0-kritisch) |
| `void syncAssistVisitTimesToWfm` | Entfernt — awaited in `finalizeVisit` |
| Proof Idempotenz ohne Check | Behoben in `persistEmployeePortalVisitProof` via `visitProofCompleteness` |
| `generateServiceRecord ok:true bei proof false` | Behoben — Fehler propagieren |
| Demo in Live-Pfad | Demo nur wenn `getServiceMode() !== 'supabase'` oder `guardLiveDemoFeature` blockt |
| Problem-Inbox EN-Status | Behoben: `beendet`/`dokumentation_offen`/… statt `finished`/… |

---

## 5. Test-Baseline (2026-06-25)

### Typecheck

```
npm run typecheck → FAIL (exit 2)
```

Vorhandene Fehler überwiegend Office-Screens (`FilterChip`/`SetStateAction`), Portal-Screens (`useCallback`/`usePermissions` fehlende Imports). **Nicht durch P0-Änderungen verursacht** — blockiert Go/No-Go-Kriterium „typecheck grün“ bis separater Fix-Sprint.

### Vitest P0-Fokus

| Suite | Ergebnis |
|-------|----------|
| `visitProofCompleteness.test.ts` | 3/3 PASS |
| `finalizeVisitProof.test.ts` | 2/2 PASS (timeout auf cold-import mit 15s) |
| `visitDispositionExecutionEnrichment.test.ts` | PASS |
| `portalExecutionSyncConsistency.test.ts` | PASS |
| `assignmentBudgetAllocation.test.ts` | PASS |
| `assistWorkflow/*` (gesamt) | 91/92 PASS (1 pre-existing Message-Mismatch in `assistWorkflow2.test.ts`) |

### Voller P0-Befehl (Referenz)

```
npm test -- src/__tests__/assistWorkflow src/__tests__/assist src/__tests__/portal ...
→ 157 files pass / 54 fail (96 tests) — viele Legacy/Demo-Suites, nicht P0-Kernflow

```

---

## 6. Referenz-Entitäten (Live)

| Entität | ID |
|---------|-----|
| Tenant Helferhasen+ | `56180c22-b894-4fab-b55e-a563c94dd6e7` |
| Mhi (MA) | `1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f` |
| Visit Hauswirtschaft (Mhi) | `70f800b8-a04f-44ae-846f-dcc7f6f6497a` — Doku in DB fehlend (Re-Submit nötig) |

---

## 7. Nächste Schritte (Phase 8)

- Manueller Browser-E2E: `docs/audit/p0-e2e-checklist.json` (14 Schritte)
- Erst `[deploy]` wenn Go/No-Go grün + typecheck (separates Ticket)
