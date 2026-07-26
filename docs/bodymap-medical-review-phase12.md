# Medizinische Bodymap-Prüfung – Phase 12

## Zweck

Die 30 Real-Human-3D-Varianten werden einzeln fachmedizinisch geprüft. Eine
Freigabe gilt ausschließlich für die Kombination aus Varianten-ID und
SHA-256-Hash der GLB-Datei. Wird das Modell neu erzeugt oder verändert, stimmt
der Hash nicht mehr und die Anwendung behandelt die Variante automatisch als
nicht freigegeben.

## Rollen

- **Platform Owner:** Prüfung durchführen, bearbeiten, final freigeben und
  widerrufen.
- **Platform Admin:** Prüfung durchführen, Befunde speichern und Änderungen
  anfordern; keine finale medizinische Freigabe.
- **Platform Developer / Readonly:** Prüfstatus und Befunde lesen.

## Ablauf je Variante

1. Platform Console öffnen und **Produktverwaltung → Bodymap-Prüfung** wählen.
2. Variante in der 30er-Matrix auswählen.
3. Asset-ID und vollständigen SHA-256-Hash gegen den vorgesehenen Build prüfen.
4. **Medizinische Prüfung starten**.
5. Modell aus Vorder-, Rück- und beiden Seitenansichten prüfen; zusätzlich frei
   drehen und bis in Detailregionen zoomen.
6. Jedes anwendbare Checklisten-Kriterium bewerten:
   - Bestanden
   - Geringe Abweichung
   - Wesentlich
   - Blockierend
   - Nicht anwendbar
7. Fehlerhafte Stellen direkt am 3D-Modell anklicken und als
   positionsgebundenes Problem erfassen.
8. Zwischenstand speichern oder **Änderungen erforderlich** setzen.
9. Nach Korrektur das neue Asset erneut prüfen. Ein geänderter Hash kann nicht
   mit der alten Prüfung freigegeben werden.
10. Sind alle Pflichtkriterien abgeschlossen und keine wesentlichen oder
    blockierenden Probleme offen, kann der Platform Owner final freigeben.
    Dafür sind eine Begründung und die Eingabe `FREIGEBEN` erforderlich.

## Mindestumfang der Prüfung

- Gesamtkörper, Proportionen, geschlossene Oberfläche und klinische Haltung
- altersgerechte Anatomie für alle acht Altersgruppen
- Augen, Lider, Ohren, Mund, Nase und Hals
- fünf getrennte Finger und Zehen, Handflächen, Fußsohlen und Gelenkpunkte
- Brustkorb, Brüste/Mamillen beziehungsweise Variante ohne Brüste
- Penis/Skrotum, Vulva, unbekannte Genitalanatomie, Perineum, Anus und Gesäß
- alle wesentlichen Dekubitusregionen einschließlich Hinterkopf, Ohr,
  Schulterblatt, Ellenbogen, Sakrum, Trochanter, Knie, Knöchel und Ferse
- 360°-Drehung, Touch, Zoom, Oberflächentreffer und gelber Pulsmarker
- verlustfreie Befundübernahme bei Alters- oder Variantenwechsel
- identische Daten in Pflege und Stationär

## Freigabegrenzen

Eine technische Funktion oder ein realistisches Erscheinungsbild ist keine
medizinische Freigabe. Nur ein aktiver, nicht widerrufener Prüfdatensatz mit
exakt passendem Varianten- und Asset-Hash setzt die Runtime-Anzeige auf
**medizinisch freigegeben**. Alle Entscheidungen werden zusätzlich im
unveränderlichen Platform-Audit protokolliert.
