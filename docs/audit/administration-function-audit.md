# Verwaltung: Funktions- und Seitenabgleich, 26.10.2026

Dies ist ein offener Arbeitsstand, keine Freigabe. Jede der 583 ausgewählten Verwaltungs-/Operatorseiten ist im JSON einzeln erfasst. Die Route-Matrix belegt Dateiauswahl und statische Verbindungen; sie führt weder reale Datensätze noch vollständige native Abläufe aus.

## Materielle Befunde

| Befund | Tatsächliche Wirkung | Stand |
|---|---|---|
| ADMIN-P1-PERSONNEL-RPC | Actual native original PersonnelWorkspace calls missing personnel list/context/commit/confirm RPCs after its real business authority check. No fallback exists. | open_backend_dependency |
| ADMIN-P1-FINANCING-RPC | Base ClientLegalDocumentsScreen focus=contracts imports extensionless ClientFinancingWorkspace. Android selects the generated .native implementation over the base null placeholder; authorized context read requires absent financing RPCs. Old private-Web/native-empty comment is inaccurate for actual Metro selection. | open_backend_dependency |
| ADMIN-P1-DETAIL-WRONG-TARGET | Normalized context tabs discarded requested legacy detail tabs; actual screen silently displayed overview. Billing now opens its actual existing billing profile/contracts only with exact financial-view permission. Other unsupported targets clearly remain unavailable; current edited budget survives invalid URL targets. No clinical module enabled. | fixed_in_working_source_pending_final_native_verification |
| ADMIN-P1-ASYNC-TAB-TARGET | Tab hook previously ignored an unchanged requested target after the available tab set changed asynchronously. Incoming tab-set identity now participates in re-evaluation; dirty/busy/identity guards remain tested. | fixed_in_working_source_pending_final_native_verification |
| ADMIN-P2-SOURCE-ASSERTIONS | Die 11 alten Quellform-Erwartungen wurden an die überprüfte aktuelle Architektur gebunden; engere tatsächliche Abschluss-, Original-, Status-, Lifecycle- und Aliasprüfungen bestehen separat. Der breite alte Lauf wurde nicht als neuer Gesamtlauf ausgegeben. | current_contracts_updated_focused_tests_pass_broad_rerun_pending |
| ADMIN-NOTES-TIMEOUT | Broad one-worker run hit 5-second timeouts in retry/conflict cases. Entire unchanged actual native Notes interaction suite rerun alone: 10/10 passed in 16.86s. No product or timeout changes made. | not_reproduced_in_isolation |

## Getrennte Nachweise

- Vorhandene Tenant/Clients/Office/Inventory-Suiten vor der Folgeprüfung: 2719/2731 Assertions bestanden, 12 fehlgeschlagen. Die breite Suite wurde nicht nachträglich als vollständig grün umgedeutet.
- Unveränderte native Notes-Interaktionssuite einzeln: 10/10 grün; breite Laufzeitüberschreitungen derzeit nicht isoliert reproduziert.
- Echter gemeinsamer Akten-Screen und Tab-Hook: 24/24 gezielte Fälle grün, einschließlich Finanzrecht, richtiger Billing-Inhalte, Nichtverfügbarkeit und Entwurfsschutz. Inerte UI-/Servicegrenzen; kein physisches Android.
- Weitere WFM/Payroll/Dokumente/Kalender: 147 Dateien, 1441/1442 Assertions grün. Ein Kontrasttest erwartet den Provider direkt in einer inzwischen reexportierenden Datei; semantischer Kontrastnachweis bleibt separat.
- Bestehende lokale PostgreSQL-Dokument-/Logo-Verträge: 18/18 grün, synthetische Daten und tatsächliche SQL-Definitionen. Keine produktiven Funktionen aufgerufen.
- Neun ergänzende Vollshell-Fälle (einschließlich exakter Finanzrechtsverweigerung) importieren tatsächliche Android-Default-Routen; Kompilierung/Bilder beim Vollshell-Agent noch ausstehend.

