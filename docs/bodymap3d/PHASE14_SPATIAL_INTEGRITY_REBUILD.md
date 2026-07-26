# Bodymap 3D · Phase 14 · räumliche Integrität

## Anlass

Die produktive Phase-13-Ansicht zeigte neben der Real-Human-Oberfläche Teile
des älteren klinischen Interaktionsmeshs sichtbar an. Besonders betroffen
waren Augen, Ohren, Finger, Zehen, Extremitäten-Proxys, Genitalzonen und
weitere anatomische Trefferflächen.

Die bisherige Prüfung bestätigte gültige GLB-Dateien und zusammenhängende
Dreiecke, prüfte aber nicht, ob das unsichtbare Interaktionsmesh im Browser
tatsächlich unsichtbar blieb.

## Korrektur

- Alle historischen Zonenkennzeichnungen werden als Interaktionsmesh erkannt:
  `bodymapInteractionProxy`, `technicalReference`, `anatomicalZoneId`,
  `zoneId` und `zone__*`.
- Die Materialien dieser Trefferflächen werden vollständig vom Rendering
  ausgeschlossen. Die Meshes bleiben für Raycasting und die Übertragung
  bestehender Befunde erhalten.
- Sichtbare Real-Human-Assets erhalten eine Hash-basierte URL-Versionierung.
  Browser und CDN können dadurch keine frühere GLB-Version wiederverwenden.
- Alle 30 Real-Human-GLBs wurden neu erzeugt.
- Haut-Normalen und prozedurale Farbmikrostruktur wurden reduziert.
- Externe Anatomiedetails werden nur noch gegen die tatsächlichen
  Körpervertices positioniert.
- Die männliche Ruheanatomie wurde proportional verkleinert.

## Neue Prüfbarrieren

`npm run bodymap3d:real-human:verify-spatial` prüft für alle 30 Varianten:

- sichtbaren Hauptkörper,
- räumliche Grenzen aller sichtbaren Zusatzteile,
- unplausibel große Zusatzgeometrien,
- vollständige Erkennbarkeit aller klinischen GLB-Teile als unsichtbare
  Trefferflächen.

Zusätzliche Laufzeittests bestätigen, dass unsichtbare Materialien keine
Farbe oder Tiefe schreiben, aber weiterhin durch Raycasting getroffen werden.

## Freigabestatus

Die Phase behebt den nachgewiesenen Rendering- und Integrationsfehler. Sie
erteilt keine medizinische Freigabe. Die medizinische Einzelprüfung bleibt
gesperrt, bis die korrigierten Körper im produktiven WebGL-Viewer visuell
abgenommen wurden.
