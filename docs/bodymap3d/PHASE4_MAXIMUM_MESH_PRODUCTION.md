# Phase 4 Maximum – vollständige medizinische Mesh-Produktion

## Ziel

Dieser Stand bündelt die technische Produktionsstrecke für selbst entwickelte
medizinische 3D-Bodymaps. Er ersetzt keine fachmedizinische Modellierung durch
Marketingbegriffe. Ein Modell gilt erst dann als medizinisches Mesh, wenn Datei,
Anatomiezonen, technische Qualität, visuelle Vergleichsprüfung und fachliche
Freigabe vollständig dokumentiert sind.

## Enthaltener Gesamtumfang

### 1. Varianten- und Mesh-Vertrag

- 15 Grundmodelle
- 3 zusätzliche erwachsene Divers-Konfigurationen
- Maßeinheit Meter
- Y-Achse oben, Z-Achse vorne
- Bodenursprung zwischen den Füßen
- klinisch neutrale A-Pose
- versionierte Assets
- technischer und medizinischer Reviewstatus

### 2. GLB-Binärinspektor

Der Inspektor prüft die Datei selbst und verlässt sich nicht auf Dateiendung
oder Dateinamen:

- GLB-Magic
- GLB-Version 2
- deklarierte Dateilänge
- JSON- und BIN-Chunks
- glTF-Asset-Version 2.0
- ausschließlich eingebettete Buffer und Bilder
- Mesh-Primitives
- Vertex- und Dreiecksanzahl
- Normalen
- UV-Koordinaten
- Accessor-Min-/Max-Abmessungen
- erwartete Körperhöhe
- Bodenursprung
- Bodymap-Metadaten
- eindeutig gekennzeichnetes Hautmaterial
- anatomische Pflichtzonen
- Dateigrößen- und Polygonbudgets

Eine Datei mit Fehlern kann nicht registriert werden.

### 3. Sichere Registrierung

Die Registrierung läuft standardmäßig als Dry-Run. Erst `--write` kopiert die
GLB-Datei und aktualisiert das Manifest. Dabei wird zusätzlich ein
Qualitätsbericht neben dem Asset gespeichert.

```bash
npm run bodymap3d:mesh:validate -- \
  --file="/pfad/body-erwachsener-maennlich.glb" \
  --variant=body-erwachsener-maennlich \
  --json="/pfad/qualitaetsbericht.json"
```

Dry-Run:

```bash
npm run bodymap3d:mesh:register -- \
  --file="/pfad/body-erwachsener-maennlich.glb" \
  --variant=body-erwachsener-maennlich \
  --status=technical-review
```

Schreibender Registrierungslauf:

```bash
npm run bodymap3d:mesh:register -- \
  --file="/pfad/body-erwachsener-maennlich.glb" \
  --variant=body-erwachsener-maennlich \
  --status=technical-review \
  --write
```

Eine direkte CLI-Registrierung als `released` ist gesperrt. Medizinische
Freigaben müssen separat dokumentiert und nachvollziehbar sein.

### 4. Anatomische Pflichtzonen

Jedes Mesh muss mindestens die festgelegten Kernzonen für Kopf, Gesicht,
Rumpf, Hände, Gesäß und druckgefährdete Bereiche enthalten. Abhängig von der
Anatomie kommen gesonderte Pflichtzonen für Penis/Skrotum oder Vulva hinzu.

Zonen werden ausschließlich über:

- `node.extras.anatomicalZoneId`, oder
- den Namen `zone__<anatomical-zone-id>`

registriert. Dekorative Meshes ohne Zonen-ID bleiben sichtbar, können aber
keinen medizinischen Befund erzeugen.

### 5. Interne Vieransichten-Werkbank

Die geschützte Entwicklungsroute
`/bodymap-mesh-workbench?variant=<variant-id>` enthält:

- alle 18 Varianten
- Vorderseite
- Rückseite
- linke Seite
- rechte Seite
- aktiven Renderer
- Assetpfad
- Versionsstand
- technischen Reviewstatus
- medizinischen Reviewstatus
- Produktionsfreigabe

Außerhalb der Entwicklung ist die Route nur mit
`EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH=true` erreichbar.

### 6. Robuster Produktionsfallback

Die produktive Bodymap bleibt bei folgenden Situationen bedienbar:

- kein Asset registriert
- Asset lädt noch
- GLB-Ladefehler
- Rendererfehler
- nicht aktivierter Reviewstatus

In diesen Fällen wird das Phase-3-Modell verwendet. Der Fehler wird technisch
protokolliert, ohne Patientendaten oder Dokumentationsinhalte in die
Fehlermeldung aufzunehmen.

### 7. Technische Kalibrierungsdatei

Der Generator erzeugt eine kleine, bewusst nicht anatomische GLB-Datei. Sie
prüft die komplette Binär-, Metadaten-, Material- und Zonenstrecke.

```bash
npm run bodymap3d:mesh:calibration
```

Diese Datei trägt in Asset, Node und Material ausdrücklich
`calibrationOnly=true` und `medicallyReviewed=false`. Sie darf niemals als
Körpermodell registriert oder beworben werden.

## Qualitätsbudgets

| Eigenschaft | Obergrenze |
| --- | ---: |
| Dateigröße | 50 MB |
| Vertices | 250.000 |
| Dreiecke | 500.000 |

Die Budgets gelten je Variante und können nach gemessener Web-/Android-Leistung
weiter reduziert werden.

## Datenschutz

- Keine Patientendaten in GLB-Dateien
- Keine extern geladenen Texturen oder Buffer
- Keine personenbezogenen Dateinamen im öffentlichen Assetpfad
- Keine signierten URLs im Manifest
- Keine klinischen Fotos als Modelltextur
- Qualitätsberichte enthalten ausschließlich technische Meshdaten

## Freigabereihenfolge

1. Modellierung abgeschlossen
2. GLB-Binärprüfung bestanden
3. Zonenprüfung bestanden
4. Vieransichten-Vergleich bestanden
5. Marker-/Raycasting-Test bestanden
6. technische Freigabe
7. fachmedizinische Anatomieprüfung
8. gesonderte Prüfung sensibler Bereiche
9. Freigabe der Hautmaterialien
10. dokumentierte Produktionsfreigabe

## Verbindlicher Gesamtcheck

```bash
npm run bodymap3d:audit
npm run typecheck
bash scripts/deploy-bodymap3d-gitbash.sh --skip-install
```

Der letzte Befehl führt Bodymap-Audit, Tests und vollständigen
Expo-Produktions-Webexport aus, ohne GitHub, Vercel oder Supabase zu verändern.
