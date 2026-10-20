# Nachweisverwaltung Desktop/Web – 10.09.2026

Ausgangsstand: main 4a3c1a213b0243f54fc16c594b0549c2c7480a0b.

## Änderung
- Details öffnen direkt im ausgewählten Listeneintrag und lassen sich dort schließen.
- Abgeschlossene Einsätze ohne assist_visit_proofs werden als fehlende Nachweise angezeigt.
- Vollständige, mandantenbezogene Seitennavigation der Datenabfragen statt Limit 200.
- Abgleich von Nachweisen, Einsätzen, Portal-Dokumenten und gültigen Unterschriften.
- Getrennte Merkmale für fehlend, noch nicht im Portal, Unterschrift offen, unterzeichnet, im Portal unterzeichnet, zurückgezogen und Status prüfen.
- Portal-Freigabe, Dokumentanlage und Unterzeichnung mit deutschen Datums-/Zeitangaben; Wartezeit für offene Portal-Unterschriften.
- Filter nach Klient:in, Leistungszeitraum, Prüfstatus und Portal-/Unterschriftsmerkmalen; Suche und Sortierung.
- Übersicht mit 25 Einträgen je Seite; automatische Aktualisierung alle 30 Sekunden bei sichtbarer Seite.
- Web-spezifischer Aktionsschutz gegen Doppelklicks und zuverlässige Fehlerbehandlung.
- Änderungen ausschließlich in Web-Erweiterungen und Tests; keine Android-Veröffentlichung.

## Verifikation
- 40 Tests bestanden: neue Status-/Filter-/Interaktionstests sowie bestehende Vorschau-, Portalfluss- und Portal-Dokumenttests.
- Abfrage mit 620 Nachweisen und künstlich auf 75 Datensätze begrenzten Serverantworten geprüft.
- Tatsächliche neue React-Oberfläche mit fiktiven Daten und bestehendem Popup-CSS im Browser geprüft: 1912, 1366, 768 und 390 Pixel; kein horizontaler Überlauf, Details direkt am ausgewählten Eintrag.
- 150 % Schriftgröße separat visuell geprüft; Filterfelder angepasst.
- Die PDF-Unteransicht war im visuellen Prüfaufbau ein Platzhalter; bestehende Vorschau-/Portaltests liefen zusätzlich.
- Projektweiter Typecheck enthält bereits Fehler außerhalb dieser Änderung; gesonderte Prüfung der neuen Dateien.

## Fachliche Grenzen
Portal-Bereitstellung ist keine Lesebestätigung. Historische Öffnungs-/Lesezeitpunkte werden nicht erfunden.
Es wurden keine produktiven Nachweise versendet oder unterschrieben und keine Klientendaten für Tests verändert.
