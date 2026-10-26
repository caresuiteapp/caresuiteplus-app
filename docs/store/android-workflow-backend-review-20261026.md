# Android-Abläufe und Serververträge, 26.10.2026

Dieser Abgleich trennt App-Prüfungen, SQL-Verträge mit synthetischen Daten und
den tatsächlichen Serverstand. Die verbundenen Produktionsabfragen waren
ausschließlich lesende Katalogabfragen und aggregierte Fehlerzählungen. Es
wurden keine Klienten-, Personal- oder Abrechnungsdatensätze gelesen, keine
produktiven Funktionen aufgerufen und keine Datenbankänderungen angewandt.

## Tatsächlicher Serverstand und vorbereitete Korrekturen

Projekt: `caresuiteplus-production`, `euagyyztvmemuaiumvxm`, Frankfurt.

| Ablauf | Frischer Katalogbefund | Eng begrenzter Reviewstand |
| --- | --- | --- |
| Eigene Monatsabrechnung bestätigen/ablehnen | `employee_decide_payroll_statement(uuid,text,text)` hat weiterhin die am 11.10. erfassten NULL-unsicheren `<>`-Prüfungen. Die Funktionsdefinition ist bytegleich, SHA-256 `dff812e4a3481618b20dba1c65356a7fee971b41098e78692f95b331d6dbc37d`. `authenticated` hat EXECUTE; `anon` und `service_role` haben es nicht. | `android-employee-decide-payroll-statement-guard-review.sql`: nichtleere Auth-/Mandanten-/Mitarbeitendenbindung, aktives exaktes Portal-Konto nach Erstlogin, beschränkter Rowlock und NULL-sichere Fassung. Bestehender Writer und ACL bleiben erhalten. |
| Einsatzstatus reparieren/spiegeln | `repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean)` ist ebenfalls bytegleich zur unsicheren Definition vom 11.10., SHA-256 `78dce54682adb1a1037b8f3eb7943b06e7f623d2b40e5a297232c04743725278`. Die DEFINER-Funktion enthält keine Auth-/Mandantenprüfung. EXECUTE besteht für `authenticated` und `service_role`. | `android-repair-assist-visit-workflow-status-guard-review.sql`: eindeutiges aktives Authprofil, Sitzungsmandant, exakte eigene Portalzuordnung und zugehöriger Einsatz; Office benötigt den bestehenden `care_security.company_actor(...,'assist.execution.manage')`. Der gespeicherte menschliche Akteur kommt aus Auth. Vorhandene Profil-/Mitarbeitenden-ID-Aufrufer bleiben möglich. Der vertrauenswürdige Maschinenpfad mit signierter oberster JWT-Rolle `service_role` behält den bisherigen Writer und seine Akteurssemantik; `user_metadata` verleiht keine Rechte. |
| Angehörigenportal öffnen und Inhalte freigeben | Die App ruft in `usePortalActor` die Funktion `current_family_portal_access_scope()` auf. Sie fehlt tatsächlich in Produktion. Daher bleibt die verifizierte Klientenzuordnung leer. `current_client_id()` unterstützt aktive Angehörigenkonten bereits. | `android-family-portal-scope-review.sql`: ausschließlich die fehlende Scope-Funktion aus W-05 mit exakter Authkonto-/Mandantenbindung und ihren Grants. Keine Aktivierung der umfangreichen historischen W-05-RLS-/Storage-Migration. |
| Eigene Office-Notizen | `office_private_notes` hat erzwungene RLS, vier Owner-/Mandanten-Policies sowie die nötigen CRUD-Rechte für `authenticated`; `anon` hat keine Tabellenrechte. | Appseitige Speicherung, Wiederholung, Konfliktbehandlung und Kontowechsel werden im vorhandenen Servicevertrag geprüft. Kein RLS-Bypass als Fehlerbehebung. |
| Kanonischer Einsatzstart | `web_start_assist_visit_service` ist vorhanden und läuft als INVOKER mit bestehenden Row- und Actorprüfungen. | App-Prüfung nutzt den echten `ensureVisitTimeEvent`-Pfad: ein bestätigtes Serverereignis verursacht keinen zweiten Timer-INSERT. Nachgelagerte Projektionsfehler löschen den bestätigten kanonischen Start nicht. |

Die Review-SQL-Dateien prüfen vor dem Ändern den SHA-256 der frisch erfassten
Funktionsdefinition beziehungsweise das Fehlen der neuen Scope-Funktion.
Geänderte Quellen brechen ab. Sie erzeugen keine Backfills, neuen Fachbelege,
Attestationen oder Freigabemarker. Die Dateien sind keine angewandten Migrationen.

