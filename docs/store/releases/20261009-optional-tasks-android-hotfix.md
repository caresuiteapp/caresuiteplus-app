# Optionaler Aufgaben-Hotfix im vollständigen nativen Android-Release 0.4.0

## Zugeordneter Fehler und übernommene Korrektur

Gemeldeter Fehler: `mergeConfirmedOptionalTasks is not a function` beim Öffnen
eines Einsatzes im Mitarbeitendenportal. Der Nutzer verlangte ausdrücklich,
die inzwischen behobene Korrektur vor dem weiteren App-Build zu übernehmen.
Der verlinkte Chat konnte nicht vollständig abgerufen werden. Der zugehörige
Hotfix ist durch den Fehlernamen, den vorliegenden Gesprächskontext und den
aktuellen Repository-Commit eindeutig zugeordnet.

Übernommen wurde der gesamte Hauptzweig bis
`3ad95a7087828d7acaf44593ba6bd0f9de5cc353` mit der Korrektur
`[deploy] fix(web): restore employee visits and optional tasks`. Die Web-Datei
`optionalVisitTasks.web.ts` wird entfernt, der Web-Speicherdienst erhält den
eigenen Namen `optionalVisitTaskService.web.ts`. So ersetzt Metro beim Import
der gemeinsamen Aufgabenlogik nicht mehr versehentlich deren Funktionen
durch einen anders aufgebauten Speicherdienst. Die Web-Verbraucher verwenden
die korrigierten Imports. Der native Speicherdienst und das native Aufgaben-
modell bleiben erhalten.

Der Zusammenführungsstand enthält außerdem den vollständigen nativen Release
944ec735 und den Werkzeugcheck 3530c2ed. Die Korrektur ist keine einzelne lose
Datei und setzt keine separate Webansicht in die Android-App ein.

## Prüfungen mit dem Android-Resolver

Die vorhandenen Aufgabenprüfungen verwenden jetzt auch den echten Metro-
Resolver für Android. Sie lesen die tatsächlichen Laufzeit-Imports aus
nativer Einsatzansicht, Aufgabenpanel und Ausführungshook und prüfen:

- `mergeConfirmedOptionalTasks` ist eine aufrufbare Funktion; die bestätigte
  Ergänzung erhält Status und Notiz bestehender Aufgaben und legt keine
  doppelten Aufgaben an.
- Das native Aufgabenpanel erhält die echten Such- und Validierungsfunktionen,
  einschließlich deutscher Vorlagensuche und Zurückweisung leerer Eingaben.
- Android verwendet den nativen/gemeinsamen Speicherdienst und keine
  `.web.ts`-Implementierung. Beide bestehenden Einsatzquellen werden korrekt
  zugeordnet; fremde Mitarbeitendenzuordnungen führen zu keiner Speicherung.
- Die bestehenden Web-, Serverantwort-, Cache-, Fehler-, Sperr- und
  Wiederholungsprüfungen bleiben enthalten. Speicherung ist in diesen Tests
  kontrolliert simuliert; produktive Einsätze werden dadurch nicht verändert.

## Nachgewiesener Stand

Geprüfter Code vor den reinen Nachweisdokumenten:
`cbec8142fed112ebf05fc06159d9421f0c4981d5`.

Die vollständige Release-Prüfkette wurde mit der vorhandenen öffentlichen
Produktionskonfiguration erfolgreich ausgeführt:

| Prüfung | Ergebnis |
| --- | ---: |
| TypeScript | bestanden |
| Portal-Prüfungen | 107 bestanden |
| Android-Prüfungen | 363 bestanden |
| Mandantenakte | 30 bestanden |
| Einsatz-Workflows | 376 bestanden |
| Optionale Aufgaben einschließlich Android-Resolver | 24 bestanden |
| Build, Signierung, R8-Speicher und Werkzeugerkennung | 46 bestanden |
| Summe automatisierter Tests | 946 bestanden |

Ein frischer Android-/Hermes-Export wurde erzeugt und gegen die aktuellen
Quellen geprüft: 700 ausgewählte Android-Routen, 4.121 erreichbare Android-
App-Quellen, 4.147 aktuelle Quellen aus der Source Map bestätigt. Keine
erreichbaren Web-Implementierungen oder WebViews; alle sechs Original-Intros
und die Originalschrift sind bestätigt. Die vollständigen Messwerte stehen
in `20261009-optional-tasks-android-export-verification.json`.

## Weiterer Build

Das neue portable Paket enthält Hotfix und Werkzeugcheck gemeinsam. Es
akzeptiert den nativen Ausgangsstand 944ec735, den optional bereits angewendeten
Werkzeugcheck 3530c2ed und den neuen Gesamtstand. Es prüft Prüfsumme,
Repository-Identität, lokale Änderungen, Bundle-Inhalt, Dateiumfang sowie den
frischen Haupt- und Releasezweig. Es überschreibt keine eigenen Änderungen.

`--check-only` importiert den Stand und prüft nur die vorhandenen Werkzeuge.
Der normale Aufruf führt bei vollständigen Werkzeugen den bisherigen nativen
Produktionsbuilder weiter aus. Signierung und EAS-Versionsreservierung folgen
erst nach erfolgreicher Werkzeugprüfung und Bestätigung des vorhandenen
Uploadschlüssels. Fehlende JDK-/SDK-/NDK-Komponenten werden nicht installiert.

Dieser Nachweis ersetzt keinen echten Windows-Compilerlauf, kein signiertes
AAB und keine Geräte- oder optische Freigabe. Diese Schritte sind weiterhin
offen. Das Paket startet keine Cloud-Kompilierung, dreht keine Signierschlüssel
und veröffentlicht keine Google-Play-Version.
