# Geführte Klientenaufnahme im Web

Ausgangsstand: `0a8e199` / PR #82. Die Rückmeldung vom 14.10.2026 betrifft das Aufnahmefenster, dessen leerer erster Schritt bereits 100 % Fortschritt und die Aktivierungsaktion zeigte.

## Oberfläche und Bedienung

- Web-spezifisches Aufnahmefenster mit gegliederter Navigation, einer räumlichen Aktenvorschau und erklärten Leistungskarten. Die Vorschau verwendet ausschließlich die aktuellen Eingaben. Die vorbereitete Schulungsauswahl behauptet keine Freischaltung.
- Persönliche Angaben, Erreichbarkeit, Versorgung, Finanzierung und Wohnungszugang sind in passende Feldgruppen gegliedert. Bestehende Eingabekomponenten und Speicherfelder bleiben erhalten. Textvorschläge ergänzen geeignete Freitextfelder.
- Der Web-Ablauf verwendet sämtliche Abschnitte, die auch der Abschlussdienst validiert. Später eintreffende Abschnittsvorgaben können dadurch keine erforderlichen Angaben verstecken oder den geöffneten Abschnitt verschieben. Der bisherige Standardpfad anderer Oberflächen bleibt erhalten.
- Fortschritt beruht auf besuchten und aktuell gültigen Abschnitten. Ohne Leistungswahl startet er bei 0 %. Vor dem tatsächlichen Abschluss wird kein vollständiger Abschluss angezeigt.
- Die abschließende Übersicht zeigt lesbare Angaben, Korrekturwege, fehlende Pflichtangaben und den tatsächlichen Stand der Unterlagen. Dateinamen gelten nicht als hochgeladene Dateien; Vorlagen erhalten keine ersatzweise Demo-Akten-ID.
- Der Schließen-Dialog ist mit X, Escape und der Fußleiste verbunden. Fehlgeschlagenes Speichern schließt nicht automatisch. Bewusstes Schließen ohne erneute Sicherung bleibt nach deutlichem Hinweis möglich. Ein neuer Entwurf wird erst nach Bestätigung und erfolgreichem lokalem Zurücksetzen begonnen.
- Scrollbereiche, erreichbare Aktionen bei geringer Fensterhöhe, vergrößerte Schrift und reduzierte Bewegung sind im Layout berücksichtigt. Native Oberflächen werden nicht ersetzt.

## Bestehende Grenze des Aufnahmeabschlusses

Der aktuelle `submitClientIntake()`-Service sperrt produktive Neuaufnahmen, weil der verifizierte atomare Abschluss von Originaldokumenten, Unterschriften und Aufnahme nicht angebunden ist. Die SQL-Datei `docs/workflow-server-intake-completion-draft.sql` ist ein Review-Entwurf, keine produktiv angebundene Migration. Auch der notwendige vertrauenswürdige Vorbereitungsdienst fehlt.

Die Web-Oberfläche erklärt diese Grenze bereits zu Beginn und bietet im Produktivmodus die Entwurfsicherung an. Sie umgeht weder den Service noch die Dokumentensperren. Der vollständige Entwurf liegt auf dem verwendeten Gerät; die vorhandene Serversicherung schreibt Kernfelder. Signierte oder finale Unterlagen können derzeit nur lokal erhalten werden. Ein lokales Zurücksetzen löscht keinen bereits auf dem Server angelegten Aufnahmeentwurf.

Es wurden keine Datenbankänderungen, produktiven Testaufnahmen, Uploads oder Unterschriften ausgeführt.

## Prüfung

115 Tests in zehn Suiten erfolgreich; ESLint für alle 13 geänderten TypeScript-Dateien und vollständige TypeScript-Prüfung ohne Befund. Die vorhandenen und neuen Verhaltenstests prüfen die Formularbedienung, Navigation, Berechtigungen, Identitätswechsel sowie Entwurfs-, Schließen- und Fehlerzustände. Sie verwenden gemockte Dienste und belegen keine produktive Persistenz.

Eine tatsächliche optische Abnahme im angemeldeten Browser ist weiterhin offen. Die vorhandene Browser-Vorschau verlangt eine Anmeldung; lokale Browser-Software steht nicht zur Verfügung. DOM-Tests und CSS-Prüfung belegen keine berechnete Browserdarstellung.
