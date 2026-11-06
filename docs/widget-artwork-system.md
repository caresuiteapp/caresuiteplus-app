# Eigene Motive für alle Widget-Funktionen

## 3D-Originale und schrittweise Veröffentlichung ab 06.11.2026

Die wiederhergestellten 3D-Originale haben Vorrang vor den bisherigen Reliefgrafiken.
`widgetRasterArtworkManifest.shared.json` ordnet jede Funktion exakt einem Original
zu. Web und native App verwenden dieselben PNG-Dateien unter `public/widget-artwork`.
Der 1.254 × 1.254 Pixel große RGBA-Master bleibt bytegleich erhalten; die kleineren
192- und 512-Pixel-Dateien dienen Navigation und kleinen Bildflächen. Web wählt die
Auflösung über `srcset`; die App bündelt dieselben Dateien über statische Requires.

Die Veröffentlichung erfolgt in drei getrennten, jeweils geprüften Paketen:

1. Office und Assist: 36 zugeordnete Originale und gemeinsame Darstellung.
2. Pflege, Stationär und Beratung: 59 zugeordnete Originale.
3. Weitere Bereiche: 58 zugeordnete Originale.

Für das Importieren genau eines Pakets dient
`python3 scripts/import-widget-originals.py ARCHIV --part office-assist|care|remaining`.
Das Originalarchiv selbst ist kein Buildbestandteil. Das Manifest und die Dateien
liegen mit dem jeweiligen Commit im Repository. Der Releasecheck prüft die Hashes,
Auflösungen, Transparenz, eigenständige Zuordnung und die statischen App-Imports.

Die Ergänzung vom 06.11.2026 schließt die acht Lücken für Einstellungen, Profil,
Support, Feature Flags, Wohnbereiche, Zimmer, Übergabe und Übergabeberichte mit
eigenen Motiven. `/beratung/arbeitsplatz` und der dorthin umleitende Einstieg
`/beratung` verwenden dasselbe vorhandene Beratungsoriginal. Unterfunktionen wie
Protokolle behalten ihre eigenen Bilder.

Die folgenden Regeln für automatische Grafiken gelten nur als vorläufige Hilfe
bei neu hinzukommenden Entwicklungszielen. Sie ersetzen kein freigabefähiges
3D-Original für eine Katalogfunktion.

Jede Funktion besitzt ein eigenes Hauptmotiv mit einem passenden Kontextobjekt.
Ein fertiges Bild darf nicht für eine andere Funktion verwendet werden. Notizen,
Dokumentation, Dokumentenablage, Vorlagen, Unterschriften und Nachweise bleiben
unterscheidbar. Gleiches gilt für die Nachrichtenarten und Google-Dienste.

## Automatische Gestaltung

`DesktopCatalogArtwork` ist der gemeinsame Einstieg für Desktop, Navigation,
Apps, Widget-Auswahl und Vorschläge. `widgetArtworkIdentity.shared.ts` vereinigt
echte Aliasse und erhält die fachlichen Query-Ziele. Kampagnen, Suchbegriffe,
Monate und Personen-IDs bestimmen das Motiv nicht.

`widgetArtworkTheme.shared.ts` bestimmt Hauptmotiv, Kontext und Modulfarben.
Der SVG-Generator zeichnet daraus eine eigene Reliefgrafik mit transparentem
Außenbereich. Die Masterfläche beträgt 2048 × 2048; als Vektor bleibt die Grafik
auch bei höherer Pixeldichte scharf. Web und native App verwenden dieselben
Pfade und Farben. Es werden keine Bilder zur Laufzeit extern erzeugt oder geladen.

Ein neues Ziel im vorhandenen App-Katalog ist bereits automatisch als Widget
verfügbar. Es erhält sofort eine Grafik aus seinem Funktionsthema und seiner
stabilen Identität. Für neue fachliche Begriffe die semantischen Regeln ergänzen.
Die automatische Grafik ist kein Ersatz für ein eigenes 3D-Original und die
visuelle Prüfung vor Freigabe.

## Verbindliche Erweiterung und Prüfung

1. Die fachliche Zielroute festlegen. Bei Query-Navigation neue semantische
   Dimensionen in der Identitätsfunktion aufnehmen.
2. Passendes Hauptmotiv und Kontextobjekt festlegen. Bei neuen Fachgebieten eine
   eigene Form in `WIDGET_ARTWORK_PATHS` ergänzen. Bloße Farbänderungen begründen
   kein neues Motiv. Unterschiedliche Funktionen dürfen dieselbe Kombination
   aus Hauptmotiv und Kontext nicht verwenden.
3. Ein eigenes transparentes 3D-PNG erzeugen und mit eindeutiger Identität ins
   Originalmanifest sowie die Web-/Native-Assetzuordnung aufnehmen. Das Ergebnis
   in kleinen Navigationssymbolen und großen Widgets ansehen.
   Überschriften stehen außerhalb der Grafik. Keine Schrift oder Datenwerte in
   die Illustration einbauen. Umrandungen und Schatten dürfen nicht abschneiden.
4. `npm run verify:widget-artwork:release` sowie die betroffenen Interaktions-
   und Navigationstests ausführen. Der Produktionsbuild führt die Motivprüfung
   automatisch mit aus.

Die Prüfung untersucht die echten Kataloge für Web, Android und iOS einschließlich
Stationär und Beratung mit aktivierter und deaktivierter Beratungsfreigabe. Jeder
Eintrag muss zu einem 3D-Original aufgelöst werden; SVG-Grafiken lassen die
Releaseprüfung fehlschlagen. Sie prüft Motive und fertige Zeichnungen auf Doppelungen,
vollständige Grafikpfade, Mastergröße, verbotene externe Inhalte und Plattform-
Unterschiede. Sie verändert keine Berechtigungen und gibt keine gesperrten Module
frei. Browserprüfungen belegen die Optik getrennt von den Funktionsprüfungen.
