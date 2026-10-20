# WFM Phase 2 — Schema-Freigabe (Review-Schicht)

**Stand:** 2026-07-07  
**Dokumenttyp:** Architektur-Freigabe / Go-No-Go für Migrationsentwurf  
**Basis:** [`wfm-phase2-proposal.md`](./wfm-phase2-proposal.md), Phase-1-Grenzen [`wfm-phase1-boundaries.md`](./wfm-phase1-boundaries.md)  
**Scope dieses Dokuments:** Freigabeentscheidung und verbindliche Schema-Rahmenbedingungen — **keine Migration, kein Code, kein Deploy**

---

## 1. Ergebnis der Schema-Freigabe

| Feld | Entscheidung |
|------|--------------|
| **Architekturoption** | **Option B** — separate Review-/Export-/Audit-Schicht über unveränderte `workforce_time_events` / `workforce_work_sessions` |
| **Freigabestatus** | **Bedingt freigegeben** |
| **Bedingung** | P2.0 (Remote-Verifikation Migrationen 0190–0195) muss **erfolgreich abgeschlossen** sein, bevor ein P2.1-Migrationsentwurf erstellt oder angewendet wird |
| **P2.1** | **GO** für Migrationsentwurf und Implementierung **nur nach** bestätigtem P2.0 |
| **P2.0** | **Nicht** Teil dieses Commits — wird separat gestartet, wenn explizit beauftragt |

**Kurzfassung:** Das Zielschema (Option B) ist fachlich und technisch abgenommen. Die operative Freigabe für Datenbankänderungen in P2.1 hängt ausschließlich an der Remote-Verifikation des WFM-Kerns (P2.0).

---

## 2. Abgrenzung zu Phase 2.0 und 2.1

### 2.1 Phase 2.0 (Voraussetzung, nicht in diesem Schritt)

P2.0 ist ein **reiner Verifikations- und Freigabeschritt** auf der Zielumgebung (Remote/Staging/Production — je nach Projektstandard), ohne Review-Tabellen.

| Prüfpunkt | Erwartung |
|-----------|-----------|
| Migration **0190** | Auf Remote **applied**; Tabellen `workforce_*`-Kern vorhanden und konsistent |
| Migrationen **0192–0195** | Ebenfalls applied und mit 0190 verknüpft (Sessions-Erweiterung, Export-Jobs, Check-in, Homeoffice-Backfill) |
| RLS-Nachschärfungen **0223–0225** | Policies und RPC `sync_assist_visit_times_to_wfm` / `resolve_current_employee_id` funktionsfähig |
| Smoke | Bestehende WFM-Tests (177+) grün; Assist-Sync ohne Regression |
| Dokumentation | Verifikationsprotokoll (Datum, Umgebung, Migrations-IDs, Prüfer) archiviert |

**Ohne bestandenes P2.0:** **NO-GO** für P2.1-Migration — Review-Schicht hätte keine stabile FK-/RLS-Basis.

### 2.2 Phase 2.1 (erster Umsetzungsschritt nach P2.0)

P2.1 liefert **persistente Office-Prüfung** als Minimum Viable Persistenz für die Prüfqueue.

**Im Umfang (P2.1):**

| Deliverable | Beschreibung |
|-------------|--------------|
| `workforce_time_entry_reviews` | Kanonische Review-Zeile pro Office-Zeitblock (polymorphe Referenz) |
| `workforce_time_review_actions` | Append-only Transitionen (Review-Lifecycle) |
| **RLS** | Policies gemäß Matrix (Abschnitt 8); analog bestehende `wfm_sessions_*`-Muster |
| **Repository-Cutover** | `reviewWfmOfficeTimeEntry`, Materialisierung/Lazy-Upsert, Wegfall von `setEntryOverlay` in Produktionspfaden |
| **Feature-Flag** | `EXPO_PUBLIC_WFM_PERSISTENT_REVIEW` (o. ä.) — Rollback auf Phase-1-Store |

**Nicht im Umfang (P2.1) — explizit zurückgestellt:**

