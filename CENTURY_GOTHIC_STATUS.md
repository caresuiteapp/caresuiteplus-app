# Century Gothic – eingebetteter Stand 11.09.2026

## Umsetzung
- Vom Nutzer bereitgestellte Datei CenturyGothic.ttf unverändert übernommen (137.568 Bytes).
- SHA-256: 64654e2515da88ca0c470c69b45341a0dda7f066a5f0c72cd6f2a929cdedd461.
- Web/Desktop lädt die Schrift über eine eigene Font-Familie, Preload und versionierte URL; eine lokale Installation ist nicht erforderlich.
- Gemeinsame Text-/Eingabekomponenten und ein Babel-Importadapter erfassen app-eigene RN-Texte. Fremdbibliotheken, Symbolschriften und explizite Styles behalten ihre Funktion.
- Native App lädt die Schrift aus dem App-Bundle vor dem Intro; ein Ladefehler blockiert die App nicht dauerhaft.
- Standard-Dokumente tragen die Schrift als eingebettete Daten. Rechnungs- und Fahrtenbuch-PDFs verwenden die eingebettete Century Gothic.
- Einzig Regular wurde geliefert. Web/OS erzeugen Fett und Kursiv synthetisch; PDF-Fettschrift wird mit zusätzlichem Strich dargestellt. Keine separaten Original-Schnitte behauptet.
- Individuelle Dokument-CI-Einstellungen und bereits finalisierte Dokumente bleiben erhalten.

## Nachweise
- 79 bestehende Tests in sieben betroffenen Suites bestanden.
- Babel-Adapter: benannte Imports und Aliase umgestellt; Bibliotheken und eigene Basis-Komponente korrekt ausgenommen.
- Browser meldet für geprüfte Texte CenturyGothic mit isCustomFont=true; Feather bleibt Feather.
- Prüfansichten 1920, 1366, 768 und 390 Pixel, zusätzlich 390 Pixel bei 150 % Schriftgröße; kein horizontaler Seitenüberlauf und keine JS-Fehler.
- Aktuelle Screenshots und eine echte Rechnung aus fiktiven Regressionsdaten visuell geprüft.
- PDF-Text extrahierbar, einschließlich ÄÖÜäöüß und Eurozeichen; beide verwendeten CenturyGothic-PDF-Ressourcen enthalten FontFile2.
- Web-Export erfolgreich; Preload/Font-Regel und identische Schriftdatei im Export bestätigt.
- Portal-only Android-Export erfolgreich; identische Schriftdatei auch als natives Bundle-Asset enthalten.
- Projektweiter Typecheck weiterhin mit Fehlern außerhalb der geänderten Dateien; keine Diagnose in den geänderten Dateien.

## Veröffentlichungsumfang
Web/Desktop kann über main/Vercel ausgerollt werden. Ein neues Google-Play-Release wurde nicht ausgelöst. Die native Darstellung auf einem physischen Endgerät und sämtliche angemeldeten Fachseiten wurden nicht vollständig visuell geprüft.
