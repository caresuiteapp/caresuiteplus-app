# CareSuite 3D-Bodymap – eigene Modellpipeline

## Aktueller Entwicklungsstand

Die Anwendung rendert die Körper derzeit vollständig selbst aus parametrischen
3D-Geometrien. Es werden keine fremden Figuren, Texturen oder medizinischen
Illustrationen eingebunden. Die Matrix umfasst fünf Altersgruppen mal drei
Geschlechtseinordnungen sowie drei modulare Divers-Anatomiepakete.

Der aktuelle Stand ist ein funktionsfähiger technischer Prototyp. Er ist noch
keine medizinisch freigegebene, fotorealistische Enddarstellung. Das Manifest
kennzeichnet diese Grenze ausdrücklich; eine medizinische Freigabe darf nicht
allein durch einen Softwaretest gesetzt werden.

## Reproduzierbare Stufen

1. Parametrische Referenz: Proportionen, eindeutige Mesh-Namen, Anatomiezonen
   und stabile Modellkoordinaten werden im Quellcode gepflegt.
2. Klinische Verfeinerung: Die Oberflächen werden in einer eigenen
   DCC-/Sculpting-Datei retopologisiert, UV-entfaltet und mit selbst erstellten
   PBR-Hautmaterialien versehen.
3. Variantenbau: Die fünf Altersstufen werden nicht nur skaliert, sondern mit
   jeweils eigenen Kopf-, Rumpf-, Hand-, Fuß- und Gewebeproportionen abgeleitet.
4. Anatomiepakete: Penis/Skrotum, Vulva und unbekannte Genitalanatomie bleiben
   modular. Brüste, keine Brüste und unbekannte Brustausprägung sind unabhängig
   kombinierbar.
5. Export: GLB 2.0, metrische Einheiten, Y-up, trianguliert, eingebettete
   Materialien, keine externen Texturen, deterministische Mesh-Namen.
6. Technische Prüfung: `npm run bodymap3d:audit`, gezielte Vitest-Suite und
   Expo-Web-Export.
7. Medizinische Prüfung: getrennte Reviews für Erwachsene, Pädiatrie,
   Intimanatomie, Hauttöne und Dekubitus-Workflow; Freigaben werden im Manifest
   einzeln dokumentiert.

## Verbindlicher Mesh-/Ankervertrag

Jede anklickbare Oberfläche besitzt eine `zoneId` aus dem Anatomiekatalog. Ein
Befund speichert Mesh-Lokalpunkt, Modellwurzelpunkt, Weltpunkt, Modell- und
Weltnormale, UV sowie Dreiecksindex. Dadurch bleibt das rote X beim Drehen,
Zoomen und bei späteren Modellversionen nachvollziehbar.

## Qualitätsgrenzen

- Keine automatische Diagnose aus der Darstellung.
- Keine medizinische Freigabe ohne dokumentiertes Fachreview.
- Kinder- und Intimanatomie ausschließlich im sachlich-klinischen Kontext.
- Klinische Fotos ausschließlich im privaten, mandantenisolierten Bucket.
- Jede Modelländerung erhöht die Modellversion und benötigt einen
  Migrations-/Ankerkompatibilitätstest.
