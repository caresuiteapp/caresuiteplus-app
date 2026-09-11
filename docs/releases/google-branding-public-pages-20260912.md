# Öffentliche CareSuite-Seiten für Google-Branding

Stand: 12. September 2026

## Status

Die Änderungen sind lokal vorbereitet und geprüft. Die automatische Freigabeprüfung hat den Commit-/Push-Befehl mit Ziel main vor Ausführung abgelehnt: Die Veröffentlichung neuer öffentlicher Nutzungsbedingungen und Betreiberinformationen benötigt eine ausdrückliche Veröffentlichungsfreigabe. Es wurde kein Produktionsdeploy für diese Änderung ausgelöst.

## Änderungen

- Öffentliche Produktseite /caresuite mit Beschreibung der Software und Google-Workspace-Anbindung.
- /datenschutz als direkt lesbares HTML aus der vorhandenen Datenschutzquelle; ergänzende Google-Datenhinweise, Freigaben, Widerruf und Limited Use.
- /nutzungsbedingungen mit Angaben zu berechtigter Nutzung, kostenlosen Funktionen, Datenverantwortung, externen Diensten und Beendigung eines Zugangs. Bestehende individuelle Verträge und gesetzliche Ansprüche bleiben maßgeblich.
- /impressum mit den bereits im Projekt hinterlegten Betreiberangaben: Kevin Reinhardt, Einzelunternehmen, Castroper Str. 81A, 44628 Herne, caresuiteapp@gmail.com. Keine unbelegte Umfirmierung in eine UG und keine erfundenen Registerdaten.
- Öffentliche Geschäftsbezeichnung: CareSuite Software Technologie; vorhandene CareSuite-HealthOS-Wortmarke.
- Weblinks auf die Produktionsdomain korrigiert; Produkt- und Rechtslinks im Webzugang und unmittelbar bei der Google-Verbindung.
- Vercel-Webbuild erzeugt die Seiten nach dem Expo-Export. Explizite öffentliche Rewrite-Regeln stehen vor dem SPA-Fallback.

## Umsetzung

scripts/build-public-branding-pages.mjs verwendet die bestehende Datenschutzquelle und erzeugt die vier HTML-Seiten ohne Abhängigkeit von einer Anmeldung oder JavaScript. Die generierten Dateien liegen unter public/caresuite, public/datenschutz, public/nutzungsbedingungen und public/impressum. Native Dateien und Android-Buildkonfiguration sind unverändert.

## Prüfung

- 4 bestehende Datenschutztests bestanden.
- 40 bestehende Workspace-Tests bestanden.
- 16 Seiten-/Viewport-Prüfungen bestanden: 1440, 390, 320 Pixel sowie 900 Pixel mit 150 Prozent Schrift.
- HTTP-Routen, Bilder, Textüberlauf, Header-Überlappung, Navigation, Inhaltsverzeichnisse und der Google-Datenschutzlink geprüft.
- Web-TSX/TypeScript-Transformation bestanden.
- Bestehende Workspace-Browserprüfung mit drei Darstellungen und synthetischen Funktionsabläufen bestanden; keine produktiven Google-Daten verändert.
- Screenshots visuell geprüft; gefundene Footer-Verschachtelung, Textüberlauf und Logo-Überlappung korrigiert.
- Kein Nachweis einer juristischen Prüfung oder Google-Freigabe. Die zuvor dokumentierten projektweiten TypeScript-Probleme sind nicht Teil dieses begrenzten Auftrags.

## Google-Konfiguration bleibt offen

Die Google-Cloud-Branding-Seite ist in der verfügbaren Browsersitzung nicht erreichbar. Auf dem verbundenen Rechner wurde kein eingerichteter gcloud-Zugang gefunden. Die bestehende Workspace-/Supabase-Anbindung ersetzt keine Google-Cloud-Verwaltungsberechtigung.

Vorgesehene Werte nach Veröffentlichung:
- Anwendungsname: CareSuite Software Technologie
- Startseite: https://www.caresuiteplus.app/caresuite
- Datenschutz: https://www.caresuiteplus.app/datenschutz
- Nutzungsbedingungen: https://www.caresuiteplus.app/nutzungsbedingungen
- Logo: bestätigte quadratische PNG aus der Unterhaltung
- Supportauswahl in der vom Nutzer gezeigten Google-Konsole: info@aventa-alltagsbegleitung.de; nicht eigenmächtig verändert

Name/Logo, Produktionsstatus, Domainbestätigung, Branding- und Scope-Prüfung wurden bei Google nicht gespeichert oder veröffentlicht. OAuth-Client-IDs, Geheimnisse und Rücksprungadressen bleiben unverändert.
