# CareSuite HealthOS 0.4.0 – Abgleich und native Umsetzung

Stand: 9. Oktober 2026 (Europe/Berlin). Paket `app.caresuitehealthos`, Produktionsprofil `healthos-full-aab`, Ausgabe `full`, Router `app`, Demo aus. Letzter durch den App-Inhaber belegter Play-Stand: **0.3.7 (40)**. Neuer Code: **mindestens 41**; der tatsächlich gebaute AAB entscheidet.

## Herkunft und Vollständigkeit

Basis ist der aktuelle Git-Hauptzweig `e07d24024f6c9e340d9e826c6ee4d3f021a96a6f`. Er enthält die letzten Änderungen an optionalen Einsatzaufgaben, kostenlosen Karten, Plattformsteuerung, Registrierung/Systemmail und Workflow-Korrekturen. Die älteren umfangreichen nativen 0.3.7-Arbeiten waren dort teilweise noch nicht integriert. Diese wurden anhand des ursprünglichen vollständigen Updatepakets gegen dessen Basisstand abgeglichen und in den aktuellen Code übernommen.

Zusätzlich wurden die vorhandenen Updatepakete vom 1.–8. Oktober geprüft. Ein vollständiger Chat-Abgleich konnte nicht durchgeführt werden: Die persönliche Gesprächssuche meldet für diese Unterhaltung fehlende Verfügbarkeit. Diese Einschränkung ist ausdrücklich kein Nachweis, dass andere Chats keine weiteren Änderungen enthalten.

Der Ambulant-Zwischenstand ist eine unvollständig freigegebene fachliche Erarbeitung mit offenen Datenbank-, Funktions-, Geräte- und Modulprüfungen. Er wird durch dieses App-Update nicht als fertiggestelltes Produkt aktiviert.

## Übernommene und ergänzte Bereiche

| Bereich | Umsetzung im nativen Android-Stand |
|---|---|
| Verwaltung/Desktop | Native Arbeitsfläche, linke Navigation auf breiten Fenstern, mobile Navigationsdialoge, Module mit Berechtigungsprüfung, Apps-, Widget-, Workflow- und Hintergrundauswahl |
| Desktop-Einstellungen | Speichern pro Person/Mandant/Modul; Reihenfolge, Entfernen, Hinzufügen, maximal zwölf Widgets, bewusst leerer Desktop, Fehler und Wiederholen |
| Wetter/Uhr | Echte BrightSky-/DWD-Daten, gerundete Koordinaten, native Orts-/Postleitzahlauswahl und nachvollziehbare Fehlerzustände |
| Google Workspace | Native Übersicht, Dienste, Suche, Details, Aktionen und Dateien; bestehende autorisierte API; OAuth-Rückkehr in die App |
| Neo | Native Bedienung, Original-Sprachaufnahmen, lokale Systemstimme und ausschließlich lokale Erkennung; explizite Namensauswahl bei Mehrdeutigkeit |
| Registrierung/Zugänge | Native Verwaltungs-, Mitarbeitenden- und Klient:innenzugänge, kostenlose Firmenregistrierung mit Katalog/Einwilligungen, keine Modulauswahl, Erstpasswort und lokale Portalsperre |
| Wiederherstellung | Native E-Mail-/Passwortformulare, rollenbegrenzte Systemmail und einmaliger Token; manuelles Übernehmen eines App-Links ohne dauerhafte Speicherung |
| Support | Öffentliches natives Formular mit Einwilligung, bestätigtem Ergebnis, erhaltenen Fehlerentwürfen und stabiler Wiederholungskennung |
| Einsatzaufgaben | Aktueller Web-Fachvertrag in der App; Katalogsuche, Mehrfachauswahl, manuelle Aufgaben, Serverbestätigung, Serienterminauflösung und Cache-Abgleich |
| Abschluss/Signaturen | Aktuelle Workflow-, Dokumentations-, Nachweis-, Wiederaufnahme- und Fahrtenbuchkorrekturen aus dem Hauptzweig |
| Karten/GPS | Native MapLibre-Karte mit vorhandenen freien Kartendaten, auswählbaren Positionen, getrennten GPS-Segmenten und geplanten Routen; Fehler stoppen die Aufzeichnung nicht |
| Rechnungen | Nativer PDF-Export und Android-Teilen über bestehende Backend-/PDF-Verträge |
| Benachrichtigungen | Native Mandanteneinstellungen, Portalgeräteanmeldung und private, opake Push-Navigation; globale automatische Push-Aktivierung bleibt offen |
| Medien/Branding | Alle sechs Original-Introvideos und Century-Gothic-Schrift unverändert; Originaldokumentationen bleiben erhalten |
| Bildspeicher | 30 Bildkomponenten nutzen `expo-image`/Glide; Größenanpassung beim Laden, verwalteter Memory-Cache und Zurücksetzen recycelter Bilder bei Quellenwechsel |
| R8 | Optimierende Standardregeln, Full Mode und optimierte Ressourcenverkleinerung; app-eigene pauschale Bibliotheks-Keeps entfernt, Consumer-Regeln der Bibliotheken erhalten |
| Signierung | Bestehendes Paket/Projekt und Uploadsignierung; Prüfung des tatsächlichen AAB-Zertifikats gegen den vom Inhaber bestätigten SHA-256-Wert; keine Schlüsselrotation |

