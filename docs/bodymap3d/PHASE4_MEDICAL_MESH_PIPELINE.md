# Phase 4 – medizinische 3D-Mesh-Pipeline

## Entscheidung

Die bestehende parametrische Bodymap bleibt als funktionsfähiger Fallback
erhalten. Sie wird nicht länger als Zielmodell weiterverfeinert. Medizinischer
Realismus wird ausschließlich über selbst entwickelte GLB-Meshes der
V2-Pipeline hergestellt.

Damit sind Interaktion und Darstellung voneinander getrennt:

- Dokumentation, Trefferpunkte, pulsierende gelbe Befundpunkte und Verlaufsdaten bleiben stabil.
- Das sichtbare Körpermodell kann je Variante schrittweise ersetzt werden.
- Unvollständige oder nicht freigegebene Meshes werden nicht automatisch aktiv.
- Web verwendet freigegebene GLB-Meshes; Android bleibt bis zur gebündelten
  Asset-Auslieferung auf dem sicheren Fallback.

## Variantenmatrix

Das V2-Manifest enthält 18 eindeutige Zielvarianten:

- 15 Grundmodelle aus fünf Altersstufen und drei Geschlechtsausprägungen
- Erwachsen · Divers · Penis/Skrotum · Brüste
- Erwachsen · Divers · Vulva · keine Brüste
- Erwachsen · Divers · Genitalanatomie unbekannt · Brüste

Die zusätzlichen Divers-Varianten werden aus der medizinischen Auswahl
deterministisch aufgelöst. Andere Divers-Konfigurationen verwenden bis zur
Erweiterung das jeweilige Divers-Grundmodell.

## Aktivierungsschutz

Eine Variante wird nur als GLB gerendert, wenn:

1. `assetPath` im V2-Manifest gesetzt ist,
2. die Datei unter `public/bodymap3d/v2/` vorhanden ist,
3. der Status mindestens `technical-review` lautet,
4. der Mesh-Vertrag und die Variantenmatrix den Audit bestehen.

Andernfalls rendert CareSuite automatisch das vorhandene parametrische Modell.
Damit kann ein fehlendes Mesh die produktive Bodymap nicht leer oder
unbedienbar machen.

## Mesh-Vertrag

Verbindliche Eigenschaften:

- glTF Binary 2.0 (`.glb`)
- Maßeinheit Meter
- Y oben, Z vorne
- Ursprung am Boden zwischen den Füßen
- klinisch neutrale A-Pose
- angewendete Transformationen
- Zonen-ID über `zone__<id>` oder `userData.anatomicalZoneId`
- stabile Modellkoordinaten für bestehende Marker
- Hautmaterialien ausschließlich mit `skin*` oder
  `userData.bodymapSkinMaterial = true`

Augen, Schleimhäute, Haare, Nägel und Wunddarstellungen dürfen nicht pauschal
mit dem Hautfarbton überschrieben werden.

## Reviewstatus

| Status | Bedeutung |
| --- | --- |
| `awaiting-mesh` | Noch keine GLB-Datei registriert; Fallback bleibt aktiv |
| `technical-review` | Datei technisch eingebunden; noch keine medizinische Freigabe |
| `medical-review` | Fachliche Prüfung läuft |
| `released` | Technisch und medizinisch freigegeben |

Die Anwendung behauptet zu keinem Zeitpunkt eine medizinische Freigabe, solange
der Status nicht `released` ist.

## Prüfungen

```bash
npm run bodymap3d:audit
npx vitest run \
  src/__tests__/pflege/bodyMapMedicalMeshPipeline.test.ts \
  src/__tests__/pflege/bodyMap3dViewerContract.test.ts \
  src/__tests__/pflege/bodyMapVisualQa.test.ts
```

Der reguläre Git-Bash-Deploy nimmt den neuen Pipeline-Test automatisch in den
Bodymap-Prüfsatz auf.

## Nächster Produktionsschritt

Als erstes Referenzmesh wird `body-erwachsener-maennlich` vollständig selbst
modelliert. Daran werden Polygonbudget, UV-Aufteilung, Materialstandard,
Zonenabdeckung, Raycasting, Marker-Reprojektion und medizinischer Reviewprozess
abgenommen. Erst nach bestandener Referenzabnahme werden die übrigen 17 Meshes
aus demselben kontrollierten Produktionsprozess abgeleitet.
