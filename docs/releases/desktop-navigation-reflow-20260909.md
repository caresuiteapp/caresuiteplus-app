# Web-Desktop: Navigation und Widget-Raster

## Rückmeldung und Ursache

Kevins Bildschirmaufnahme vom 9. September zeigt beim wiederholten Ein- und Ausklappen der Navigation vorübergehend drei Widget-Spalten, freien Platz rechts sowie einen Menü-Griff über den linken Widgets.

Die Navigation animierte ihre Breite über React Native Animated. Gleichzeitig wurden feste Kartenbreiten aus nachlaufenden onLayout-Messungen berechnet und in einer Flex-Wrap-Liste verwendet. Damit konnten die Karten einer Messung vor dem aktuellen Animationsschritt entsprechen und eine vollständige Reihe vorübergehend umbrechen. Der Menü-Griff war unabhängig vom Inhaltslayout absolut positioniert.

## Änderung

- Ein Browser-Raster teilt Navigation und Arbeitsfläche auf. Eine CSS-Transition steuert die reservierte Navigationsspalte; der Browser verteilt Widget-Spalten und verbleibende Breite im selben Layoutdurchlauf.
- Das Widget-Raster nutzt Container Queries und gemeinsame Spalten mit minmax(0, 1fr). Nachlaufende JavaScript-Messungen einzelner Kartenbreiten entfallen.
- Die zwölf Plätze bilden abhängig vom verfügbaren Arbeitsbereich eine, zwei, drei, vier oder sechs Spalten. Die Mindestbreiten berücksichtigen die gewählte Schriftgröße. Bildhöhen richten sich nach der verfügbaren Containerhöhe; bei Platzmangel bleibt Scrollen möglich.
- Das geschlossene Menü erhält links eine eigene schmale Spalte. Sein Öffnen-Knopf überlagert keine Widget-Titel oder Bildflächen mehr.
- Die Navigation behält während ihres Übergangs ihre innere Breite. Versteckte Steuerelemente sind inert; Escape schließt die Navigation und gibt den Fokus an den oberen Menüknopf zurück. Reduzierte Bewegung wird per Medienabfrage berücksichtigt.

## Umfang und Abnahme

Ausschließlich Web-Desktop-Dateien. Gespeicherte Auswahl, Hintergrund, Textgrößen, Standortwetter und Routen bleiben erhalten. Kein nativer Android-Code und keine produktiven Fachdaten werden geändert.

Die bereitgestellte Aufnahme und der Quellcode dienen zur Ursachenanalyse. Auf ausdrücklichen Nutzerwunsch keine Tests, kein Lint/Typecheck und keine Browser-Sichtprüfung der Änderung. Veröffentlichung über den vorhandenen Expo-Web-Build, Git und Vercel; manuelle Abnahme durch Kevin danach.
