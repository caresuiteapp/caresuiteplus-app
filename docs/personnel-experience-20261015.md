# Personalbereich im Web

Ausgangsstand: `215f9eddf5c90d114984d3cda948fb761285cc31` (main, Klient:innen-Aufnahme #84).
Arbeitsbranch: `feat/personnel-experience-20261015`.

## Umsetzung

- Personalübersicht im bestehenden Klient:innen-Design: kompakter Kopf, aktive Statusfilter, Suche über Namen, Kontakte, Funktionen und Abteilungen, Sortierung sowie Listen- und Aktenkartenansicht. Weitere Akten werden in derselben Ansicht nachgeladen. Archivierte Akten und tatsächlich gelieferte weitere Statuswerte bleiben auffindbar.
- Einheitliche Personalakte für Dialog, direkte Route und geteilte Ansicht. Die 15 Bereiche sind gruppiert; Tastaturnavigation, ausgewählter Bereich in der Adresse, direkte Kontaktlinks, Fristen und offene Hinweise sind eingebunden. Arbeitszeit und Abrechnung öffnen mit der gewählten Person.
- Alle bestehenden Fachbereiche bleiben an ihre bisherigen Dienste angeschlossen: Beschäftigung, Vergütung/Bank, Steuer/Sozialversicherung, Nebenbeschäftigung, Qualifikationen, Portalzugang, Rollen/Rechte, Fahrtenbuch, Einsatzfähigkeit, Arbeitsmittel und Verlauf.
- Neuer dreistufiger Anlageablauf mit Pflichtfeldprüfung, echten Katalogen, Profilfoto und Prüfung vor dem Speichern. Standard ist ein gespeicherter Entwurf; bestehende Beschäftigte können ausdrücklich aktiv angelegt werden. Dabei werden keine Einladungen versendet oder Portalzugänge erzeugt.
- Ein optional fehlgeschlagener Fotoupload meldet die bereits erfolgreich erstellte Akte und bietet deren Öffnung an. Er führt nicht zu einer erneuten Anlage. Eine verlorene Antwort des eigentlichen Anlagedienstes wird ausdrücklich als unbestätigt behandelt; dieser Umbau behauptet keine neue serverseitige Idempotenzgarantie.
- Die Bearbeitung umfasst die bisherigen Felder für Person, Kontakt, Beschäftigung, Adresse und Qualifikationsangaben. Fehlgeschlagenes Speichern erhält die Eingaben. Formulare sind gegen Mehrfachabsenden gesperrt und nach Mandant, angemeldeter Person und Akte getrennt. Abbrechen, Dialogschließen, Routenentfernung und Neuladen berücksichtigen ungespeicherte Eingaben; derselbe bewusst bestätigte Abbruch fragt nicht doppelt.
- Dokumente lassen sich suchen, zuordnen, hochladen und herunterladen. Der Download prüft die freigegebene Akte, Dokumentzuordnung und Mandantenpfad erneut. Neue Uploads bleiben intern; Führungszeugnisse und Vertraulichkeitsunterlagen werden vertraulich markiert. Dateigröße und Dateityp werden vor dem Upload geprüft. Löschaktionen sind ausdrücklich bestätigt; zentrale Dokumente werden nicht über den normalen Löschweg entfernt.
- Berechtigungen, vorhandene Sicherheitsdienste und vorbereitete Fachmodul-Sperren bleiben maßgeblich. Änderungen am Produktcode liegen ausschließlich in Web-Dateien. Keine Datenbankmigration und keine Änderung an Android-Dateien.

## Prüfung

- 45 Tests in 11 Personal-Suiten bestanden. Sie prüfen unter anderem Listenbedienung, Entwurfserstellung, Validierung, Mehrfachabsenden, Fotos mit Teilerfolg, erneutes Speichern nach Fehlern, Datensatz-/Mandantenwechsel, Navigation bei ungespeicherten Eingaben und den Dokumentzugriff.
- Die bestehende Build-Vorprüfung für Klient:innen bestand: 291 Tests in 17 Suiten, 22 SQL-Vertragstests und der gemeinsame App-/Edge-Code-Abgleich.
- Vollständige TypeScript-Prüfung und ESLint für sämtliche betroffenen TypeScript-Dateien bestanden auf dem finalen Quellstand.
- Der finale Web-Export ist bestanden. Die anschließenden Audits für lokale Sprachdateien, Kalender-Erkennung und Web-Navigation sowie die Erstellung der öffentlichen Seiten endeten ebenfalls mit Exitcode 0. Das Prüfprotokoll liegt in `/tmp/personnel-final-verification.log`.

Die Verhaltenstests verwenden isolierte Daten und gemockte Dienste. Sie belegen keinen angemeldeten produktiven Ende-zu-Ende-Durchlauf. Es wurden keine echten Personalakten, Dokumente, Rechte, Einladungen oder sonstigen produktiven Daten geändert.

## Noch offene Abnahme

Eine echte Sichtprüfung breiter und schmaler Browserdarstellungen ist offen. Der vorhandene Cloud-Browser erreicht den lokalen Prüfserver nicht; seine Sicherheitsrichtlinie sperrt direkte Dateiseiten. Lokal ist kein Browser installiert. Es wurde keine zusätzliche Browser-Software oder Testinfrastruktur eingerichtet. DOM-Tests sind kein Nachweis für eine optisch fehlerfreie Darstellung.

Der Nutzer hat Commit, Push und die angekündigte Vercel-Vorschau am 15.10.2026 mit „deploy“ freigegeben. Die Veröffentlichung erfolgt über den bestehenden GitHub-Deployweg. Der konkrete Buildstatus und die Vorschauadresse werden am zugehörigen Pull Request nachgewiesen. Die optische Abnahme und ein angemeldeter Ende-zu-Ende-Durchlauf sind damit nicht automatisch erfolgt.
