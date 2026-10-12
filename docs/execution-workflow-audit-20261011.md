# Einsatzdurchführung – Prüf- und Übergabestand vom 11.10.2026

Ausgangscommit: `53aa6a47f2deb0d1c8184092ee90d64597b5d74a`, Branch `fix/mobile-admin-20261011`. Geprüft wurden die bestehenden Native- und Web-Einsatzabläufe. Die bisherigen Mitarbeitenden-Auditkorrekturen wurden erhalten. Keine produktiven Geschäfts- oder Authentifizierungszeilen gelesen oder geändert, keine Registrierung/E-Mail ausgeführt, keine Installation, Migration, Veröffentlichung, Exporte oder Commits durch diesen Teilauftrag.

## Bestätigte Fehler und Änderungen

| Auslöser | Bisheriges Verhalten | Korrigierter Vertrag |
|---|---|---|
| Unterschrift im Web speichern | Abweichende Web-Implementierung mit schwächeren Actor-/Speicherreceipts | Native und Web verwenden denselben Service; tatsächliches authentifiziertes Profil, Mandant, Einsatz, Bildpfad, Inhalts- und Bildhash sowie Signiername und Rolle müssen passen. |
| Antwort auf Signatur-INSERT bricht ab | Eine abgelehnte Netzwerk-Promise konnte die vorhandene Recovery umgehen | Scoped Readback auch bei abgelehnter Promise; ungewisser Commit erhält das Bild für die Wiederholung. |
| Bereits übermittelte Dokumentation korrigieren | Altes `submitted` konnte eine neue, nicht gespeicherte Fassung bestätigen | Jeder übermittelte Dokumentationswert wird mit der tatsächlich gespeicherten scoped Zeile und dem authentifizierten Profil verglichen. |
| Unterschrift ersetzen, Antwort verlieren, anschließend neu laden | Eine frühere gültige Signatur konnte als neue Speicherung erscheinen; die erwartete Fassung ging beim Neustart verloren | Vor dem Write werden ausschließlich Hashes und Signiermetadaten unter Mandant/Mitarbeiter/Profil/Authkonto/Einsatz gespeichert. Refresh/Neustart prüft genau diese Fassung. Fehlender oder fehlerhafter Speicher bleibt unbestätigt. |
| Dokumentation, Aufgaben, Klient oder Planzeit nach einer Unterschrift ändern | Eine weiterhin gültig markierte frühere Signatur konnte am neuen Nachweis hängen | Nachweisaufbau und Wiederverwendung prüfen den tatsächlichen Signatur-Inhaltshash gegen die aktuelle Einsatzfassung. Signierinformationen stammen aus der echten Signaturzeile. |
| Abschluss aus einer alten Bildschirmanzeige | Aktionskontext konnte aus dem UI-/Cache-Fallback kommen | Beide Abschlusswege lesen die aktuelle Fassung ohne vorbefüllte Details oder automatische Reparatur. Fehlgeschlagene Abfrage sendet keinen Abschluss. Bearbeitete Aufgaben müssen vorher bestätigt sein. |
| Abschlussantwort verlieren | Ein Endstatus mit Statusflags genügte für die Recovery | Zusätzlich sind Nachweis-Scope, tatsächlicher Snapshot-Hash, aktuelle und versuchte Inhaltsfassung sowie die richtige gültige Signatur erforderlich. Beim verschobenen Signieren muss der Nachweis tatsächlich im Portal freigegeben sein. Eine inzwischen vom Klienten erledigte Anfrage wird ebenfalls korrekt erkannt. |
| Eine weitere Pause/Fortsetzung prüfen | Allgemeiner Status konnte die konkrete Pause bestätigen | Tatsächliche passende `pause_start`-/`pause_end`-Ereignisse und Timergrenzen sind erforderlich. |
| Legacy-Einsatzübersicht öffnen | `updated_at` wurde als Arbeitszeit interpretiert; englische gespeicherte Zustände wurden falsch eingeordnet | Kanonischer Besuch mit gespeicherten tatsächlichen Zeiten; Ende/Dokumentation/Unterschrift bleiben offen bis zum echten Abschluss. Aktive Listen verwenden gespeicherte Planzeiten und passende Phasen. |
| Legacy-Checkout oder parallele Aktionen | Direkte Statuswrites konnten den geführten Nachweisablauf umgehen; alte Antworten konnten einen anderen Einsatz beeinflussen | Legacy-Screen führt in die bestehende Visitansicht. Eigene zugewiesene Einsätze haben den Link zur Mitarbeitendendurchführung; alte Live-Statusbuttons melden den geführten Weg. Ein scoped Aktionslock verhindert parallele Aktionen und ignoriert Antworten nach Visit-/Accountwechsel. |
| Assignment-Status-RPC verweigert oder quittiert eine andere Änderung | Fallback auf schwächeres direktes UPDATE; schnelles Ergebnis konnte erwarteten statt gespeicherten Status enthalten | Kein Fehler-Fallback. Frischer Scope vor dem Write, erwartete RPC-ID und tatsächlicher scoped Statusreadback nach dem Write; Ausführung bestätigt zusätzlich den weiterhin zugewiesenen Mitarbeiter. Audit ist sekundär. |
| Execution-State speichern, Server liefert keine Zeile/abweichende Werte/fehlendes Schema | Teilweise fingierte Erfolgsantwort bzw. reduzierte Ersatzpersistenz | Vollständige tatsächlich gespeicherte Zeile muss Scope, Status, Schritt, Zeiten und Flags bestätigen. Server-`updated_at` wird zurückgegeben; unbekannter Besuch oder fehlendes Schema ist ein sichtbarer Fehler. |
| Verspätete State-Projektion nach Ende oder Abschluss | Verifizierter Produktionsguard erlaubte etwa `abgeschlossen → pausiert` | Lokaler SQL-Reviewentwurf schützt Ende/Abschluss, tatsächliche Zeitinvarianten und gespeicherte Versionsreceipts. Echte offene Pause/Fortsetzung, Dokumentationsinvalidierung, spätere Klientensignatur und kanonische Zeitkorrektur bleiben möglich. Keine Anwendung auf dem Server. |

