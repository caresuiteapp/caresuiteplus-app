# Bodymap 3D Phase 15 – anatomische Ausrichtung

Phase 15 korrigiert die anhand der produktiven Vierseitenansichten gemeldeten
Lage-, Material- und Konturfehler der Real-Human-Modelle.

## Korrekturen

- Brustwarzen und Warzenhöfe auf 72 % der Scheitel-Fersen-Höhe abgesenkt.
- Genitalanker auf 50,2 % und Anusanker auf 48,5 % abgesenkt.
- Penisschaft in eine neutrale, körpernahe Ruheposition gebracht.
- Glans verkleinert und mit Eichelkranz sowie äußerer Harnröhrenöffnung ergänzt.
- Skrotalhälften abgesenkt, angenähert und proportional verkleinert.
- Alle Haut-, Brust-, Genital- und Öffnungsmaterialien ausdrücklich opak.
- Klinische A-Pose mit geringerer Armrotation, damit die echte
  HM08-Oberarmtopologie erhalten bleibt und die Axilla zugänglich ist.
- Armmaske auf Referenz-Armbereich begrenzt. Becken, Hüfte, Gesäß und
  proximale Oberschenkel werden nicht länger versehentlich mitrotiert.
- Lokale, topologiegestützte Glättung der Oberarmkonturen.

## Prüfgates

`bodymap3d:real-human:verify-anatomy` prüft alle 30 Varianten:

- Lagebereiche von Brustwarzen, Anus, Penis, Glans, Eichelkranz,
  Harnröhrenöffnung, Skrotum und Vulva,
- vollständige Opazität sämtlicher sichtbarer Materialien,
- Vorhandensein der erforderlichen anatomischen Teilflächen.

Die bestehenden Geometrie- und räumlichen Integritätsprüfungen bleiben
zusätzlich verbindlich. Die fachmedizinische Freigabe bleibt weiterhin
ausstehend und erfolgt durch den Auftraggeber.
