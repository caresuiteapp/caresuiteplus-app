# Erstkontakt aus der Beratung · 21.10.2026

Die zentrale Klientenaufnahme bleibt der Einstieg für alle Leistungsbereiche. In der Beratung ergänzt die Klientenauswahl „Neu anlegen · Eckdaten erfassen“. Die Person wird über die vorhandene, berechtigungsgesicherte `client_intake_save_draft`-RPC als zentrale Klientenakte gespeichert. Der Beratungsfall verweist auf dieselbe `client_id`.

## Verhalten

- Kompaktes Formular für Namen, Telefon/Mobiltelefon/E-Mail, abweichende Kontaktperson, Besuchsadresse und erste Hinweise. Geburtsdatum, Pflegegrad und Zugangshinweise sind optional.
- Zentrale Erstkontaktvalidierung: Nachname und mindestens ein Kontaktweg. Es werden weder abgeschlossene Aufnahme noch Vertragsabschluss, Unterschriften oder durchgeführte Leistungen erzeugt.
- Ein bekannter Name oder eine Telefonnummer kann auf vorhandene Akten hinweisen. Übernahme erfolgt bewusst; es findet keine automatische Zusammenführung statt.
- „Eckdaten speichern & übernehmen“ bestätigt zuerst die zentrale Speicherung und wählt dann diese Person aus. Die separate Fallanlage kann danach wiederholt werden, ohne nochmals eine Person anzulegen. Der gespeicherte Erstkontakt bleibt auch bei Abbruch der Fallanlage unter Klienten verfügbar.
- Kontaktperson und erste Hinweise werden als bearbeitbare Vorbereitung übernommen. Termin und persönliche Zuweisung erfolgen anschließend im bestehenden Beratungsablauf.
- Unbestätigte Übertragungen behalten exakt ihre Akten-ID, Vorgangs-ID und Nutzdaten. Bis zur Klärung sind die betroffenen Eingaben gesperrt; ein erneuter Versuch wiederholt denselben Vorgang. Der Entwurf bleibt im Arbeitsspeicher innerhalb derselben Sitzung auch beim Schließen/Wiederöffnen erhalten. Ein vollständiges Neuladen verwirft ungesicherte Browserangaben; bereits gespeicherte Akten bleiben zentral verfügbar.
- Zugriff auf „Neu anlegen“ erfordert die bestehenden Rechte für Klientenaufnahme, Klientenansicht und sensible Klientendaten. Die serverseitigen Prüfungen bleiben unverändert. Im Mitarbeiterportal ist diese Aufnahmefunktion nicht verfügbar.

## Gemeinsame Eckdaten und Dokumentation

Der vorbereitete SQL-Schritt `supabase/changes/consultation_central_contact.sql` erweitert die bestehenden öffentlichen Beratungs-RPCs über private Funktionen. Es werden keine neuen Tabellen oder weiteren direkten Tabellenrechte eingeführt.

Noch nicht begonnene Besuche zeigen die aktuellen zentralen Eckdaten. Bei Planung und tatsächlichem Start übernimmt der Server den aktuellen Stand in den Besuch. Bereits begonnene und unterschriebene Dokumentationen behalten ihren zugehörigen Stand. Wiederholungen bereits bestätigter Startanfragen aktualisieren diesen Stand ausdrücklich nicht erneut. Die qualifizierte, persönlich zugewiesene Person sieht die vorbereiteten Daten im bestehenden Mitarbeiterportal.

Der allgemeine interne Ersttermin aus der Klientenaufnahme und die Beratungsterminplanung bleiben fachlich getrennte bestehende Abläufe. Dieser Einstieg legt keinen zusätzlichen allgemeinen Kalendertermin an. Eine modulübergreifende Kalenderintegration ist nicht Teil dieser Änderung.

## Prüfung

- Strikter TypeScript-Lauf mit vorhandenen Abhängigkeiten (`--noEmit --skipLibCheck`, ausreichendes Node-Heap-Limit).
- Acht React-Interaktionsprüfungen für Neuanlage, Verknüpfung, Validierung, Berechtigungen, Dublettenhinweis, Fehler/Wiederholung, erneute Fallanlage und Sitzungswechsel.
- Vorhandene 18 Repository-Prüfungen für die unverändert weiterverwendete zentrale Schreib-RPC.
- 37 isolierte PostgreSQL-Transaktionstests einschließlich neuer durchgehender Prüfung: zentraler Erstkontakt → Beratungsfall → Änderung unter Klienten → Mitarbeiterzuweisung → Start → spätere Stammdatenänderung und Wiederholung ohne Umschreiben des Besuchsstands.
- Bestehende Beratungsprüfungen einschließlich § 37.3/§ 45, persönlicher Zuweisung, Dokumentation, Signaturen, fachlicher Prüfung, Teamvorlagen und Folgeaufgaben.
- Gestaltung nutzt das vorhandene Design und ein an der Formularbreite ausgerichtetes Spaltenraster. Echte Browserprüfung für breite und schmale Ansichten sowie ein angemeldeter Live-Durchlauf sind noch offen. Happy DOM ist kein visueller Nachweis.

## Bereitstellung

Noch keine Produktionsänderung für diese Erweiterung. Zuerst den vorbereiteten SQL-Schritt über den freigegebenen Deploymentablauf anwenden und mit der tatsächlich vergebenen Versionskennung in der Migrationshistorie übernehmen; anschließend Web veröffentlichen. Der neue Einstieg bleibt ohne die Serverfähigkeit `centralContact` deaktiviert. Bestehende Klienten können weiter ausgewählt werden.

Bei Rücknahme des SQL-Schritts die beiden öffentlichen Wrapper wieder auf `care_security.consultation_extended_load` beziehungsweise `consultation_extended_mutate` richten, deren bisherigen EXECUTE-Grant an `authenticated` wiederherstellen und den Grant der neuen Kontaktfunktionen zurücknehmen. Zentrale Klientenakten und bereits festgehaltene Besuchsstände bleiben erhalten. Vorhandene Freigaben für die alten Basisfunktionen werden nicht erweitert.
