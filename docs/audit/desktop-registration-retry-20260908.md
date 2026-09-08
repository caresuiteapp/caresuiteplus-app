# Desktop/Web: Registrierungsfehler und Wiederholung – 08.09.2026

## Ausgangslage und Korrekturen
Ausgangsstand auf ChristianLaptop war `46a8e558` auf `feature/desktop-platform-support-20260907`; das Arbeitsverzeichnis war sauber. Die erweiterten Prüfungen liefen zunächst gegen diesen Anwendungsstand: 13 erfolgreich, vier fehlgeschlagen.

Der obere Zurück-Knopf der Web-Registrierung ist nun wie die übrige Schrittnavigation während der Übertragung gesperrt. Dadurch kann diese Aktion die noch ausstehende Rückmeldung nicht mehr ausblenden. Die vorhandene Sperre gegen mehrfaches gleichzeitiges Absenden bleibt bestehen. Andere Anmeldeseiten behalten ihr bisheriges Verhalten.

Die Servervalidierung behandelt eine optionale Website, die ausschließlich Leerzeichen enthält, nun ebenso wie die Web-Validierung als leere Angabe. Tatsächlich eingetragene URLs benötigen weiterhin `https://` oder `http://`. Die vorhandene SQL-Normalisierung benötigt keine Änderung.

Fehler im abschließenden Registrierungsschritt tragen die Überschrift „Registrierung nicht abgeschlossen“. Die konkrete Fehlermeldung bleibt sichtbar; Feldfehler in vorherigen Schritten behalten „Angaben prüfen“.

## Nachweise
- Zwei gezielte Testsuiten: **17 Tests erfolgreich, Exit-Code 0**. Zehn Interaktionsprüfungen decken Registrierung und Unternehmensverwaltung ab; sieben Prüfungen betreffen Validierung und atomare Unternehmensanlage.
- Beide Fehlerwege, eine negative Serverantwort und eine Ausnahme, erlauben die Wiederholung. Dabei bleiben Formulareingaben erhalten. Passwörter bleiben nur im Arbeitsspeicher; der gespeicherte Entwurf enthält kein Passwort. Erst nach erfolgreicher Registrierung wird der Entwurf entfernt, ohne anschließendes erneutes Speichern. Die Weiterleitung zur Anmeldung wird geprüft.
- Vollständige TypeScript-Prüfung: **Exit-Code 0**.
- Bestehende Web-Vorschau neu gebaut: **1.387.384 Byte** JavaScript. Vier DOM-Startprüfungen, Menübedienung, Öffnen der passenden Unternehmensakte und Wechsel zwischen Karten und Tabelle erfolgreich; **Exit-Code 0**.
- `git diff --check`: **erfolgreich**.

## Grenzen und Veröffentlichung
Die Prüfungen verwenden tatsächliche Komponenten und Servervalidierung mit simulierten Dienstantworten. Sie belegen keine vollständige Registrierung mit realer Authentifizierung, Datenbank und anschließender Anmeldung. Diese angemeldeten Backend-Endtests bleiben offen. Die vorhandene Web-Entwurfsspeicherung schreibt unmittelbar in den lokalen Browserspeicher; eine zusätzliche Warteschlange wurde nicht benötigt.

Das bestehende Layout wurde nicht geändert. DOM-Prüfungen ersetzen keine optische Prüfung der aktualisierten Fehler- und Ladezustände; dafür liegt in diesem Schritt kein neuer Browsernachweis vor.

Die korrigierte Serverfunktion ist ausschließlich als Quelltext vorbereitet und noch nicht veröffentlicht. Keine Migration, Android-Datei, Paketversion oder produktiven Daten geändert. Vorhandene Werkzeuge verwendet; keine Installation, kein Push und kein Deployment.
