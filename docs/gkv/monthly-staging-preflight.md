# Staging vor einer Abnahme der GKV-Monatsnachweise

Der [SQL-Vorabcheck](checks/monthly-database-preflight.sql) liest ausschließlich PostgreSQL-Systemkataloge. Er ruft keine Fachfunktion auf und liest keine Personen-, Nachweis- oder Rechnungsdaten. Er prüft die im Entwurf unmittelbar verwendeten Rollen, Tabellen und Funktionssignaturen. Für die beiden Eingangskontrollen des ersten Monatsentwurfs prüft er auch den Rückgabetyp. Elf weitere Abfragen zeigen anhand einzelner Objekte, ob es Anzeichen für die zehn Monatsentwürfe gibt. Ein gefundenes Objekt allein belegt weder die richtige Implementierung noch funktionsfähige Zugriffsrechte.

## Befund vom 04.11.2026

Auf `caresuiteplus-staging` (PostgreSQL 17.6) waren 30 von 38 geprüften Voraussetzungen vorhanden. Keine der elf Objektmarken für die Monatsentwürfe war vorhanden. Die folgenden acht Signaturen fehlten. Auch die fünf zugehörigen Versionsnummern standen zu diesem Zeitpunkt nicht in `supabase_migrations.schema_migrations`.

| Vorhandene Migration im Repository | Fehlende Funktionen auf Staging | Auswirkung |
| --- | --- | --- |
| [20260905170000](../../supabase/migrations/20260905170000_employee_direct_deferred_signature_release.sql) | `employee_portal_release_deferred_signature` | Der persönliche Auftrag zur späteren Unterschrift kann über diesen Weg nicht freigegeben werden. |
| [20260911120000](../../supabase/migrations/20260911120000_client_portal_signature_completion.sql) | `client_portal_finalize_assist_proof` | Der signierte Assist-Beleg kann über diesen Portalweg nicht abgeschlossen werden. |
| [20261013072827](../../supabase/migrations/20261013072827_verified_assignment_service_records.sql) | `workflow_canonical_json`, `workflow_record_actor_allowed`, `workflow_signed_proof_source`, `workflow_tasks_match` | Die Entwürfe können die persönliche Zuordnung, den Inhaltsabgleich und die Herkunft des Leistungsnachweises nicht wie vorgesehen prüfen. |
| [20261018075737](../../supabase/migrations/20261018075737_office_invoice_workspace.sql) | `office_invoice_assert_source` | Die erforderliche Office-Prüfung der Leistungsquelle fehlt. Der erste Monatsentwurf stoppt vor der Einrichtung. |
| [20261019214752](../../supabase/migrations/20261019214752_gkv_exchange_workspace.sql) | `gkv_exchange_actor` | Die erforderliche GKV-Berechtigungsprüfung fehlt. Der erste Monatsentwurf stoppt vor der Einrichtung. |

Die aufgelisteten Migrationen sind die Quellen dieser Funktionsdefinitionen. Die Liste ersetzt keine Prüfung ihrer weiteren Abhängigkeiten oder der Ausführungsreihenfolge. Ein fehlender Eintrag im Migrationsverlauf beweist für sich allein keine fehlende Funktion; hier wurden die tatsächlichen Signaturen separat im Katalog geprüft.

## So wird der Befund wiederholt

Den Vorabcheck auf der ausdrücklich ausgewählten Stagingdatenbank ausführen. Zeilen mit `category = prerequisite` und `present = false` bezeichnen konkrete fehlende Voraussetzungen. `draft_marker` zeigt den sichtbaren Schemazustand und ist keine Freigabe. Der Abgleich der Versionsnummern lässt sich ohne Zugriff auf die gespeicherten Migrationsinhalte wiederholen:

```sql
WITH wanted(version) AS (VALUES ('20260905170000'), ('20260911120000'),
  ('20261013072827'), ('20261018075737'), ('20261019214752'))
SELECT w.version, EXISTS (SELECT FROM supabase_migrations.schema_migrations m
  WHERE m.version::text=w.version) AS recorded
FROM wanted w ORDER BY w.version;
```