| Thema | Geplante Phase | Begründung |
|-------|----------------|------------|
| `workforce_export_job_items` vollständig | P2.3 | Export-Protokoll auf Item-Ebene |
| Export-Batches End-to-End (Warnungs-Ack, Re-Export-Regeln) | P2.3 | Abhängig von Review-Join |
| `workforce_manual_time_entries` / Nachträge persistent | P2.4 | Eigenes Datenmodell + Approval |
| `workforce_travel_rules` / Fahrzeitregeln | P2.6 | Tab noch Platzhalter |
| `workforce_time_conflicts` | P2.5 | Abwesenheits-/Einsatz-Konflikte |
| `workforce_meeting_time_links` / Team-Meeting-Zeitlogik | P2.7 | Kalender-Brücke |
| Legacy Auto-Merge (`employee_time_*`, Payroll) | P2.8 | Read-only bis manuelle Migration |

---

## 3. Architekturentscheidung Option B (verbindlich)

### 3.1 Prinzipien

1. **SSOT Rohdaten:** `workforce_time_events` bleiben append-only; `workforce_work_sessions` bleiben Realtime-/Tagesanker.
2. **Orthogonaler Office-Lifecycle:** Prüf-, Export- und Sperrstatus leben in der Review-Schicht, nicht als mutable Felder auf Events.
3. **Granularität:** Office-UI (`WfmOfficeTimeEntry`) arbeitet auf **Visit-/Manual-/Meeting-Blöcken**, nicht nur auf Session-Ebene — Option A ist abgelehnt (siehe Proposal §4–6).
4. **Idempotenz:** Stabile `reference_key` pro `(tenant, employee, work_date, entry_kind, …)` für Lazy-Upsert ohne Duplikate.

### 3.2 Abgelehnte Alternative (Option A)

Session-/Event-Spalten für Review/Export wurden verworfen wegen:

- falscher Granularität (Multi-Visit-Tag),
- Widerspruch zu append-only Events,
- erhöhtem Korruptionsrisiko bei parallelen Session-Updates.

---

## 4. Finale Tabellenempfehlung (Canonical + Aliase)

Canonical-Namen folgen Migration **0190** (`workforce_*`). Aliase dienen nur Doku und optionalen Service-Konstanten — **nicht** als physische Tabellennamen in P2.1.

| Canonical (DB) | Alias (Doku/Legacy-Vorschlag) | P2.1 | Später |
|----------------|-------------------------------|------|--------|
| `workforce_time_entry_reviews` | `wfm_time_reviews` | **Ja** | — |
| `workforce_time_review_actions` | `wfm_time_review_audit` | **Ja** | — |
| `workforce_export_jobs` | `wfm_time_export_batches` | Lesen/Schreiben unverändert | P2.3 erweitern |
| `workforce_export_job_items` | `wfm_time_export_items` | **Nein** | P2.3 |
| `workforce_manual_time_entries` | `wfm_time_adjustments` | **Nein** | P2.4 |
| `workforce_travel_rules` | `wfm_travel_time_rules` | **Nein** | P2.6 |
| `workforce_time_conflicts` | `wfm_time_conflicts` | **Nein** | P2.5 |
| `workforce_meeting_time_links` | — | **Nein** | P2.7 |
| `workforce_audit_log` | — | Weiter nutzen (Summary) | P2.2 vertiefen |

Bestehende Kern-Tabellen (**unverändert** in P2.1): `workforce_time_events`, `workforce_work_sessions`, `workforce_absences`, `workforce_approvals`, `workforce_time_accounts`, `workforce_rule_violations`, `workforce_checkin_tokens`.

---

## 5. Referenzmodell (polymorph)

Jede Zeile in `workforce_time_entry_reviews` verweist auf genau **einen** fachlichen Zeitblock.

### 5.1 Felder

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `entry_kind` | Ja | `session` \| `visit` \| `manual` \| `meeting` |
| `reference_id` | Ja | UUID der Zielentität (siehe Mapping) |
| `reference_key` | Ja | Stabiler String, **UNIQUE** pro Mandant |
| `tenant_id` | Ja | Mandant |
| `employee_id` | Ja | `employees.id` (WFM-Auflösung) |
| `work_date` | Ja | Kalendertag (Europe/Berlin-Logik wie Office-UI) |

### 5.2 Mapping `entry_kind` → Entität

