# Google Play – CareSuite HealthOS 0.7.1

Paket `app.caresuitehealthos`; vollständige native Ausgabe `full`; Router `app`.
Der letzte im Gerätebericht nachgewiesene Android-Versionscode ist **53**. EAS erhöht den verwalteten Code. Für das neue Paket gelten ausschließlich Version und Versionscode aus dem geprüften AAB und dessen `BUILD-INFO.json`; der Code muss über 53 und der unmittelbar vor dem Build ermittelten EAS-Basis liegen.

## App-Zugänge

Verwaltung, Desktop, Widgets, Navigation, Firmenregistrierung, Passwortwiederherstellung, öffentlicher Support und die beiden Portale verwenden native App-Komponenten. Android lädt dafür keine CareSuite-Webseiten. Die Kartenansicht verwendet ebenfalls den nativen MapLibre-Renderer. Die gemeinsame produktive API benötigt eine Internetverbindung; Rollen, Mandant und freigegebene Produkte bestimmen den Zugriff.

Vor Einreichung werden vorhandene, freigegebene Review-Zugänge zu einem Testmandanten in der Play Console hinterlegt. Dieses Update legt keine produktiven Testkonten an.

| Zugang | Review-Zweck |
|---|---|
| Verwaltung: freigegebenes E-Mail-/Passwortkonto | Nativer Desktop, modulbezogene Navigation, Widgets, Firmen-/Mandanten-Einstellungen, Google Workspace |
| Mitarbeitende: bereitgestellter Portalzugang | Erstpasswort, Einsätze, optionale Aufgaben, Fahrtenbuch, Dokumentation, Medien, Unterschriften |
| Klient:innen: bereitgestellter Portalcode | Freigegebene Informationen, Dokumente, offene Unterschriften |
| Ohne Anmeldung | Kostenlose Firmenregistrierung, Support und Verwaltungspasswort-Wiederherstellung |

## Review-Ablauf

Die folgenden Schritte stehen für die manuelle Geräteprüfung mit freigegebenen Testzugängen und Testdaten aus. Automatisierte Quell-, Komponenten- und SQL-Prüfungen sind getrennte Nachweise.

1. Kaltstart, unveränderte Original-Introvideos und anschließend alle drei Zugangskarten prüfen.
2. Verwaltung anmelden. Navigation und Widget-Raster auf Telefon und Tablet prüfen, einschließlich großer Systemschrift und Querformat. Bei schmalen Fenstern Apps/Navigation als App-Dialog öffnen.
3. Gemeinsame Navigation der freigegebenen Arbeitsbereiche ohne Modulauswahl prüfen. Widgets hinzufügen, entfernen, sortieren, Hintergrund ändern und App neu starten. Einstellungen müssen je Mandant und Person erhalten bleiben; ein bewusst leerer Desktop bleibt leer. Frühere Office-/Assist-Favoriten werden zusammengeführt, entfernte Bodymap-Zugänge bleiben geschlossen.
4. Uhrzeit, echtes Standortwetter, Ortsauswahl, verweigerte Standortfreigabe und Wiederholen nach Verbindungsfehler prüfen.
5. Kostenlose Firmenregistrierung mit Firmenkatalog, Kontaktfunktion, Pflichtangaben und Einwilligungen prüfen. Keine Modulauswahl. Nach bestätigtem Ergebnis zur getrennten Anmeldung wechseln.
6. Verwaltungspasswort anfordern. Systemmail öffnet den App-Dialog; bei einem Mailprogramm ohne App-Link-Unterstützung den vollständigen Link in der App einfügen. Nur einmaliger Recovery-Token; keine normale Anmeldesitzung. Erfolgreiche Änderung erfordert erneute Anmeldung.
7. Öffentliches Support-Ticket mit Einwilligung und freigegebenen Testdaten prüfen. Fehler erhalten die Eingaben; die gleiche Anfrage-ID verhindert versehentliche Wiederholungen.
8. Google Workspace mit freigegebenem Testkonto verbinden. Google-Zustimmung erfolgt beim Anbieter; Rückkehr und Diensteansicht erfolgen in der App. Schreiben, Hochladen und Trennen nur mit bewusst bestätigter Aktion prüfen.
9. Mitarbeitenden-Erstanmeldung und Passwortwechsel prüfen. Testeinsatz starten; optionale Aufgaben suchen, auswählen oder ergänzen. Eine Ergänzung erscheint erst nach bestätigter Speicherung.
10. Dienstliche Fahrt, Hintergrund-/Display-Sperre, native Karte, Offline-Zwischenspeicherung und anschließende Übertragung prüfen. Standortaufnahme ist nutzerinitiiert und Android zeigt den laufenden Vordergrunddienst. Tag vollständig beenden.
11. Dokumentation, Originalfoto/-video, Dateien, Signatur und das Nachholen im Klient:innenportal prüfen. Verbindungsabbrüche dürfen keinen unbestätigten Abschluss als Erfolg anzeigen.
12. Nativen Rechnungs-PDF-Export und Android-Teilen prüfen. Benachrichtigungen, lokale Portal-Biometrie, Wechsel in den Hintergrund, Abmelden und Mandantenwechsel prüfen.
13. Neo antippen und den lokalen Sprachdialog einschließlich Nachfragen, Abbruch und erneutem Start prüfen. Verweigerte Mikrofonfreigabe und fehlende lokale Spracherkennung müssen einen verständlichen Hinweis anzeigen. Die Fachseiten bleiben über Apps und Navigation erreichbar.

