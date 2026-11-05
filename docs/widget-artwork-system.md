# Eigene Motive für alle Widget-Funktionen

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
Die automatische Grafik ist kein Ersatz für die visuelle Prüfung vor Freigabe.

## Verbindliche Erweiterung und Prüfung

1. Die fachliche Zielroute festlegen. Bei Query-Navigation neue semantische
   Dimensionen in der Identitätsfunktion aufnehmen.
2. Passendes Hauptmotiv und Kontextobjekt festlegen. Bei neuen Fachgebieten eine
   eigene Form in `WIDGET_ARTWORK_PATHS` ergänzen. Bloße Farbänderungen begründen
   kein neues Motiv. Unterschiedliche Funktionen dürfen dieselbe Kombination
   aus Hauptmotiv und Kontext nicht verwenden.
3. Das Ergebnis in kleinen Navigationssymbolen und großen Widgets ansehen.
   Überschriften stehen außerhalb der Grafik. Keine Schrift oder Datenwerte in
   die Illustration einbauen. Umrandungen und Schatten dürfen nicht abschneiden.
4. `npm run verify:widget-artwork:release` sowie die betroffenen Interaktions-
   und Navigationstests ausführen. Der Produktionsbuild führt die Motivprüfung
   automatisch mit aus.

Die Prüfung untersucht die echten Kataloge für Web, Android und iOS einschließlich
Stationär und Beratung. Sie prüft Motive und fertige Zeichnungen auf Doppelungen,
vollständige Grafikpfade, Mastergröße, verbotene externe Inhalte und Plattform-
Unterschiede. Sie verändert keine Berechtigungen und gibt keine gesperrten Module
frei. Browserprüfungen belegen die Optik getrennt von den Funktionsprüfungen.
