# Persönlicher Assist-Abschluss mit eigener Originalfassung

Stand 01.11.2026, Weiterentwicklung von `d1e5316`. Der achte
[SQL-Entwurf](sql/monthly-assist-originals-draft.sql) ist **nicht aktiviert**.
Er setzt die sieben Monatsentwürfe und die vorhandene Migration
`20261013072827_verified_assignment_service_records.sql` voraus. Das Paket muss
gemeinsam geprüft werden; der siebte Entwurf allein passt weiterhin nicht zum
frühen, veränderbaren Assist-Arbeitsentwurf.

## Ablauf und bisheriger Konflikt

Die Live-Dokumentation speichert einen Arbeitsentwurf, teilweise bereits vor dem
Leistungsende. Die spätere Unterschrift aktualisiert diesen Datensatz. Eine
unveränderbare persönliche Bindung dieses ersten INSERTs würde entweder zu früh
verlangen, dass der Einsatz beendet ist, oder bei der regulären Unterschrift
ungültig werden.

Der Web-Repository-Hook schließt deshalb nach dem bestätigten Einsatzende eine
**neue Original-ID** ab. Dokumentation, tatsächliche Zeiten einschließlich Pausen,
vollständige Aufgabenfassung und zugehörige gültige Unterschrift werden mit den
bestehenden kanonischen Serverfunktionen erneut geprüft. Die endgültige Kopie hat
denselben vollständigen Inhalt und Hash wie der geprüfte signierte Arbeitsentwurf.
PDF, Freigabe, Veröffentlichung und Bytebestätigung werden nicht aus dem Entwurf
übernommen.

Nur dieser serverseitige INSERT erhält den persönlichen Ursprungsbeleg aus dem
siebten Entwurf. Ein privater, unveränderbarer Abschlussdatensatz bindet die neue
ID an Entwurf, Revision, Unterschrift, Person, Sitzung und Zeitpunkt. Marker,
Original, Ursprungsbeleg und Wiederholungskennung werden gemeinsam gespeichert
oder vollständig zurückgerollt. Vorherige Nummernfreigabe, eigene aktive Sitzung
und die bestehende interne 15-Minuten-Grenze bleiben erforderlich.

Anschließend liest der vorhandene Edge-Dienst die Originalunterschrift aus Storage,
vergleicht deren tatsächliche Bytes mit dem gespeicherten Hash, erzeugt das PDF,
liest dessen gespeicherte Bytes zurück und bestätigt genau die neue Original-ID.
Erst danach kann der bestehende Dienst den zugehörigen Leistungsnachweis ableiten.
Die getrennte Office-Prüfung und Monatsbestätigung bleiben erforderlich.

## Web-Bedienung und Wiederaufnahme

Der vorhandene Einsatzabschluss nutzt die neue Fassung automatisch. Ein Web-Panel
im abgeschlossenen Einsatz zeigt, ob die persönliche Originalfassung noch offen
oder bereits gesichert ist. Es erlaubt den ausdrücklichen Abschluss bzw. eine
erneute Prüfung von PDF und Übergabe. Ein lesender Statusaufruf erzeugt keinen
Nachweis. Die Erfolgsanzeige erscheint erst nach bestätigtem Leistungsnachweis
und erneutem Lesen des persönlich gebundenen Originals. Kontowechsel verwerfen
verspätete Antworten; während einer Aktion bleiben doppelte Aufträge gesperrt.

Nur ein eindeutig fehlender optionaler RPC erlaubt den bisherigen ungebundenen
Ablauf. Netzwerk-, Sitzungs-, Berechtigungs-, Format- oder Datenbankfehler sind kein
Signal für diesen Rückfall. Nicht erfasste Altfälle bleiben ausdrücklich ohne
persönliche Herkunft. Eine verlorene Abschlussantwort wird lesend gegen genau
Entwurfs-ID, Zeitstempel, Inhaltshash, Signatur und Einsatz abgeglichen. Wiederholte
Anfragen erhalten dasselbe Original. Ein späterer Widerruf kann nicht durch eine
alte Wiederholungskennung aufgehoben werden.

## Schutz der Quellen

