# Bodymap 3D Phase 10 · Kontinuierliche Oberfläche und Altersautomatik

Stand: 26.07.2026

## Ergebnis

Phase 10 erweitert die gemeinsame Bodymap für Pflege und Stationär auf acht
medizinisch sinnvoll getrennte Altersgruppen:

| Altersgruppe | Vollendetes Alter |
| --- | ---: |
| Baby | 0–11 Monate |
| Kleinkind | 1–5 Jahre |
| Kind | 6–12 Jahre |
| Jugendliche | 13–17 Jahre |
| Junger Erwachsener | 18–29 Jahre |
| Erwachsener | 30–64 Jahre |
| Senior | 65–84 Jahre |
| Hochbetagter Mensch | ab 85 Jahren |

Jede Altersgruppe besitzt ein männliches, weibliches und diverses Grundmodell.
Zusammen mit den sechs expliziten Erwachsenen-Divers-Konfigurationen werden
30 technische GLB-Dateien deterministisch erzeugt und geprüft.

## Automatische Auswahl

Die Bodymap liest das Geburtsdatum aus den Klient:innenstammdaten. Das
vollendete Alter wird kalender- und tagesgenau berechnet. Die passende
Altersgruppe wird beim Öffnen vorbelegt und bei einer Änderung des
Geburtsdatums aktualisiert. Ungültige oder zukünftige Daten lösen keine
automatische Auswahl aus.

Eine manuelle Abweichung ist weiterhin möglich. Der gespeicherte Befund trägt
die verwendete Altersgruppe und Modell-ID und bleibt damit revisionsfähig.

## Verlustfreier Alterswechsel

Ein Alterswechsel erzeugt keine neuen klinischen Befunde und löscht keine
bestehenden Daten. Identität und Inhalt der Datensätze bleiben erhalten:

- Befund-ID, Typ, Diagnose, Freitext und Behandlung
- Dekubitusklassifikation und vollständiges Assessment
- Maße, Schmerz, Exsudat, Wundrand und Umgebungshaut
- Fotos, Messfotos, Dokumente und Verlaufseinträge
- Zeitpunkte, Autor:innen und Statushistorie
- anatomische Zone und ursprüngliche Oberflächenkoordinate

Für die Darstellung auf dem neuen Körper wird der gelbe Pulsmarker anhand der
stabilen anatomischen Zonen-ID und UV-Oberflächenkoordinate auf das Zielmesh
projiziert. Dadurch bleibt beispielsweise ein Fersenbefund beim Übergang von
„Kind“ zu „Jugendliche“ an der entsprechenden Ferse sichtbar.

## 3D-Oberfläche

Die bisher getrennt sichtbaren technischen Körperteile werden von einer
zusammenhängenden, geglätteten Sichtoberfläche überdeckt. Die detaillierten
anatomischen Teilmeshes bleiben unsichtbar als präzise Klick- und
Raycasting-Zonen erhalten. Augen, Mund, Ohren, Brust- und Genitaldetails
bleiben gesonderte sichtbare Strukturen.

Die Referenzbilder dienen ausschließlich als Proportions-, Haltung- und
Silhouettenvorgabe. Kleidung wird nicht übernommen. Sensible Anatomie wird
klinisch neutral und nicht sexualisiert dargestellt.

## Freigabestatus

Alle 30 GLBs bestehen den technischen Vertrag für Dateiformat, Höhen,
Geometriebudget, UVs, Zonen und reproduzierbare Generierung. Sie bleiben
absichtlich als `technical-review` und `medicalReleaseBlocked` markiert.

Die kontinuierliche prozedurale Oberfläche ist ein deutlicher visueller
Zwischenschritt, jedoch noch kein fachmedizinisch abgenommenes,
fotorealistisches Human-Asset. Vor medizinischer Produktivfreigabe sind
weiterhin externe Anatomieprüfung, sensible Anatomieprüfung, pädiatrische,
adoleszente und geriatrische Prüfung sowie visuelle Mehransichten-QA
erforderlich.
