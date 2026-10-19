# Datenauskunft & Export: Backend und Veröffentlichung

## Stand dieses Änderungsvorschlags

`supabase/changes/data-request-workspace.sql` enthält die auf dem bestehenden Staging bereitgestellte Änderung und ist **keine angewandte Produktionsmigration**. Die Bereitstellung erfolgte über den SQL-Editor und erzeugte keinen formalen Eintrag in der Supabase-Migrationshistorie. In der vorhandenen Arbeitsumgebung war keine Supabase-CLI verfügbar; es wurde keine zusätzliche Software installiert und kein Migrationsdateiname erfunden. Vor einer produktiven Übernahme muss die versionierte Repository-Migration mit der freigegebenen CLI erzeugt und die bereits vorhandene Stagingstruktur mit der Migrationshistorie abgeglichen werden.

Die Metadaten wurden am 19.10.2026 ausschließlich lesend mit Produktion und bestehendem Staging verglichen. Es wurden keine produktiven Anfragen, Profile oder Kontaktdaten als Testdaten abgerufen oder verändert. Nach der ursprünglichen Ablehnung durch die automatische Freigabeprüfung hat der Nutzer die Anwendung des konkret vorbereiteten SQL-Stands aus PR 131 auf dem bestehenden Staging `shwpweerzsfkqaivmaoc` und dessen anschließende Prüfung ausdrücklich freigegeben.

Nach drei fehlgeschlagenen Connectoraufrufen mit `Invalid or expired requestState` wurde der ausdrücklich freigegebene Browserzugang zum vorhandenen Staging verwendet. Ein erster SQL-Versuch scheiterte an der dort fehlenden Tabelle `public.audit_logs`; seine Transaktion wurde vollständig zurückgerollt. Anschließend wurde der angepasste SQL-Stand `75e44c2e844010ecab01268f5b7c389dac843404` erfolgreich über den SQL-Editor angewandt. Die Audit-Policy bleibt bei vorhandener Tabelle unverändert restriktiv; in Staging wurde keine zusätzliche Audit-Infrastruktur angelegt.

Die vorbereiteten Datenbanktests liefen auf Staging mit ausdrücklich gesetztem Test-Opt-in und abschließendem ROLLBACK durch. Das tatsächlich ausgegebene Ergebnis war `test_result = all_available_assertions_passed` und `audit_copy_tested = false`. Damit sind die verfügbaren Datenbankassertionen bestanden; die Prüfung von Auditkopien ist wegen der fehlenden Tabelle ausdrücklich **nicht** nachgewiesen. Die separate Nachkontrolle bestätigte jeweils **0 verbliebene Fixturezeilen** in `auth.users`, `public.profiles`, `public.tenants`, `public.roles`, `public.data_subject_requests`, `data_request_private.submissions` und `data_request_private.admin_notifications`. Die zusätzlich abgefragten unerlaubten Rollenrechte lieferten sämtlich `false`.

