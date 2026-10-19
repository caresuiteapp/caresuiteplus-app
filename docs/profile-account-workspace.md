# Profil & Konto (Web/Desktop)

Die Web-Route `/settings/profile` verwendet `userprofilescreen.web.tsx` und die neue helle `UserProfileWorkspace`. Der bestehende native Bildschirm bleibt unverändert. Es werden keine Pakete oder Datenbankmigrationen ergänzt.

## Bedienung

- Vorname, Nachname und optionale Telefonnummer bearbeiten, speichern oder verwerfen. Mindestens ein Namensbestandteil ist erforderlich. Bei Hintergrundaktualisierungen bleiben bearbeitete Felder erhalten.
- JPEG, PNG oder WebP bis 5 MB auswählen, lokal ansehen und ausdrücklich als Profilbild speichern. Dateigröße, tatsächliche Bytes, Bildsignatur und Browser-Decodierung werden vor dem Upload geprüft. Abbruch verwirft die Auswahl; Entfernen stellt nach Bestätigung auf Initialen um.
- Anmeldeadresse und Rolle anzeigen. Ein Passwortlink kann nach Bestätigung für die eigene Verwaltungssitzung angefordert werden. Portaladressen werden nicht als persönliche E-Mail angezeigt; der Verwaltungs-Passwortablauf wird für Portalzugänge nicht angeboten.
- Bestehende Seiten für Darstellung, Datenauskunft, Löschanfrage und Unterstützung öffnen. Die Löschaktion eröffnet eine Anfrage und löscht kein Konto unmittelbar.
- Abmeldung bestätigen; bei fehlgeschlagener Abmeldung bleiben Entwurf und Verlassensschutz erhalten.

## Speicherung und Navigation

Die Web-Servicefunktionen bestätigen Auth-ID, Profilzuordnung und Mandant vor dem Schreiben. Profilupdates ändern nur persönliche Felder oder das Profilbild. Eine zurückgegebene, passende Profilzeile ist Voraussetzung für eine Erfolgsmeldung. Ein Update ohne betroffene Zeile gilt nicht als Erfolg.

Neue Bilder erhalten eindeutige Speicherpfade ohne Überschreiben des bisherigen Bildes. Vor dem Profilupdate wird die Identität erneut geprüft. Die bestehende öffentliche Avatar-Bucket-Konfiguration bleibt bestehen. Entfernen löscht die Profilreferenz; ältere Objekte und Objekte nach ungewissem Datenbankergebnis bleiben erhalten, damit bestehende Verweise nicht beschädigt werden. Eine physische Dateilöschung oder private Speicherung wird nicht zugesagt.

Laufende Aktionen sperren parallele Änderungen. Identitätswechsel verwerfen den alten Editor und ignorieren verspätete UI-Ergebnisse. Der Schutz ungespeicherter Eingaben greift bei den Seitenaktionen, dem gemeinsamen Web-Zurück-/Schließen-Knopf und beim Verlassen des Dokuments. Nur die aktive Profilroute registriert den globalen Schließen-Listener.

## Nachweise und offene Prüfung

`npm run verify:profile-account:release` verwendet das vorhandene Vitest-Setup für Service-, DOM-Interaktions- und Navigationsprüfungen einschließlich der bisherigen Profil-/Avatar-Regressionstests. Der Befehl ist im bestehenden Produktionsbuild enthalten; die vorhandene TypeScript-Prüfung läuft weiterhin davor. Tests verwenden isolierte Daten und lösen keine produktiven E-Mails oder Profiländerungen aus.

Der lokale Arbeitsstand enthält keine installierten Projektabhängigkeiten. Syntaxprüfungen, Diff-Prüfung und isolierte Service-Laufzeitfälle sind lokal möglich; vollständiger TypeScript-/Vitest-/Web-Export-Nachweis erfolgt über die bestehende Build-Pipeline.

DOM-Tests belegen Verhalten, nicht Geometrie. Eine authentifizierte Browserprüfung mit breitem und schmalem Fenster, vergrößerter Schrift, tatsächlichem Browser-Zurück und realem Upload/Passwortlink/Abmelden in einer freigegebenen Testumgebung bleibt gesondert erforderlich. Es wurden keine produktiven Daten zum Testen verändert.
