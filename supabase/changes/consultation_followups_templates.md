# Teamvorlagen und Nachverfolgung – vorbereiteter Rollout

Stand 20.10.2026. Das SQL in dieser Ablage ist vorbereitet, isoliert geprüft und noch nicht produktiv angewendet. Es ist keine automatisch abzuarbeitende historische Migration.

## Voraussetzungen und Reihenfolge

1. Gemeinsamen Beratungsarbeitsplatz und dessen Company-Access-/Portalvoraussetzungen prüfen. Benötigt wird insbesondere `20261019202713_consultation_workspace.sql`. Nicht pauschal ältere vorbereitete Beratungsmigrationen anwenden.
2. Nach der Freigabe des Rollouts den aktuellen Schema-/Funktionsstand und Supabase-Sicherheitsberater prüfen. `consultation_followups_templates.sql` als eine Transaktion über `apply_migration` registrieren. Die CLI ist in der vorhandenen Umgebung nicht installiert; gemäß Projektvorgabe wird keine zusätzliche Software eingerichtet und kein Zeitstempel erfunden. Die vom Server registrierte Migrationsversion danach mit identischem SQL unter `supabase/migrations/` nachvollziehen und die Testfixture auf diese Datei umstellen.
3. Neue Tabellen, RLS, entzogene direkte Tabellenrechte und SECURITY-INVOKER-Eigenschaft der öffentlichen RPCs prüfen. `care_security` bleibt ein nicht exponiertes Implementierungsschema; nur die beiden bewachten Erweiterungsfunktionen sind für `authenticated` ausführbar. Keine produktiven Testfälle anlegen.
4. Web-Stand veröffentlichen und reale Anmeldung/RPCs sowie breite/schmale Darstellung, Tastatur, Zoom, Touchsignatur und Druck in einer zulässigen Testumgebung abnehmen. Fehlende echte Browsernachweise nicht als erledigt behandeln.

Die Funktionen sind serverseitig rückwärtskompatibel zum bestehenden Web-Client. Der neue Client zeigt Teamvorlagen/Aufgaben nur an, wenn der Server die entsprechenden Fähigkeiten meldet. Aufgaben werden erst bei einer neuen Freigabe erzeugt. Frühere Freigaben können von der Verwaltung in der Besuchsakte ausdrücklich übernommen werden; es gibt keinen ungeprüften Daten-Backfill.

## Datengrenzen

- Teamvorlagen ändern nur Vorbereitungshilfen. Bearbeitung und Archivierung benötigen `beratung.cases.manage`, Veröffentlichung `beratung.cases.review`, jeweils mit bestehendem Beratungs-/Sensitivdatenzugriff. Das Portal erhält ausschließlich veröffentlichte, aktive Inhalte.
- Aufgaben bleiben bei der zugewiesenen Beratungsperson und der berechtigten Verwaltung. Die vereinbarte Zuständigkeit ist ein Text aus der Empfehlung; sie vergibt keine Zugriffsrechte. Neue delegierte Mitarbeiterzuweisungen werden hier nicht eingeführt.
- Aufgaben und Vorlagen haben eigene Versionsnummern. Request-Kennungen, Rechteprüfung vor Wiederholung und eindeutige Quellschlüssel verhindern doppelte Einträge. Verlaufsereignisse ergänzen die Akte, ohne Besuchsversion oder signierte Inhalte zu verändern.
- Keine E-Mail-/Push-Erinnerung, keine zentrale Kalender-/Aufgabenintegration, kein Kassenversand und keine Abrechnungsfreigabe durch diese Änderung.

## Rücknahme bei einem Rolloutproblem

Zuerst den Web-Stand zurücknehmen. Falls auch der neue Datenbankpfad deaktiviert werden muss, in einer registrierten Rücknahmemigration die öffentlichen RPCs wieder auf `care_security.consultation_load` und `care_security.consultation_mutate` verweisen, diesen beiden privaten Funktionen `EXECUTE` für `authenticated` zurückgeben und den Erweiterungsfunktionen dieses Recht entziehen. Signaturen, SECURITY INVOKER und `search_path=pg_catalog` der öffentlichen Wrapper beibehalten. Die drei neuen Tabellen samt Daten nicht löschen. Der alte Load liefert keine Fähigkeiten; damit wird die Erweiterung im neuen Client ebenfalls ausgeblendet. Während dieser Rücknahme freigegebene Besuche lassen sich nach erneuter Aktivierung ausdrücklich übernehmen.
