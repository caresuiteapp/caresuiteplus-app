# Mobile Verwaltung: kompakter Arbeitsplatz und erreichbare Unterseiten

## Verhalten

- Unter 900 CSS-Pixeln Breite entspricht 100 % Textgröße im internen Arbeitsplatz
  der bisherigen 90-%-Stufe. Die Schriftvergrößerung bleibt verfügbar; mobile und
  breite Ansichten speichern ihre Auswahl getrennt. Bestehende 90/100-%-Werte
  werden auf den neuen mobilen Ausgangswert übernommen. Größere gewählte Stufen
  bleiben ausgewählt. Anmeldung, öffentliche Seiten und separate Portale haben
  weiterhin ihren eigenen bisherigen Ausgangswert.
- Die mobile Bedienleiste ist zentriert. Arbeitsplatzbezeichnung, Aktiv-Zähler
  und Bearbeiten stehen kompakt nebeneinander. Widgets, Karten und Innenabstände
  nutzen den schmalen Bereich besser; zentrale Schaltflächen bleiben mindestens
  44 CSS-Pixel hoch.
- Verschachtelte Fachseiten erben die verfügbare Popup-Höhe, statt erneut eine
  volle Browserhöhe zu belegen. Listen und Formulare haben dadurch einen
  begrenzten, erreichbaren Scrollbereich. Breite Tabellen erlauben horizontale
  und vertikale Touch-Gesten. Kleine Fenster und Querformat bleiben bedienbar.
- Die Zeiterfassung zeigt auf mobilen Webansichten einen kurzen Kopf mit beiden
  Aktionen; ihre Tab-Leiste lässt sich weiterhin horizontal scrollen.
- Eingabeschrift bleibt mindestens 16 CSS-Pixel groß, um automatisches
  Eingabe-Zoomen auf mobilen Browsern zu vermeiden. Android-spezifische Ansichten
  und das Startvideo wurden nicht geändert.

## Prüfung am 30. September 2026

206 Routendateien in `app/office` und `app/business/office` wurden auf ihre
gemeinsamen Layout- und Scroll-Komponenten untersucht. Das ist eine strukturelle
Abdeckung, keine vollständige Prüfung jedes angemeldeten Geschäftsablaufs.

Die vorhandenen React-Native-Web-Komponenten wurden mit synthetischen Daten und
gesperrtem API-Zugriff in Chromium gerendert: Startseite, Formular, Datenliste,
AutoScrollView, Modulübersicht, breite Tabelle, Master/Detail, Personalübersicht
mit Kennzahlen, beide verschachtelten Zeiterfassungs-Layouts und Nachrichten.

122 Browserprüfungen bestanden: diese elf Layoutfälle in elf Konfigurationen
sowie eine echte Touch-Gestenprüfung für beide Achsen. Geprüfte Fenstergrößen:
320×568, 360×740, 390×844, 430×932, 768×1024, 844×390, 1280×500 und 1440×900;
zusätzlich 150 % Textgröße bei 320×568, 390×844 und 1440×900. Kontrollen umfassen
Seitenüberlauf, nutzbare Scrollhöhen, Erreichbarkeit der letzten Einträge mit
Mausrad, Anklicken der unteren Formularaktion, Navigation und Bearbeiten.
Screenshots schmaler und breiter Ansichten wurden zusätzlich visuell geprüft.
Die abschließende Startseitenprüfung bestand erneut in allen elf Konfigurationen.

Die Übernahme einer alten 90-%-Einstellung, Vergrößern, Neuladen, Wechsel zwischen
mobil und breit sowie Zurücksetzen auf den neuen 100-%-Wert wurden im Browser
geprüft. 70 bestehende bzw. ergänzte gezielte Vitest-Prüfungen bestanden.

Der vollständige Typecheck ist bereits im Ausgangsstand nicht grün: 39
vorhandene Diagnosen im Ausgangsstand, dieselben 39 nach der Änderung; keine
zusätzlichen Diagnosen. Bei diesem Vergleich werden verschobene Zeilen- und
Spaltennummern normalisiert. Zwei schon vorher veraltete Erwartungen des
Startseiten-Navigationstests wurden an die bereits vorhandenen Ziele angepasst.

`npm run build:web:production` ist erfolgreich abgeschlossen. Im exportierten
Web-Bundle ist die neue mobile Größensteuerung enthalten. Die Exportprüfungen
für Navigation, lokale Kalender-Erkennung und Neo-Sprachausgabe bestanden.

Nicht belegt sind echte iPhone-/Safari-Gerätetests, Bildschirmtastatur-Verhalten
und alle angemeldeten Fachabläufe mit produktiven Daten. Die Layoutprüfungen
ändern keine produktiven Datensätze.
