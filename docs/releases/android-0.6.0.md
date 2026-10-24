# CareSuite HealthOS Android 0.6.0

Dieses Update führt den aktuellen Web-Stand mit den nativen Verwaltungsansichten zusammen. Es ersetzt den installierten Stand 0.4.0 einschließlich der bisher nicht übernommenen Android-Änderungen aus 0.5.0.

## Änderungen

- Native Verwaltung mit Unternehmensakte, Organisation, Standorten, Personalzuordnungen, Inventar, Dokumenten und Datenübernahme.
- Aktuelle Desktop-Bereiche, gemeinsame Office-Apps und Widgets, Vorschläge und getrennt gespeicherte Auswahlen je Mandant, Person und Bereich. Ausgeblendete Vorschläge bleiben ausgeblendet.
- Native Notizen mit Vorlagen, Aufgaben, Quellen, Mindmap, Handschrift und Archiv. Speicherung verwendet dieselben Mandanten-, Personen- und Versionsprüfungen wie das Web.
- Mehrere Mitarbeitende oder das ganze Team für Kalendertermine auswählen.
- Klienten-, Personal-, Notiz- und Kalenderansichten berücksichtigen die tatsächlich verfügbare Inhaltsbreite und vergrößerte Schrift, auch bei geteilter Tabletansicht.
- Aktuelle Mitarbeiter-, Klienten- und Angehörigenportale sowie Registrierung, Anmeldung, erstes Passwort und Passwort-Wiederherstellung sind in die Release-Prüfungen einbezogen.
- Zugangskarten trennen Figuren und Aktionen auch auf kleinen Displays. Passwortformulare erhalten konsistente Innenabstände; das Angehörigenportal verwendet stabile Kartenhöhen, eine passende Kopfzeile und zur Rolle passende Beschriftungen.

## Nachweise und verbleibende Geräteprüfung

Die Pipeline sperrt den Build bei fehlgeschlagenen TypeScript-, Android-, Verwaltungs-, Portal-, Zugangs-, Offline- oder Einsatzprüfungen. Ein neuer Android/Hermes-Export und der signierte R8-Build werden aus diesem Quellstand erzeugt. Die AAB-Prüfung kontrolliert Paket, Version, ursprünglichen Upload-Schlüssel, Intro-Dateien und enthaltene native Oberflächen.

Die visuellen Prüfungen rendern native Komponenten mit lokalen Prüfdaten über React Native Web bei 320, 360, 390, 412, 600, 768, 844 und 1280 Pixeln sowie mit vergrößerter Schrift. Sie belegen berechnete Layouts und ersetzen keinen Android-Gerätetest. Installation als Update von 0.4.0, Android-Tastatur, Zurück-Geste, Stift, Datei- und Freigabedialoge sowie reale Ende-zu-Ende-Anmeldung bleiben vor der Veröffentlichung auf einem Gerät zu prüfen. Die Layoutprüfung registriert keine echten Konten und verändert keine produktiven Daten.

App-ID bleibt `app.caresuitehealthos`; die bestehende Upload-Signierung wird weiterverwendet. EAS erhöht den Versionscode; der tatsächliche Wert steht in `BUILD-INFO.json`. Keine automatische Google-Play-Veröffentlichung.

## Erzeugte Datei

`CareSuite-HealthOS-0.6.0-46.aab`, Version 0.6.0, Versionscode 46, 238.933.796 Bytes. Der vollständige [GitHub-Build](https://github.com/caresuiteapp/caresuiteplus-app/actions/runs/39997302577) aus `b800fb811db2956ed53c96db80d275b4d7439958` ist erfolgreich abgeschlossen. Signatur, Manifest, sechs Introformate, sieben native Oberflächenmerkmale sowie das passende R8-Mapping und die aktiven Optimierungsregeln wurden nach dem Download erneut geprüft.

SHA-256: `ef429812dc1f3ea65d83fa428407715437f221ea02734ed8acab9ca2bcab588b`.

Die nachgereichten Web-Buildprotokolle enthielten überholte Erwartungen an native Demodaten. Die Verwaltung verlangt auf allen drei Plattformen bestätigte Live-Daten und Serverberechtigungen. Die aktualisierten Prüfungen decken erfolgreiche Speicherungen, Fehler, fehlende Verbindung und Berechtigungen ab; die Produktionslogik wurde dafür nicht verändert. Die gemeinsame Vitest-Konfiguration isoliert lokale Prüfdaten von geerbten Deploymentvariablen.

## Text für Google Play

CareSuite HealthOS wurde für Smartphone und Tablet aktualisiert: mit überarbeiteter Verwaltung, Unternehmensakte, Klienten- und Personalansichten, Inventar und Dokumenten. Office-Widgets sind in weiteren Desktop-Bereichen verfügbar. Notizen mit Vorlagen, Aufgaben und Archiv sowie die Teamauswahl im Kalender ergänzen die native App. Auch Portale, Registrierung und Anmeldung sind auf dem aktuellen Stand.