Die automatische Freigabeprüfung hat am 26.10.2026 die Anwendung des
vorbereiteten Pakets auf `caresuiteplus-production` abgelehnt: Der bisherige
Auftrag wurde als breite Datenbankprüfung, nicht als eindeutige Freigabe dieser
dauerhaften Änderungen an DEFINER-Funktionen, RLS-Regeln, Grants und Triggern
gewertet. Es wurde keine Änderung angewandt und kein anderer Ausführungsweg
verwendet. Für die produktive Anwendung ist eine ausdrückliche Freigabe nötig.
Die App-Korrekturen und deren Build laufen davon unabhängig weiter.

Die Office-Reparatur verwendet ausdrücklich die vorhandene Berechtigungs- und
Scopeprüfung. Ein begrenzter Organisationszugang erhält dadurch keine bislang
ungeprüfte mandantenweite DEFINER-Schreibbefugnis. Die Änderung ersetzt nicht
die getrennte Prüfung von Korrektur-, Abschluss- und Nachweisregeln.

## Weitere tatsächliche Berechtigungsgrenzen

Die permissive Policy `assignments_select_own_tenant` erlaubt weiterhin
mandantenweite SELECTs für `authenticated`. Per OR kann sie enge Own-Policies
übersteuern. `assist_visit_execution_state_tenant` verwendet für ALL weiterhin
`is_tenant_member(tenant_id)`. Der separat geprüfte Entwurf
`android-workflow-rls-ceilings-review.sql` ergänzt fünf restriktive Regeln auf
genau diesen zwei Tabellen und schützt Portal-Identitäten vor Umbindung.
Er erhält die acht ursprünglichen Policies und alle effektiven CRUD-Grants.
17 isolierte PostgreSQL-Fälle reproduzieren die aktuellen Lücken und prüfen
legitime Business-, Mitarbeitenden-, Klienten- und Angehörigenzugriffe,
gesperrte/fremde Identitäten, neue Upserts, Wiederholung und Katalogdrift.
Aktive RLS allein belegt keine korrekte Zeilenfreigabe.

Die fehlende Angehörigen-Scope-RPC ist ein eigenständiger Ablaufdefekt. Ihre
Ergänzung ersetzt keine Prüfung sämtlicher Inhalts- und Storage-Policies auf
die tatsächlichen Angehörigen-Capabilities. Die App verwendet den geprüften
Scope für Termine, Dokumente und Nachrichten und bleibt ohne Scope gesperrt.

Die statische Inventur enthält 264 unterschiedliche RPC-Namen; 96 davon sind
als öffentliche Funktionen vorhanden. Viele weitere Quellen gehören zu
vorbereiteten Pflege- und Reviewabläufen. Diese Differenz ist keine Freigabe,
alle fehlenden Funktionen oder deren Module produktiv zu aktivieren.

## Ausgeführte Prüfungen und Grenzen

- 21 vorhandene SQL-Suiten bestanden vor den engen Ergänzungen mit 322 Tests.
  Sie führen echte PostgreSQL-/RLS-/Trigger-/Rollback-Verträge in PGlite mit
  synthetischen Identitäten aus. Mehrere Suiten reproduzieren absichtlich alte
  Lücken, bevor sie historische lokale SQL-Entwürfe anwenden. Ihr grünes Ergebnis
  belegt deshalb keine Anwendung dieser Entwürfe auf Produktion.
- Die zwei erweiterten bestehenden Writer-Suiten und die Angehörigen-Scope-Suite
  bestehen zusammen mit 42 Tests. Sie prüfen die aktuellen Writer-Bodies mit den
  engen Guards, legitime eigene/Office-/Maschinenaufrufe, NULL-/fremde/inaktive
  Identitäten, Akteursspoofing, Source-Drift und SQL-Receipt bis zum echten
  App-Decoder. Historische breitere Entwürfe bleiben getrennt.
- Der gemeinsame abschließende Lauf dieser drei Suiten und des aktuellen
  RLS-Entwurfs besteht mit 59 Tests, ohne übersprungene oder fehlgeschlagene
  Fälle. Er läuft ausschließlich mit synthetischen Daten. Der bestehende
  Android-Releasecheck führt diese Serververträge vor dem Paketbau aus.
- Sieben fokussierte App-Suiten bestehen mit 64 Tests: private Notizen,
  kanonischer Start, bestätigte Wiederaufnahme, gespeicherte Signaturfassungen,
  finaler Proof-Receipt und bytegenauer Transport durch den tatsächlich
  installierten Supabase-Storage-Client. Netzwerk- und Native-Grenzen sind dabei
  kontrollierte Testbindungen; keine reale Geschäftstransaktion wird behauptet.

Ausstehend bleiben die kontrollierte Backend-Freigabe, deren frischer
Katalognachweis sowie authentifizierte fachliche Abläufe auf einem tatsächlichen
Androidgerät. Ein neuer AAB-Build allein behebt die hier beschriebenen
serverseitigen Befunde nicht.
