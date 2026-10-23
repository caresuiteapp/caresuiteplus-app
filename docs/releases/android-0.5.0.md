# CareSuite HealthOS Android 0.5.0

Die bisherige native Verwaltung verwendet mehrere frühere Arbeitsabläufe und Größen. Dieses Update übernimmt die aktuellen Unternehmens-, Dokument- und Organisationsabläufe in native Ansichten für Smartphones und Tablets.

## Änderungen

- Acht Desktop-Bereiche mit getrennten Widget-Auswahlen je Unternehmen und Person, aktualisierter Navigation und Migration vorhandener Einstellungen. Hochformat, Querformat und vergrößerte Schrift werden bei der Aufteilung berücksichtigt.
- Native Unternehmensakte mit Stammdaten, Kontakten, Vertretung, Bankverbindungen, Steuern, Leistungskatalog, eigenen Feldern, Kostenstellen und Budgetvorlagen.
- Standorte, Abteilungen, Gesellschaften, Beziehungen, Personalzuordnungen und Zugriffsbereiche sowie Versicherungen, Verträge, Fuhrpark und Anlagen.
- Inventarverwaltung mit realen Personalzuordnungen, versionierten Änderungen, expliziten Rücknahmeangaben, Schäden und Personalrückgaben.
- Überarbeitete Klienten-, Personal- und Einsatzlisten mit Suche und Filtern.
- Aktueller Dokumentenkatalog, Originaldateien und neue Dokumentversionen, Dokumentenablage, Portal-Uploadprüfung sowie Briefkopf- und Layouteinstellungen. Teilen und Drucken über Android.
- Datenübernahme mit abschnittsweisem Datei-Upload, Unterbrechung und Fortsetzung, Kontoprüfung pro Anfrage und gesonderter Freigabe.
- Aktuelles Hilfezentrum mit derselben Artikelsammlung und passenden nativen Zielseiten.

## Grenzen und Nachweise

Gemeinsame Fachlogik bleibt dieselbe wie im Web. Plattformbrücken importieren die gemeinsamen Implementierungen ausdrücklich; Rechte- und Mandantenprüfungen werden nicht durch lokale Beispieldaten ersetzt.

Die Release-Pipeline führt TypeScript, bestehende Android-/Portal-/Einsatzprüfungen, ergänzende Verwaltungsprüfungen, einen frischen Android-Export und den signierten R8-AAB-Build aus. Ein fehlgeschlagener Schritt sperrt den nachfolgenden Build.

`verify-native-administration-visual.mjs` rendert die tatsächlichen nativen Komponenten über React Native Web mit isolierten lokalen Prüfdaten und erstellt Aufnahmen bei 360, 390, 844 und 1280 Pixeln sowie vergrößerter Schrift. Diese Aufnahmen belegen das dort berechnete Layout. Sie ersetzen keinen Test der Android-Laufzeit, Tastatur, Zurück-Geste, Dateiauswahl, Druck-/Freigabedialoge oder Installation als Update auf einem Gerät. Diese Geräteprüfung bleibt vor der Play-Veröffentlichung erforderlich.

VersionCode wird durch das bestehende EAS-Verfahren erhöht; `BUILD-INFO.json` enthält den tatsächlich signierten Stand. App-ID und vorhandene Upload-Signierung bleiben erhalten. Keine automatische Google-Play-Einreichung.

## Entwurf für Google Play

Die Verwaltung wurde für Smartphone und Tablet neu gestaltet. Entdecken Sie den neuen Desktop, die überarbeitete Unternehmensakte, aktuelle Klienten- und Personalansichten sowie die erweiterte Inventarverwaltung. Der Dokumentenkatalog, die Dokumentenablage und die Hilfe sind auf dem aktuellen Stand. Dateien können für die Datenübernahme hochgeladen und unterbrochene Übertragungen fortgesetzt werden.
