# Nachrichten: Umsetzung und Prüfnachweis

Stand: 15.10.2026 · Branch `feat/messages-experience-20261015`

## Überarbeitung

Der Nachrichtenbereich erhält eine eigene Web-Oberfläche mit gemeinsamer Kopfzeile, Gesprächsliste, Verlauf und festem Schreibbereich. Die zusätzliche Seitenüberschrift entfällt in dieser Ansicht. Die Anordnung richtet sich nach der verfügbaren Breite im Arbeitsfenster; für niedrige Fenster bleiben die Bereiche scrollbar.

- Gespräche nach Mitarbeitenden, Klient:innen und internem Austausch; Suche, Ungelesen-, Offen-, Meine- und Abgeschlossen-Filter; weitere Gespräche und ältere Nachrichten nachladen. Die Suche bezieht sich ausdrücklich auf den geladenen Bestand.
- Neue Gespräche und Teamgruppen beginnen mit der Empfängerauswahl. Auswahl, Betreff, Priorität und Kategorie sind klar getrennt. Lange Auswahlen vergrößern den festen Dialogfuß nicht unbegrenzt.
- Getrennte Entwürfe je Gespräch, Schutz vor unbeabsichtigtem Verlassen und Sperre des Gesprächswechsels während des Versands. Entwürfe bleiben innerhalb der Sitzung im Speicher und werden beim Wechsel der Organisation getrennt.
- Web-Direktlinks werden auf die gemeinsame Nachrichtenansicht mit Gesprächsauswahl vereinheitlicht. Der Wechsel der Empfängergruppe entfernt dadurch auch bei Direktlinks die bisherige Gesprächsauswahl.
- Dateien per Auswahl, Ablegen oder Einfügen; Sprachnachrichten, Schnellantworten, Emojis und interne Notizen. Anhangsvorschauen und Downloads prüfen die Zugehörigkeit zum Gespräch.
- Sichtbarer Lesestatus, Statuswechsel, Priorität, Kategorie, eigene Zuständigkeit, Abschließen/Wiederöffnen, Archivierung und Entfernen. Andere Verwaltungsmitglieder werden als tatsächliche Absender angezeigt.
- Ein echter Textdownload ersetzt den bisherigen Export-Platzhalter. Er enthält den verfügbaren Verlauf einschließlich interner Notizen; Dateien werden separat heruntergeladen.
- Rundnachrichten mit tatsächlicher Empfängervorschau, allen bestehenden Kategorien, Priorität, optionaler Gültigkeit und den für Mitarbeitende unterstützten Antwort-/Bestätigungsoptionen. Individuelle Lesestatistiken werden nur angezeigt, wo die Datenquelle sie bereitstellt.
- Eigene Schnellantworten erstellen, bearbeiten und deaktivieren. Nachrichteneinstellungen steuern die tatsächlich angebundenen Schreibfunktionen. Die Kanalübersicht gibt vorbereitete E-Mail-/SMS-/WhatsApp-Platzhalter nicht als eingerichtete Versandwege aus.

## Fehlerbehandlung und Datenzugriff

Gesprächs- und Nachrichtenvorgänge verwenden feste IDs für einen begonnenen Vorgang. Bei verlorenen Antworten oder teilweise fehlenden Anhängen setzt ein erneuter Versuch denselben Vorgang fort. Neuere Rückmeldungen werden dabei nicht durch eine ältere Vorschau ersetzt.

Rundnachrichten speichern die ursprünglichen Zustell-IDs mit dem begonnenen Versand. Der ursprüngliche Absender kann einen unvollständigen Versand aus den Details fortsetzen, auch nach einem Neuladen. Bereits vorhandene Benachrichtigungen werden nicht überschrieben. Die Schreiboperation benötigt keine Leseberechtigung auf die persönlichen Benachrichtigungen anderer Empfänger.

Lesebestätigungen betreffen nur die angezeigten eingegangenen Nachrichten. Die Datenbank verwaltet die Ungelesen-Zähler; der Client setzt sie nicht pauschal auf null. Interne Notizen werden nicht in die öffentliche Gesprächsvorschau übernommen. Späte Antworten aus einem vorherigen Gespräch oder Organisationskontext werden verworfen.

Bestehende Tabellen und Zugriffsregeln werden verwendet. Es gibt keine Datenbankmigration, neue Abhängigkeit oder Änderung am Android-Code. Die einzige gemeinsame Layout-Erweiterung liegt in `ScreenShell.web.tsx`; bestehende Aufrufer behalten ihr bisheriges Verhalten.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| Gezielte lokale Service-, DOM- und bestehende Messaging-Prüfungen | 77 Tests in 9 Dateien erfolgreich, davon 28 neue Prüfungen |
| TypeScript | Erfolgreich, auch im Release-Prüflauf |
| ESLint für alle geänderten Quellen und Tests | Erfolgreich ohne Warnungen |
| Datenbankschema | Spalten, relevante Zugriffsregeln und Benachrichtigungs-Primärschlüssel lesend mit dem produktiven Schema abgeglichen |
| Vollständiger Web-Produktionsbuild | Erfolgreich einschließlich Release-Prüflauf, Export sowie Navigations-, Sprach- und Kalenderprüfungen; neue Nachrichtenansicht im erzeugten Bundle nachgewiesen |
| Echter Browser mit angemeldeter Rolle | Noch offen |

Die Tests prüfen unter anderem Doppelabsendungen, verlorene Antworten, Teilfehler bei Dateien und Gruppen, Empfängeränderungen während eines Rundversands, Wiederaufnahme nach Neuladen, Mandantentrennung, Lesefehler, Entwurfwechsel, URL-Auswahl, Rollenbeschränkungen und die Gesprächsverwaltung. Die Datenbankzugriffe in diesen Tests sind isolierte Modelle. Produktive Nachrichten oder Testdatensätze wurden nicht angelegt.

## Noch offene Abnahme

Die vorhandene Cloud-Browserumgebung kann den lokalen Entwicklungsserver nicht erreichen. Gemäß `AGENTS.md` wurde dafür keine zusätzliche Software oder Testinfrastruktur eingerichtet. DOM-Prüfungen sind kein Nachweis einer fehlerfreien optischen Darstellung.

An einem erreichbaren Vorschau-Stand sind breite und schmale Arbeitsfenster, geringe Höhe, vergrößerte Schrift, Dialogfokus und Scrollverhalten visuell zu prüfen. Ein angemeldeter Ende-zu-Ende-Durchlauf mit freigegebenen Testkonten muss außerdem Aufnahme/Wiedergabe, Upload/Download, Portalzustellung und die realen Rollenrechte abdecken.

Die Veröffentlichung als Vorschau ist freigegeben. Der lokale Prüfnachweis ersetzt keine optische Abnahme oder Freigabe für die Produktion.
