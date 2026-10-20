# CareSuite+ HealthOS — Redesign-Risiko-Matrix / P0-Schutz (H0)

**Stand:** 2026-07-02  
**Bewertung:** grün = nur Layout · gelb = Datenanzeige · rot = Workflow/Persistenz

---

## P0/P0.1 Schutzzone — Nicht anfassen in H0–H2

| Domäne | Geschützte Pfade/Services | HealthOS-UI erlaubt | Verboten |
|--------|---------------------------|---------------------|----------|
| Visit Workflow | `src/features/assistWorkflow/*`, `useEmployeePortalVisitExecution` | Layout, Button-Labels | State transitions, RPC calls |
| Dokumentation | `saveVisitDocumentation.ts` | Panel layout | Payload, status writes |
| Signatur | `CareSignatureCanvas`, signature session store | Canvas chrome | capture/persist |
| Finalize | `finalizeVisit.ts`, document engine finalize | Preview UI | finalize triggers |
| Proof | `visitProof*`, `assistProofPdf*` | Review panel styling | verify/reject logic |
| Budget | `clientBudgetTransactionService`, allocation | Grid/card display | transactions, locks |
| WFM | `wfmClockService`, `wfmAssistAdapter`, `wfmWorkSessionRepository` | Status badge display | clock in/out, sync RPC |
| RLS | Supabase policies, portal visibility | — | any policy change |
| Portal Sync | `mirrorAssistVisitStatusFromAssignment`, live tracking | Map markers UI | sync hooks |

---

## Risiko-Matrix geplanter HealthOS-Änderungen

| Änderung | Visit | Doku | Signatur | Finalize | Proof | Budget | WFM | RLS | Portal Sync | Rating |
|----------|-------|------|----------|----------|-------|--------|-----|-----|-------------|--------|
| H1 Design Tokens | — | — | — | — | — | — | — | — | — | **grün** |
| H2 Shell/Nav | — | — | — | — | — | — | — | — | — | **grün** |
| H3 Office Listen-UI | — | — | — | — | — | Anzeige | — | — | — | **gelb** |
| H3 Klientenakte Tabs | — | — | — | — | Anzeige | Anzeige | — | — | — | **gelb** |
| H4 Assist Assignment Detail | Anzeige | Anzeige | — | — | Anzeige | Anzeige | — | — | — | **gelb** |
| H4 Execution Screen merge | Workflow | Persist | Persist | Persist | Persist | Reservierung | GPS | — | Sync | **rot** |
| H5 Employee Execute Shell | Workflow | Persist | Persist | Persist | — | — | Stempel | — | Sync | **rot** |
| H6 Client Budget Nav | — | — | — | — | — | Anzeige | — | Sichtbarkeit | — | **gelb** |
| H7 Cross-Portal QA | alle | alle | alle | alle | alle | alle | alle | alle | alle | **rot** (Tests) |

---

## Rote Zonen — Pflicht-Smoke-Tests vor Deploy

1. `/portal/employee/assignments/[id]/execute` — Start → Doku → Signatur → Finalize  
2. `/assist/assignments/[id]` — Status-Transition + Budget-Tab  
3. `/assist/nachweise/[id]` — Proof review + PDF  
4. Klientenakte Budget-Tab — Sperre/Transaktion (read-only UI)  
5. `/business/office/time-tracking` + `/portal/employee/arbeitszeit` — Clock in/out  
6. `/portal/client/appointments/[id]` — Live-Status + Tracking  
7. `/portal/client/documents/[id]` — RLS finalized docs  
8. `AssistExecutionProblemInboxPanel` — Blocker-Liste vs. DB  

---

## Größte P0/P0.1-Risiken bei Umbau

| Rang | Bereich | Risiko | Maßnahme |
|------|---------|--------|----------|
| 1 | Employee Execute | Finalize, WFM auto-sync, Budget mark executed | Shell-only in H5; Smoke vor Deploy |
| 2 | Assist Assignment Detail | Budget allocation, status dimensions | Display-only in H4 |
| 3 | Proof/Nachweise | PDF, review, release to portal | Kein Touch an Services |
| 4 | WFM Clock + Assist mirror | RPC 0225 tenant auth | Badge/Anzeige only |
| 5 | Client document visibility | RLS + releaseAssistProofToPortal | Nav/Layout only in H6 |

**Regel:** Rote Bereiche dürfen nur mit vollständigem P0-E2E-Smoke und expliziter Freigabe geändert werden.
