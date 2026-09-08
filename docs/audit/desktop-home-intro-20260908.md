# Desktop-Startseite und Web-Intro R4 – 08.09.2026

## Auftrag und Umsetzung

Die Nutzerrückmeldung fordert eine links angeordnete Navigation, separat zentrierte Widgets, lesbare Schrift, Überschriften über den Bildern und weniger leere Hintergrundfläche. Die rechte Bedienleiste soll auf Höhe der linken Infoleiste unter dem Logo liegen. Zusätzlich sollen die vorhandenen App-Videos beim Web-/Desktop-Start und bei jedem vollständigen Neuladen vor der Anmeldung abgespielt werden.

- Die Web-Startseite nutzt die Fensterbreite mit 24 px Außenabstand (kompakt 12 px). Die Navigation liegt links, das Raster wird separat in der übrigen Breite zentriert. Die gemeinsame maximale Rahmenbreite und die Skalierungsanimation des Rasters entfallen.
- Die große dunkle Hintergrundplatte entfällt. Kopf und Widgets haben jeweils eigene Flächen. Die Rasterspalten entstehen aus der tatsächlichen Inhaltsbreite, mindestens 300 px pro Karte bei normaler Schrift und bis zu sechs Spalten. Vergrößerte Schrift reduziert bei Bedarf die Spaltenzahl.
- Widget-Überschriften stehen vor dem Bild, mit 20 px Basisgröße und 28 px Zeilenhöhe; Hauptnavigation 17 px. Die oberen Leisten sind in breiten Fenstern unten bündig und jeweils mindestens 78 px hoch. Die Textgrößensteuerung bleibt auch im schmalen Fenster erreichbar.
- Das kompakte Menü öffnet als linke Dialogebene, schließt nach Navigation und verändert die gespeicherte Einstellung des breiten Menüs nicht. Alle Menüaktionen sind im Scrollbereich erreichbar. Ein geschlossenes breites Menü ist inert und nicht bedienbar.
- Entfernte Widgets werden nach Neuladen nicht mehr automatisch ergänzt; auch eine ausdrücklich leere Auswahl bleibt erhalten. Kontowechsel zeigen während des Ladens keine Auswahl des vorherigen Kontos. Bei Lesefehlern werden gespeicherte Einstellungen nicht überschrieben; Wiederholen ist möglich.
- Die Apps-Suche bietet einen leeren Trefferzustand mit Rücksetzen. Suche und Filter liegen im scrollbaren Inhalt des Centers.
- Die neue plattformspezifische `AppStartIntro.web.tsx` wird vom bereits vorhandenen Root-Wrapper automatisch aufgelöst. Die sechs unveränderten App-Videos werden anhand des Fensterformats einmalig ausgewählt und ohne Beschneiden oder Strecken wiedergegeben.
- Der Router bleibt unter dem Intro gemountet, sein Inhalt ist bis zum Videoende verborgen und inert. Der gemeinsame Bereitschaftskontext verzögert nachfolgende Begrüßungsabläufe. Der Abschluss wird nur im Arbeitsspeicher gehalten: vollständiges Neuladen startet erneut, interne Navigation und Root-Remount innerhalb desselben Dokuments nicht.
- Zunächst wird Wiedergabe mit Ton versucht. Bei einer Browser-Sperre folgt stummes Autoplay mit „Ton einschalten“; bei vollständiger Autoplay-Sperre gibt es „Startvideo abspielen“. Videoende gibt die Oberfläche frei; Medienfehler und eine maximale Startwartezeit von 20 Sekunden verhindern eine dauerhafte Sperre. Verspätete Wiedergabeantworten werden nach Freigabe ignoriert.
- Die Vorgaben für Desktop-Anordnung und Intro sind dauerhaft in `AGENTS.md` ergänzt.

## Verifikation

Alle Prüfungen verwenden ausschließlich bestehende lokale Abhängigkeiten auf ChristianLaptop.

