# CareSuite HealthOS 0.4.0: Abgleich nach dem Datenbank-Update

Prüfdatum: 9. Oktober 2026. Verglichen wurden der tatsächlich gebaute Android-Release, der aktuelle Hauptzweig, die jüngsten Korrekturzweige, die produktive Supabase-Migrationshistorie und die produktiv installierten Backend-Quelldateien. Hinweise aus den vorherigen CareSuite-Chats wurden an diesen aktuellen Ständen geprüft.

## Ergebnis und Releaseumfang

Die bisherige AAB **0.4.0 (43)** stammt aus Commit `66abd385ee4147e1793c2c438ceff6439bbfb2eb` und [GitHub-Build 14](https://github.com/caresuiteapp/caresuiteplus-app/actions/runs/37956128018). Sie enthält den Hauptzweig bis `3ad95a7087828d7acaf44593ba6bd0f9de5cc353`, einschließlich des Besuche-/Aufgabenfixes. Ihr SHA-256 ist `0ae9671bec76247bcc7c1f4838c30622388d9e20b67f0d66f4c3fef66822cb8f`.

Beim erneuten Abgleich wurden zwei fehlende Korrekturen gefunden:

- [PR 47](https://github.com/caresuiteapp/caresuiteplus-app/pull/47), Stand `544776fb88400bf7cbbfd6fdbed4d91e05256ea3`: stabile Wiederherstellung bei Web-Neuladen, begrenzte Web-Abmeldung und IndexedDB-Bereinigung, Wiederholung fehlgeschlagener Abmeldungen sowie parallele Dashboard-Abfragen. Der gemeinsame Dashboard-Service ist über `app/business/office/dashboard.tsx` und die gemeinsame Office-Ansicht auch in der nativen App erreichbar. Diese Verbesserung benötigt eine neue AAB.
- [PR 48](https://github.com/caresuiteapp/caresuiteplus-app/pull/48), Stand `8ba4540cad6ad551d0e3c69e4cf985d123385f8e`: die bereits produktiv angewendete Migration `20261009201110_platform_observation_safeupdate_singleton_fix.sql` fehlte im Release-Quellstand. Sie ergänzt den bekannten Singleton-UPDATE um `WHERE singleton IS TRUE`. Der produktive Datenbankfix wirkt bereits für bestehende App-Installationen.

Beide Änderungen wurden konfliktfrei auf den bestehenden nativen Release übernommen. Die Android-Routen bleiben synchron; das vollständige native App-Router-Verzeichnis, die Android-Optimierung und alle bisherigen nativen Funktionen bleiben im Releasebaum erhalten. Die neue Buildnummer wird aus der frischen EAS-Basis ermittelt und anschließend aus der fertigen AAB geprüft. Die alte AAB mit Code 43 wird dadurch nicht rückwirkend aktualisiert.

## Abgleich der abgeschlossenen Änderungen

| Bereich | Nachweis |
| --- | --- |
| Native Verwaltung, Desktop, Navigation, Widgets, Registrierung und zusätzliche Anmeldeabläufe | Bestandteil des nativen Releasebaums aus Build 14; erneut im vollständigen Android-Export und in den nativen Releaseprüfungen zu prüfen. |
| Optionale Besuchsaufgaben, vorhandene Status-/Notizwerte und Vermeidung doppelter Aufgaben | Hauptzweig `3ad95a70` und nativer Aufgaben-Hotfix bereits in Build 14 enthalten; Workflow- und native Aufgabenprüfungen bleiben Pflicht. |
| Mandantenakte, Zugriffssteuerung, Betriebsbestände und Laufzeitkontrollen | Migrationen vom 6.–9. Oktober sind exakt mit der produktiven Migrationshistorie abgeglichen. |
| Kostenlose Karten-, Geocoding- und Routendienste | Bereits im bisherigen Release enthalten; produktive Geo-Migration stimmt exakt überein. |
| Registrierung, Gmail-Versand, öffentlicher Support und Verwaltungs-Passwortwiederherstellung | Vier produktive Edge Functions einschließlich 17 zusammengehöriger Dateien stimmen bytegenau mit dem Release-Quellstand überein. |
| Automatischer Push, Einsatz-Erinnerungen und private Push-Navigation | Drei produktive SQL-Migrationen vom 2. Oktober stimmen bytegenau mit den vorhandenen Quelldateien überein, auch wenn ihre registrierten Versionsnummern von den Dateinamen abweichen. |
| Beobachtungs-/Statistikfehler unter PostgreSQL safeupdate | Produktive Funktion: alter UPDATE 0-mal, korrigierter UPDATE 1-mal; SECURITY INVOKER und Ausführungsrechte für postgres/service_role bestätigt. Exakte angewendete Migration jetzt im Release. |
| Dashboard-Ladeleistung | Parallele Datenabfragen aus PR 47 jetzt auch im nativen gemeinsamen Service enthalten. |
| Bitmap-Downsampling und R8 | Bestehende nativen Bildkomponenten und Optimierung beibehalten; Konfigurationsaudits bestanden. Mapping, Signatur und Bundleinhalt werden am neuen AAB erneut geprüft. |
| Datenbank-Kapazitätsumstellung | Serverseitige Infrastrukturänderung. Das produktive Projekt wurde als ACTIVE_HEALTHY bestätigt; dafür ist kein App-Quellcode oder eingebautes Datenbankpaket erforderlich. |

## Produktionsnachweise

Alle **16 produktiven Migrationen seit dem 6. Oktober** stimmen nach Ergänzung des Statistikfixes bytegenau mit den SQL-Dateien dieses Release-Standes überein. Zusätzlich stimmen die **drei Push-Migrationen vom 2. Oktober** bytegenau überein. Historische Versionsnummern sind teilweise anders registriert; ein fehlender identischer Dateiname allein ist kein Beleg für eine fehlende Funktion.

Die einmalige Bereinigung bestimmter Testdateien vom 2. Oktober ist eine ausgeführte Wartungsmaßnahme, kein Bestandteil eines Android-Bundles und keine beim Release erneut auszuführende Bereinigung.

Die produktiven Funktionen `register-business-tenant`, `business-password-recovery`, `registration-welcome-dispatch` und `public-support-ticket` wurden mit allen 17 zurückgelieferten Quelldateien verglichen: keine Abweichung. Insgesamt meldete das produktive Projekt 31 aktive Edge Functions. Der aktive Willkommensmail-Scheduler ist eingerichtet. Die aggregierte Versandhistorie enthält vier als versandt bestätigte Nachrichten, zuletzt am 8. Oktober um 21:28:43 UTC; keine anderen Warteschlangenstatus wurden in dieser Abfrage gefunden. Es wurde keine neue Nachricht versandt.

Zusätzlich stimmen die produktiven Mitarbeiter-, Klienten- und Code-Anmeldungen, Sitzungsverlängerung, Push-Registrierung, Push-Dispatcher, Office-Push und Zustellbelege, kostenloses Geocoding/Routing, Google-Workspace-Anbindung sowie Beobachtungserfassung mit allen 49 je Bereitstellung geprüften Dateien exakt überein. Insgesamt wurden damit 17 für die aktuellen Änderungen relevante produktive Funktionen mit 66 Dateivergleichen ohne Abweichung geprüft. Die korrigierte Statistikfunktion erfasst produktiv seit 20:18:35 UTC wieder Ereignisse; ihre letzte Erfassung lag beim Abgleich um 20:50:34 UTC.

**Automatischer System-Push ist serverseitig weiterhin ausgeschaltet.** Die lesende Prüfung bestätigt sechs verbundene Ereignistrigger und geschützte authentifizierte Zielauflösung. Die Laufzeitfreigabe, Einsatz-Erinnerungen und der Worker-Schlüssel sind jedoch nicht aktiviert/eingerichtet; die Outbox ist leer. Eine vorhandene native Push-Oberfläche und installierte SQL-Dateien belegen daher keinen aktiven automatischen Versand. Die Datenbank-Kapazitätskorrektur aktiviert diese Funktionen nicht.

Der produktive Web-Stand ist weiterhin `3ad95a70`. Die Übernahme in diesen Android-Release veröffentlicht die beiden offenen Korrektur-PRs nicht automatisch auf dem Web-Hauptzweig.

## Prüfungen vor dem neuen Build

- Gesamte TypeScript-Prüfung des kombinierten Releasebaums bestanden, mit demselben Node-Speicherlimit von 6144 MiB wie im bestehenden GitHub-Workflow.
- 120 vorhandene Prüfungen für Anmeldung, Abmeldung einschließlich unveränderter nativer Abmeldung, Navigation, Offline-Daten, Dashboard, Live-Daten und native App-Struktur bestanden.
- Alle 16 vorhandenen Beobachtungsprüfungen bestanden.
- Android-API-36- und Release-Performance-Konfigurationsaudits bestanden.
- Git-Diff ohne Konflikte oder Whitespacefehler.
- Die 120 Prüfungen und 16 Beobachtungsprüfungen sind zusätzlich in das bestehende vollständige Release-Prüfskript aufgenommen.

Der erste erweiterte GitHub-Prüflauf fand zwei Node-20-Inkompatibilitäten in vorhandenen Test-Promises und einen Demo-Test, der die produktive Android-Edition geerbt hatte. Die Promises verwenden jetzt den vorhandenen portablen Testansatz; der Demo-Test setzt seine eigene Edition ausdrücklich. Die produktive Sperre für Demo-Modus in der vollständigen Android-App bleibt erhalten. Die Assertions wurden nicht abgeschwächt; der vollständige Lauf ist erneut erforderlich.

Die native Router-Prüfung berücksichtigt außerdem die neue Plattformkonfiguration ausdrücklich: Web lädt Bereiche nach Bedarf, Android und iOS müssen synchron bleiben. Der gezielte Lauf dieser zehn Releaseprüfungen besteht.

Der neue GitHub-Lauf muss zusätzlich die bisherigen vollständigen Portal-, Android-, Mandantenakten-, Einsatz-, Aufgaben-, Toolchain- und Exportprüfungen bestehen. Erst der erfolgreiche signierte AAB-Build belegt, dass die neue Datei diese Ergänzungen enthält.

## Genau abgegrenzte offene Punkte

[PR 39](https://github.com/caresuiteapp/caresuiteplus-app/pull/39) ist eine noch nicht produktiv freigegebene Erweiterung für Pflegedienst Ambulant. Laut ihrem eigenen Prüfstand fehlen registrierte und in Staging geprüfte SQL-Migrationen sowie die Abnahme angemeldeter Abläufe. Dieser ältere Entwicklungszweig ist nicht Bestandteil des aktuellen Release und darf nicht als bereits abgeschlossener Fehlerfix dargestellt werden.

Echte Geräteprüfung, vollständige Anmeldung mit den drei produktiven Rollen, optische Prüfung der nativen Oberflächen einschließlich schmaler Ansichten/vergrößerter Schrift und interner Google-Play-Test bleiben getrennte Abnahmen. Die Quell-, Test- und Exportprüfungen ersetzen diese Nachweise nicht. Eine Google-Play-Veröffentlichung ist nicht erfolgt.
