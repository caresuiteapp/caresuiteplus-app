# Startintro mit Ton — Fassung 1.3, acht Sekunden

Aktualisierung vom 6. September 2026. Das zuvor eingebaute Intro 1.2 wurde
vollständig gegen die richtige Fassung aus der neuen HTML-Vorschau ersetzt.
Die gleichzeitig hochgeladene ZIP enthält noch die alte Fassung; die neue
HTML enthält dagegen die vollständige Szene, den neuen Ton und sechs Formate.

## Verhalten

- Bei jedem vollständigen App-Neustart einmal acht Sekunden Wiedergabe.
  Kein dauerhaftes „bereits gesehen“ und keine Bindung an ein Benutzerkonto.
- Neuer Stereo-Raumklang und ein Lichtbogen vor und hinter dem Originalroboter,
  entsprechend der gelieferten HTML-Vorschau 1.3.
- Smartphone, Tablet 4:3 und Tablet 16:10, jeweils hoch und quer. Die Auswahl
  verwendet das tatsächliche Fensterformat und passt so auch zu einem
  geteilten Bildschirm oder Foldable. Das vollständige Bild bleibt sichtbar.
- Drehen während der Wiedergabe startet das Video nicht neu.
- Die Sitzung kann parallel laden. Biometrie, Begrüßung und Push-Dialoge
  warten auf das Ende des Intros. Die bestehende Biometriesperre bleibt aktiv.
- Ton ist eingeschaltet; die Medienlautstärke des Geräts bleibt maßgeblich.
  Nach dem Clip wird der Player pausiert und beim Entfernen freigegeben.
- Beim Wechsel in den Hintergrund endet die Wiedergabe. Normales Zurückkehren
  und interne Navigation spielen das Intro nicht erneut ab. Ein neuer
  App-Prozess spielt es wieder ab.
- Playerfehler geben die App sofort frei; ausbleibende Playerereignisse
  spätestens nach zwölf Sekunden. Darin sind acht Sekunden Video und vier
  Sekunden Reserve für den lokalen Decoder enthalten.
- Die Website hat keine vorgeschaltete Video-Wartezeit.

## Technische Einbindung

`expo-video ~57.0.3` für das vorhandene Expo SDK 57 bleibt eingebunden.
Hintergrundwiedergabe und Bild-in-Bild sind deaktiviert. Beide Root-Layouts
verwenden den gemeinsamen nativen Startablauf. `selectAppStartIntroFormat`
wählt die passende der sechs statisch eingebundenen Videodateien. Die Daten
sind direkt im App-Paket enthalten; es wird kein Startvideo heruntergeladen.

Die ursprüngliche HTML-Szene und ihr WAV-Ton wurden unverändert übernommen
und für die sechs Auflösungen nach H.264/AAC exportiert: 60 fps, acht Sekunden,
48 kHz und Stereo. Herkunft und Prüfsummen stehen in
`assets/brand/intro/README.md` und `manifest.json`. Die aktive App verwendet
keine Videodatei der alten Sechs-Sekunden-Fassung mehr.

## Prüfung

- 103 gezielte Portal-/Intro-Prüfungen bestanden, darunter 16 Introtests.
  Sie prüfen auch alle sechs Formate, die Verzögerung vor Decoderbereitschaft,
  den vollständigen achtsekündigen Ablauf und den Übergang zur Biometrie.
- TypeScript und ESLint für die geänderten Codebereiche bestanden.
- Alle sechs Videos vollständig mit FFmpeg decodiert; jeweils acht Sekunden,
  korrekte Auflösung und Stereo-Ton. Identische neue AAC-Tonspur in allen sechs.
- Endbilder aller Formate und mehrere Zeitpunkte der räumlichen Umkreisung
  visuell geprüft. Die neue HTML-Quelle ist im Gesamtpaket enthalten.
- Android/Hermes-Export und Prüfung aller sechs verpackten Videodateien
  bestanden: 29,5 MB Laufzeitdateien. Keine alte Sechs-Sekunden-MP4 enthalten.
  Einzelheiten stehen in `PRUEFERGEBNIS.json` im Gesamtpaket.

Der vollständige frühere Stand 659cc334 wurde mit 6.530 bestandenen Tests
und drei ausgelassenen Live-Tests geprüft. Für diesen Medienaustausch wurden
gezielt die betroffenen Portal-/Intro-Prüfungen erneut ausgeführt.

## Übernahme und Gerätetest

Das aktualisierte Gesamtpaket enthält auch das komplette vorherige Portal-
Update. Der Installer kann eine bereits installierte ältere Intro-Fassung
auf demselben Branch sicher vorwärts aktualisieren. Ungesicherte Änderungen
oder abweichende Commits werden nicht überschrieben.

Ein neuer AAB ist erforderlich. Der aktuelle Buildweg ist in
`GITHUB-ACTIONS.md` beschrieben. Das Intro benötigt keine Servermigration;
die Push-Einrichtung des vorherigen Portal-Updates gilt weiterhin, sofern sie
noch nicht durchgeführt wurde.

Auf dem Android-Gerät die App vollständig beenden und zweimal neu öffnen:
jeweils das ganze achtsekündige Intro mit dem neuen Ton sehen und hören.
Auch offline, auf Smartphone/Tablet und in beiden Ausrichtungen prüfen.
Biometrie muss erst nach dem Intro erscheinen. Während der Wiedergabe zur
Startseite wechseln: Ton muss enden; normales Zurückkehren darf nicht erneut
starten. Einen Push bei geschlossener App öffnen: nach Intro und Entsperren
muss das richtige Ziel erscheinen. Hier wurde noch kein neuer AAB gebaut
oder auf einem physischen Gerät ausgeführt.