## Workflowgrenzen

| Workflow | Quellbindung | Verbleibende Grenze |
|---|---|---|
| company | Explicit tenant, actor role/effective permissions and expected version in organization/resources services; actual RPC existence checked only through the captured catalog. | No actual authenticated company create/edit/readback acceptance. Additional subpage-specific render/state acceptance still required. |
| client_record | Native record owner key contains tenant, record, user/profile and role. Full detail must match record ID. Restored billing view additionally requires clients.billing_profile.view. Context-only routes never gain tabs through arbitrary incoming parameters. | Real authenticated record authorization/readback not executed. Intake activation/signature provenance requires endpoint and stored-document acceptance; historical source-string expectations currently fail. Several legacy detail routes have no implementation in the current record context and now explicitly say unavailable instead of showing overview. |
| personnel | Standard personnel file is keyed by tenant/user/profile/role/employee. Original workforce repository additionally verifies current access token, user and actor/tenant/employee in each read/receipt. | Original workforce backend RPCs absent from captured production catalog. No actual standard personnel edit/readback or employee portal grant acceptance. |
| invoices | Workspace requires a current nonportal authenticated user, tenant, role and invoice permissions; scope key includes actor/tenant/role/effective permissions. Mutations send invoice ID, expectedUpdatedAt and stable request ID. | No actual invoice lifecycle or payment persisted/read back. Presence of RPC does not prove server validator/hash/archive behavior or a norm-valid issued e-invoice. |
| wfm | Explicit tenant/actor/role, employee/reference and expected revision carried by review/correction calls. Native read repositories are separate from UI. Synthetic/fixture tests do not establish production RLS behavior. | No authenticated review/correction/export readback. Team calendar requires a verified colleague-status projection; own-assignment SQL tightening packet remains blocked. |
| payroll | Publication validates source revision and compares existing publication after uncertain outcomes; signed PDF URL requires document context rather than a caller-provided path alone. | No real payroll publish/readback or original PDF download acceptance. Employee payroll decision SQL review remains unapplied. |
| documents | Existing local PostgreSQL tests validate tenant/record/object path and rollback/idempotency of portal upload review plus exact catalog logo authority. These are synthetic local contracts only. | No real native picker/storage upload/signature lifecycle and stored-original readback. No exact per-route full-shell layout/state acceptance yet. |
| messages | Native workspace actor key contains tenant, profile/user and effective role. Draft/operation scopes are identity bound. No message has been sent by this audit. | No authenticated message send/readback/recipient acceptance. Current compact header contract is checked against the shared implementation; visual acceptance remains separate. |
| google_workspace | Canonical native UI derives from shared Web source; current focused local tests cover capability count, loading/error/retry and native form callbacks, not a live Google connection. | No authenticated Google operation or recipient/content acceptance. |
| operator_console | Native platform session/route guards and current capability model remain in force. Dossier owner/record identity and operation receipts are validated by existing adapter tests; actual operator backend actions not executed. | No actual operator membership/tenant/billing write and readback acceptance. Previous isolated dossier/console image fixtures are not the new all-portal full-shell acceptance. |

## Nicht aktivieren

ClientLifecycleWorkspace liegt hinter gesperrter /pflege-Route. Für den generierten ClientBillingWorkspace ist aktuell kein tatsächlich erreichbarer Aufrufer nachgewiesen. Fehlende RPCs solcher Module werden daher getrennt von den beiden aktiven Original-Workspaces geführt. Die vier alten SQL-Pakete bleiben gesperrt; der Teamstatus-Entwurf ist keine aktive Lösung.

## Weiter offen

