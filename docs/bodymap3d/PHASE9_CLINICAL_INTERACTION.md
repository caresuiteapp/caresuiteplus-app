# Bodymap 3D – Phase 9: klinische Interaktion

Stand: 26.07.2026
Branch: `feat/bodymap-clinical-interaction-phase9-20260726`

## Ziel

Phase 9 verbindet die 18 technischen GLB-Referenzkörper mit der vollständigen
klinischen Dokumentationsstrecke. Die Modelle sind damit nicht nur dreh- und
zoombar, sondern ihre getrennten anatomischen Oberflächen werden direkt für
Befund, Dekubitus-Assessment, Verlauf und klinische Medien verwendet.

Die Bodymap ist in **Pflege und Stationär** eingebunden. Beide Module verwenden
dieselbe 3D- und klinische Engine. Stationär besitzt zusätzlich einen
Bewohner:innen-Hub, einen Einstieg in der Bewohnerakte und einen eigenen
Navigationseintrag.

Die Modelle sind weiterhin **nicht medizinisch freigegeben**. Dieser Status
wird in der Patienten-Bodymap sichtbar ausgewiesen. Die technische Nutzung
aktiviert keine medizinische Freigabe.

## Bedienablauf

1. Geschlechtseinordnung, Altersgruppe und Hautton auswählen.
2. Bei Divers zusätzlich Genitalanatomie und Brustausprägung festlegen.
3. Technischen 3D-Körper mit Maus, Touch oder Trackpad drehen und zoomen.
4. Eine konkrete Mesh-Oberfläche anklicken.
5. Den direkten Treffer bei Bedarf über anatomisch passende Unter- oder
   Nachbarstrukturen präzisieren.
6. Eine der 16 strukturierten Befundarten auswählen.
7. Beobachtung, Diagnose beziehungsweise Verdachtsdiagnose und Behandlung
   dokumentieren.
8. Bei Druckverletzungen das vollständige Dekubitus-Assessment ausfüllen.
9. Optional ein initiales Foto mit Messreferenz anhängen.
10. Befund speichern; der Punkt bleibt an der Modelloberfläche verankert.
11. Spätere Status-, Behandlungs- und Fotoverläufe am selben Befund ergänzen.

## Pulsierender gelber Befundpunkt

Das bisherige rote X wurde vollständig durch einen pulsierenden gelben
Befundpunkt ersetzt:

- gelber Kern mit hellem Mittelpunkt,
- animierter Außenring,
- oberflächennormale Ausrichtung,
- verstärkte Animation für den ausgewählten Befund,
- identische gelbe Kennzeichnung in der Befundliste,
- dauerhaft gespeicherte modelllokale Koordinate.

## Anatomische Trefferpräzisierung

Die Trefferliste beginnt immer mit der tatsächlich angeklickten Mesh-Zone.
Danach folgen feinere Unterzonen und direkte Nachbarstrukturen. Die Liste:

- respektiert Links-/Rechts-Lateralität,
- filtert unpassende Genitalstrukturen,
- trennt modulare Divers-Konfigurationen,
- speichert direkten Mesh-Treffer und fachlich ausgewählte Zone getrennt,
- speichert Pfad, Beschriftungen, Lateralität, sensible Kennzeichnung,
  Druckrisiko und klinische Tags als Ortssnapshot.

## Dekubitus und Druckverletzungen

Erfasst werden:

- Kategorie/Stadium 1 bis 4,
- nicht klassifizierbare Druckverletzung,
- tiefe Gewebeschädigung,
- Schleimhautdruckverletzung,
- medizinproduktbezogene Druckverletzung,
- vorhanden bei Aufnahme: ja, nein oder unbekannt,
- Länge, Breite, Tiefe und berechnete Fläche,
- Granulation, Fibrin und Nekrose,
- Exsudatmenge, Exsudatart und Geruch,
- Wundrand und Wundumgebung,
- Infektions- und Eskalationszeichen,
- Unterminierung nach Uhrposition und maximale Tiefe,
- Tunnel beziehungsweise Fistelgang,
- Schmerz,
- verursachendes Medizinprodukt,
- Behandlung,
- Druckentlastungs- und Lagerungsplan,
- verpflichtende nächste Kontrolle.

Medizinproduktbezogene Befunde benötigen die konkrete Produktangabe.
Verlaufsstatus können nicht ohne nachvollziehbare Verlaufsnotiz gespeichert
werden.

## Klinische Medien

- JPEG, PNG und WebP,
- maximal 25 MB,
- mandanten- und klientenisolierter privater Speicherpfad,
- kurzlebige Vorschau- und Download-URLs,
- Phasen von Initialaufnahme bis Wiedereröffnung,
- optionale Messreferenz,
- Fotos werden im append-only Verlauf referenziert.

## Datenintegrität

Die Migration
`20260726094500_bodymap_clinical_interaction_phase9.sql` ergänzt:

- atomaren Status- und Verlaufsschreibvorgang,
- mandantenisolierte RPC mit `SECURITY INVOKER`,
- Pflichtnotiz für jeden Statuswechsel,
- Unterdrückung doppelter Triggerereignisse,
- automatischen Verlaufseintrag für jedes neue Druckverletzungsassessment.

Klient:innen aus Pflege und Bewohner:innen aus Stationär werden über einen
polymorphen, mandantenisolierten Subjektbezug getrennt:

- `client` verweist weiterhin auf `clients`,
- `resident` verweist auf `care_records`,
- beide verwenden eigene Fremdschlüssel,
- Marker, Verlauf, Medien und Assessments tragen denselben Subjektbezug,
- stationäre Fotos erhalten einen getrennten privaten Speicherpfad.

Bestehende Tabellen und Befunde werden weder gelöscht noch zurückgesetzt.

## Medizinischer Status

Die 18 GLBs sind selbst entwickelte technische 3D-Referenzen. Sie werden
sichtbar verwendet, bleiben aber ausdrücklich als nicht medizinisch
freigegeben gekennzeichnet. Eine spätere fachliche Freigabe benötigt
unabhängige anatomische, pflegefachliche, datenschutzrechtliche und klinische
Abnahme.

## Reproduzierbare Qualitätssicherung

Der Phase-9-Abschluss umfasst:

- 84 gezielte Tests in 15 Testdateien,
- technischen Mesh-Audit mit 18/18 registrierten GLBs,
- portablen Pflege-/Stationär-Vertragsprüfer,
- Production-Webexport mit 644 statisch gerenderten Routen,
- echte Headless-WebGL-Aufnahme mit vier Canvases,
- 0 Browserfehler im Aufnahmelauf.

Der eingecheckte Nachweis liegt unter
`docs/bodymap3d/qa/bodymap-phase9-clinical-marker/`. Er zeigt die technische
Divers-Variante Penis/Brüste in Vorder-, Rück- und Seitenansicht einschließlich
gelbem Befundpunkt und sichtbarem Freigabestatus.
