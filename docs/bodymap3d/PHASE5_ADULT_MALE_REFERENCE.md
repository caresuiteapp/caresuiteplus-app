# Phase 5 – selbst entwickelter Referenzkörper „Erwachsener · Männlich“

## Ergebnis

Phase 5 liefert das erste echte, im CareSuite-Repository erzeugte GLB-Asset für
die 18er-Bodymap-Matrix:

`/bodymap3d/v2/body-erwachsener-maennlich-v2.glb`

Das Modell ist kein Platzhalterquader und keine zweidimensionale Abbildung. Es
besteht aus einer vollständig dreidimensionalen, triangulierten
Oberflächengeometrie mit Normalen, UV-Koordinaten, Materialien und
anatomischen Zonen.

Der Stand ist als **technischer Referenzkörper** registriert. Er ist noch nicht
fachmedizinisch freigegeben und wird daher ausschließlich in der internen
Mesh-Werkbank gerendert. In der produktiven Patienten-Bodymap bleibt der
parametrische Sicherheitsfallback aktiv.

## Technische Kennzahlen

| Merkmal | Stand |
| --- | ---: |
| Körpervarianten mit registriertem GLB | 1 von 18 |
| Anatomische Oberflächenzonen | 113 |
| Vertices | 25.908 |
| Dreiecke | 45.260 |
| Materialien | 6 |
| Nennkörpergröße | 1,72 m |
| Maßeinheit | Meter |
| Bodenursprung | Y = 0 |
| Ausrichtung | Y oben, Z vorne |
| Pose | klinische A-Pose |
| Medizinisch freigegeben | Nein |
| Produktiv freigegeben | Nein |

## Enthaltene Oberflächen

### Kopf und Gesicht

- Kopfhaut und Hinterhaupt
- Gesicht
- beide Augen mit Sklera, Iris und Pupille
- beide Ohren
- Nase
- Ober- und Unterlippe
- Kinn
- Halsvorderseite

### Rumpf und Rücken

- Brustkorb und beide Brustmuskelregionen
- Brustwarzen
- Bauch und Bauchnabel
- Becken
- Schlüsselbeine und Schulterblätter
- Brust- und Lendenwirbelsäule
- Kreuzbein und Steißbein

### Arme, Hände, Beine und Füße

- Schultern, Oberarme, Ellenbogen, Unterarme und Handgelenke
- Handflächen, Daumen, alle Finger und einzelne Fingernägel
- Oberschenkel, Knie, Unterschenkel und Waden
- Innen- und Außenknöchel
- Fußrücken, Fußsohlen, Fersen, alle Zehen und einzelne Zehennägel

### Gesäß, Damm und äußere männliche Genitalanatomie

- linke und rechte Gesäßhälfte
- beide Sitzbeinregionen
- Damm und Anus
- Penisschaft, Glans und Harnröhrenöffnung
- linke und rechte Skrotalregion

Diese sensiblen Bereiche sind technisch separat anklickbar. Ihre
fachmedizinische Detailprüfung ist ausdrücklich noch offen.

## Dekubitusrelevante Zonen

Die technische Oberfläche enthält gesonderte Zonen für Hinterhaupt, Ohren,
Schulterblätter, Wirbelsäule, Kreuzbein, Steißbein, Gesäß, Sitzbeinregionen,
Ellenbogen, Knie, Knöchel, Fersen und Fußsohlen.

## Deterministische Erzeugung

```bash
npm run bodymap3d:mesh:adult-male-reference
```

Der Generator schreibt das GLB-Asset und den maschinenlesbaren
Qualitätsbericht. Tests verlangen bytegenaue Wiederholbarkeit und vergleichen
das eingecheckte Asset mit dem aktuellen Generatorergebnis.

## Vieransichten-QA

```bash
npm run bodymap3d:mesh:render-reference-qa
```

Das geprüfte Vergleichsbild liegt unter:

`docs/bodymap3d/qa/adult-male-four-view.png`

Die echte WebGL-Werkbank bleibt verfügbar:

```bash
EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH=true npm run web
```

Route:

`/bodymap-mesh-workbench?variant=body-erwachsener-maennlich`

## Freigabesperren

Das GLB trägt unter anderem:

- `referenceModel=true`
- `selfDeveloped=true`
- `calibrationOnly=false`
- `medicallyReviewed=false`
- `sensitiveAnatomyReviewed=false`
- `safeForClinicalRelease=false`

Das Manifest trägt zusätzlich:

- `reviewStatus=technical-review`
- `medicalReleaseBlocked=true`

Der Produktionsrenderer akzeptiert nur `reviewStatus=released`. Die interne
Werkbank darf technische Referenzmeshes anzeigen.

## Noch offene medizinische Arbeit

Vor einer Freigabe sind mindestens Gesamtproportionen, Hautoberflächen,
Gesicht, Augen, Ohren, Mund, Hände, Füße, äußere Genitalanatomie, Gesäß, Anus,
Damm, Dekubituszonen, Marker/Raycasting, alle Hauttöne sowie Web und Android
fachlich abzunehmen.

Bis dahin ist der Status eindeutig: **technisch prüfbar, medizinisch nicht
freigegeben**.
