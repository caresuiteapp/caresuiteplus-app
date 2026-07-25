# CareSuite Bodymap 3D – medizinischer Mesh-Vertrag v1

Dieser Ordner nimmt ausschließlich selbst entwickelte und fachlich freigegebene
GLB-Dateien auf. Ein Mesh wird erst aktiviert, wenn sein Eintrag in
`assets/bodymap3d/v2/medical-mesh-manifest.json` einen `assetPath` besitzt und
mindestens den Status `technical-review` trägt.

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

Die Registrierung ist ohne `--write` immer nur lesend. Eine direkte
CLI-Freigabe als `released` ist gesperrt.
