# Persönliche Monatsbestätigung: Originaldateien und privater Prüfbeleg

Stand: 29.10.2026. Der private Dienstkern erzeugt die anzuzeigende PDF-Fassung,
bewahrt deren Bytes zusammen mit einer neu erfassten PNG-Unterschrift auf und
erstellt nach dem Zurücklesen einen gebundenen Prüfbeleg. Dieser wird im lokalen
Prüflauf vom bestehenden SQL-Befehl `confirm` tatsächlich verbraucht.

**Es gibt noch keine freigegebene Host-/App-Anbindung für diesen Ablauf.** Der
SQL-Entwurf ist nicht eingespielt. Keine Rolle erhält durch den Entwurf einen
Ausführungszugang. Vertreter, Druck/Scan und Fach-XML sind nicht implementiert.
Das ist keine abgeschlossene ITSG-Prüfung und keine Freigabe zum Echtversand.

## Ablauf

| Aufruf im privaten Dienst | Ergebnis |
| --- | --- |
| `prepare` | Prüft persönliche Beauftragung, offene Fassung und aktuelle kanonische Quellen. Erzeugt die PDF selbst und liest sie aus dem verschlüsselten Archiv zurück. |
| `readOriginal` | Liest genau diese gespeicherten Bytes, solange Akteur, Fassung und Erfassung unverändert und nicht abgelaufen sind. |
| `acknowledge` | Bindet die ausdrückliche Bestätigung der angezeigten Originalfassung an deren SHA-256. Das Backend kann damit keine tatsächliche Betrachtung beweisen; diese Aktion muss später aus der geprüften Ansicht kommen. |
| `verify` | Prüft und archiviert die PNG-Bytes einmalig. Liest Original und PNG zurück, prüft Berechtigung und Quellen erneut und lässt den privaten SQL-Erzeuger den Prüfbeleg anlegen. |
| vorhandenes `confirm` | Verbraucht diesen Beleg unter derselben persönlichen Identität und wiederholt Quellen-/Fassungsprüfung. Erst dieser getrennte Auftrag finalisiert den Monatsdatensatz. |
| `readArchivedOriginal` | Liest die ursprünglich angezeigte PDF zu einem tatsächlich bestätigten oder später entwerteten Nachweis. Benötigt aktuelle Leserechte, keine Schreibbeauftragung. Liefert den aktuellen Archivstatus und keine wiederverwendbare Unterschriftsdatei. |

Die neue Erfassungskennung gehört genau zu einer persönlichen Sitzung im Sinne
des serverseitig aufgelösten Akteurs, einer Nachweis-ID und deren Bearbeitungsstand.
Es wird noch keine separate Auth-Sitzungs-ID gespeichert. Die spätere Gateway-
Anbindung muss die tatsächliche, aktuelle Anmeldung prüfen; eine vom Aufrufer
mitgeteilte Benutzerkennung genügt nicht. `auth.uid()` und der vorhandene
Office-Berechtigungsprüfer werden bei jedem SQL-Zugriff erneut ausgewertet.

Die interne Erfassungsfrist beträgt 30 Minuten. Das ist eine eigene technische
Begrenzung, keine behauptete gesetzliche Frist. Browserzeitstempel werden nicht
übernommen. Erfassungs- und Prüfzeit stammen aus den Datenbankabfragen; die
Prüfzeit wird erst nach dem Zurücklesen der Dateien festgeschrieben.

## Original und Unterschrift

Die PDF verwendet die vorhandene Century-Gothic-Schrift. Sie enthält Klient,
Monat, Leistungsart, Fassungsstand, alle übernommenen Leistungsbeschreibungen,
Pflegekräfte, Zeiten, Aufgaben und Notizen. Normale Leistungsblöcke bleiben
zusammen; längere Texte werden ohne Kürzung auf weitere Seiten umgebrochen.
Folgeblätter wiederholen Klient, Monat und Fassung. Unbekannte oder nicht
darstellbare Zeichen führen zu einem Fehler statt zu fehlenden Textteilen.

HTML, PDFs, bestehende Einsatzunterschriften und externe URLs werden nicht als
Original angenommen. Die Fassung stammt ausschließlich aus der privaten
SQL-Kontextabfrage. Die Dienstschnittstelle nimmt keine frei gewählten
Unterzeichnernamen, Vertreterangaben oder Hashbehauptungen entgegen.