## Verifikation

Finaler Lauf, `--maxWorkers=1`: **41 Testdateien, 384 Tests bestanden**. Log: `/workspace/scratch/06df2d298469/execution-final-focused-tests.log`. `git diff --check` ist sauber.

Der Lauf umfasst die komplette bestehende `src/__tests__/assistWorkflow`-Gruppe und die Portaltests `assignmentWorkflowRegressionGate`, `visitSignatureConfirmationRecovery`, `visitWorkflowNativePersistence` und `deferredSignatureRpc`.

Neue beziehungsweise gezielt erweiterte echte Verhaltenstests prüfen insbesondere:

- tatsächliche Native- und explizite Web-Serviceimporte für Signatur-/Nachweisreceipts;
- Hookaktionen mit kontrollierten Timern, spät eintreffenden Antworten, Readback, Scopewechsel und gesperrter Wiederholung;
- sämtliche Dokumentationsfelder sowie Actor, Inhaltsfassung und Ersatzsignatur;
- tatsächliche device-/session-storage-Reads und -Writes, Neustart, Account-/Visitwechsel, korrupte Werte und Timeouts;
- kanonische Legacyzeiten, fehlgeschlagene Reads und blockierte alte Livewrites;
- acht Assignment-Statusreceipts und neun Execution-State-Receipts;
- elf tatsächliche Nachweis-Recoveryfälle einschließlich bereits erledigter Klientensignatur;
- siebzehn isolierte PostgreSQL/PGlite-Fälle, die zunächst die erfasste Produktionsdefinition reproduzieren und anschließend den wirklichen SQL-Entwurf ausführen.

Zwei vorhandene Sourcechecks verlangten die entfernte UI-Fallback-Recovery beziehungsweise einen Kommentar zum alten schnellen Receipt. Sie wurden auf den strengeren Reader-/Receiptvertrag umgestellt. Die entsprechenden fachlichen Fehlerfälle sind zusätzlich durch echte Service-/Hooktests abgedeckt.

## Betroffene Dateien

- `src/lib/assist/assistVisitSignaturePersistenceService.shared.ts`, `.ts` und `.web.ts`
- `src/features/assistWorkflow/visitDocumentationContent.ts`, `workflowWriteExpectation.ts`, `signatureMatchesVisitContent.ts`, `readFinalWorkflowProofConfirmation.ts`
- `src/features/assistWorkflow/saveVisitDocumentation.ts`, `saveClientSignature.ts`, `generateServiceRecord.ts`, `finalizeVisit.ts`, `readWorkflowActionConfirmation.ts`, `workflowRecoveryVerification.ts`, `assistVisitExecutionStatePersistence.ts`
- `src/hooks/useEmployeePortalVisitExecution.ts`, `useAssignmentExecution.ts`
- `src/lib/portal/visitSignatureWriteVersionStorage.ts`, `readVisitSignatureConfirmation.ts`
- `src/lib/assist/executionService.ts`, `src/lib/services/repositories/executionRepository.supabase.ts`
- `src/lib/assist/repositories/assignmentRepository.supabase.ts`: ausschließlich der Status-/Receiptpfad aus diesem Teilauftrag; `prepareServiceRecord` gehört dem Remaining-Agenten.
- `src/features/liveTracking/persistResolvedAssignmentStatus.ts`: erwartete Mitarbeiterzuordnung beim Statuswrite.
- `src/screens/assist/AssignmentExecutionScreen.tsx`, `VisitExecutionScreen.tsx`
- `docs/workflow-server-execution-regression-draft.sql` und zugehörige fokussierte Tests.

## Offene Freigabegrenzen