Authentifizierte Aktions-/Readback-Nachweise, jede einzelne Unterseite mit echten Recordbindungen, vollständige Shell in Telefon/Tablet/Großschrift sowie echte Android-Navigation und Offline-/Wiederanlaufzustände sind nicht durch diese Inventur ersetzt. Die Release-Erstellung bleibt gehalten.

## Abschließende Business-Folgeprüfung

Die alten Quellform-Erwartungen wurden gegen die tatsächlich aktuelle Architektur überprüft und eng erneuert: Der Aufnahmeabschluss benötigt die gebundene `client-intake-completion-v1`-Quittung des vorhandenen Serverendpunkts, statt pauschal jeden Abschluss zu blockieren; Statuszuordnungen verwenden die konkrete Intake-Statusabbildung. Unveränderliche Originale und bestehende Serverabschluss-/Wiederanlaufverträge bleiben separat geprüft. Die Android-Office-Aliasse werden jetzt tatsächlich ausgeführt und prüfen Bereich, Datensatz und wiederholte Querywerte, statt einen veralteten Arbeitsflächen-Komponentennamen zu verlangen.

- Acht aktualisierte Vertrags-/Alias-Suiten: **77/77** bestanden.
- Neun vorhandene tatsächliche Aufnahmeabschluss-, Original-, Status-, Lifecycle-, Inventar- und Aktennavigation-Suiten: **133/133** bestanden.
- Zwei Akten-Hooks mit echtem `useAsyncQuery`: **10/10** Fälle für sofortige Leerung bei Konto-/Mandanten-/Datensatzwechsel und Rechtewiderruf sowie Ablehnung später Altantworten. Vier ergänzende WFM-Token-/Quellverträge bestehen ebenfalls.
- Normaler UI-Textaudit: **26/26** bestanden. Die technische Arbeitsplatzbeschreibung verwendet verständliche deutsche Begriffe; ihre bestehenden Release-/Security-Schutzregeln wurden nicht gelockert. Der ausgewählte Unterbrechungs-Radiobutton setzt seinen tatsächlichen Zustand ausdrücklich; er trägt keinen leeren Aktionshandler mehr.

Ein zusätzlicher belegter Quellfehler betraf den Akten-Lesepfad: `useClientRecord` und `useClientFullDetail` hatten keinen Datensatz-Scope im asynchronen Queryzustand. Ein gehaltener Verbraucher konnte vorherige Daten bis zur Folgeantwort behalten. Beide Hooks binden jetzt Konto, Mandant, Datensatz, Rolle und Lese-/Sensitivitätsrechte, verwerfen Altantworten und lesen nach Rechteentzug nicht weiter. Der Record-Service reicht die Sensitivitätsfreigabe an den bestehenden Maskierungsleser weiter; ohne explizite Freigabe bleibt diese maskiert. Das ersetzt keinen aktuellen Server-RLS-Nachweis.

Die neuen Konto-, Dossier- und Datenübernahme-Komponenten der Konsole bleiben im älteren Registrierungs-/Status-Harness echte Komponenten. Ihre dort nicht beauftragten Transporte sind ausdrücklich abgewiesen; eine Quittung oder erfolgreiche Datenanzeige wird nicht erfunden. Die entsprechenden eigenständigen Interaktionssuiten werden getrennt ausgeführt.

Alle Zahlen sind überlappende, eng begrenzte Prüfgruppen und werden nicht zu einer Gesamtzahl oder vollständigen Portalabnahme addiert. Native Vollshell-, Geräte- und Produktivabläufe sowie die bestätigten fehlenden Serverabhängigkeiten bleiben offen.

Der kombinierte Konsolen-Folgelauf besteht mit **38/38** Fällen in vier Dateien: der reparierte Registrierungs-/Status-Harness sowie die eigenständigen tatsächlichen Dossier-, Konto- und Datenübernahme-Interaktionssuiten. Die Konten-/Datei-/Dossiertransporte bleiben ausschließlich synthetisch und werden nicht als authentifizierte Produktivaktionen ausgegeben.
