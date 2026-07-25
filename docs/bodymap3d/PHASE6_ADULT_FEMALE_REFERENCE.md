# Phase 6 – selbst entwickelter Referenzkörper „Erwachsen · Weiblich“

## Ergebnis

Phase 6 ergänzt die 18er-Bodymap-Matrix um das zweite echte, im
CareSuite-Repository erzeugte GLB-Asset:

`/bodymap3d/v2/body-erwachsener-weiblich-v2.glb`

Das Modell ist eine dreidimensionale technische Referenz mit triangulierter
Oberfläche, Normalen, UV-Koordinaten, sechs eingebetteten Materialien und 118
separat anklickbaren Körperzonen. Es ist weder fotorealistisch noch
fachmedizinisch freigegeben.

Im normalen Patientenbetrieb bleibt deshalb weiterhin der parametrische
Sicherheitsfallback aktiv. Das GLB wird nur in der internen Mesh-Werkbank
angezeigt.

## Technische Kennzahlen

| Merkmal | Stand |
| --- | ---: |
| Registrierte technische GLB-Varianten | 2 von 18 |
| Weibliche Oberflächenzonen | 118 |
| Vertices | 27.197 |
| Dreiecke | 47.532 |
| Materialien | 6 |
| Nennkörpergröße | 1,72 m |
| Maßeinheit | Meter |
| Bodenursprung | Y = 0 |
| Ausrichtung | Y oben, Z vorne |
| Pose | klinische A-Pose |
| Medizinisch freigegeben | Nein |
| Produktiv freigegeben | Nein |

## Weibliche Körperproportionen

Der Referenzkörper besitzt gegenüber dem männlichen technischen Grundmodell:

- einen schmaleren Schulter- und Oberarmbereich,
- eine betonte Taille,
- ein breiteres Becken,
- breitere Sitzbein- und Gesäßregionen,
- angepasste Oberschenkel,
- separat aufgebaute Brustgeometrien.

Diese Unterschiede sind technische Entwicklungsparameter. Vor medizinischer
Verwendung müssen sie durch qualifizierte Fachpersonen geprüft und
gegebenenfalls korrigiert werden.

## Brustoberflächen

Je Körperseite sind getrennt anklickbar:

- Brust,
- Warzenhof,
- Brustwarze.

Damit können Befunde, Wunden, Rötungen, Druckstellen, postoperative Zustände,
Diagnosen, Maßnahmen und Verlaufsfotos positionsgenau zugeordnet werden. Die
Darstellung bleibt bis zur sensiblen anatomischen Fachprüfung gesperrt.

## Äußere weibliche Genitalanatomie

Technisch getrennte Zonen:

- Venushügel,
- linke und rechte große Schamlippe,
- linke und rechte kleine Schamlippe,
- Klitorisregion,
- Harnröhrenöffnung,
- Vaginalöffnung,
- Damm,
- Anus.

Die Bodymap dokumentiert sichtbare äußere Oberflächen. Sie bildet keine
inneren Organe oder einen vaginalen Innenraum ab. Sämtliche Intimzonen tragen
eine ausdrückliche medizinische und sensible Freigabesperre.

## Dekubitusrelevante Zonen

Wie das männliche Referenzmodell enthält die weibliche Variante gesonderte
Treffflächen für:

- Hinterhaupt und Ohren,
- Schulterblätter und Wirbelsäule,
- Kreuzbein und Steißbein,
- Gesäß und Sitzbeinregionen,
- Ellenbogen und Knie,
- Innen- und Außenknöchel,
- Fersen und Fußsohlen.

## Erzeugung und portable Prüfung

```bash
npm run bodymap3d:mesh:adult-female-reference
npm run bodymap3d:mesh:render-female-reference-qa
npm run bodymap3d:mesh:verify-female-portable
```

Die portable Prüfung:

- vergleicht das GLB bytegenau,
- vergleicht Qualitätsbericht und QA-Manifest semantisch,
- prüft PNG-Signatur, Abmessungen und Mindestinhalt,
- prüft Zonen-, Vertex-, Dreiecks- und Freigabeangaben im SVG,
- schreibt ausschließlich in ein temporäres Verzeichnis,
- funktioniert unabhängig von Windows- oder Linux-Zeilenenden.

## Vieransichten-QA

Das geprüfte Vergleichsbild liegt unter:

`docs/bodymap3d/qa/adult-female-four-view.png`

Interne WebGL-Werkbank:

`/bodymap-mesh-workbench?variant=body-erwachsener-weiblich`

## Freigabesperren

Das GLB trägt:

- `referenceModel=true`
- `selfDeveloped=true`
- `calibrationOnly=false`
- `medicallyReviewed=false`
- `sensitiveAnatomyReviewed=false`
- `safeForClinicalRelease=false`

Das Manifest trägt zusätzlich:

- `reviewStatus=technical-review`
- `medicalReleaseBlocked=true`

Der Patientenrenderer akzeptiert weiterhin ausschließlich
`reviewStatus=released`.

## Noch offene medizinische Arbeit

Vor einer produktiven Freigabe sind Gesamtproportionen, Hautoberflächen,
Gesicht, Augen, Ohren, Mund, Hände, Füße, Brüste, äußere Genitalanatomie,
Gesäß, Damm, Anus, Dekubituszonen, Hauttöne, Raycasting, Markerpositionen sowie
Web und Android fachlich abzunehmen.

Der Status bleibt eindeutig: **technisch prüfbar, medizinisch nicht
freigegeben**.
