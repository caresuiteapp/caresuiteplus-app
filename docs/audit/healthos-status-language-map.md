# CareSuite+ HealthOS — Status- und Sprachsystem (H0)

**Stand:** 2026-07-02  
**Ziel:** Einheitliche UI-Texte, Badge-Typen und technische Mapping-Tabelle für HealthOS.

---

## Einsatzstatus (AssignmentStatus)

Quelle: `src/types/modules/assignmentStatus.ts`  
Primäre Anzeige: Assist, Employee Portal, Live-Status.

| Technisch | UI-Text | Badge-Typ | Schweregrad | Angezeigt in |
|-----------|---------|-----------|-------------|--------------|
| geplant | Geplant | muted | info | Assist list, Portal assignments |
| bestaetigt | Bestätigt | cyan | info | Assist, Portal |
| unterwegs | Unterwegs | orange | warning | Live map, Portal live |
| angekommen | Angekommen | orange | warning | Execute |
| gestartet | Gestartet | green | success | Execute |
| pausiert | Pausiert | orange | warning | Execute |
| beendet | Beendet | muted | info | Execute |
| dokumentation_offen | Dokumentation offen | orange | warning | Dashboard CTA, Inbox |
| unterschrift_offen | Unterschrift offen | orange | warning | Execute, Inbox |
| abgeschlossen | Abgeschlossen | green | success | Nachweise, Billing |
| storniert | Storniert | red | error | Listen |
| nicht_erschienen | Nicht erschienen | red | error | Assist |

### Visit-Dimensionen (Office Detail)

Quelle: `src/lib/assist/visitTypes.ts`

| Dimension | Beispiel-Werte | UI-Labels | Badge |
|-----------|------------------|-----------|-------|
| planning | scheduled, confirmed | Geplant, Bestätigt | cyan |
| execution | on_way, in_progress | Unterwegs, In Durchführung | orange/green |
| documentation | open, complete | Offen, Vollständig | orange/green |
| proof | pending, signed, verified | Nachweis offen, Unterschrieben, Verifiziert | orange/green/cyan |
| billing | ready, blocked | Abrechnungsbereit, Blockiert | green/red |
| portal | visible, hidden | Sichtbar, Verborgen | cyan/muted |

**HealthOS:** `HealthOSStatusBadge` zeigt AssignmentStatus primär; Dimensionen als sekundäre Chips in Office-Detail.

---

## Budgetstatus

| Modell | Technisch | UI-Text | Badge | Schweregrad | Wo |
|--------|-----------|---------|-------|-------------|-----|
| ClientBudgetAccount.status | active | Aktiv | green | success | `ClientBudgetAccountsGrid` |
| | closed | Geschlossen | muted | info | Akte Budget |
| | suspended | Ausgesetzt | orange | warning | Akte Budget |
| ClientBudgetAccount.locked | true/false | Gesperrt / Aktiv | red/green | error/success | Grid |
| BudgetAllocationLineStatus | blocked | Blockiert | red | error | Assignment wizard |
| | used | Verbraucht | green | success | Allocation preview |
| lifecycle (Transaktion) | geplant | Vorschau | muted | info | Budget tab |
| | reserviert | Reserviert | cyan | info | Assignment finalize |
| | durchgefuehrt | Durchgeführt | green | success | Post-finalize |
| VisitBillingStatus | ready, blocked | Abrechnungsbereit, Blockiert | green/red | success/error | Visit detail |

---

## WFM/Zeitstatus

Quelle: `src/lib/wfm/wfmClockService.ts`

| Technisch (session.status) | UI-Text | Badge | Schweregrad |
|----------------------------|---------|-------|-------------|
| offline | Nicht gestartet | muted | info |
| clocked_in | Aktiv | green | success |
| paused | Pause | orange | warning |
| on_visit | Im Einsatz | cyan | info |
| driving | Unterwegs | orange | warning |
| office | Büro | cyan | info |
| homeoffice | Home Office | cyan | info |
| ended | Feierabend | muted | info |

Display-Status (displayStatus): im_einsatz, pause, urlaub, krank — Labels in `DISPLAY_STATUS_LABELS`.

| UI-Zustand | Technisch | Badge |
|------------|-----------|-------|
| Offen | offline, ended | muted |
| Laufend | clocked_in, on_visit, driving | green/cyan |
| Abgeschlossen | ended (Tagesabschluss) | muted |
| Prüfen | audit flags | orange |
| Korrigiert | corrected | cyan |
| Blockiert | sync_failed, policy block | red |

---

## Dokumentstatus

| Modell | Technisch | UI-Text | Badge | Wo |
|--------|-----------|---------|-------|-----|
| DocumentLifecycleStatus | draft | Entwurf | muted | Document engine |
| | finalized | Finalisiert | green | Engine |
| DB document_status | draft, active, archived, deleted | Entwurf, Aktiv, Archiviert, Gelöscht | variabel | Office docs |
| Portal WorkflowStatus | entwurf, aktiv, in_bearbeitung | WORKFLOW_STATUS_LABELS | variabel | Portal docs |
| Proof status | draft, pending, verified | Nachweis-Entwurf, Ausstehend, Verifiziert | orange/green | Assist Nachweise |
| Portal sichtbar | portal_visible true/false | Im Portal sichtbar / Verborgen | cyan/muted | Release flow |

**Inkonsistenz:** Portal nutzt WorkflowStatus; Engine nutzt DocumentLifecycleStatus.  
**HealthOS H7:** `HealthOSStatusBadge` mit `scope`: `document.lifecycle` | `document.portal` | `workflow` | `proof`.

---

## Blocker-/Qualitäts-Sprache

Quelle: `assistExecutionProblemInboxService`

| Code | UI-Text | Badge | Schweregrad |
|------|---------|-------|-------------|
| budget_reservation_failed | Budget-Reservierung fehlgeschlagen | red | error |
| budget_ledger_missing | Budget-Ledger fehlt | red | error |
| wfm_sync_failed | WFM-Sync fehlgeschlagen | orange | warning |
| documentation_incomplete | Dokumentation unvollständig | orange | warning |
| signature_missing | Unterschrift fehlt | orange | warning |