## Berechtigungen und Verarbeitung

Kamera, Dateien, Mikrofon, Standort und Push werden im zugehörigen, bewusst gestarteten Ablauf verwendet. Dienstliche Hintergrundaufzeichnung endet mit dem aktiven Fahrt-/Tageskontext. Biometrische Merkmale verlassen das Gerät nicht. Neo fordert ausschließlich lokale Spracherkennung an; Karten erhalten keine Klient:innen-Namen als Teil der Kartendienst-Anfragen. Google-OAuth und die vorhandene API prüfen den angemeldeten Verwaltungszugang.

Die automatische globale Push-Cron-Aktivierung ist nicht Teil dieses Android-Releases. Der aktuelle Push-Serverstand, der aktive Cronjob und die tatsächliche Zustellung auf Android bleiben gesondert zu prüfen.

## Ausstehende Serverkorrekturen

Die vier vorbereiteten Datenbankkorrekturen sind nicht angewandt. Die automatische Freigabeprüfung hat ihre produktive Anwendung abgelehnt; dafür ist eine ausdrückliche Freigabe erforderlich. Die bestätigten Serverbefunde bestehen bis zur Anwendung weiter.

- [Eigene Monatsabrechnungsentscheidungen absichern](android-employee-decide-payroll-statement-guard-review.sql)
- [Einsatzreparaturen an den tatsächlichen Akteur und Mandanten binden](android-repair-assist-visit-workflow-status-guard-review.sql)
- [Die fehlende Angehörigen-Scope-Funktion ergänzen](android-family-portal-scope-review.sql)
- [Zeilenzugriffe auf Einsätze und Durchführungsstände begrenzen](android-workflow-rls-ceilings-review.sql)

Der [Backend-Prüfbericht](android-workflow-backend-review-20261026.md) trennt die aktuellen Servermetadaten, 59 SQL-Fälle mit synthetischen Daten und die ausstehenden Änderungen. Die SQL-Fälle belegen keine produktive Geschäftstransaktion. Der Angehörigenzugang bleibt ohne die fehlende Serverfunktion gesperrt; weitere Inhalts-, Storage- und Abschlussverträge benötigen ihre eigenen Nachweise.

## Leistung und Signierung

Bildanzeige nutzt `expo-image`/Glide mit Downsampling auf die Anzeigefläche. Fotos und Signaturvorschauen erhalten keinen neuen dauerhaften Bildcache. Die Originaldateien und alle sechs Intro-Videos bleiben unverändert.

R8 verwendet `proguard-android-optimize.txt`, Full Mode, Code- und Ressourcenverkleinerung. Pauschale app-eigene Keep-Regeln für komplette Bibliotheken wurden entfernt; deren eigene Consumer-Regeln sichern JNI und reflektierte Zugriffe. R8-Mapping und Buildnachweis müssen zum konkreten AAB gehören.

Die Signierungsidentität steht in `android-signing-identity.json`. AAB-Uploadzertifikat und Play-App-Signaturzertifikat werden getrennt geprüft. Kein Schlüsselwechsel oder Uploadschlüssel-Reset. Der Build verwendet die bestehende EAS-Signierung mit `--freeze-credentials`.

## Freigabestand

Automatisierte Funktions-, Quellgraph-, Export- und Konfigurationsprüfungen ersetzen keine Android-Geräteprüfung. Signatur, Paketidentität und Versionscode werden am tatsächlich gebauten AAB geprüft. Vor einem öffentlichen Rollout stehen die gemessene Speicherprüfung, die Aktualisierung über die bestehende Play-Installation, die optische und fachliche Prüfung auf echten Geräten sowie der aktuelle Play-Vorabbericht aus. Die vier Serverkorrekturen benötigen weiterhin ihre gesonderte Freigabe und anschließende Prüfung. Diese Unterlagen dokumentieren die Release-Vorbereitung.

Datenschutz: https://www.caresuiteplus.app/datenschutz
Support: https://www.caresuiteplus.app/support
Kontakt: caresuiteapp@gmail.com
