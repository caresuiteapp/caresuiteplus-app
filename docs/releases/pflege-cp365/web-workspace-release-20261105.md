# Pflege auf der Webseite – 05.11.2026

Der Nutzer hat die bisherige globale Pflege-Sperre ausdrücklich aufgehoben und die Veröffentlichung des aktuellen gesicherten Pflege-Stands mit Widgets und angepasstem Layout beauftragt. Diese Anweisung ersetzt die früheren Vorgaben, den Bereich gesperrt zu lassen.

## Quellstand und Oberfläche

Der gesicherte Pflege-Zweig `87cc0038bdc1137e8b4009f87dccafdb4e39b8ab` wurde mit dem aktuellen Hauptstand `abacb57c1a60b001c614509f7c82f46c73fd11e1` zusammengeführt. Dadurch bleiben die jüngsten Office-, Personalabrechnungs- und Portaländerungen enthalten. Nicht gesicherter Code aus dem entfernten früheren Arbeitsverzeichnis wird nicht als Bestandteil dieser Veröffentlichung ausgegeben.

Pflege ist über die Bereichsauswahl, Apps, Suche und die vorhandenen direkten Fachrouten erreichbar. Zwölf eigene Desktop-Widgets bilden die Startauswahl: Übersicht, Pflegeakten, SIS, Pflegepläne, Dokumentation, Vitalwerte, Medikation, Behandlungspflege, Wunden, Übergaben, Touren und Risiken. Ihre Bildmotive stammen aus dem vorhandenen CareSuite-Katalog. Pflegepläne verwenden ein Dokumentmotiv statt des bisherigen Rechnungsmotivs. Eigene Widget-Anordnungen anderer Bereiche werden nicht verändert.

Die Startseite bündelt 39 vorhandene Hauptziele in acht Bereichskarten. Das Raster berücksichtigt die tatsächlich verfügbare Inhaltsbreite und Schriftvergrößerung mit einer bis drei Spalten. Vorhandene CareSuite-Liquid-Komponenten, Abstände, Farben und Schriftstile bleiben die Grundlage. Die Navigation bleibt auch bei fehlgeschlagenen Kennzahlenabfragen sichtbar. Die bisherigen Kennzahlen und Prioritäten bleiben erhalten; doppelte alte Bereichslisten werden auf dieser Startseite ausgeblendet.

## Zugriffe

Die Modulsperre wird gemeinsam für Web und native Quellfassung aufgehoben; diese Veröffentlichung erzeugt kein signiertes App-Paket. Die Sperre für Stationär bleibt bestehen. Pflege verwendet weiterhin den vorhandenen Mandanten-Modulzugang, Office-/Pflege-Zugang, Einzelrechte und registrierten Rollen. Die sichtbaren Hauptziele werden ausdrücklich aufgelistet, unbekannte Katalogziele erhalten keine pauschale Freigabe. Zurückbehaltene Aktionen prüfen die aktuelle Rolle, Rechte und den Mandanten erneut vor dem Öffnen.

Es werden keine Produktionsdatenbank-Migrationen oder neuen RPC-/Tabellenrechte ausgeführt. Insbesondere werden private Staging-Schreibfunktionen durch die sichtbare Oberfläche nicht produktiv freigegeben. Die eigenständige Freigabe von Leistungskatalogen in Office bleibt von der Modulnavigation getrennt. Sichtbarkeit belegt weder die Verfügbarkeit jeder klinischen Serverfunktion noch eine pflegefachliche Gesamtabnahme.

## Prüfung und Veröffentlichung

Der abschließende gezielte Lauf besteht mit **261 Prüfungen in zwölf Vitest-Suiten**. Enthalten sind Modul-/Rollenfreigabe, Widget-Katalog, Native-Navigation, bestehende Pflegeplanansichten sowie zehn neue Startseiten-/Dashboard-Modell- und Komponentenprüfungen. Die Teilmengen früherer Läufe werden nicht addiert. Der vollständige Node-Lauf besteht mit **15.189 Fällen, null Fehlern und null übersprungenen Fällen**. Nach der ausdrücklichen Pflege-Freigabe wurden veraltete Sperrerwartungen in den Unternehmen-/Registrierungsfixtures aktualisiert; deren drei Suiten bestehen mit 38 Fällen. Eine historische Familienportal-Fixture verwendet nun ihren ausdrücklich gesetzten Prüfzeitpunkt auch für Fähigkeitsprüfungen und prüft weiterhin die tatsächliche Ablaufablehnung. Laufzeitrechte wurden dadurch nicht verändert. Die genannten Testauswahlen überlappen und werden nicht addiert. Web-/Native-Quellabgleich und der vollständige Produktionsbuild sind eigene Prüfungen. Der Vercel-Produktionsbuild verwendet unverändert `npm run build:web:production` und veröffentlicht erst nach erfolgreichem Abschluss nach `dist`.

Eine tatsächliche angemeldete Browser- und Geräteabnahme ist noch offen: Der vorhandene Prüfbrowser erreicht die CareSuite-Verwaltungsanmeldung, besitzt aber keine angemeldete Sitzung. Komponenteninteraktionen und Rasterberechnungen ersetzen diese sichtbare Abnahme nicht. Die Oberfläche enthält keine erfundenen Live-Fallzahlen und keinen aus Testzahlen abgeleiteten Fertigstellungsprozentsatz.