1. **Serverkorrekturen sind Reviewentwürfe.** Der erfasste `set_assignment_status`-Serververtrag ist ohne vollständigen Actor-/Mandantencheck sicherheitskritisch; der separate Status-/WFM-Entwurf gehört dem Remaining-Agenten. Der Execution-Regressionsentwurf verwendet `SECURITY INVOKER` und gewährt keine zusätzlichen Schreibrechte. Seine echte Supabase-RLS-/JWT-Integration ist noch nicht durch synthetische Fixtures belegt.
2. **Atomarer Serverabschluss für parallele Geräte bleibt zu integrieren.** Lokale Fas­sungsprüfungen und gespeicherte Receipts ersetzen keine atomare serverseitige Prüfung zwischen Dokumentation, Signatur, Nachweis und kanonischem Abschluss. Der Reviewentwurf schützt End-/Abschlussregressionen; er führt keinen neuen compare-and-swap-Writevertrag für alle offenen Pause-/Fortsetzungsprojektionen ein.
3. **Alte/fehlerhafte Nachweise können bewusst sperren.** Der SQL-Entwurf verlangt passende Dokumentation und kanonische Zeiten. Fehlerhafte JSON-Zeitwerte oder unvollständige historische Snapshots brauchen vor Anwendung eine eigene read-only Bestandsbewertung und einen überprüften Reparaturvertrag; hier wurde kein Backfill ausgeführt.
4. **Reales Gerät und vollständiger PDF-Ablauf fehlen.** Ein echter Android-/Webablauf mit GPS-Freigabe, Offlinewechsel, Hintergrundbetrieb, Touchsignatur, PDF-Rendering und Klientenfreigabe wurde in diesem Teilauftrag nicht ausgeführt. Die Tests belegen Service-/Hook-/Speicherverhalten, keine vollständige optische oder produktive Ende-zu-Ende-Freigabe.
5. **Integration liegt bei Root.** Projektweiter Typecheck, Export/Build und Zusammenführung mit den Änderungen anderer Agenten werden separat durchgeführt. Der Produktcode dieses Teilauftrags ist nach dem finalen Fokuslauf eingefroren.

## Autorisierter Servernachtrag: Workflow-Reparatur

Nach dem App-Freeze bestätigte das read-only RPC-Inventar einen weiteren tatsächlich verwendeten Serverfehler in `repair_assist_visit_workflow_status`: Der vorhandene `SECURITY DEFINER`-RPC prüft weder tatsächliche Anmeldung und Sitzungsmandant noch eigene Mitarbeiterzuordnung. Er interpretiert die vom Aufrufer gelieferte Mitarbeiter-ID als Profil-ID, kann mehrere verknüpfte Visits zugleich ändern und lässt einen Abschluss ohne vorhandenen Nachweis zu.

Der separat autorisierte lokale Reviewentwurf `docs/workflow-server-repair-authorization-draft.sql` ersetzt ausschließlich die bestehende RPC-Signatur. Er prüft ein eindeutig Auth-gebundenes aktives Profil, Sitzungsmandant, aktive eigene Portalverbindung und deren Erstloginstatus; Officezugriff erfordert Businesskontext und bestätigte Ausführungsberechtigung beziehungsweise Admin. Assignment und genau ein zugehöriger kanonischer Besuch werden gesperrt und erneut auf Mitarbeiter/Klient/Mandant geprüft. Auditautor ist ausschließlich das tatsächliche Profil. Reparaturen richten Status und Zeitmirrors an vorhandenen Zeitereignissen beziehungsweise kanonischen Zeiten und übermittelter Dokumentation aus. Sie erzeugen keine Dokumente, Signaturen, Nachweise oder Zeitereignisse.

Neue terminale Zustände bleiben gesperrt. Bereits vollständig konsistente terminale Zustände sind idempotent; widersprüchliche Abschlussmirrors bleiben bei der getrennten beleg- und PDF-gebundenen Abschlusskorrektur. Die frühere Boolean-Umgehung für einen fehlenden Leistungsbeginn ist auch für Admin gesperrt. Mehrere Recurrences werden nicht willkürlich ausgewählt oder gemeinsam verändert. Der geprüfte monotone Execution-Guard ist eine explizite Installations- und Laufzeitdependency, erkennbar an seinem lokalen Revisionskommentar und aktivem Trigger.

`supabase/tests/workflow_server_repair_authorization_draft.test.mjs`: **19/19 isolierte PostgreSQL/PGlite-Tests bestanden**, ein Prozess mit `--test-concurrency=1`. Der erste Test reproduziert die exakt erfasste Produktionsdefinition vor den Drafts. Danach werden unter anderem Authentifizierung, Profile/EPA, Scope, Actor-Spoofing, Officeberechtigungen, Zeitbelege, Mehrfachzuordnung, terminale Regression, Idempotenz und vollständiger Transaktionsrollback bei Auditfehler geprüft. Log: `/workspace/scratch/06df2d298469/execution-repair-authorization-tests.log`.

Der Execution-Regressionsentwurf wurde nach Ergänzung des Revisionskommentars erneut geprüft: **17/17 Tests bestanden**, `--maxWorkers=1`, Log `/workspace/scratch/06df2d298469/execution-regression-dependency-tests.log`. Der Appcode blieb unverändert. Die synthetischen Sitzungshelper belegen keine produktiven JWT-/RLS- oder PDF-Verträge; beide SQL-Dateien wurden ausschließlich lokal ausgeführt und bleiben Reviewentwürfe.
