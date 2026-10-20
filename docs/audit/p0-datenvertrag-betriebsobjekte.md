# P0 Datenvertrag — Betriebsobjekte (verbindlich)

Datum: 2026-06-25  
Gültigkeit: P0 Betriebssystem E2E bis nächste Architektur-Revision

---

## Regel P0

**Write-Pfad:** Jede Portal-Aktion schreibt kanonisch in die unten genannte SoT-Tabelle und spiegelt per RPC/Sync wo nötig (`repair_assist_visit_workflow_status`, Task-Sync, Visit-Doc-Sync).

**Read-Pfad:** Office, Assist und Portale nutzen `resolveAssignmentExecutionSnapshot` bzw. `overlayVisitDispositionFromAssignment` wenn `assist_visits`-Snapshot veraltet ist.

**Portal-ID:** `assignmentId` ist primär; `visitId` (assist) via `resolveAssistVisitIdForPersistence` / `resolveVisitMasterId`.

---

## Objekt-Tabelle

| Objekt | Kanonische Wahrheit (Write) | Abgeleitet / Spiegel (Read) | Portal-ID | Sync-Regel |
|--------|----------------------------|----------------------------|-----------|------------|
| **Einsatzstatus** | `assignments.status` | `assist_visits.canonical_status`, `assist_visit_execution_state` | `assignmentId` | Nach jedem Statusübergang: `upsertAssistVisitExecutionState`; optional RPC repair |
| **Zeitereignisse** | `assist_time_events` | `assist_visit_execution_state.visit_times`, WFM | `assistVisitId` | `calculateVisitTimes` aus Events; WFM bei `finalizeVisit` |
| **Aufgaben** | `assignment_tasks` | `assist_visit_tasks` (Legacy) | `assignmentId` | Portal schreibt assignment_tasks; Office-Overlay bevorzugt Snapshot-Tasks |
| **Dokumentation** | `assist_visit_documentation` + `assignments.documentation_notes` | `assist_visits.documentation_status`, `employee_notes` | `visitId` + `assignmentId` | Dual-Write in `saveVisitDocumentation`; Fehler wenn visitId fehlt |
| **Signatur** | `assist_visit_signatures` + Storage-Bucket | `assist_visits` Signatur-Dimensionen | `visitId` | Hash + payload_hash; Anforderung aus `proof_template_key` wenn Katalog fehlt |
| **Nachweis** | `assist_visit_proofs` + Storage | `assist_visits.proof_status` | `visitId` | Idempotenz nur wenn `isStoredVisitProofComplete`; sonst Update/Regenerierung |
| **Klientendokument** | `client_documents` | — | `clientId` | Mirror bei Freigabe via `upsertAssistProofClientPortalDocument` |
| **Budget Reservierung** | `client_budget_transactions` (type=reservation) | `client_budget_accounts.reserved_cents` | `reference_id` = visit/assignment | `reserveForAssignment` bei Planung |
| **Budget Durchführung** | `client_budget_transactions.lifecycle_status=durchgefuehrt` | — | visit/assignment | `markAssignmentExecuted` bei `endService` (beendet) |
| **Budget Verbrauch** | `client_budget_transactions` (type=usage) | Konten `used_cents` | proof/visit | `consumeOnProofApproval` bei Nachweis-Freigabe |
| **Budget Rechnung** | `client_budget_transactions.invoice_id`, status abgerechnet | Rechnungsmodul | invoice | Bestehende Billing-Services |
| **Budget Storno** | `stornoAssignmentReservation` / Korrekturbuchung | Audit-Log | visit | Bei Stornierung Einsatz |
| **Arbeitszeit Tag** | `workforce_sessions`, `workforce_time_events` | WFM-Dashboard | `employee_id` | Aus Assist via `syncAssistVisitTimesToWfm` nach Abschluss |
| **Mandant / RLS** | Postgres RLS auf allen Tabellen | App-Layer `tenant_id` + `employee_id`/`client_id` Filter | — | Keine Cross-Tenant-Queries in Portal-Services |

---

## Nachweis vollständig (P0-Kriterium)

Ein Leistungsnachweis gilt als **vollständig**, wenn:

1. `visit_id`, `tenant_id`, `payload_hash` gesetzt
2. Aufgaben, Zeiten, Dokumentation im `payload_snapshot`
3. Signatur oder dokumentierte Begründung (`signature_id` oder Template ohne Signatur)
4. PDF-Pfad (`pdf_storage_path` oder `storage_path`) oder explizit `pending_pdf_generation`
5. Bei Freigabe: `client_documents`-Mirror + `portal_visible=true`

Implementierung: `src/lib/assist/visitProofCompleteness.ts`

---

## Verbotene Muster (P0)

- Erfolg melden wenn Proof/Doku/WFM-Sync fehlgeschlagen
- `void` auf kritischen Persistenz-Nebenwirkungen in Finalize/Doku/Signatur
- Stiller Demo-Fallback im Supabase-Modus für Kernflow-Daten
- Read-only aus veraltetem `assist_visits.canonical_status` ohne Overlay

---

## Offene Nicht-P0-Punkte

- Vollständige Migration `assist_service_catalog_items` auf Production
- Realtime-Subscriptions (Refresh navigation-basiert)
- Typecheck-Gesamtgrün (Office/Portal Screen-Typen)
