# App-Navigation, Apps & Widgets und Neo – 29.10.2026

## Änderungen

- Native Modulstacks werden nicht mehr in einen vom globalen Pfad abhängigen Web-Rahmen eingesetzt. Der Wechsel vom Desktop zu einer Fachseite konnte sonst den untergeordneten Navigator neu anlegen und dessen Ausgangsseite statt des gewählten Ziels anzeigen. RootShell und ScreenShell behalten die nativen Seitenköpfe.
- Ein nicht fokussierter Produktwächter darf keine Weiterleitung auslösen. Rollenprüfungen und Sperren nicht freigegebener Module bleiben aktiv.
- Der gemeinsame native CSS-Adapter wertet die tatsächliche Kartenmindestbreite auch innerhalb verschachtelter `min()`-/`calc()`-Ausdrücke aus. Zuvor fiel der Apps-&-Widgets-Katalog auf 180 statt 260 Pixel zurück. Nur die Scrollansicht darf schrumpfen; der Kataloginhalt behält seine natürliche Höhe.
- Navigationsbezeichnungen sind in Web und App kleiner. Android behält Wortgrenzen und die vollständigen Beschriftungen. Schriftvergrößerung und die mindestens 44 Pixel großen Bedienelemente bleiben erhalten.
- Neo startet oben mittig im reservierten Desktop-Kopfbereich, ist verschiebbar und auf allen nativen Desktop-Aliasrouten verfügbar. Verschieben, Beenden, Routenwechsel und Wechsel in den Hintergrund verwerfen vorgemerkte Aktionen. Eine vorübergehend inaktive Mikrofonabfrage darf den ersten Start fortsetzen, sobald die App wieder aktiv ist. Fehlende deutsche Offline-Sprachmodelle erhalten eine gezielte, vom Nutzer ausgelöste Ladeaktion. Aufnahme bleibt lokal; Seitenwechsel erfolgen nach der gesprochenen Bestätigung. Kein Chat und keine Texteingabe.

## Prüfungen

1. Neue Regressionstests reproduzierten vor der Korrektur den Verlust des inneren Navigators und die falsche Berechnung verschachtelter Kartenmindestbreiten.
2. 1.838 gezielte Tests bestanden: tatsächlicher Expo-Dateiselektor und Linking-Parser für die vorhandenen App-Seiten, imperative Menüziele aus Desktop/Office/QM, Navigator-Lebenszyklen, Desktop-Aktionen, Raster, Modal-Verträge und Neo-Abläufe.
3. Die vollständige TypeScript-Prüfung ist im bestehenden CI-System bestanden. Der lokale Versuch wurde an der Speichergrenze beendet. Ein zusätzlicher statischer Abgleich erfasste 464 Linkziele; Landingpage, Impressum und Karten-CSS liegen außerhalb des Expo-Routers und sind als vorhandene öffentliche Dateien beziehungsweise Rewrite-Ziele bestätigt.
4. Der Native-Quellenabgleich meldet 1.111 Module, 269 übertragene Routen und null veraltete Dateien. Die Web- und Native-Browserfixtures lassen sich mit den vorhandenen Abhängigkeiten bündeln.
5. Die bestehende CI-Darstellungsprüfung misst zusätzlich die Katalogspalten nach 2,1 Sekunden, Scrollen bis zum letzten Hintergrund, die vollständige Navigationsbezeichnung „Vorlageneinstellungen“ und Neos Position sowie sichtbare Gerätefehler. Die Sprachhardware ist in dieser Browserfixture ausdrücklich nicht verfügbar.
6. Der breite lokale Gesamtlauf enthält bereits auf dem unveränderten Ausgangscommit `0d7610d0` 14 fehlgeschlagene Prüfungen in neun Dateien: drei alte Serverbeleg-Mocks, zwei Medikamentendatenbank-Prüfungen und neun Erwartungen zu bisherigen Gestaltungs- und Routenvorgaben. Der Gesamtlauf ergab 15.131 bestandene, 14 fehlgeschlagene und drei übersprungene Tests. Alle 14 Fehler wurden separat auf dem unveränderten Ausgangsstand reproduziert. Diese Ausgangsfehler sind keine bestandene Gesamtprüfung. Die gezielten Prüfungen dieses Auftrags sind davon getrennt.

## Grenze des Nachweises

Browserbilder mit ausgewählten Native-Komponenten und simulierten Gerätebindungen ersetzen keinen Test auf dem betroffenen Android-Gerät. Insbesondere tatsächliches Touch-Scrolling, Mikrofon, installierter Sprachdienst und Audioausgabe benötigen einen Gerätetest mit einem neuen Paket. Dieser Änderungsstand erzeugt kein signiertes App-Paket; normale Pushes veröffentlichen weiterhin nur das Web und sammeln die App-Änderungen.

Die zusätzliche ältere Arbeitszeitaufnahme wurde anhand der Daten geprüft: Beim betroffenen Mitarbeitendendatensatz ist keine vertragliche Wochensollzeit (`employee_contract_settings.work_days`) hinterlegt. Die entsprechende Meldung darf keine erfundenen Sollstunden verdecken; es wurden keine Vertragswerte geändert.
