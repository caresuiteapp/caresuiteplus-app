# Optionale Einsatzaufgaben — 08.10.2026

Das Mitarbeitendenportal konnte vorhandene Aufgaben bearbeiten, bot jedoch keine Suche, Auswahl oder manuelle Ergänzung. Bei einem Einsatz ohne Aufgaben wurde das Fenster gar nicht gerendert. Im Web fehlte außerdem eine feste verfügbare Fensterhöhe; dadurch konnte nur die Überschrift sichtbar bleiben.

## Verhalten

- Ein leerer Einsatz zeigt einen verständlichen Leerzustand und die beiden Wege „Vorlagen auswählen“ und „Eigene Aufgabe“.
- Vorlagen aus dem vorhandenen Assist-Aufgabenkatalog lassen sich nach Bezeichnung, Beschreibung und deutschem Leistungsbereich suchen. Mehrfachauswahl bleibt beim Wechsel der Suche erhalten. Bereits vorhandene Aufgaben sind erkennbar und nicht erneut auswählbar.
- Eigene Aufgaben lassen sich mit bis zu 300 Zeichen eingeben. Die Speicheraktion bleibt außerhalb des scrollenden Inhalts erreichbar. Das Fenster verwendet die sichtbare Browserhöhe, auch bei Drehung und geöffneter Bildschirmtastatur.
- Speichern erzeugt optionale Aufgaben im eigenen einzelnen, bereits begonnenen und noch bearbeitbaren Einsatz. Serientermine werden zuerst über den bestehenden Ablauf einzeln aufgelöst. Planungsvorlagen und Serienmaster erhalten keine neuen Aufgaben.
- Die Aufgaben werden dauerhaft gespeichert, gegebenenfalls mit der bestehenden Einsatzansicht verbunden, und in den Einsatzkontext für Aufgabenstatus, Dokumentation und Nachweis übernommen. Bestehende Statuswerte, Notizen und Pflichtkennzeichen werden beim Ergänzen nicht überschrieben.
- Netzwerkfehler erhalten Auswahl und Eingabe. Eine wiederholte Anfrage erzeugt keine doppelte Aufgabe. Ausstehende Eingaben werden beim Schließen berücksichtigt. Der Demozugang legt keine echten Einsatzaufgaben an.

## Serverstand

Migration `20261008175820_employee_optional_visit_tasks.sql` ist auf dem zugeordneten CareSuite-Server angewendet. Die Serverkennung lautet `caresuite-optional-visit-tasks-20261008`; die öffentliche Bereitschaftsabfrage antwortet mit `ready: true`.

Die öffentliche Schreibfunktion läuft mit den Rechten des Aufrufers. Die benötigte erhöhte Berechtigung liegt in einem privaten Schema mit leerem Suchpfad. Beide Schreibfunktionen sind für anonyme Anfragen gesperrt und prüfen aktuelle Anmeldung, Mandantenzugang, Mitarbeitendenrolle, Zuordnung und Einsatzstatus. Es wurden keine Tabellenfreigaben oder vorhandenen Regeln zur Datensicht erweitert.

## Verifikation und verbleibende Lücken

- 20 Funktionsprüfungen des tatsächlichen Modell-, Speicher-, Einsatzkontext- und Ansichtscodes bestanden. Netzwerkgrenzen und React-Hooks sind dabei simuliert; diese Prüfung ist keine optische oder vollständige Browserprüfung.
- Die tatsächliche Datenbankfunktion wurde in PostgreSQL auf temporäre Tabellen und simulierte Portalzustände umgeleitet: Vorlagen/manuelle Aufgaben, Verbindung beider Einsatzansichten, Wiederholung, Erhalt vorhandener Werte und atomarer Rücklauf bei ungültigem Stapel bestanden. Alle 15 vorgesehenen Verweigerungen bestanden. Anschließender Rücklauf entfernte sämtliche Prüftabellen.
- Die tatsächliche öffentliche Schreibfunktion verweigert anonyme HTTP-Anfragen mit HTTP 401 / `42501`. Ein Datenbankaufruf mit der Rolle `authenticated` ohne gültige Anmeldung wurde ebenfalls verweigert.
- Die sechs betroffenen TypeScript-/React-Dateien wurden mit dem vorhandenen Babel-Werkzeug gelesen und umgewandelt. Eine vollständige Typprüfung und ein vollständiger lokaler Expo-Webbuild waren mangels Projektabhängigkeiten nicht möglich; es wurde nichts installiert.
- Eine echte Sichtprüfung auf iPad, breitem Desktop und schmalem Browserfenster sowie ein authentifizierter vollständiger Nutzervorgang sind offen. Es wurden keine produktiven Testeinsätze oder Kundenaufgaben angelegt.

Die neue Ansicht wird erst mit dem zugehörigen Web-Paket veröffentlicht. Das Paket prüft den Serverstand und die vorhandenen vier Vercel-Erstellungen vor der Zusammenführung. Eine bestätigte Webdatei an der Live-Adresse ersetzt nicht die noch offene Sichtprüfung.

Die Änderung richtet sich an Web/Desktop. Die native Aufgabenansicht und die Android-Projektdateien sind unverändert. Der gemeinsame Einsatz-Hook nimmt ausschließlich auf expliziten Aufruf durch die neue Web-Ansicht bestätigte Aufgaben entgegen; dadurch bleibt der bisherige native Ablauf erhalten.
