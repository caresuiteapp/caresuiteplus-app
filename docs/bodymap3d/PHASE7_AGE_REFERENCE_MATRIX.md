# Phase 7 – acht altersabhängige technische 3D-Referenzkörper

Phase 7 erweitert den selbst entwickelten GLB-Bestand in einem großen
Mehrmodellblock von zwei auf zehn technische Referenzkörper.

## Neue Varianten

- Junger Erwachsener · männlich
- Junger Erwachsener · weiblich
- Kind · männlich
- Kind · weiblich
- Kleinkind · männlich
- Kleinkind · weiblich
- Baby · männlich
- Baby · weiblich

Jede Variante ist ein echtes GLB-2.0-Dokument mit eigener Variant-ID,
eingebetteten Materialien, Normalen, UV-Koordinaten und mindestens 113
separat anklickbaren Oberflächenzonen.

## Proportionale Altersprofile

Die Modelle werden nicht durch eine einheitliche Gesamtskalierung erzeugt.
Eine deterministische Landmarkenabbildung transformiert getrennt:

- Boden und Knöchel
- Knie
- Becken
- Schulterlinie
- Schädeloberkante

Zusätzliche Zonenprofile steuern Kopf, Rumpf, Becken, Extremitäten,
Hände/Füße sowie äußere Genitalanatomie. Dadurch besitzen Baby, Kleinkind,
Kind und junger Erwachsener unterschiedliche Kopf-Körper- und
Extremitätenverhältnisse.

## Präpubertäre Brustanatomie

Die weiblichen Varianten Baby, Kleinkind und Kind erhalten ausdrücklich keine
entwickelten Brustkonturen und keine Warzenhöfe des Erwachsenenmodells.
Stattdessen gelten Brustkorb, linke/rechte Brustwand und Brustwarzen als
präpubertärer Oberflächenvertrag. Die Variante junger Erwachsener verwendet
den postpubertären Brustvertrag.

## Sensible äußere Anatomie

Männliche und weibliche äußere Genitalzonen bleiben getrennt anklickbar.
Ihre Proportionen werden altersabhängig reduziert. Es handelt sich
ausschließlich um technische äußere Oberflächenreferenzen. Eine
fachmedizinische, pädiatrische und sensible Prüfung steht aus.

## Dekubitus

Alle acht Modelle enthalten unter anderem separate Zonen für:

- Hinterhaupt und Ohren
- Schulterblätter und Wirbelsäule
- Kreuzbein und Steißbein
- Gesäß und Sitzbeinregionen
- Ellenbogen und Knie
- Innen- und Außenknöchel
- Fersen und Fußsohlen

## Freigabesicherheit

Jedes GLB trägt:

- `referenceModel=true`
- `selfDeveloped=true`
- `medicallyReviewed=false`
- `pediatricAnatomyReviewed=false`
- `sensitiveAnatomyReviewed=false`
- `safeForClinicalRelease=false`

Der produktive Patientenrenderer akzeptiert weiterhin nur
`reviewStatus=released`. Alle zehn vorhandenen GLBs sind daher ausschließlich
in der internen technischen Werkbank sichtbar.

## Reproduzierbarkeit und QA

Phase 7 erzeugt:

- acht GLBs und acht Qualitätsberichte
- acht Vieransichten als PNG
- acht semantische QA-Manifeste
- acht SVG-Quellprojektionen
- insgesamt 32 visuelle Vergleichsansichten

Die portable Prüfung reproduziert alle Artefakte in einem temporären
Verzeichnis und vergleicht GLBs bytegenau sowie JSON semantisch.