Nach dem Abschluss sind Inhalt und Identität der Originalkopie sowie ihr
Arbeitsentwurf gegen Änderungen und Löschung geschützt. Späte automatische
Entwurfsjobs dürfen keine andere Fassung davor setzen. Der bestehende Byte-Dienst
darf noch das PDF anfügen; danach greifen zusätzlich die vorhandenen Sperren für
bereits an `service_records` gebundene Nachweise.

Die Monatsübernahme akzeptiert für persönlich geführte Einsätze nur diese finale
Original-ID. Eine direkt vorzeitig abgeleitete Quelle oder ein alter Entwurf kann
keine persönliche Herkunft erhalten und nicht auf einen unbestätigten Bezug
zurückfallen. Bereits übergebene Quellen werden nicht nachträglich umgebunden.
Zusätzlich prüft ein Servertrigger die persönliche Herkunft schon beim Ableiten
des Leistungsnachweises. Dadurch können ältere Clients und ein noch nicht
aktualisierter PostgREST-Schemacache die neue Abschlussbindung nicht umgehen.
Ein vorzeitig erzeugtes Entwurfs-PDF verhindert die spätere korrekte Fertigstellung
nicht; es wird nicht als finaler Nachweis übergeben. Der SQL-Entwurf stößt nach
Installation außerdem ausdrücklich die Aktualisierung des Schemacaches an.

## Prüfungen und Grenzen

- `monthly-assist-originals.test.mjs` führt die acht SQL-Entwürfe und die tatsächliche
  kanonische Einsatzmigration in PGlite aus. Auth, Rollen, Storage-Transport und die
  übergeordnete Office-Grenze sind kontrollierte Doubles; die kanonische Prüfung
  von Aufgaben, Zeiten, Unterschrift und Original sowie die Byte-Handlerlogik sind
  die tatsächliche Implementierung. Historische Registrierungs- und Einsatzzeiten
  werden ausschließlich in der isolierten Fixture angelegt.
- Der normale CI-Lauf verwendet ein ausdrücklich synthetisches Assist-PDF aus dem
  bereits vorhandenen jsPDF. `node scripts/gkv-assist-original-bytes.mjs` verwendet
  zusätzlich den unveränderten Edge-Renderer mit der bereits verfügbaren
  `pdf-lib`-Version 1.17.1; dafür wird nichts installiert. Ein Lauf ohne diese
  vorhandene Bibliothek darf nicht als bestanden gewertet werden.
- Ein integrierter Fall in `tsl-ocsp.test.mjs` führt Abschluss, Bytebestätigung,
  Monatsdaten, amtliche XSD, tatsächliches lokales SOAP/CMS und gesonderte
  Monatsbestätigung zusammen. Der Konnektor und seine Karte sind synthetisch.
- Web-Repository- und tatsächliche React-DOM-Prüfungen belegen Bedienlogik,
  Wiederaufnahme, Sperren und Kontowechsel. Ein ausführbarer Browser für die
  breite/schmale optische Abnahme steht hier nicht zur Verfügung.

PGlite serialisiert seine Verbindung; mehrfach angestoßene Aufträge sind kein
Nachweis echter konkurrierender PostgreSQL-Verbindungen. Reale Auth-/RLS-/Storage-
Integration, Parallelverbindungen, Geräte und produktive Aktivierung sind offen.
Die unveränderte Android-Anwendung erhält durch den Web-Hook keinen eigenen
Abschlussweg. Einzelne mobile Leistungen, Mehrpersonenleistungen, Ersatznummern,
PDL-Provisionierung und Tarif-/Vertragsregeln bleiben gesonderte Aufgaben.

Später im Klientenportal eingeholte Unterschriften und fachliche Berichtigungen
des bereits abgeschlossenen Assist-Ursprungs benötigen einen eigenen Ablauf. Sie
werden nicht nachträglich als zeitnahe persönliche Erfassung ausgegeben. Die
vorhandene **Monatskorrektur** ist davon zu unterscheiden: Sie erhält die Quelle,
entwertet die alte Monatsfassung und verlangt eine neue Monatsbestätigung.

Diese Arbeit belegt weder ausgeführte ITSG-Prüffälle noch Hardware, TI, Annahme durch
Kassen oder Zulassung. `upstreamEmployeeCaptureVerified`, `dispatchReady`,
`productionReady` und `submissionDossierComplete` bleiben false.
