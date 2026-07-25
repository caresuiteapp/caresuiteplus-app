# CareSuite Bodymap 3D – medizinischer Mesh-Vertrag v1

Dieser Ordner nimmt ausschließlich selbst entwickelte technische
Referenzmodelle und fachlich freigegebene GLB-Dateien auf. Ein Mesh wird in der
produktiven Patienten-Bodymap erst mit dem Status `released` aktiviert.
Registrierte Stände mit `technical-review` oder `medical-review` sind nur in
der geschützten internen Mesh-Werkbank sichtbar.

## Technische Referenzkörper

- `body-erwachsener-maennlich-v2.glb`: 113 Oberflächenzonen
- `body-erwachsener-weiblich-v2.glb`: 118 Oberflächenzonen
- `body-junger-erwachsener-maennlich-v2.glb`: 113 Oberflächenzonen
- `body-junger-erwachsener-weiblich-v2.glb`: 118 Oberflächenzonen
- `body-kind-maennlich-v2.glb`: 113 Oberflächenzonen
- `body-kind-weiblich-v2.glb`: 116 Oberflächenzonen
- `body-kleinkind-maennlich-v2.glb`: 113 Oberflächenzonen
- `body-kleinkind-weiblich-v2.glb`: 116 Oberflächenzonen
- `body-baby-maennlich-v2.glb`: 113 Oberflächenzonen
- `body-baby-weiblich-v2.glb`: 116 Oberflächenzonen

Alle zehn sind selbst entwickelte technische Referenzmeshes mit Normalen,
UV-Koordinaten und eingebetteten Materialien. Sie sind **nicht medizinisch
freigegeben** und werden ausschließlich in der internen Mesh-Werkbank als
`technical-review` angezeigt.

Die acht Altersreferenzen verwenden getrennte proportionale Landmarken für
Beine, Becken, Schultern und Kopf. Präpubertäre weibliche Varianten besitzen
keine entwickelten Brustkonturen.

## Koordinatensystem

- Einheit: Meter
- Y-Achse: oben
- Z-Achse: vorne
- Ursprung: Bodenmitte zwischen den Füßen
- Pose: klinisch neutrale A-Pose
- Transformationen müssen vor dem Export angewendet sein

## Anatomische Treffflächen

Jede anklickbare Oberfläche benötigt entweder:

- den Mesh-Namen `zone__<anatomical-zone-id>`, oder
- `userData.anatomicalZoneId = "<anatomical-zone-id>"`

Die IDs stammen aus `assets/bodymap3d/v1/model-manifest.json`. Ein Mesh ohne
Zonen-ID bleibt sichtbar, erzeugt aber bewusst keinen medizinischen Treffer.

## Materialien

Materialien, die durch die ausgewählte Hautfarbe getönt werden dürfen, beginnen
mit `skin` oder tragen `userData.bodymapSkinMaterial = true`. Schleimhäute,
Augen, Haare, Nägel und klinisch relevante Farbstrukturen dürfen dieses Kennzeichen
nicht erhalten.

## Freigabereihenfolge

1. Mesh vollständig und technisch valide
2. Einheiten, Achsen, Ursprung und Polygonbudget geprüft
3. Zonenabdeckung und Marker-Reprojektion geprüft
4. Anatomie fachmedizinisch geprüft
5. Intimbereiche gesondert geprüft
6. Alle 18 Vergleichsbilder ohne Browserfehler erzeugt
7. Erst danach Status `released`

## Lokale Werkzeuge

- `npm run bodymap3d:mesh:validate -- --file=... --variant=...`
- `npm run bodymap3d:mesh:register -- --file=... --variant=...`
- `npm run bodymap3d:mesh:calibration`
- `npm run bodymap3d:mesh:adult-male-reference`
- `npm run bodymap3d:mesh:adult-female-reference`
- `npm run bodymap3d:mesh:age-references`
- `npm run bodymap3d:mesh:verify-portable`
- `npm run bodymap3d:mesh:verify-female-portable`
- `npm run bodymap3d:mesh:verify-age-portable`
- `npm run bodymap3d:mesh:render-reference-qa`
- `npm run bodymap3d:mesh:render-female-reference-qa`
- `npm run bodymap3d:mesh:render-age-reference-qa`
- `npm run bodymap3d:mesh:capture-workbench`

Die Registrierung ist ohne `--write` immer nur lesend. Eine direkte
CLI-Freigabe als `released` ist gesperrt.
