# Klientenübersicht und Klientenakte, Web

Die Überarbeitung basiert auf `6187697` und betrifft die Klientenverwaltung im Web. Die vorhandenen nativen Komponenten und die native Übersichtsauswertung bleiben unverändert.

## Änderungen

- Neue Übersicht mit Aktenkarten und Tabellenansicht, dreidimensionalen Mappen, klaren Filtern, Statusauswahl, Telefonlinks und Hinweisen auf offene Aufnahmeentwürfe. Die bestehenden Rollenrechte, Routen und Import-/Exportaktionen bleiben erhalten.
- Räumlicher Aktenkopf mit Perspektive, Lichteffekten und dezenter Mausreaktion. Reduzierte Bewegung und die eingestellte Textgröße werden berücksichtigt. Die Darstellung passt sich an die verfügbare Inhaltsbreite an.
- Aktennavigation mit Tastaturbedienung, konsistenter Auswahl und unverändertem URL-basiertem Seitenzustand. Die Inhalte werden beim Wechsel von Person, Unternehmen oder Benutzer neu geladen. Archivieren und Löschen sind im Abschnitt „Akte verwalten“ zusammengefasst.
- Übersicht mit echten anstehenden Einsätzen aus dem bestehenden berechtigungsgeprüften Dienst, nachvollziehbaren Prüfpunkten, Notfallkontakten, Vertragsunterschriften und letzten Einträgen. Dateistatus und erteilte Einwilligungen gelten nicht als Unterschriftsnachweis. Wiederkehrende Betreuungsaufgaben werden nicht als unerledigte Aufgaben gezählt.
- „Weitere Aktenbereiche“ öffnet die vorhandenen Ansichten für Verträge, Einwilligungen, vereinbarte Leistungen und Aufgaben. Der bisherige technische Platzhalter entfällt.
- Die Portalverwaltung erklärt Betreuungsbereiche und trennt Zugangsdaten, vier bestehende Inhaltsfreigaben, Anfragen und Nachweisfreigaben. Laufende Speichervorgänge, Fehler und teilweise bestätigte Änderungen werden ausdrücklich angezeigt. Wiederholen fragt Daten neu ab. Neue Codeaktionen entfernen zuvor angezeigte Codes sofort; frische Serverantworten erhalten Vorrang vor lokalen Zwischenständen.

## Prüfung

- 89 Tests in 11 Suiten erfolgreich: fünf neue Verhalten-/Auswertungssuiten und sechs bestehende Suiten für Akte, Aufnahme, Listenabfrage und Portal.
- ESLint für alle geänderten TypeScript-Dateien ohne Befund.
- Vollständige Anwendungs-Typprüfung mit `tsc --noEmit --skipLibCheck` erfolgreich (Exit 0, keine Diagnosen).
- Unabhängiges Code-Review; gefundene Probleme bei Aktenwechsel, Registerauswahl, Zugangsstatus, Codeänderung und Fehleranzeige korrigiert.
- Keine produktiven Testdatensätze, Nachrichten, Uploads, Freigaben oder Signaturen erzeugt. Keine Datenbankmigration erforderlich.

Die optische Abnahme im Browser ist offen. In der Arbeitsumgebung fehlt eine Browser-Binärdatei; das verbundene Gerät ist offline. Die DOM-Tests belegen Bedienung und Zustände, nicht die tatsächliche Darstellung. Vor einer Produktionsfreigabe sind die angemeldete Übersicht und Akte bei breiten und schmalen Fenstern, geöffneter Navigation, langen Namen und vergrößerter Schrift zu prüfen. Für die Portalansicht sind außerdem die vorhandenen Schreib-/Leserechte und die leeren beziehungsweise fehlgeschlagenen Ladezustände sichtbar abzunehmen.
