# Aufnahme: Leistungsauswahl und gemeinsames Vertragspaket

Stand: 20.10.2026. Ursprünglicher Stand: PR #136, Produktionsbuild für `cf2b05b20627fd95221daf3ecc71dd39ab96eb04` erfolgreich. Aktueller Hotfix: `fix/intake-signing-recovery-20261020`.

Die Leistungsauswahl lud den Katalog bei jedem Rendern neu, weil das Standard-Filterobjekt die Ladeabhängigkeit ständig änderte. Der Hook hängt nun von den einzelnen Filterwerten ab. Veraltete Antworten nach einem Mandantenwechsel werden verworfen; Ladefehler enden mit einer Rückmeldung und erneuter Lademöglichkeit. Ausgewählte Leistungen sind in der Webansicht mit Häkchen und blauer Fläche erkennbar.

Die Vertragsauswahl öffnet ein gemeinsames Dokumentenpaket mit Inhaltsverzeichnis und einer durchgehenden Vorschau. Die benötigten Rollen werden aus den ausgewählten Vorlagen ermittelt. Klient und Mitarbeitender zeichnen ihre Unterschriften getrennt. Nach Bestätigung werden diese ausschließlich in die zugehörigen Vorlagenfelder übernommen. Bestehende Unterschriften werden nicht auf geänderte Inhalte übertragen. Abgewählte unterschriebene Dokumente bleiben in der Entwurfshistorie erhalten.

Der neue Aufnahmedialog speichert das vollständig unterzeichnete Paket sofort über den bestehenden, versionierten Entwurfsweg. Ein fehlgeschlagener Versuch behält exakt dieselbe Fassung für einen erneuten Versuch. Erst eine bestätigte Serverspeicherung zeigt den Erfolg an. Der abschließende Aufnahmevorgang verwendet weiterhin den vorhandenen atomaren Serverabschluss, der Originale, Rollen, Vorlagen und Formularinhalt gegeneinander prüft. Bestehende Aktenänderungen werden weiterhin mit dem Änderungsvorgang gespeichert.

## Geprüft

- 315 Tests aus allen 20 Aufnahme-Regressionssuiten bestanden, einschließlich Paketinteraktion, Speicherwiederholung, Mandantenwechsel, Originalschutz und Serververifikation des gemeinsam unterschriebenen Pakets.
- 22 lokale SQL-Transaktionstests bestanden. Keine produktiven Klientendaten für Testschreibzugriffe verwendet.
- Gezielte TypeScript-Prüfung von 13 geänderten und unmittelbar abhängigen TypeScript-Dateien ohne Diagnose.
- Abgleich des vorhandenen gemeinsamen App-/Edge-Verifizierers bestanden.
- Die neue Weboberfläche lässt sich mit dem vorhandenen Bundler übersetzen. `git diff --check` ohne Fehler.

## Nachtrag: Unterschreiben blockiert

Der neue Screenshot zeigt vier fehlende Pflichtangaben für ausgewählte Zusatzdokumente: Pflegekasse, Versichertennummer, Notfallkontakt und Notfall-Telefon. Statt einer deaktivierten Signieraktion führt die Vorschau jetzt mit „Angaben ergänzen“ zu einer Korrekturansicht. Die Angaben können dort ergänzt werden; die Pflegekasse nutzt die bestehende Katalogauswahl mit ihren Referenzen. Eine bislang nicht ausgewählte Pflegekasse wird nur nach ausdrücklicher Auswahl hinzugefügt. Nicht vereinbarte Zusatzdokumente lassen sich einzeln entfernen. Danach wird das verbleibende Gesamtpaket erneut zur Prüfung angezeigt. Fehlende Pflichtangaben und bestehende Originale werden weiterhin geprüft.

Außerdem überdeckte die Paketvorschau mit ihrem höheren z-index beide Varianten des vorhandenen Unterschriftsdialogs. Während der Erfassung wird der Paket-Portal einschließlich seines Fokusfangs nun entfernt. Nach Übernehmen oder Abbrechen kehrt die unveränderte Paketansicht zurück. Die Interaktionstests verwenden den echten Desktop-Modal und den echten Web-Vollbild-Portal; nur die Canvas-Ausgabe, Geräte-APIs und Katalogsuche sind Testgrenzen. Die Tests belegen damit Zustandswechsel und Portal-Verhalten, keine Pixel- oder Freihandzeichnungsprüfung.

## Prüfgrenzen

- Die vollständige projektweite TypeScript-Prüfung wurde zweimal vom Arbeitsspeicherlimit beendet. Die gezielte Prüfung ist kein Ersatz für den kompletten Release-Build.
- Die breite und schmale Darstellung muss noch im Browser kontrolliert werden. Der verfügbare Cloud-Browser erreicht den lokalen Testserver nicht; lokale Datei-URLs wurden von seiner Sicherheitsrichtlinie gesperrt. Eine optische Freigabe liegt damit nicht vor.
- Der ursprüngliche Stand wurde nach ausdrücklicher Veröffentlichungs- und Deploy-Freigabe über PR #136 in `main` übernommen; sein Produktionsbuild ist erfolgreich. Der Hotfix muss seinen eigenen vollständigen Produktionsbuild durchlaufen.
- Der Vercel-Connector lieferte beim Abruf der Deployments für das zugehörige Projekt HTTP 403; ein angemeldeter lokaler Vercel-CLI-Zugang ist nicht vorhanden.