## Backend und App-Links

`google-workspace-auth` Version 9 und `business-password-recovery` Version 5 wurden auf dem produktiven Projekt bereitgestellt. Die anschließend erneut gelesenen Quellen stimmen mit den getesteten Änderungen überein. Ohne Sitzung wird der Google-Start mit HTTP 401 abgewiesen; Recovery-GET mit HTTP 405. Es wurden keine produktiven Testkonten erstellt und keine Recovery-Mails oder Google-Nachrichten ausgelöst. Die anderen Funktionsdateien und vorhandenen produktiven Datenbankmigrationen wurden nicht erneut überschrieben.

Das Zertifikat `deployment_cert.der` aus der bereitgestellten ZIP entspricht exakt `21:37:5B:D0:2E:0E:30:76:46:F0:61:6E:53:B7:59:79:6A:B4:EF:6D:5B:40:79:94:75:8D:FD:C6:09:DE:7F:6B`. Das AAB-Uploadzertifikat wird gesondert gegen `2D:44:96:38:4E:A1:60:C5:EB:6C:F1:86:2F:48:70:C1:CE:18:5C:8E:98:0C:8D:73:7C:34:E5:71:BF:A0:F5:B0` geprüft.

App-Link-Intentfilter und die passende `assetlinks.json` sind im Quellcode vorbereitet. Die Website-Dateien wurden in diesem Auftrag nicht veröffentlicht. Die native Passwortwiederherstellung nutzt deshalb einen eigenen App-Link und bietet zusätzlich das Einfügen des Links in der App an.

## Layout und Nachweise

Der native Desktop berücksichtigt tatsächliche Fensterbreite, seitliche Safe Areas und Systemschrift. Automatisierte Geometrieprüfungen decken 320–1920 px bei Schriftfaktoren 1, 1,5 und 2 ab. Die Prüfung belegt Spalten-/Navigationsgeometrie, keine vollständige optische Gerätefreigabe. Dialoge scrollen und berücksichtigen Tastatur sowie kurze Querformatfenster. Texte/Aktionen werden nicht durch Verkleinern der gesamten Arbeitsfläche angepasst.

| Nachweis | Stand |
|---|---|
| TypeScript für den gesamten Stand | Bestanden |
| Android-Paket mit nativen Interaktionen und Release-Grenzen | 363 Prüfungen bestanden, einschließlich 42 aktualisierter Exportprüfungen |
| Portal-Regression | 107 Prüfungen bestanden |
| Workflow-Freigabepaket | 376 Prüfungen bestanden |
| Geteilte Web-/Native-Desktop-, Google- und Recovery-Verträge | 59 Prüfungen bestanden |
| Zusätzliche Aufgabenprüfung | 20 Prüfungen bestanden |
| AAB-Manifest-/Versions-, Hermes- und R8-Prüfung | 7 Prüfungen bestanden |
| API 36 und Leistungs-Konfiguration | Bestanden |
| Frischer Android-Export gegen aktuelle Quellen | Bestanden: 700 Android-Routen, 4.114 erreichbare App-Quellen; keine erreichbare WebView-/iframe-Oberfläche |
| Signierter AAB mit R8-Mapping | Noch nicht gebaut; bestehende Expo-Signierung wird auf GitHub benötigt |
| Gerätebild, Systemschrift/Tastatur, Speicher-/Low-Memory-Messung | Offen; hier kein Android-Gerät verfügbar |
| Play-Update über vorhandene Installation und neuer Vorabbericht | Offen |
| Vollständige Suche sämtlicher Chats | Technisch nicht verfügbar |

Der konkrete Exportnachweis steht in `20261009-android-export-verification.json`. Er bestätigt den Abgleich von 4.140 exportierten App-Quellen mit dem Arbeitsstand, alle sechs Video-Prüfsummen und die Originalschrift. Der Hermes-Bundle hat SHA-256 `0e31cd7fb99df8de946efa9a5825a560b6032f82c487444b625f65eb30a82e93`; fünf native Oberflächenkennungen wurden direkt in der Binärdatei geprüft. Der Export enthält 175,2 MiB an Runtime-Dateien. Diese Größe ist kein installierter RAM-Verbrauch und keine AAB-/Play-Downloadgröße. Browser-PDF-Vorschauen in gemeinsamen Dateien werden nur dann ausgeschlossen, wenn ihre Plattformbedingung für Android nachweislich falsch ist; unbekannte Bedingungen bleiben gesperrt.

## Release-Ablauf

Der bereitgestellte Installer importiert ausschließlich den geprüften Release-Commit in ein separates Git-Arbeitsverzeichnis. Der vorhandene Checkout wird nicht überschrieben. Ein normaler Push auf den eigenen Releasezweig startet den vorhandenen GitHub-Build mit den bisherigen Expo-Zugangsdaten; kein EAS-Cloud-Build und kein automatischer Play-Rollout. Der Workflow prüft produktive Konfiguration, Mindestcode 41, tatsächlichen Android-Quellgraph, Originalmedien und Signatur des AAB. Zusätzlich wird das R8-Mapping aufbewahrt.

Push, signierter AAB und Play-Einreichung sind erst durch ihre tatsächlichen Ergebnisse nachgewiesen. Dieser Bericht behauptet weder eine bereits veröffentlichte Play-Version noch eine zu 100 % optisch geprüfte App.