Für den Paralleltest der Berichtigung müssen zwei **nachweislich gleichzeitig laufende** Datenbanktransaktionen dieselbe simulierte Mandantenkennung verwenden. Am 04.11. liefen die Anfragen über den bestehenden Verwaltungszugang mit unterschiedlichen Backend-IDs, aber zeitlich nacheinander. Daraus ergibt sich kein Nachweis, dass eine Berichtigung den parallelen Monatsabschluss im Betrieb sperrt. Dafür bleiben zwei überlappende Fachtransaktionen auf einer geeigneten Testdatenbank erforderlich. Der Katalogbefund und die isolierten PGlite-Tests ersetzen auch keine Portal-, RLS- oder Storage-Abnahme. Bei dieser Bestandsaufnahme wurden keine Migrationen durchgeführt.

## Nach dem Portalpaket am 04.11.2026

Auf `caresuiteplus-staging` ist die gesonderte Migration `20261104072159` (`gkv_staging_assist_portal_prerequisites`) eingetragen. Der Vorabcheck findet jetzt **32 von 38** Voraussetzungen. Die persönliche Freigabe und der Klientenabschluss sind vorhanden. Weiterhin fehlen die vier Workflow-Funktionen aus `20261013072827` sowie die Office- und GKV-Funktion aus `20261018075737` und `20261019214752`. Keine der elf Objektmarken für die zehn Monatsentwürfe ist sichtbar. Die Portal-Teilmigration ersetzt keine der fünf vollständigen historischen Migrationen.

Die [Anschlussprüfung](checks/staging-portal-smoke.sql) bestand auf dem tatsächlichen PostgreSQL-Server: Berechtigungen für vier Funktionen, beide Storage-Regeln, RLS und kein direkter Audit-Tabellenzugriff der drei App-Rollen. Unter der Rolle `authenticated` ohne Benutzeridentität lehnten beide Portalaktionen den Aufruf ab; beide Storage-Hilfsfunktionen lieferten `false`. Das ist kein abgeschlossener Portalvorgang mit angemeldeten Testpersonen.

Für die sieben zuvor fehlenden Tabellen enthält die [Referenz](checks/upstream-schema-reference.json) die tatsächlich vorgefundenen 142 Spalten, 54 Constraints, 27 Indizes, 11 eigenen Trigger und 19 Regeln für den Zeilenschutz. Zu den Referenzdaten gehören auch Datentypen und Tabellenrechte. Der [nur lesende Strukturvergleich](checks/monthly-upstream-schema.sql) prüft sieben Merkmale pro Tabelle. Auf der Referenz stimmten alle 49 überein. Er gibt auch bei zwei gleich großen, aber abweichenden Definitionen `differs` aus. Funktionen, auf die Trigger und Regeln verweisen, muss man gesondert untersuchen; ein übereinstimmender Name belegt nicht die Implementierung.

| Gegenstand | Beobachtung auf Staging nach der Teilmigration |
| --- | --- |
| `audit_logs` | 14 Spalten, drei Constraints, drei Indizes, Tabellenart, RLS und Triggerstand stimmen mit der Referenz überein. Bewusste Abweichung: keine direkten App-Rechte und keine Audit-Lesepolitik, da unter anderem der Academy-Schutz fehlt. |
| `documentation_entries`, `signatures`, `time_entries` | Noch nicht vorhanden. Der Workflow für Bestandsbelege braucht diese Tabellen. Unter anderem fehlen die zugehörigen Enum-Typen und die Referenzfunktion für Audit-Trigger. |
| `invoice_items`, `payments` | Noch nicht vorhanden. Der Office-Ablauf setzt die Positions- und Zahlungstabellen einschließlich Schreibschutz voraus. |
| `payroll_month_statements` | Noch nicht vorhanden. Die Storage-Regel des Office-Arbeitsplatzes verweist darauf. Die unveränderte Migration 0264 umfasst auch weitere Lohnfunktionen. |

[Nutzungsumfang, Audit-Sperre und Bau des Portalpakets](staging-portal-signature.md). Die Bestandsaufnahme und der Staging-Einbau verwendeten keine Produktions-Fachdaten. Auf Produktion wurde nichts eingespielt.

## Nach dem Kassenarbeitsplatz am 04.11.2026

Migration `20261104083006` bringt den Arbeitsplatz mit Versionsverlauf und drei direkte Workflow-Voraussetzungen auf Staging. Damit sind **36 von 38** vorhanden. Es fehlen die Prüfung des unterschriebenen Ursprungsbelegs und die Rechnungsquellenprüfung. Alle elf Objektmarken für die zehn Monatsentwürfe bleiben aus. Der [Staging-Bericht](staging-exchange.md) verlinkt die wiederholbaren Rechte-, Mandanten- und Aufgabentests und beschreibt die Abweichung der Leistungsnachweistabelle.