| `entry_kind` | `reference_id` zeigt auf | Beispiel `reference_key` |
|--------------|--------------------------|---------------------------|
| `session` | `workforce_work_sessions.id` | `{tenant_id}:{employee_id}:{work_date}:session:{session_id}` |
| `visit` | `assist_visits.id` | `{tenant_id}:{employee_id}:{work_date}:visit:{visit_id}` |
| `manual` | `workforce_manual_time_entries.id` (ab P2.4) | `{tenant_id}:{employee_id}:{work_date}:manual:{id}` |
| `meeting` | `calendar_events.id` (ab P2.7) | `{tenant_id}:{employee_id}:{work_date}:meeting:{event_id}` |

**P2.1-Hinweis:** `manual` und `meeting` können in P2.1 als **reservierte** `entry_kind`-Werte im Schema vorkommen; Materialisierung erfolgt erst mit P2.4/P2.7. Bis dahin: keine fremden Keys erzeugen.

### 5.3 Constraints (freigegeben)

```text
UNIQUE (tenant_id, reference_key)
CHECK (entry_kind IN ('session', 'visit', 'manual', 'meeting'))
FK reference_id — polymorph, ohne DB-enforced FK auf alle Zieltabelle (Application-Level + Trigger optional später)
INDEX (tenant_id, employee_id, work_date)
INDEX (tenant_id, review_status) WHERE review_status IN ('pending_review', 'needs_clarification')
```

### 5.4 Lazy Materialisierung

- Erster Zugriff über Prüfqueue, Ampel Rot/Blau (`wfmVisitDeviationAmpelService`), oder explizite Review-Aktion → **UPSERT** auf `reference_key`.
- Kein Bulk-Backfill aller historischen Tage in P2.1 (optional separates Datenprojekt).

---

## 6. Review-Statuswerte (freigegeben)

Abgestimmte Erweiterung gegenüber Phase-1-UI (`WfmOfficeTimeEntryStatus`); DB ist **Superset**, UI mappt initial Teilmenge.

| Status | Bedeutung | Terminal? | Übergänge (Auszug) |
|--------|-----------|-----------|---------------------|
| `open` | Noch nicht in Prüfung; Ampel grün/gelb ohne Pflichtaktion | Nein | → `pending_review`, `approved` (Auto) |
| `pending_review` | Prüfpflichtig (z. B. Rot/Blau-Ampel, Regelverstoß) | Nein | → `needs_clarification`, `approved`, `rejected` |
| `needs_clarification` | Rückfrage an MA/Team; wartet auf Antwort/Justification | Nein | → `pending_review`, `approved`, `rejected` |
| `approved` | Office-Freigabe erteilt | Nein* | → `corrected`, `exported`, `rejected` (Korrektur) |
| `rejected` | Abgelehnt; ggf. Korrektur nötig | Nein | → `corrected`, `pending_review` (Reopen) |
| `corrected` | Nach Korrektur/Freigabe-Zyklus bestätigt | Nein | → `approved`, `exported` |
| `exported` | In Exportlauf aufgenommen (logisch) | Nein** | → `changed_after_export`, `locked` |
| `locked` | Gesperrt (Lohn/periode); keine fachliche Änderung ohne Admin | **Ja*** | → `superseded` (selten, mit Audit) |
| `superseded` | Durch neue Review-Zeile oder Korrekturkette ersetzt | **Ja** | — |

\* `approved` ist fachlich „freigegeben“, aber Export/Sperre folgen separat.  
\** `exported` blockiert nicht automatisch Rohdaten-Änderungen an Events — siehe Abschnitt 9.  
\*** `locked` nur durch Admin/`time.tracking.admin.correct` + Audit.

**Automatik (freigegeben):** Ampel Rot oder Blau auf Visit-Block → beim ersten JOIN `pending_review` setzen (heute: Store-Overlay).

**Kompatibilität Phase 1:** Bestehende UI-Werte ohne `needs_clarification` / `superseded` bleiben bis Cutover gültig; Repository mappt fehlende DB-Werte konservativ.

---

## 7. Export-Statuswerte (freigegeben)

Export-Status sitzt **primär** auf `workforce_time_entry_reviews.export_status` (nicht auf Events). Job-Status auf `workforce_export_jobs` bleibt 0193-Set (`pending`, `processing`, `completed`, `failed`).

