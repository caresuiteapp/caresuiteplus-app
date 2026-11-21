# NEO R2.1: lokale Browsererkennung vorbereiten

Ausgangspunkt: R2 `ff6f4b0c40e1620428fcd7881906ae53cf806e6b` ist bei Vercel erfolgreich veröffentlicht. Der eingesandte Bildausschnitt zeigt die allgemeine Erkennungs-Abbruchmeldung. Er enthält keinen Browserfehlercode; die konkrete Geräteursache ist daraus nicht feststellbar.

Die bisherige Prüfung auf das Vorhandensein von `processLocally` genügte nicht. R2.1 prüft zusätzlich `SpeechRecognition.available({langs:['de-DE'],processLocally:true})`, wenn der Browser diese Abfrage unterstützt. Die Aufnahme beginnt erst bei einem nutzbaren Ergebnis. Ältere lokale APIs ohne Bereitschaftsabfrage werden als ungeprüfter lokaler Startversuch behandelt, nicht als bestätigte Sprachpaketbereitschaft.

Bei einem nachladbaren deutschen Paket erscheint „Deutsches Sprachpaket laden“. Erst eine ausdrückliche Betätigung startet die Browserinstallation. Danach wird die tatsächliche Bereitschaft erneut geprüft. Eine fertiggestellte Installation aktiviert das Mikrofon nicht automatisch; NEO muss anschließend bewusst gestartet werden. Während eines Downloads oder bei fehlender Unterstützung beginnt keine Aufnahme. Ein veraltetes Vorbereitungsergebnis nach Abbruch, Hintergrundwechsel oder einem neuen Start darf keine alte Aufnahme reaktivieren.

Die Desktop-Statusanzeige und die Sprachbegleitung in der Dokumentation bieten die Wiederherstellung. Mikrofonverweigerung, fehlendes Gerät, gesperrter Erkennungsdienst, fehlende Sprache und Netzwerk-/Enginefehler erhalten getrennte Meldungen mit einem begrenzten Browsercode. Gesprächsinhalte oder rohe Ausnahmeberichte werden dafür nicht protokolliert. Die Permissions-Policy erlaubt lokale Erkennung ausdrücklich nur der eigenen Herkunft.

Das Paket macht einen Browser ohne geeignete lokale Engine nicht nachträglich kompatibel. Microsoft beschreibt die lokale Edge-Engine aktuell für Canary/Dev ab Version 150.0.4076 mit aktivierter entsprechender Funktion. Eine höhere Stable-Versionsnummer und ein vorhandenes JavaScript-Property sind kein Betriebsnachweis. Die produktive eigene Cloud-Erkennung bleibt bis zu ihrer gesonderten Abnahme gesperrt. Es wird kein fremder Erkennungsdienst als Ersatz gestartet.

## Git Bash

```bash
bash "$HOME/Downloads/CareSuite_NEO_R2_1_Browserreparatur.sh" --publish
```

Die Datei verwendet den vorhandenen NEO-Arbeitsordner, prüft vor dem Ersetzen die bisherigen Dateiinhalte und sichert sie. Der normale Git-Push startet den bestehenden Vercel-Build. Die vollständigen Produktionsprüfungen bleiben aktiv. `--prepare` führt denselben lokalen Ablauf ohne Push aus. Es werden weder zusätzliche npm-Pakete noch andere Browser installiert. Ein gegebenenfalls angebotenes Sprachpaket wird erst später über die sichtbare Browseraktion geladen.

## Quellen und Prüfgrenze

- [Microsoft: lokale SpeechRecognition in Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api), abgerufen am 21.11.2026.
- [MDN: Bereitschaft prüfen](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static).
- [MDN: Sprachpakete laden](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/install_static).
- [MDN: Browserfehler unterscheiden](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error).

Die Regressionstests prüfen echte Zustandsabläufe mit simulierten Browserantworten, insbesondere fehlende Pakete, ausdrücklich ausgelöste Installation, verspätete Bereitschaft und Fehlerkategorien. Sie belegen keine erfolgreiche Spracherkennung auf dem eingesandten Windows-/Edge-Gerät. Eine visuelle Browserabnahme war in der Entwicklungsumgebung wegen deren gesperrtem Browserstart nicht möglich.