Für die persönliche Bestätigung wird der Name aus dem gebundenen
Klientendatensatz verwendet. Das beweist weder die Identität der tatsächlich
zeichnenden Person noch ihre Einwilligung. Die echte Unterschriftserfassung,
die eindeutige Anzeige vor dem Zeichnen und die Zuordnung zur Person müssen
noch in der App umgesetzt und am gesamten Ablauf geprüft werden.

Der begrenzte PNG-Leser akzeptiert nicht verschachtelte, nicht animierte RGB-
und RGBA-Bilder mit acht Bit je Kanal. Er prüft Chunk-Grenzen, CRC, zulässige
Abmessungen, begrenzte Dekompression, Filter und sichtbare Bildinhalte. Leere,
beschädigte, übergroße oder nicht unterstützte Bilder erzeugen keinen Beleg.

Neben dem SHA-256 der Originalbytes wird ein Fingerabdruck der dekodierten,
auf Weiß zusammengesetzten Bildpunkte ohne leeren Rand gebildet. Andere
Komprimierung, PNG-Filter, Textmetadaten, RGB/RGBA-Kodierung und zusätzliche
leere Ränder machen dasselbe Bild dadurch nicht zu einer neuen Unterschrift.
Archiv und PostgreSQL verhindern die erneute Verwendung innerhalb eines
Mandanten. Das ist keine Handschrifterkennung; veränderte, etwa skalierte oder
neu gezeichnete Bilder werden damit nicht zuverlässig als identisch erkannt.

## Aufbewahrung und Wiederaufnahme

Der Baustein verwendet den bereits vorhandenen SQLite-/AES-256-GCM-Speicher
aus `services/gkv/storage.mjs`. Snapshot, Original, Anzeigequittung, Unterschrift
und Prüfbeleg werden mit an Mandant, Erfassung und Objekt gebundener
authentifizierter Verschlüsselung gespeichert. Der Schlüssel liegt außerhalb
der Datenbank. Die gespeicherten PDFs bleiben lesbare PDF-Originalbytes; die
Verschlüsselung schützt ihre Aufbewahrung im Archiv.

Dateien werden durch die Dienstmethoden nicht überschrieben. Versionen und
Hashes bleiben unverändert. Ein konfigurierbares Mandantenlimit zählt alle
verschlüsselten Nutzdaten einschließlich Anzeigequittung und Prüfbeleg vor
jedem Hinzufügen. SQLite-Index-/Datei- und WAL-Overhead ist darin nicht enthalten
und benötigt zusätzlich eine betriebliche Volumenbegrenzung.
Das ist keine WORM- oder Revisionssicherheitszertifizierung.
Backup, Schlüsselrotation, Aufbewahrungsregeln, Wiederherstellung, Zuordnung
eines Archivs zum Host und dessen Betrieb bleiben gesondert zu prüfen.

Die Pfade `tenant/…/gkv/monthly/…/captures/…/original.pdf` und `signature.png`
sind logische Referenzen dieses privaten Archivs. Es wurden keine Objekte in
einen Supabase-Bucket geschrieben. Bestehende allgemeine Upload-/Upsert-Rechte
des Office-Dokumentenbereichs werden hierfür nicht verwendet.

Vor der Belegerteilung speichert der Dienst den unveränderten Auftrag mit
Beleg-ID. Eine verlorene oder widersprüchliche Antwort löscht ihn nicht.
Nach einem Neustart kann ein ausdrücklich wiederholter Aufruf dieselben Bytes
und dieselbe Kennung verwenden. Es gibt keinen automatischen Neuversuch.
Eine andere Unterschrift unter derselben Erfassungskennung wird abgewiesen.

Bei einer Korrektur bleibt das alte Original erhalten. Ein reiner Leser kann
es mit Status `invalidated` abrufen. Es wird dabei weder wieder endgültig noch
neu bestätigt. Die Folgefassung benötigt einen neuen Erfassungsvorgang und
ein anderes Unterschriftsbild.

## SQL-Vertrauensgrenze