| `export_status` (Review-Ebene) | Bedeutung |
|--------------------------------|-----------|
| `not_exportable` | Fachlich nicht exportierbar (z. B. offene Prüfung, fehlende Pflichtdaten) |
| `pending` | Exportierbar, aber noch kein Lauf zugeordnet |
| `blocked` | Export blockiert (Warnung, Regel, fehlende Freigabe) |
| `ready` | Freigegeben für nächsten Exportlauf (`export_ready` in UI — Alias) |
| `exported` | Mindestens einmal in abgeschlossenem Job referenziert (Items ab P2.3) |
| `changed_after_export` | Rohdaten/Review nach Export geändert; Re-Export-Entscheid nötig |
| `voided` | Exportposition fachlich ungültig/storniert (mit Audit) |

**P2.1-Scope:** Felder und CHECK-Constraint im Schema; vollständige Item-Verknüpfung und Warnungs-Join (`getWfmOfficeExportWarnings` auf DB) folgen **P2.3**. Bis dahin darf Export-Status **manuell/transitional** aus Review-Workflow gesetzt werden.

**Mapping UI (Phase 1):**

| Alt (UI) | Neu (DB) |
|----------|----------|
| `not_exported` | `pending` oder `not_exportable` (regelbasiert) |
| `export_ready` | `ready` |
| `exported` | `exported` |

---

## 8. RLS-Matrix (Zusammenfassung, freigegeben)

Legende: **E** = Employee Portal, **O** = Office (Team-View), **A** = Admin (`time.tracking.admin.*`), **S** = Service Role (Bypass RLS).

| Ressource / Operation | E | O | A | S |
|------------------------|---|---|---|---|
| `workforce_work_sessions` / `workforce_time_events` — eigene lesen | Ja | Eingeschränkt (Team) | Ja | Bypass |
| `workforce_time_entry_reviews` — eigene lesen | Ja | Ja (`time.tracking.team.view`) | Ja | Bypass |
| `workforce_time_entry_reviews` — fremde lesen | Nein | Ja (Team) | Ja | Bypass |
| `workforce_time_entry_reviews` — Review-Status ändern | Nein | Nein | Ja (`time.tracking.admin.correct`) | Bypass |
| `workforce_time_review_actions` — lesen | Optional (eigene Kette) | Ja (Team) | Ja (`time.audit.view`) | Bypass |
| `workforce_time_review_actions` — INSERT | Nein (außer System-Trigger) | Nein | Ja (Admin + Service) | Bypass |
| `workforce_export_jobs` — lesen | Nein | Eingeschränkt | Ja (`time.tracking.admin.export`) | Bypass |
| `workforce_export_jobs` — erstellen/ausführen | Nein | Nein | Ja | Bypass |
| `workforce_audit_log` — lesen | Eingeschränkt | Ja | Ja | Bypass |
| Justification (JSONB auf Review) — MA-Update | Ja (eigene Zeile, `needs_clarification`) | Nein | Ja | Bypass |

**Permissions (Referenz, unverändert):** `time.tracking.own.start`, `time.tracking.team.view`, `time.tracking.admin.view`, `time.tracking.admin.correct`, `time.tracking.admin.export`, `time.audit.view`, `time.settings.manage`, `office.employees.absences.*`, `portal.employee.absences.*`.

**Freigabe-Hinweis:** Feingranulare Policies pro `entry_kind` sind **nicht** P2.1-Pflicht; einheitliche Review-Policy mit `employee_id = workforce_current_employee_id()` für Portal reicht für MVP.

---

## 9. Regeln nach Export (Post-Export Change Rules)

| Regel | Verhalten |
|-------|-----------|
| **R1** | Änderung an `workforce_time_events` nach `export_status = exported` setzt Review auf `changed_after_export` (Trigger oder Service — Implementierungsdetail P2.3). |
| **R2** | Re-Export nur mit `time.tracking.admin.export`, neuem Job (P2.3) und `workforce_time_review_actions` + `workforce_audit_log`. |
| **R3** | `locked` verbietet fachliche Korrektur ohne Admin-Reopen; Reopen erzeugt Action `review_reopened` und setzt Status auf `pending_review` oder `needs_clarification`. |
| **R4** | `voided` nur mit Audit; Payroll-Storno außerhalb WFM bleibt in `payroll_export_*` (Legacy). |
| **R5** | Assist-Rohdaten (`assist_time_events`) werden **nie** durch Review-Status überschrieben — nur Mirror/Events in WFM. |
| **R6** | Kein Auto-Merge historischer Payroll-Zeilen in Review-Schicht. |

