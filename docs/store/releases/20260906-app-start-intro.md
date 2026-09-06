# Startintro mit Ton – 6. September 2026

Ergänzung zum Portal-Update auf Stand `144cd259`. Beide Portalgruppen verwenden
denselben Startablauf. Das gelieferte CareSuite-Health-OS-Intro ist unverändert
als lokales Video mit Stereo-Ton eingebaut.

## Verhalten

- Bei jedem vollständigen App-Neustart einmal sechs Sekunden Wiedergabe.
  Kein dauerhaftes „bereits gesehen“ und keine Bindung an ein Benutzerkonto.
- Hoch- oder Querformat wird beim Start gewählt. Das Bild wird vollständig
  eingepasst; Drehen des Geräts startet den Clip nicht neu.
- Die Sitzung kann währenddessen laden. Biometrie, Begrüßung und Push-Dialoge
  warten auf das Ende des Intros. Geschützte Portalansichten bleiben hinter
  der bestehenden Biometriesperre.
- Ton ist eingeschaltet, die Medienlautstärke des Geräts bleibt maßgeblich.
  Nach dem Clip wird der Player pausiert und beim Entfernen freigegeben.
- Beim Wechsel in den Hintergrund endet die Wiedergabe. Beim gewöhnlichen
  Zurückkehren oder Navigieren innerhalb der laufenden App erfolgt kein
  erneutes Intro. Ein neuer App-Prozess spielt es wieder ab.
- Bei einem Playerfehler wird die App sofort freigegeben; bei ausbleibenden
  Playerereignissen spätestens nach zehn Sekunden. Ein Fehler darf die
  Anmeldung nicht dauerhaft blockieren.
- Die Website hat keine vorgeschaltete Video-Wartezeit.

## Technische Einbindung

`expo-video ~57.0.3` passend zum vorhandenen Expo SDK 57, eingebunden in beide
App-Konfigurationen. Hintergrundwiedergabe und Bild-in-Bild sind deaktiviert.
`AppStartIntro.native.tsx` umschließt beide nativen Root-Layouts; ein gemeinsamer
React-Kontext steuert den Beginn der nachgelagerten Dialoge. Nur die laufende
JavaScript-Sitzung merkt sich das Ende. Der native Splash-Hintergrund passt
zum Video.

Die zehn Interaktionstests prüfen Start/Ende, Tonkonfiguration, verzögerten
Decoderstart, Fehler, Zeitlimit, Hintergrundwechsel, Wiederstart, Ausrichtung,
Android-Zurücktaste und Web-Einstieg; enthalten ist ein Test mit der echten
Biometrie-Gate-Komponente. Sie sind Teil von `npm run audit:portal-update`.
Das Android-Exportaudit prüft zusätzlich, dass beide Originalvideos tatsächlich
unverändert im Export liegen und der native Startablauf eingebunden ist.

## Lokale Prüfergebnisse

6.530 Tests bestanden, keine fehlgeschlagen; drei Tests mit erforderlichem
Live-Zugang ausgelassen. TypeScript und ESLint bestanden. Zehn zusätzliche
PostgreSQL-Push-Prüfungen bestanden. Android/Hermes-Export und Exportaudit
bestanden: 24,5 MB Laufzeitdateien einschließlich beider Originalvideos.

## Auslieferung und Gerätetest

Ein neuer AAB ist erforderlich, weil eine native Video-Abhängigkeit hinzukommt.
Das bestehende Buildskript prüft nun auch den Android-Export und beide Videos.
Das Intro benötigt keine Servermigration. Die Push-Einrichtung des vorherigen
Portal-Updates gilt weiterhin, sofern sie noch nicht durchgeführt wurde.

Auf dem Android-Gerät prüfen: App vollständig beenden und zweimal neu öffnen;
jeweils das gesamte Intro mit Ton sehen/hören. Anschließend im Flugmodus
neustarten und Hoch-/Querformat prüfen. Biometrie muss erst danach erscheinen.
Während des Videos zur Startseite wechseln: Ton muss enden; normales
Zurückkehren darf den Clip nicht erneut starten. Einen Push bei geschlossener
App öffnen: nach Intro und gegebenenfalls Entsperren muss das richtige Ziel
erscheinen. Der lokale Test und Export ersetzen diese native Geräteprüfung
nicht; hier wurde kein neuer AAB auf einem physischen Gerät ausgeführt.
