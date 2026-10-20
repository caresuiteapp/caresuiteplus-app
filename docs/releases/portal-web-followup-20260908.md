# Web-Portale: Einsatzansicht und Speicherzustände

Fortsetzung auf Basis von `b997fa7e9b76458abf133c212fd71c76dc0d1d02`.
Alle Änderungen dieser Lieferung sind Web-Overrides. Die nativen Android-Dateien,
App-Version und Store-Artefakte werden nicht verändert.

## Navigation und Platzaufteilung

- Im geöffneten Einsatz entfällt die zweite allgemeine Portalnavigation. Der
  Rückweg bleibt über die beschriftete Aktion im Einsatzkopf erreichbar.
- Aufgaben, Dokumentation, Medien, weitere Aktionen und zusätzliche Inhalte teilen
  eine Leiste im normalen Seitenlayout. Keine über Formularen schwebende Plus-Taste.
- Die Leiste beansprucht ihre tatsächliche Höhe. Pauschale zusätzliche Reserven
  von mehr als 100 Pixeln werden aus dem Einsatzinhalt entfernt.
- Bei schmaler Ansicht zeigt der Fortschritt den aktuellen Schritt als Text und
  die Schrittfolge als kompakte Punkte. Breite Ansichten behalten die Beschriftungen.
- Portalnavigation zeigt höchstens vier direkte Ziele und „Mehr“. Alle übrigen
  bestehenden Ziele bleiben im Menü erreichbar.
- Portaltexte verwenden ausdrücklich dunkle Farben auf den hellen Flächen und
  lesbare Schriftgrößen. Die vorhandene Einstellung zur Schriftgröße bleibt wirksam.
- Der Portalrahmen berücksichtigt die sichtbare Browserhöhe bei geöffneter
  Bildschirmtastatur. Pinch-Zoom verändert diese Layoutberechnung nicht.

## Dokumentation und Abschluss

- Erst tatsächlicher gespeicherter Beginn und tatsächliches gespeichertes Ende
  bestätigen vollständige Einsatzzeit; eine laufende Timeranzeige reicht nicht aus.
- Noch nicht gespeicherte Dokumentationsänderungen verhindern die Freigabe des
  Abschlussbuttons, auch wenn eine frühere Fassung bereits gespeichert wurde.
- Eine noch nicht bestätigte oder weitergeleitete Unterschrift wird nicht als
  bestätigte Unterschrift im Fortschritt dargestellt.
- Die Abschlusskarte erklärt offene Voraussetzungen. Sie behauptet vor dem
  bestätigten Abschluss nicht, dass der Leistungsnachweis bereits erstellt sei.
- Änderungen der Dokumentation erscheinen als ungespeichert. Bereits geladene
  Daten lösen beim bloßen Anzeigen kein Änderungsereignis mehr aus.
- Änderungen werden während einer laufenden Speicherung gesperrt. Doppelklicks
  lösen keinen zweiten Speichervorgang aus; Ausnahmen lassen Eingaben bestehen.
- Entwürfe bleiben auch bei Änderungen einer schon eingereichten Dokumentation
  in der vorhandenen Wiederherstellungslogik berücksichtigt. Keine zusätzliche
  Ablage von Gesundheitsdaten und keine neuen Speicherorte.
- Der vorhandene Schutz vor Routenwechsel und Browser-Neuladen wird auf die
  Dokumentationsbearbeitung angewendet. Schließen des Dokumentationsfensters
  behält den Entwurf im Einsatz; Verlassen der Route erfordert bei Änderungen
  eine ausdrückliche Entscheidung.

## Fahrtenbuch im Browser

- Fehlgeschlagene Queue-Abfragen werden als unbestätigte Synchronisierung angezeigt.
- Rückkehr in ein sichtbares Browserfenster und wiederhergestellte Verbindung
  verwenden den bestehenden Wiederaufnahme- und Synchronisierungspfad.
- Späte Antworten eines vorherigen Mandanten-/Mitarbeitendenkontexts werden verworfen.
- Die Web-Oberfläche verspricht keine dauerhafte GPS-Aufzeichnung bei gesperrtem
  Gerät oder im Hintergrund. Bestehende native Hintergrunddienste bleiben unverändert.

## Veröffentlichung und Abnahme

Auf ausdrückliche Nutzeranweisung erfolgen keine Tests, Typprüfung, Lint- oder
Browserprüfungen. Der Web-Export dient ausschließlich dem Erstellen der Veröffentlichung.
Die manuelle Funktions- und Gestaltungsabnahme erfolgt durch den Auftraggeber nach
dem Deployment. Es wird keine vollständige Fehlerfreiheit aller Seiten oder Geräte behauptet.

Keine neuen Datenbankmigrationen, keine Änderung produktiver Einsatzdaten und kein
Erfinden fehlender Zeiten, Signaturen oder GPS-Punkte. Desktop-Startseite, Wetter,
Intro, Registrierung und Support aus den vorherigen Veröffentlichungen bleiben erhalten.