**Vorläufige Empfehlung (freigegeben):** Strikte Sperre über `locked`; `exported` allein ist **warnend**, nicht blockierend für Event-Korrekturen bis P2.3 Item-Nachweis existiert.

---

## 10. Datenmodell P2.1 (Kernfelder)

### 10.1 `workforce_time_entry_reviews`

Zusätzlich zu Referenzfeldern (§5):

| Feldgruppe | Felder |
|------------|--------|
| Status | `review_status`, `export_status` |
| Prüfung | `reviewed_by`, `reviewed_at`, `review_note`, `office_comment` |
| Export (vorbereitet) | `export_job_id` (nullable), `exported_at` (nullable) |
| Snapshots | `ampel_snapshot JSONB`, `justifications JSONB`, `flags JSONB`, `metadata JSONB` |
| Audit | `created_at`, `updated_at` |

### 10.2 `workforce_time_review_actions`

| Feld | Beschreibung |
|------|--------------|
| `entry_review_id` | FK → Reviews |
| `action` | z. B. `review_approved`, `review_rejected`, `review_corrected`, `export_marked`, `review_reopened`, `clarification_requested` |
| `prev_status`, `new_status` | Review-Status vor/nach Transition |
| `actor_id` | `auth.users` / Employee-Auflösung |
| `reason`, `metadata JSONB` | Pflicht bei `rejected`, `review_reopened` |

**Redundanz zu `workforce_audit_log`:** Beide **ja** — Log für lesbare Summary (`writeWfmOfficeAudit`), Actions für maschinelle Transitionen und Historie-Tab.

---

## 11. Cutover und Feature-Flag

| Schritt | Beschreibung |
|---------|--------------|
| 1 | Migration P2.1 nur nach P2.0-Protokoll |
| 2 | Repository liest/schreibt Reviews; bei `isSupabaseMissingTableError` Fallback Store (wie Phase 1) |
| 3 | Flag **aus** in Produktion bis Cutover-Test grün |
| 4 | Flag **an** → `wfmOfficeTimekeepingStore.entryOverlays` für Review **deaktiviert** in Prod-Pfaden |
| 5 | Rollback: Flag **aus**, keine DROP-Tabellen |

**Akzeptanz:** Review-Entscheidung überlebt Reload (Browser-Tab, App-Neustart).

---

## 12. Risiken und Mitigation

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Migration 0190 nicht remote / Drift | **Hoch** | P2.0 Gate; NO-GO P2.1 |
| `reference_key`-Drift (falsche Key-Generierung) | Mittel | Zentraler Key-Builder + Unit-Tests; UNIQUE |
| Dual-Write Store + DB während Cutover | Mittel | Feature-Flag; kurzes Cutover-Fenster |
| Polymorphe FK ohne DB-FK | Mittel | Strikte Service-Validierung; optional deferred FKs später |
| RLS-Lücken (fremder `employee_id`) | **Hoch** | Policy-Smoke + Integrationstests |
| Export ohne Items (P2.1) | Mittel | Status nur transitional; P2.3 Pflicht für Lohn-Protokoll |
| Performance JOIN Prüfqueue | Mittel | Indizes §5.3; Pagination beibehalten |
| Legacy `employee_time_*` Parallelität | Niedrig | Read-only; keine Auto-Sync |

---

## 13. Offene Entscheidungen (nach Freigabe noch zu klären)

| ID | Thema | Status | Empfehlung |
|----|-------|--------|------------|
| D1 | Physische FK auf `assist_visits` vs. nur `reference_id` | Offen | Kein harter FK in P2.1 (Visit kann archiviert werden) |
| D2 | Trigger vs. Service für `changed_after_export` | Offen | Service in P2.3, Trigger optional |
| D3 | `needs_clarification` — Portal-Edit auf `justifications` | Offen | Ja, eingeschränkte RLS für E |
| D4 | Terminal: `exported` vs. `locked` Reihenfolge | **Entschieden** | Export vor Lock; Lock admin-only |
| D5 | Doppeltes Audit (`audit_log` + `actions`) | **Entschieden** | Beide |
| D6 | Tabellennamen `workforce_*` vs. `wfm_*` | **Entschieden** | `workforce_*` canonical |
| D7 | Bulk-Backfill Reviews für Historie | Offen | Nicht P2.1; separates Projekt |
| D8 | Re-Export derselben `reference_key` | Offen | Neuer Job + Audit; alte Items bleiben |

