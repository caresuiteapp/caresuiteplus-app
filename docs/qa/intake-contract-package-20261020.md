# Aufnahme: Leistungsauswahl und gemeinsames Vertragspaket

Stand: 20.10.2026. Arbeitszweig: `fix/intake-contract-package-20261020`.

Die Leistungsauswahl lud den Katalog bei jedem Rendern neu, weil das Standard-Filterobjekt die Ladeabhängigkeit ständig änderte. Der Hook hängt nun von den einzelnen Filterwerten ab. Veraltete Antworten nach einem Mandantenwechsel werden verworfen; Ladefehler enden mit einer Rückmeldung und erneuter Lademöglichkeit. Ausgewählte Leistungen sind in der Webansicht mit Häkchen und blauer Fläche erkennbar.

Die Vertragsauswahl öffnet ein gemeinsames Dokumentenpaket mit Inhaltsverzeichnis und einer durchgehenden Vorschau. Die benötigten Rollen werden aus den ausgewählten Vorlagen ermittelt. Klient und Mitarbeitender zeichnen ihre Unterschriften getrennt. Nach Bestätigung werden diese ausschließlich in die zugehörigen Vorlagenfelder übernommen. Bestehende Unterschriften werden nicht auf geänderte Inhalte übertragen. Abgewählte unterschriebene Dokumente bleiben in der Entwurfshistorie erhalten.

Der neue Aufnahmedialog speichert das vollständig unterzeichnete Paket sofort über den bestehenden, versionierten Entwurfsweg. Ein fehlgeschlagener Versuch behält exakt dieselbe Fassung für einen erneuten Versuch. Erst eine bestätigte Serverspeicherung zeigt den Erfolg an. Der abschließende Aufnahmevorgang verwendet weiterhin den vorhandenen atomaren Serverabschluss, der Originale, Rollen, Vorlagen und Formularinhalt gegeneinander prüft. Bestehende Aktenänderungen werden weiterhin mit dem Änderungsvorgang gespeichert.

## Geprüft

- 307 Tests aus allen 20 Aufnahme-Regressionssuiten bestanden, einschließlich Paketinteraktion, Speicherwiederholung, Mandantenwechsel, Originalschutz und Serververifikation des gemeinsam unterschriebenen Pakets.
- 22 lokale SQL-Transaktionstests bestanden. Keine produktiven Klientendaten für Testschreibzugriffe verwendet.
- Gezielte TypeScript-Prüfung aller 13 geänderten TypeScript-Dateien ohne Diagnose.
- Abgleich des vorhandenen gemeinsamen App-/Edge-Verifizierers bestanden.
- Die neue Weboberfläche lässt sich mit dem vorhandenen Bundler übersetzen. `git diff --check` ohne Fehler.

## Vor Veröffentlichung offen

- Die vollständige projektweite TypeScript-Prüfung wurde zweimal vom Arbeitsspeicherlimit beendet. Die gezielte Prüfung ist kein Ersatz für den kompletten Release-Build.
- Die breite und schmale Darstellung muss noch im Browser kontrolliert werden. Der verfügbare Cloud-Browser erreicht den lokalen Testserver nicht; lokale Datei-URLs wurden von seiner Sicherheitsrichtlinie gesperrt. Eine optische Freigabe liegt damit nicht vor.
- GitHub-Push und Vorschau-Build wurden noch nicht ausgeführt. Die automatische Freigabeprüfung blockierte die Übertragung des neuen Arbeitsstands, weil sie die Autorisierung zur Veröffentlichung im GitHub-Ziel nicht als ausreichend ansah.
- Der Vercel-Connector lieferte beim Abruf der Deployments für das zugehörige Projekt HTTP 403; ein angemeldeter lokaler Vercel-CLI-Zugang ist nicht vorhanden.