[Der zusätzliche Review-Entwurf](sql/monthly-original-verifier-draft.sql)
ergänzt die private Belegtabelle um den Bildfingerabdruck. Drei ausschließlich
private Funktionen lesen den aktuellen Kontext, lesen einen Archivkontext
oder übernehmen einen Prüfbeleg. Sie haben einen festen Suchpfad und prüfen
die persönliche Office-Berechtigung, beim Schreiben auch die aktuelle
fachliche Beauftragung. Keine rohe Tabellenfreigabe ist erforderlich.

`PUBLIC`, `anon`, `authenticated` und `service_role` dürfen diese Funktionen
nicht ausführen. Auch ein RLS-Bypass allein erteilt kein Funktionsrecht. Die
Funktionen sind keine öffentlichen RPC-Wrapper. Die spätere explizite Freigabe
eines verifizierenden Hosts und seiner persönlichen Authentisierung ist
weiter offen. Nur der byteprüfende Dienst darf einen solchen Zugang erhalten;
die Datenbank kann die Inhalte seines lokalen Archivs nicht selbst nachlesen.

Bei der Belegübernahme werden Serie und Nachweis in derselben Reihenfolge wie
beim bestehenden Korrektur-/Bestätigungsbefehl gesperrt. Inhaltshash,
Bearbeitungsstand, ursprüngliche Quellen, Akteur, Patient, Dateireferenzen und
Zeitfenster müssen noch passen. Dubletten desselben Belegs sind nur mit
identischem Inhalt erlaubt. Der endgültige Abschluss bleibt ein gesonderter
atomarer Vorgang im bisherigen Speichervertrag.

Es wurde keine Migration erzeugt oder angewendet. Sollten in einer späteren
Zielumgebung bereits Belege existieren, dürfen deren Bildfingerabdrücke nicht
erfunden oder aus Dateinamen abgeleitet werden. Ein Abgleich mit den echten
Originalbytes und der zulässigen Aufbewahrung ist dann erforderlich.

## Prüfstand und Grenzen

`monthly-originals.test.mjs` besteht mit 20 Testmeldungen: drei Datei-/PDF-Fälle,
16 Unterfälle des integrierten Dienst-/Datenbanklaufs und dessen Hauptfall.
Die Tests erzeugen PNGs mit einem unabhängigen vorhandenen Encoder und lesen
die echten erzeugten PDFs mit PDF.js. Sie verwenden echte verschlüsselte
SQLite-Dateien, Neustarts und PGlite mit den tatsächlichen SQL-Entwürfen.
Der vorhandene Office-Quellprüfer und die Anmeldeauflösung sind Vertragsdoubles.
Die Unterschriftsbilder sind rein synthetisch. PGlite belegt keine konkurrierenden
Verbindungen einer produktiven PostgreSQL-Installation.

Geprüft sind unter anderem geänderte Quellen und entzogene Rechte während der
Prüfung, falsche Akteure, Mandanten und Dateireferenzen, manipulierte Archive,
leere/ungültige PNGs, Wiederverwendung über getrennte Archive, verlorene
Antworten, Doppelaufrufe, Wiederaufnahme nach Neustart, Korrektur mit neuer
Bestätigung und unveränderte Archivansicht für reine Leser.

Die neuen Fälle sind Bestandteil von `verify:gkv:monthly-proofs` und damit des
bestehenden Webbuilds. Die bisherigen 27 Vertragsfälle, 24 SQL-Testmeldungen und
zehn React-Bedienabläufe bestehen ebenfalls. Alle drei mit Poppler gerenderten
synthetischen PDF-Seiten wurden auf Umbrüche, Umlaute und Lesbarkeit angesehen:
Leistungsblöcke bleiben vollständig, Folgeblätter wiederholen den Fassungskopf.
Das belegt keine schmale
App-Ansicht oder tatsächliche Unterschriftserfassung im Browser.

Die Implementierung bereitet die Bestätigungs- und Korrekturabläufe aus dem
[offiziellen ITSG-Prüfkatalog](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf)
vor. Die Fälle 3.6–3.11 und 5.1/5.2 sind damit noch nicht bestanden. Die aktuelle
Pflegeseite und der Prüfkatalog wurden am 29.10.2026 erneut gelesen.

Offen sind die Host-/Gateway-Freigabe, die tatsächliche persönliche Anmeldung,
Originalanzeige und Erfassungsoberfläche, die Vertreterprüfung, der Druck-/
Scan-Pfad, signiertes Fach-XML mit XSD-/CMS-Prüfung und die unabhängige Abnahme.