---

## 14. Tests für P2.1 (Pflicht vor Merge Produktion)

| Ebene | Testfokus |
|-------|-----------|
| **Unit** | `reference_key`-Generierung pro `entry_kind`; Status-Übergangsvalidierung; Ampel → `pending_review` |
| **Unit** | Review-Repository: Upsert, Update Status, Lesen nach `work_date` |
| **Integration** | `reviewWfmOfficeTimeEntry` → DB → Reload simuliert → gleicher Status |
| **Integration** | Feature-Flag aus: Store-Pfad unverändert (Regression Phase 1) |
| **Integration** | Feature-Flag an: kein `setEntryOverlay` in Prod-Pfad |
| **RLS** | MA sieht nur eigene Reviews; Office Team sieht Mandanten-Team; MA kann fremde Reviews nicht ändern |
| **Regression** | `zeit2OfficeTeamTimekeeping`, `zeit3OfficeTimekeeping` grün |
| **Manuell** | Rot-Ampel → Prüfqueue → Freigabe → Hard-Reload → Status bleibt |

**Exit-Kriterium P2.1:** Alle obigen automatisierten Tests grün; manueller Smoke dokumentiert; **177+** Gesamtsuite grün.

---

## 15. Go / No-Go

| Gate | Kriterium | Status |
|------|-----------|--------|
| **G0** | Option B Schema inkl. Referenzmodell abgenommen | **GO** |
| **G1** | P2.0 — 0190–0195 remote verified | **Ausstehend** (P2.0 nicht gestartet) |
| **G2** | RLS-Matrix §8 abgenommen | **GO** (vorläufig) |
| **G3** | Post-Export-Regeln §9 fachlich abgenommen | **GO** (vorläufig) |
| **G4** | Migrationsentwurf P2.1 (SQL) reviewt | **GO nach G1** |

**Gesamtentscheidung:**

- **GO** für Erstellung und Review eines **P2.1-Migrationsentwurfs** (Entwurf, nicht Apply) **nach** erfolgreichem **P2.0**.
- **NO-GO** für Apply auf Remote / `supabase db push` ohne P2.0-Protokoll.
- **NO-GO** für P2.2–P2.8 in derselben Migrationswelle wie P2.1.

---

## 16. Referenzen und Abhängigkeiten

- Architekturvorschlag: [`wfm-phase2-proposal.md`](./wfm-phase2-proposal.md) (Option B, §7–12)
- Phase-1-Grenzen: [`wfm-phase1-boundaries.md`](./wfm-phase1-boundaries.md)
- Typen UI: `src/types/modules/wfmOfficeTimekeeping.ts` (`WfmOfficeTimeEntryStatus`)
- Services (Cutover-Ziel): `wfmOfficeTimekeepingService`, `wfmOfficeTimekeepingStore`, `wfmVisitDeviationAmpelService`
- Migrationen (Kern): 0190, 0192, 0193, 0194, 0195; RLS 0223–0225

---

## 17. Freigabeprotokoll

| Rolle | Name / Datum | Unterschrift / Vermerk |
|-------|--------------|-------------------------|
| Architektur | 2026-07-07 — Schema-Freigabe dokumentiert | Option B bedingt freigegeben |
| P2.0 Verifikation | — | Ausstehend |
| P2.1 Migrationsentwurf | — | Ausstehend bis G1 |

---

**Zusammenfassung:** WFM Phase 2 setzt auf **Option B**. Dieses Dokument gibt **bedingte Freigabe** für den **P2.1-Migrationsentwurf** — ausschließlich nach **P2.0** (Remote-Verifikation 0190–0195). P2.1 umfasst Reviews, Review-Actions, RLS, Repository-Cutover und Feature-Flag; Export-Items, Nachträge, Fahrzeit, Konflikte und Team-Meetings bleiben ausgeschlossen. Review- und Export-Statuswerte sowie Referenzmodell und RLS-Matrix sind verbindlich für den Entwurf.

---

## Anhang A — Statusübergänge Review (State Machine)