- 41 Tests erfolgreich: 10 Rasterprüfungen, 7 Desktop-Interaktionstests, 8 neue Web-Intro-Tests und 16 bisherige Native-Intro/Fallback-Tests. Medienereignisse sind dabei simuliert; geprüft werden Ablauf, Sperrung, Freigabe und Fehlerbehandlung.
- Vollständige TypeScript-Prüfung: Exit-Code 0.
- Vollständiger Expo-Web-Export: Exit-Code 0, 702 statische Routen. Die neue Intro-Komponente ist im Web-JavaScript enthalten; der Intro-Inhaltsrahmen ist auch im HTML der Startseite vorhanden.
- Alle sechs ursprünglichen MP4-Dateien sind im Export vorhanden. SHA-256-Abgleich bestätigt jeweils eine byteidentische Exportdatei. Die Videos wurden weder neu erzeugt noch umkodiert.
- R4-Vorschau erfolgreich gebaut. Enthalten sind die tatsächliche Web-Startseite mit ihren Bildern, das echte Web-Intro und die bestehenden Registrierungs-, Unternehmens- und Support-Ansichten. Kontodaten und Dienste sind fiktiv; Profilbild-Upload und Live-APIs werden nicht ausgeführt.
- DOM-Prüfungen erfolgreich: Intro-Sperre und Freigabe, fünf Ansichten, Plattformnavigation, kompakte Unternehmensangaben und passendes Öffnen, Rückkehr zur Tabelle, Desktop-Überschrift vor Artwork mit 20 px Basisgröße, Navigation und Center sowie Umschalten bei 320/780/1440/2560/3440 px Fensterbreite.
- Der DOM-Prüfhost besitzt keine Layout-, Video-, Schriftlade- oder CSS-Animationsengine. Schriftbereitschaft, Medienereignisse und Animationsende werden ausdrücklich simuliert. Diese Ergebnisse belegen keine gerenderte Geometrie oder tatsächliche Video-/Tonwiedergabe.

## Vorschau und verbleibende Grenzen

Die bestehende Vorschau unter `%LOCALAPPDATA%\Temp\caresuite-company-preview\index.html` ist auf R4 aktualisiert. Vollständiges Neuladen startet das Intro. Danach führt der Link „Desktop“ zur überarbeiteten Startseite.

Die tatsächliche Darstellung von R4 und echte Browser-Videowiedergabe einschließlich Autoplay-Verhalten sind noch nicht visuell bestätigt. Die vorliegenden Nutzerscreenshots zeigen den vorherigen Stand. Die abgeschlossenen DOM-Prüfungen ersetzen diese Sichtprüfung nicht; insbesondere sind Balkenpositionen, Kartenbreiten, Umbrüche und Schriftgrößen bei verschiedenen Bildschirm-/Textgrößen noch am gerenderten Ergebnis zu bestätigen. Bei wenig Höhe bleibt der Widget-Bereich scrollbar; alle zwölf Widgets werden nicht durch Verkleinern auf eine Bildschirmhöhe gezwungen.

Die bereits dokumentierten angemeldeten Backend-Endabläufe und die übrigen Desktop-/Web-Arbeitsflächen bleiben offen. Ein erfolgreicher Export aller Routen ist keine vollständige Prüfung dieser Routen. Der separat aufgefallene gemeinsame `ScreenHeader` anderer Arbeitsflächen ist in diesem Schritt nicht geändert.

Keine Änderung der Native-Intro-Datei, Android-Oberflächen, Android-Konfiguration oder Abhängigkeiten; der geänderte Rasterhelfer wird im Anwendungscode ausschließlich von der Web-Startseite verwendet. Kein Android-Build, keine Installation, keine produktiven Datenänderungen, kein Push und keine Veröffentlichung. Der neue Startablauf ist vorbereitet, aber noch nicht auf caresuiteplus.app live.