Die anschließende Sicherheitsprüfung meldete für die neuen privaten Tabellen den erwarteten INFO-Hinweis [RLS Enabled No Policy](https://supabase.com/docs/guides/observability/advisors?lint=0008_rls_enabled_no_policy). Das entspricht dem vorgesehenen Zugriffsmodell: Zugriff erfolgt über die kontrollierten Funktionen, direkte Tabellenrechte sind entzogen.

Die beiden zusätzlichen Fremdschlüsselindizes `data_request_submissions_tenant_id_idx` und `data_request_submissions_profile_id_idx` wurden anschließend erfolgreich über den SQL-Editor angelegt und ihre Definitionen über `pg_indexes` bestätigt. Die erneute Performanceprüfung enthält **keine** Meldung `unindexed_foreign_keys` mehr für `data_request_private`. Für die neuen, bislang ungenutzten Indizes verbleiben erwartete INFO-Hinweise [Unused Index](https://supabase.com/docs/guides/observability/advisors?lint=0005_unused_index). Die bereits zuvor vorhandenen INFO-Hinweise [Unindexed Foreign Keys](https://supabase.com/docs/guides/observability/advisors?lint=0001_unindexed_foreign_keys) zu `public.data_subject_requests.client_id` und `public.data_subject_requests.employee_id` bleiben getrennt davon bestehen; diese Indizes wurden im vorliegenden Nachtrag nicht verändert.

Es wurde weder produktiv ausgerollt noch die Supabase-Edge-Funktion für Benachrichtigungen bereitgestellt. Die erfolgreichen SQL-Tests belegen keinen tatsächlichen Mailversand und keine Browserabläufe mit angemeldeten Fachanwendern.

Die produktive Übernahme, die visuelle Abnahme der betroffenen Oberflächen sowie die vollständigen authentifizierten Ende-zu-Ende-Prüfungen bleiben offen. Die Stagingfreigabe ist keine Produktionsfreigabe und ersetzt diese Nachweise nicht.

## Funktions- und Sicherheitsvertrag

Der öffentliche, mit Aufruferrechten ausgeführte Einstieg ist:

`public.data_request_workspace_v1(p_action text, p_payload jsonb)`

Die privilegierte Implementierung liegt im nicht für die Data API freizugebenden Schema `data_request_private`. Alle Funktionen haben einen festen leeren Suchpfad. Öffentliche Standard-Ausführungsrechte werden ausdrücklich entzogen.

Jede Aktion benötigt `expected_auth_user_id`, `expected_tenant_id` und `expected_profile_id`. Diese Werte werden nur mit der serverseitig aufgelösten Identität verglichen. Sie bestimmen weder die Person noch den Mandanten. Abweichungen ergeben SQLSTATE 42501, bevor eine Mutation stattfindet. Die Profilbindung unterstützt sowohl `profiles.id = auth.uid()` als auch die bestehende `auth_user_id`-Zuordnung. Ein gesperrtes oder inaktives Profil erhält keinen Zugriff.

| Aktion | Eingabe zusätzlich zu den Identitätsprüfwerten | Ergebnis |
| --- | --- | --- |
| `capabilities` | keine | Version 1, Selfservice sowie serverseitige Verwaltungsrechte |
| `list` | `limit` 1–100, `offset` 0–100000 | Eigene Empfangsbelege und Status, ein zusätzlicher Datensatz als Seitentest |
| `submit` | UUID `idempotency_key`, Typ, Kontaktname, Kontakt-E-Mail, optionale Nachricht | Serverbestätigter Beleg; Wiederholung derselben Eingabe liefert denselben Beleg |
| `account_export` | keine | Sieben aktuelle eigene Profilfelder und Erstellungszeitpunkt |
| `admin_update` | Anfrage-ID, erwarteter Status und Änderungszeitpunkt, neuer Status | Statusänderung nur bei passender Identität, Verwaltungsrecht und unverändertem Datensatz |

Selfservice-Typen sind Auskunft, Datenübertragbarkeit, Berichtigung, Einschränkung und Widerspruch. Der vorhandene Löschungsablauf bleibt separat. Eine Nachricht ist bei allen fünf Typen optional. Maximale Längen: Name 160, E-Mail 254, Nachricht 4000 Zeichen. Steuerzeichen werden abgefangen; Zeilenumbrüche und Tabulatoren bleiben in Nachrichten erlaubt.

Der Kontodownload enthält ausschließlich `first_name`, `last_name`, `display_name`, `email`, `phone`, `created_at` und `updated_at` des eigenen Profils. Er ist **keine vollständige Antwort nach Artikel 15 DSGVO** und kein umfassender Export von Pflege-, Personal-, Abrechnungs- oder Mandantendaten. Die Anfrageliste gibt keine internen Notizen, Ergebnisse, Metadaten, Dokumentverknüpfungen oder fremden Kontaktdaten zurück.

## Bestehende Tabellenrechte

Bei der Bestandsprüfung erlaubte die produktive SELECT-Policy allen authentifizierten Personen das Lesen sämtlicher Anfragen ihres Mandanten. Die ALL-Policy erlaubte bereits Verwaltungsrollen den Tabellenzugriff. Zusätzliche restriktive Regeln allein würden breite permissive Policies nicht ersetzen.

Der Vorschlag ersetzt deshalb die Policies auf `data_subject_requests` vollständig:

- Direkter Tabellenzugriff ist nur für berechtigte interne Verwaltungskonten vorgesehen. Selfservice verwendet den schmalen RPC.
- Die Prüfung bindet Rechte an die exakt aufgelöste aktive Profilrolle und deren Mandanten. Sie übernimmt die bereits produktiv zugelassenen Verwaltungsrollen aus dem bestehenden `is_tenant_admin`-Modell, ohne neue Berechtigungszeilen anzulegen.
- Vollqualifizierte `role_permissions`-Zeilen gelten gemäß vorhandenen Migrationen als explizite Freigaben. Der ältere Modulschlüssel `security` verwendet dagegen `can_view` beziehungsweise `can_update`.
- Globale Rollen ohne Mandant und mandantengebundene Rollen werden unterschieden; eine Rolle oder Rechtezeile eines anderen Mandanten kann keine Freigabe erteilen.
- Geschäftliche Portalbindung und die in Produktion vorhandenen zusätzlichen Helfer `is_internal_tenant_actor` und `current_role_key` bleiben wirksam. Mitarbeiter-, Klienten- und Angehörigenportale erhalten keine Verwaltungsrechte.
- Authentifizierte Tabellenupdates sind auf Status und dessen Zeitstempel beschränkt. Änderung von Mandant, Eigentümer, Inhalt oder internen Metadaten ist darüber nicht möglich. DELETE, TRUNCATE, REFERENCES und TRIGGER werden den öffentlichen Clientrollen entzogen.
- Neue Anfragen bekommen Empfangszeit und Anfangsstatus serverseitig. Beim Wiederöffnen wird `completed_at` entfernt.
- Der bestehende Audittrigger speichert Kopien der Datensätze. Eine zusätzliche **restriktive** Policy schützt auch diese Kopien für die Tabelle `data_subject_requests`, ohne die Regeln anderer Auditarten zu ersetzen.

Der Android-Quellcode wird nicht geändert. Der bisherige direkte Selfservice-Insert normaler Konten war durch die produktive Admin-Policy bereits nicht freigegeben. Er wird durch die neue Web-RPC-Funktion nicht automatisch als native Funktion ergänzt. Der bestehende native administrative Insert mit zurückgegebenem Datensatz bleibt möglich; dies muss beim Rollout ausdrücklich geprüft werden.

## Benachrichtigung

`public.data_request_admin_notification_v1` ist ausschließlich für `service_role` ausführbar. Die Datenbank beansprucht eine Anfrage atomar einmalig für den Versand und dokumentiert `claimed`, `sent` oder `failed`. Nach einem unbekannten Providerergebnis erfolgt keine automatische Wiederholung; damit wird eine unkontrollierte Mehrfachbenachrichtigung verhindert. Ein fehlgeschlagener Mailversand macht eine bereits gespeicherte Anfrage nicht rückwirkend ungespeichert.

Die Versandfunktion muss Typ und Kontaktangaben aus der gespeicherten Anfrage lesen. Der Vorschlag erteilt dafür ein ausdrücklich begrenztes SELECT-Recht auf die benötigten Spalten. Das Schema enthält keine Zugangsdaten, keine Mailtexte im Ledger und keine Versand-Fallbacks ohne Berechtigungs- oder Replayprüfung. Verbleibende Claimeinträge nach Prozessabbruch müssen im Betrieb anhand der Providerbelege geprüft werden.

## Prüfungen und Freigabereihenfolge

Der Fixturetest liegt unter `supabase/tests/data-request-workspace.sql`. Er benötigt ausdrücklich freigegebenes Staging oder eine isolierte Testdatenbank sowie auf derselben Verbindung die Einstellung `caresuite.allow_data_request_fixture_tests = yes`. Niemals in Produktion ausführen. Er verwendet ausschließlich reservierte künstliche IDs, prüft vorher auf Kollisionen, verwendet einen einzigen DO-Block ohne neue Tabellen oder Funktionen und beendet sämtliche Fixtureänderungen mit ROLLBACK. Er versendet keine E-Mails.

Vorbereitet sind insbesondere Prüfungen für:

- eigener Zugriff, Mandantentrennung und fehlende interne Felder in Selfservice-Antworten;
- Legacy-Profilzuordnung, abweichende erwartete Identität und inaktive Profile;
- idempotente Eingänge und Konflikte bei wiederverwendetem Schlüssel mit verändertem Inhalt;
- Pagination und ein präzise begrenzter Kontodownload;
- reine Leserechte, atomare Statusänderung mit Konflikterkennung, Zeitstempel und Wiederöffnung;
- verweigerte Eigentümeränderung, Löschung, Truncate und anonyme RPC-Aufrufe;
- fehlende Portalrechte auch auf Auditkopien;
- einmaliger Benachrichtigungsclaim ohne tatsächlichen Versand.

Staging weicht von Produktion ab: Es besitzt ältere Mandantenauflösung, keine identischen zusätzlichen Portal-/Plattformhelfer und keine mandantengebundenen Spalten in `roles`/`role_permissions`. Der SQL-Vorschlag berücksichtigt diese Strukturunterschiede, übernimmt aber vorhandene Produktionsprüfungen weiterhin. Ein erfolgreicher Stagingtest ersetzt daher nicht die Prüfung der produktiven Helferkonfiguration und der tatsächlichen API-/Sessionabläufe.

Vor Veröffentlichung:

1. Aktuelle Policies, Spaltenrechte, Trigger, Funktionsdefinitionen und Supabase-Migrationshistorie erneut abgleichen; Änderungen anderer Arbeiten berücksichtigen.
2. SQL auf freigegebenem bestehendem Staging ausführen, Fixturetest mit ROLLBACK und die Sicherheits-/Leistungsberater prüfen. Ergebnisse getrennt von Frontendtests dokumentieren.
3. Die gehärtete Benachrichtigungsfunktion gemeinsam mit dem neuen RPC bereitstellen; ihre kanonische Datenabfrage und fehlende Replay-Fallbacks prüfen.
4. Authentifizierte API-Prüfungen mit ausdrücklich dafür vorgesehenen Testkonten durchführen: normaler Benutzer, Verwaltung, anderer Mandant, Portal, abgelaufene/gewechselte Sitzung. Parallel wiederholte Einreichungen zusätzlich prüfen.
5. Erst nach Freigabe produktiv übernehmen. Ohne vorhandenen Version-1-RPC zeigt die neue Weboberfläche eine nachvollziehbare Nichtverfügbarkeit und verwendet keinen ungeschützten Tabellen-Fallback.

## Rücknahme

Bei einem Ausführungsfehler innerhalb der SQL-Transaktion erfolgt ein Rollback. Nach erfolgreicher Bereitstellung ist ein bloßes Zurücksetzen der breiten alten SELECT-Policy keine sichere Rücknahme. Im Fehlerfall zunächst die neue Webfunktion sperren beziehungsweise den vorherigen Webstand wiederherstellen und die abgesicherten Tabellenrechte beibehalten. Daten und Benachrichtigungsclaims nicht löschen. Eine korrigierende Migration muss anhand der gesicherten Metadaten und der inzwischen gespeicherten Anfragen vorbereitet werden.

## Fachliche Einordnung und Quellen

Die Oberfläche nennt eine Regelfrist von einem Monat ab Eingang, nicht pauschal 30 Tage. Sie stellt keine juristisch verbindliche Fristautomatik oder Vollständigkeitszusage für alle Betroffenenrechte dar. Eine Verlängerung, Identitätsprüfung, Herausgabe weiterer Daten, Rechte Dritter und abschließende Antwort bleiben fachlich zu bearbeiten.

- [EDPB, Guidelines 01/2022, Recht auf Auskunft, Version 2.1](https://www.edpb.europa.eu/system/files/documents/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf)
- [Berliner Beauftragte für Datenschutz: Informations- und Auskunftsrecht](https://www.datenschutz-berlin.de/buergerinnen-und-buerger/rechte/informations-und-auskunftsrecht/)
- [Berliner Beauftragte für Datenschutz: Datenübertragbarkeit](https://www.datenschutz-berlin.de/buergerinnen-und-buerger/rechte/recht-auf-datenuebertragbarkeit/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Supabase: Datenbankfunktionen](https://supabase.com/docs/guides/database/functions)