```text
open ──────────────────────────────► pending_review (Ampel/Regel)
open ──────────────────────────────► approved (Auto-Freigabe grün)
pending_review ────────────────────► needs_clarification (Rückfrage)
needs_clarification ───────────────► pending_review (Antwort eingegangen)
pending_review ────────────────────► approved | rejected
rejected ──────────────────────────► corrected | pending_review (Reopen)
approved ──────────────────────────► corrected (Korrekturzyklus)
corrected ─────────────────────────► approved | exported
approved ──────────────────────────► exported (Exportlauf)
exported ──────────────────────────► changed_after_export (Rohdaten-Drift)
changed_after_export ──────────────► corrected | exported (nach Re-Export P2.3)
exported | corrected | approved ───► locked (Admin-Sperre)
locked ────────────────────────────► superseded (selten, mit Audit)
* ─────────────────────────────────► superseded (neue Review-Kette)
```

Übergänge ohne gültige `workforce_time_review_actions`-Zeile und ohne Berechtigung sind **verboten**.

---

## Anhang B — Statusübergänge Export (Review-Ebene)

```text
not_exportable ◄── (offene Prüfung, blocked rules)
pending ─────────► ready (Freigabe + keine Blocker)
pending ─────────► blocked (Warnung/Regel)
blocked ─────────► ready (Admin-Ack)
ready ───────────► exported (Job completed, ab P2.3 mit Item)
exported ────────► changed_after_export (Event/Review-Drift)
exported ────────► voided (Storno mit Audit)
changed_after_export ─► ready (nach Korrektur-Freigabe)
```

Job-Ebene (`workforce_export_jobs.status`) bleibt unabhängig: `pending` → `processing` → `completed` | `failed`.

---

## Anhang C — P2.0 Checkliste (Operativ)

- [ ] Remote: `workforce_time_events` existiert, RLS aktiv
- [ ] Remote: `workforce_work_sessions` inkl. 0192-Spalten
- [ ] Remote: `workforce_export_jobs` (0193/0195)
- [ ] Remote: `workforce_checkin_tokens`, `workforce_rule_violations` (0194)
- [ ] RPC `sync_assist_visit_times_to_wfm` ausführbar (Testvisit)
- [ ] `resolve_current_employee_id` / 0225-Pfad für Testnutzer
- [ ] CI: WFM-Test-Suite grün auf Commit-Stand
- [ ] Protokoll abgelegt unter `docs/architecture/` oder Audit-Ordner (separater Schritt)

---

## Anhang D — Abnahme P2.1 (Product / Office)

- [ ] Prüfqueue zeigt persistenten Status nach Reload
- [ ] Historie-Tab liest Review-Actions (mindestens letzte Transition)
- [ ] Keine verlorenen Freigaben nach Browser-Neustart
- [ ] Demo-Modus / fehlende Tabelle: Graceful Fallback ohne Crash
- [ ] Keine Regression Assist-Sync / Homeoffice-Adapter

---

## Anhang E — Explizit ausgeschlossene Schema-Objekte in P2.1

| Objekt | Grund Ausschluss |
|--------|------------------|
| `workforce_export_job_items` | P2.3 — Item-Protokoll |
| `workforce_manual_time_entries` | P2.4 — Nachtragsmodell |
| `workforce_travel_rules` | P2.6 |
| `workforce_time_conflicts` | P2.5 |
| `workforce_meeting_time_links` | P2.7 |
| ALTER auf `workforce_time_events` Review-Spalten | Option A verworfen |
| ALTER auf `workforce_work_sessions` Review-Spalten | Option A verworfen |
| Bulk-Migration `employee_time_*` → Reviews | Legacy — manuell, P2.8 |

---

## Anhang F — Glossar

| Begriff | Definition |
|---------|------------|
| **SSOT** | Single Source of Truth — Rohdaten in `workforce_time_events` |
| **Office-Zeitblock** | Ein Prüfobjekt in der Office-UI (`WfmOfficeTimeEntry`) |
| **Lazy Upsert** | Review-Zeile wird erst bei Bedarf angelegt |
| **Cutover** | Umstellung von In-Memory-Store auf DB-Persistenz |
| **P2.0** | Remote-Verifikation WFM-Kern-Migrationen |
| **P2.1** | Review-Persistenz (dieses Freigabe-Minimum) |

