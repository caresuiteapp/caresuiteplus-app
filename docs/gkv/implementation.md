# Pflegekassen-Datenaustausch nach § 105 SGB XI

Stand: 21.10.2026. Diese Änderung ist ein prüfbarer Entwicklungsstand für den
klassischen Datenaustausch. Sie ist **keine vollständige produktive Umsetzung**
aller GKV-Fachprofile und keine Bestätigung einer Abnahme oder Zertifizierung.
Veröffentlichung, Datenbankfreigabe und Echtbetrieb sind eigenständige Schritte.

Der Auftrag umfasst seit 20.10.2026 ausdrücklich **Eigenentwicklung von DTA und
KIM einschließlich eigenem Fachdienst**. Der neue ausführbare Dienstkern und die
noch offenen Integrations-/Zulassungsschritte sind in
[own-services.md](own-services.md) beschrieben. Ein externer DTA- oder KIM-Anbieter
ist nicht mehr die vorgesehene Implementierungsabhängigkeit.
Der aktuelle Dienststand verbindet auch einen eigenen lokalen mTLS-SMTP-Eingang,
mathematische AUT-Tokenprüfung, begrenzte äußere CMS-Prüfung, atomare Postfach-
zustellung und selbst erzeugte Zustellmeldungen mit dem vorhandenen POP3-Empfang.
Der [ECC-CMS-Kern](ecc-cms.md) kann nun Nachrichten mit Brainpool/ECDSA signieren,
mit TI-ECIES/AES-GCM verschlüsseln und nach dem lokalen SMTP-/POP3-Weg wieder
entschlüsseln und mathematisch prüfen. Die Zertifikatsidentität bleibt ausdrücklich
unbestätigt. Der [Nachrichtenablauf](kim-client-message.md) ergänzt AUT-Erzeugung,
äußere MIME-Nachricht, geschützten Headervergleich und einen eigenen AUT-
Empfangsprüfer für zeitversetztes Abholen. Der [Fehlerpfad](kim-receive-errors.md)
erzeugt inzwischen lokale Diagnosemails mit unveränderten Originalbelegen und
standardmäßig deaktiviertem Klartextanhang. Die [OCSP-Prüfung](ocsp.md) ergänzt
signierte Sperrstatusbelege gegen konfigurierte Pins, einen begrenzten lokalen
Cache und die Bindung der Ergebnisse an die OSIG-/AUT-Zertifikate im Empfangsbericht.
TI-Vertrauensbeschaffung, vollständiges KIM-Clientmodul, externe Fachdienstweiterleitung
und die kanonische CareSuite-Versandfreigabe bleiben offen.

## Verbindliche Quellen und Versionsstand

Maßgeblich sind die Originalunterlagen auf der
[GKV-Pflegeseite](https://www.gkv-datenaustausch.de/leistungserbringer/pflege/pflege.jsp).
Für diese Implementierung wurden insbesondere folgende Unterlagen geprüft:

| Unterlage | Umsetzung / Bedeutung |
| --- | --- |
| TA 1, Version 6.4.0, gültig ab 01.05.2026 | Dateistruktur, PLGA/PLAA, Felder, Nachrichtenfolge, KIM-Abgrenzung |
| TA 3, Version 6.4.0 | Abrechnungs-, Leistungs-, Vergütungs-, Qualifikations- und Beschäftigtenschlüssel |
| TA 1 Anhang 1, Version 2.0 | 348-Byte-Auftragsdatei |
| TA 1 Anhang 2, Version 2.2.1 | Test-/Erprobungsverfahren mit den Annahmestellen |
| TA 1 Anhang 3, Version 2.1.2 | Klassischer Transport, Verschlüsselung und KIM |
| TA 1 Anhang 4, Prüfkatalog und Selbsterklärung | Softwareprüfung, PROD-/MOD-ID und zeitbezogene Nachweisgültigkeit |
| TA 1 Anhang 5, Version 5.2 | KOTR-Dateien, Empfängerverknüpfungen und zeitliche Gültigkeit |
| TA 1 Anhang 6 | Fehlermeldeverfahren; automatische Verarbeitung noch offen |

Ab 01.02.2027 ist auf die dann geltende TA 1 Version 6.5.1 und zugehörige
Anlagen umzustellen. Die Erzeugung mit Version 6.4.0 ist ab diesem Datum
gesperrt. Maßgeblich ist das Erstelldatum in der Zeitzone Europe/Berlin, nicht
das UTC-Kalenderdatum. Eine ältere Dateierstellung wird nicht automatisch als
zulässige aktuelle Übermittlung interpretiert.

## Bedienbarer Umfang

Einstieg: Office → Rechnungen → **Pflegekassen-Abrechnung**;
Route `/business/office/billing/kassenabrechnung`.
Die zusätzliche `.web.tsx`-Implementierung lässt die native Android-Ansicht
unverändert.

1. Abrechnungsprofil mit eigenem IK, Absender-IK, Kassenart, Bundesland,
   Abrechnungscode, Tarifkennzeichen und bestätigter steuerlicher Einordnung
   speichern. Die Umsatzsteuerbefreiung wird nicht aus der Branche abgeleitet.
2. Ein Paket für genau eine Leistungsart, Pflegekasse und einen Monat anlegen.
   Bestehende Pakete behalten eine Kopie ihres Vertragsstands.
3. Ausgestellte Rechnungen mit Personendaten, sämtlichen Positionen und Nachweisreferenzen übernehmen oder einen manuellen Prüffall erfassen. Vertragsziffern, Beschäftigtennummern und fachliche Nachweisbestätigung ergänzen. Beträge werden übernommen; GKV-Schlüssel und Vergütungsverträge werden nicht aus Beschreibungstexten geraten. Geänderte Quellen können im Fall erneut übernommen werden.
4. Die fall- und positionsbezogenen Prüfhindernisse bearbeiten und den Entwurf
   speichern. Unvollständige Textangaben sind als Entwurf zulässig; ungültige
   Zahleneingaben müssen vor der Speicherung korrigiert werden.
5. Für unterstützte Varianten eine interne Prüfdatei erzeugen. Nutzdaten und
   Auftragsdatei werden getrennt heruntergeladen. Sie sind unverschlüsselt und
   werden von dieser Anwendung nicht an eine Annahmestelle versandt.
6. Bearbeitungsvermerke im Verlauf erfassen. Ein solcher Vermerk kann weder
   Annahme, Zustellung noch Bezahlung setzen.
7. Gespeicherte Paketstände seitenweise laden und schreibgeschützt ansehen.
   Einen früheren klassischen Prüfstand mit Begründung als neuen Testentwurf
   übernehmen. Ursprung und ausgewählte Revision bleiben verknüpft;
   Nachweisbestätigungen werden zurückgesetzt. Dies ist kein Kassenstorno und
   kein fachlicher Korrekturversand. Dateinummern sind erneut zu koordinieren.

Das Verzeichnis zeigt die 100 zuletzt geänderten Pakete, maximal 100 zur
Übernahme angebotene Rechnungen, 30 Verzeichnisimporte und 100 Protokolleinträge.
Diese Begrenzungen werden in der Oberfläche ausgewiesen. Ein historisches
Vollarchiv mit serverseitiger Suche/Paginierung ist noch nicht implementiert.
Die neue Revisionshistorie innerhalb eines ausgewählten Pakets hat diese
100er-Grenze nicht: Sie lädt jeweils 20 ältere Stände über einen Revisionscursor.

## Fachliche Grenzen der Dateierzeugung

| Fall | Stand |
| --- | --- |
| Selbstabrechnung, eigenes Absender-IK | Implementiert |
| Leistungsarten 01, 07, 09, 10, 13 | Grundprofile für klassische Prüfdateien |
| Tages-/Nachtpflege 02/03 | Vereinbarter voller/halber Pflegesatz je tatsächlichem Tag, Beginn/Ende, bestätigter Folgetag bei Nachtpflege, passende Anbietergruppe; Beförderungsentgelt separat |
| Kurzzeit-/vollstationäre Pflege 04/05 | Vertraglich bestätigter Tagessatz einschließlich Von-/Bis-Tag oder feste Pauschale für den vollständigen Kalendermonat; eigener Abwesenheitspreis, keine überlappenden Zeiträume |
| DiPA-Unterstützung 15 | Ambulante Anbietergruppe, Zeitvergütung mit Zeitart 0 und ausdrücklicher Vertragsgrundlage |
| Vergütungsarten 01, 06 mit Pauschalen 01–03, 07, 08, 99 | Einzelpreis × Menge mit ganzzahliger Centberechnung |
| Beratungspauschale | Schlüssel 1 vor Ort / 2 Video, nur Leistungsart 09 |
| Entlastungsleistung | Anbieterbezogene Schlüssel aus TA 3, nur Leistungsart 10 |
| Steuerbehandlung | Bestätigter Befreiungsschlüssel 01; zusätzlich steuerpflichtige Pflegehilfsmittel mit Steuernummer und ausdrücklich gewähltem Satz 19 % / 7 % je Position |
| Pflegehilfsmittel 06 / Vergütung 05 | HIL-Segment, technische/Verbrauchshilfsmittel, Positionsnummer, Genehmigung, Lieferung, Produktbesonderheit, Inventar und Zuzahlung; ganze Mengen, explizite Vertrags- und Steuerregel |
| Sonderleistungen 08/11/12/14 | Fallbezogener Bescheid/Vertrag, Zeitraum, Höchstbetrag und Datenaustauschvereinbarung; Einzelbeträge, bei 08/12/14 vollständige Monatspauschale; bei 11 zusätzlich Komplex-/Zeitvergütung |
| Zeitvergütung | Zeitanteilig oder je angefangener verschlüsselter Einheit; ausdrückliche Vertragsreferenz und Auswahl erforderlich |
| Punktwert | Leistungskomplexe: bis fünf Dezimalstellen, Einzelpreis kaufmännisch auf Cent, danach Menge |
| Kilometervergütung | Tatsächliche Strecke bis zwei Dezimalstellen, ganze Kilometer kaufmännisch gerundet; bestätigte Vertragsregel erforderlich |
| Einfache ambulante Zuschläge/Abzüge | ZUS-Berechnung 11 (prozentual) und 12 (fester Betrag), nur einzelne Pauschalen/Leistungskomplexe mit Menge 1; ausdrücklich bestätigte Vertragsgrundlage |
| Weitere Zuschlagsberechnungen und stationäre Sonderfälle | Noch zu implementieren und fachlich abzunehmen; neue Sonderprofile decken nur die ausdrücklich beschriebenen Vertragsmodelle ab |
| Sammelabrechnung über Abrechnungszentrum | Noch nicht exportierbar |
| Verknüpfte Leistungsdaten / ausgewählte Originalnachweise | Serverabgleich mit den vorhandenen Office-Verifizierern, Revisionen und tatsächlichen PDF-Bytes; kein KIM-Nachweisexport |
| KIM, XML-Leistungsnachweise, SMC-B-Signaturen | Serverseitige Paket-/MIME-Vorbereitung und Prüfverträge vorhanden; XML-Erzeuger, echte XSD-/CMS-Prüfer und TI-Dienst fehlen |
| Verschlüsselter klassischer Echtversand | Eigener SECON-/TLS-SMTP-Kern, verschlüsselte Outbox und Worker mit dauerhafter Versandbindung lokal integriert; kanonischer Freigabe-/Reservierungsablauf und Betriebsanschluss fehlen |
| Technischer Rückmeldeeingang | Eigener TLS-POP3-Abruf, verschlüsselte Inbox und begrenzte DSN-/Anlage-7-Korrelation; Herkunft bleibt ungeprüft, keine automatische Fachstatusübernahme |

Bei TA 1 Version 6.4.0 ist KIM auf die dort genannten Leistungsarten 01, 07
und 10 beschränkt; bei 10 gilt zusätzlich die Einschränkung auf ambulante
Pflegeanbieter. Insbesondere werden Beratungseinsätze der Leistungsart 09
und häusliche Schulungen der Leistungsart 13 nicht als KIM-fähig ausgegeben.

Die Formprüfung prüft kein Leistungsrecht, keine Bewilligung, keinen individuellen
Vergütungsvertrag und keine Richtigkeit einer handschriftlichen Unterschrift.
Ein technisch erzeugtes EDIFACT-Dokument ist dadurch weder fachlich abgenommen
noch zum Echtversand freigegeben. Es ist auch keine XRechnung oder ZUGFeRD-Datei.

## Architektur und Vertrauensgrenzen

### Fachmodell und Serializer

`src/lib/gkvExchange/model.ts` enthält Version, Eingabeformen und Fachprüfungen.
`editor.ts` verarbeitet Dezimalzahlen ohne binäre Rundung bei gespeicherten
Geldbeträgen. `pricing.ts` verwendet BigInt für Multiplikation, rationale Zeitanteile und kaufmännische Cent-Rundung. Die tatsächliche Dauer bleibt erhalten, auch bei einem Vertrag über angefangene Einheiten. Anzahl ist dabei die Anzahl gleicher Leistungen, nicht nochmals die Minuten- oder Kilometerzahl. Punktwert und Punktzahl werden in ELS ausgegeben. Die auswählbaren Berechnungsregeln sind explizite Vertragsmodelle, keine bundesweit vorgegebenen Vergütungstarife. Ihre Eignung für den jeweiligen Tarif und die Annahmestelle muss unabhängig geprüft werden; abweichende Vertragsrundungen bleiben ununterstützt.

`care.ts` prüft die neuen Pflegesatzprofile. Bei Tages-/Nachtpflege enthält ELS
das tatsächliche Ende als HHMM. Halbtage verwenden ihren ausdrücklich erfassten
Vertragspreis; die Software halbiert keinen Tagessatz. Nachtpflege über
Mitternacht benötigt eine ausdrückliche Folgetagsangabe. Monatsüberschreitende
Nachtpflege und teilstationäre Abwesenheit werden bis zur Implementierung ihrer
besonderen Zeitzuordnung blockiert.

Bei stationärer Tagesberechnung enthält ELS den Von-/Bis-Tag als TTTT. Die
Eingabemaske übernimmt die Anzahl einschließlich beider Grenztage; diese
Zählweise muss vertraglich bestätigt sein. Andere Zählweisen werden nicht
angenähert. Die feste Monatspauschale erfordert ESK 99, den vollständigen
Kalendermonat und Menge 1. Der ursprüngliche Rechnungspositionstag bleibt als
Quellreferenz erhalten; die Quellrechnung muss den vollständigen Monat abdecken.
Ein einzelner Einsatznachweis reicht dafür nicht aus. Anwesenheits- und
Abwesenheitszeiträume dürfen sich innerhalb eines Falls nicht überschneiden.
Unterkunft, Verpflegung, Investitionskosten, weitere Zuschläge, Leistungsrecht
und automatische Kürzungen sind durch dieses Grundprofil nicht abgedeckt.

`edifact.ts` erzeugt UNB/UNZ und PLGA-/PLAA-Nachrichten, zählt UNH/UNT und
maskiert EDIFACT-Steuerzeichen. Der Parser verarbeitet Aufhebungszeichen in
einem Durchlauf. Die Ausgabe ist verlustfrei ISO 8859-1; nicht darstellbare
Zeichen werden abgewiesen. Die Auftragsdatei hat feste Bytepositionen.
Entschlüsselnde und physikalische Annahmestelle werden getrennt geführt.

`adjustments.ts` ergänzt unabhängig berechnete Zu- und Abschläge für einzeln
ausgewiesene ambulante Pauschalen und Leistungskomplexe. Berechnung 11 bezieht
sich auf den unveränderten Basisbetrag, Berechnung 12 ist ein fester Betrag.
Jedes Ergebnis wird separat mit BigInt kaufmännisch auf Cent gerundet; Abzüge
werden mit eigenem Vorzeichen verrechnet. Die Vertragsregel muss ausdrücklich
bestätigt werden. ZUS meldet den jeweiligen Differenzbetrag, fünf Nachkommastellen
im Wert und die berechneten Ende-Kennzeichen. Die unveränderte Basis bleibt in ELS,
die Gesamtsumme einschließlich der Zu-/Abschläge in IAF/GES.

Tarifbereich, ambulante Zuschlagsart, Grund, Zuordnung zur Leistung/Wegegebühr,
Wert, Vertragsreferenz und gegebenenfalls zweite Beschäftigtennummer werden
geprüft. Der Tarifbereich verwendet die TA3-Schlüssel (Berlin 23), nicht die
Routing-Bundeslandnummern. Nicht belegte Schlüssel, negative Positionssummen,
Feldüberläufe und fremde Zuschlagsstrukturen blockieren die Ausgabe. Die
Quellrechnung muss weiterhin genau den Gesamtbetrag einschließlich Zuschlägen
enthalten; aus ihren Beschreibungstexten wird keine Zuschlagsregel abgeleitet.

Mehrfachmengen, Zeit-/Kilometerzuschläge, Monats-/Tagesbeträge, Punktzuschläge,
stationäre Abzüge und verkettete Ersatzwerte sind nicht durch dieses Profil
abgedeckt. Die Vertragsmodelle und Segmentfolgen benötigen noch unabhängige
Annahmestellen-Testfälle; die lokalen Tests sind keine Tarif- oder Normabnahme.

### Pflegehilfsmittel und Sondervereinbarungen

`special.ts` berechnet Pflegehilfsmittel mit BigInt: bei Nettopreisen Steuer je
Stück kaufmännisch auf Cent runden, danach Menge; bei Bruttopreisen die enthaltene
Steuer ausweisen, ohne sie nochmals hinzuzurechnen. Nur ganze Liefermengen sind
unterstützt. Netto, Steuer, Brutto, Menge, Nettostückpreis und Steuersatz müssen
mit der Quellrechnung exakt übereinstimmen. Eine andere Rundung der Quellrechnung
wird abgewiesen; Originalrechnungen werden weder umgeschrieben noch angepasst.
Die Auswahl der steuerlichen Einordnung bleibt ausdrücklich erforderlich.

Technische Hilfsmittel benötigen Genehmigungskennzeichen und Lieferkennzeichen.
Reservierte Schlüssel werden abgewiesen. Eine zweistellige Produktgruppe
benötigt eine Bezeichnung; eine vergebene Positionsnummer hat zehn Stellen.
Produktbesonderheiten und Inventarnummern werden entsprechend der erklärten
Vertragsanforderung geprüft; Wiedereinsatz erfordert die Inventarnummer. Die
Summe der HIL-Zuzahlungen muss der Fallzuzahlung entsprechen. Es werden keine
Zuzahlungsobergrenzen oder Leistungsansprüche automatisch festgesetzt.

Die Sonderprofile 08, 11, 12 und 14 verlangen die tatsächliche Bewilligung oder
Vertragsreferenz, ihren Zeitraum, einen für den Fall bestätigten Kassenhöchstbetrag
und die Vereinbarung zum Datenaustausch. Dies ist eine zusätzliche Anwendungssperre,
kein Nachweis der Echtheit eines Bescheids. 08/12/14 unterstützen Vergütung 99;
11 zusätzlich Komplex- und Zeitvergütung. Eine feste Pauschale bei 08/12/14
benötigt den abgeschlossenen vollständigen Monat, ESK 99, Menge 1 und eine einzige
Position. Vertrags- und Quellzeitraum müssen passen. Vertragswerte werden nicht
als allgemeine gesetzliche Pauschalen vorbelegt.

### Authentifizierter Export

`POST /api/gkv/test-export` nimmt nur `tenantId`, `batchId` und `revision` an.
Der Dienst lädt mit dem JWT des Aufrufers über Supabase/RLS. Er verwendet
keinen Service-Role-Schlüssel und akzeptiert keine frei eingereichte Abrechnung.
Die zusätzliche RPC `gkv_exchange_export_allowed` prüft serverseitig sowohl
Lese- als auch Erstellrechte.

Vor der Ausgabe werden Stand, Modus und Fachprüfungen geprüft. Die neue RPC `gkv_invoice_source_snapshot` lädt alle ausgewählten Rechnungspositionen, zugehörigen Leistungsdatensätze und ausgewählten Originalnachweise. Sie prüft den Office-Zugang und ruft die vorhandenen Funktionen `office_invoice_assert_source` und `office_invoice_proofs` auf.

Der Export gleicht Rechnungsnummer, Datum, Person, Betrag, jede Positionsreferenz und Revision ab. Fehlende, doppelte und geänderte Positionen blockieren. Steuerpflichtige Positionen sind ausschließlich im ausdrücklich gewählten Hilfsmittelprofil mit vollständigem Netto-/Steuer-/Bruttoabgleich zulässig. Bei Zeitpositionen aus Leistungsdatensätzen müssen Dauer und Anzahl zur bestätigten abrechenbaren Dauer passen. Die Nachweisauswahl und ihre Revisionen müssen unverändert sein. Ausgewählte Original-PDFs werden mit dem Benutzer-JWT aus dem erlaubten Mandantenpfad geladen und bytegenau gegen den bestätigten SHA-256 geprüft. Externe URLs, fremde Pfade und Umleitungen sind ausgeschlossen; Grenzen: 20 MB je PDF, 50 MB insgesamt, 40 Sekunden Prüfbudget.

Nach der Dateierzeugung werden die Quellen nochmals vollständig geprüft und mit dem ersten Stand verglichen; auch Paketrevision und Status werden erneut gelesen. Die Antwort weist getrennte Prüfzahlen für Rechnungen, Positionen, Leistungsdatensätze und PDFs sowie manuelle Fälle aus. Manuelle Prüffälle haben keinen automatischen Quellnachweis. Die PDF-Prüfsumme belegt Byteidentität, keine PDF/A-Eigenschaft oder KIM-Signatur. Der Rückgabewert enthält Byteinhalt, SHA-256 und die Einordnung
`unencrypted_test`. Dieser öffentliche Endpunkt bietet keinen Versand und gibt keine Produktionsdateien heraus.

Die Quellprüfung im Prüfexport ist keine atomare Reservierung einer Rechnung
für den Echtversand. Dafür ist später eine serverseitige Transaktion mit
Quellrevisionen, eindeutiger Zuordnung und unveränderlichen Artefakten nötig.

### Serverseitige Vorbereitung des Echtversands

`api/_lib/gkv-transport.ts` ist ein internes Modul, kein erreichbarer Versandendpunkt.
Es nimmt ausschließlich vom Server bereitzustellende Adapter und Prüfbelege an.
Die Oberfläche bleibt beim Prüfexport. Die neuen Funktionen leisten:

- Klassisch: Freigabeprüfung gegen den SHA-256 der tatsächlichen Nutzbytes,
  Prüfung des vom Kryptografieadapter erzeugten PKCS#7-Containers auf Inhalt,
  Signatur-/Empfängerbindung und Hash; AUF aus der tatsächlichen verschlüsselten
  Dateilänge mit Kennzeichen 02/02. Ein unverändertes Klartext-Ergebnis wird
  abgewiesen. Der konkrete Adapter `services/gkv/secon.mjs` erzeugt und prüft
  diesen Container mit OpenSSL; Details und echte Kryptografietests siehe own-services.md.
- KIM: Begrenzung auf 15.000.000 XML-Bytes, gültiges UTF-8 ohne BOM, Bindung des
  Prüfbelegs an die Datei und des Schema-/Signaturprüfers an Leistungserbringer,
  Kasse, Leistungsart, Monat und logische Version 1.2.0. Der Prüfer muss jede
  signierte Komponente und ihre IMG-Zuordnung prüfen. Diese Implementierung
  enthält weder XML-Erzeuger noch echten XSD-/CMS-Prüfer.
- KIM-MIME: genau ein Base64-XML-Anhang mit `Content-Description: PFL`, leerer
  Textteil, vorgeschriebener Betreff/Dateiname und `X-KIM-Dienstkennung`.
  Zustellbenachrichtigung wird als SMTP-DSN-Option angefordert. TI-Verschlüsselung
  und tatsächlicher SMTP-Versand erfolgen erst durch das anzuschließende KIM-Modul.
- Datei-/Empfängermanifest: Hashes, Größen, Absender, Empfänger, Kasse, Monat,
  Leistungsart und Prüftag bleiben gebunden. Nach Änderungen oder Tageswechsel
  ist eine neue Prüfung nötig. Der Versionswechsel am 01.02.2027 bleibt gesperrt.
- Einzelversand: stabile Auftragskennung, atomarer Claim als erforderlicher
  Journalvertrag; nur der erfolgreiche Claim darf den Provider aufrufen. Timeout,
  fehlende Quittung oder Fehler nach Versand führen zu keiner automatischen
  Zweitübermittlung. `sent` bedeutet lediglich Provider-Übernahme, weder Zustellung,
  fachliche Annahme noch Zahlung.

**Lokal implementiert:** dauerhafter transaktionaler Claim, verschlüsselte Outbox
und paketübergreifende Reservierung im eigenen Versanddienst; TLS-/STARTTLS-SMTP
mit genau einem Dateipaar und ohne automatische Wiederholung. Der Worker bindet
Route, Ziel, Message-ID, DSN-ENVID und AUF-Fakten vor dem Senden. Ein eigener
TLS-POP3-Abruf speichert Originalquittungen verschlüsselt vor DELE/QUIT. Begrenzte
DSN-/Anlage-7-Korrelation und Wiederanlauf sind mit dem eigenen mTLS-POP3-Listener
verbunden und getestet. Ergebnisse bleiben unbestätigter Herkunft und ändern
keinen Rechnungsstatus; siehe own-services.md für die genaue Formatabdeckung.
**Noch nicht implementiert/angeschlossen:** atomare Reservierung gegenüber den
kanonischen Office-Rechnungen in Supabase, aktuelle serverseitige
Quell-/Routing-/Zertifikatsprüfung im Versandablauf, Virenprüfer, unveränderliche
Aufbewahrung mit Betriebs-/Backupkonzept, VZD-Adressbindung, Herkunftsprüfung von
Quittungen, weitere Rückmeldeformate und kanonische Fachstatusübernahme. Ein In-Memory-Journal ist ausschließlich
Testdouble und darf keinen Echtbetrieb tragen. Ein Client-Hash oder Häkchen ist
kein serverseitiger Prüfbeleg. Die KIM-Adressen müssen aus dem verifizierten
serverseitigen Routing stammen; syntaktische Mailprüfung allein reicht nicht.

Am 20.10.2026 ergab die schreibgeschützte Prüfung der verbundenen Supabase-Datenbank:
`public.ti_providers` enthält keine Einträge. Die vorhandenen Edge-Funktionen
enthalten keinen DTA-/KIM-Transport. Die neuen eigenen Dienste liegen im Repository,
sind aber nicht als externer Dienst registriert oder bereitgestellt. Annahmestellen-
Teilnahme, Trust-Center-Zertifikate und für KIM TI-/SMC-B-Zugang sowie eigene
Produkt-/Anbieterzulassung bleiben erforderlich. Es wurden keine Echtdaten
übermittelt und keine Providerdaten ergänzt.

### Datenbank

Migrationen: `20261019214752_gkv_exchange_workspace.sql`,
`20261019214757_gkv_invoice_source_snapshot.sql` und
`20261019214802_gkv_revision_history.sql`. Die ursprünglich mit der vorhandenen
Supabase CLI angelegten Migrationen wurden am 19.10.2026 nach lokalen Tests im
verbundenen Projekt `euagyyztvmemuaiumvxm` angewendet. Die Dateiversionen stimmen
mit den vom Migrationsdienst vergebenen und anschließend ausgelesenen Versionen
überein. Es wurden keine bestehenden Rechnungen verändert und keine fachlichen
Testdaten im Remoteprojekt angelegt. RLS, Rollenrechte und RPC-Suchpfade wurden
danach im Datenbankkatalog kontrolliert; der Advisor meldet keine neuen Warnungen.

Alle drei Migrationen laufen zusätzlich in PostgreSQL 17.5/PGlite. Neben den
isolierten Zugriffstests führt `office-flow.mjs` die tatsächlichen vorhandenen
Office-Rechnungs- und Nachweisfunktionen aus: Rechnung ausstellen, Quellen
übernehmen, GKV-Paket speichern und Prüfbytes über den tatsächlichen API-Handler
erzeugen. Auth-Claims, HTTP/Storage-Zugriff und PDF-Erzeugung bleiben hierbei
Testdoubles. Das ersetzt keinen Test mit Supabase Auth und PostgREST.

- `gkv_exchange_batches`: mandantenbezogene Entwürfe und Revisionen.
- `gkv_exchange_settings`: versioniertes Anbieterprofil.
- `gkv_exchange_directories`: importierter Quelltext und SHA-256 zur Dublettenerkennung.
- `gkv_exchange_events`: vom Server geschriebener Bearbeitungsverlauf.
- `gkv_exchange_revisions`: gesonderte Schnappschüsse jeder Paketrevision mit Datenstand, Status und SHA-256 des kanonischen PostgreSQL-JSON-Texts.
- `care_security.gkv_exchange_requests`: private Wiederholungsquittungen.

Direkte Schreibrechte für `anon` und `authenticated` sind entzogen.
Lesezugriffe benötigen RLS, den aktuellen Mandanten und Office-Rechte;
Portalzugänge werden ausgeschlossen. Öffentliche RPCs sind Invoker. Private
Definer-Funktionen verwenden einen festen `search_path` und prüfen den Akteur
vor jeder Mutation. Nullwerte in einer Zugangsprüfung führen zur Ablehnung.

Mutationen verwenden Auftragskennung, Inhalts-Hash und Akteur. Gleiche Aufträge
werden aus der Quittung beantwortet; anders wiederverwendete Kennungen werden
abgewiesen. Bestehende Pakete/Profilstände benötigen die aktuelle Revision.
Neue Pakete erhalten eine stabile Client-Kennung, damit ein unklarer
Speicherausgang nicht unbemerkt einen zweiten Entwurf erzeugt.

`export_note` dokumentiert nur die Bereitstellung einer Prüfdatei. Der Hash ist
an dieser Stelle ein **nicht verifizierter Client-Vermerk**, kein serverseitiger
Validierungsbeleg. Das wird ausdrücklich mit `verified: false` festgehalten.
`feedback_note` erzeugt keinen Statuswechsel. Direkte Statusübergänge zu
`sent`, `delivered` oder `accepted` sind über die vorhandenen RPCs nicht möglich.

Die Revisionsmigration sperrt während der Einführung konkurrierende
Paketänderungen und übernimmt nur den dann vorhandenen Stand. Vergangene
Revisionen und Bearbeiter werden nicht erfunden. Danach schreibt ein privater
Trigger jede neue Revision in derselben Transaktion. Direkte Inserts, Updates
und Deletes durch Anwendungsbenutzer sind entzogen. Eine Übernahme verwendet
die geschützte RPC `gkv_exchange_copy_revision`, liest den ursprünglichen
Schnappschuss serverseitig, prüft den aktuellen Paketstand und erzeugt einen
neuen Testentwurf mit eigener stabiler Kennung. Begründung und Herkunft werden
beidseitig protokolliert. Unklare Wiederholungen mit derselben Auftragskennung
liefern dasselbe Ergebnis; konkurrierende oder abweichende Aufträge blockieren.
Originaldaten und Rechnungen werden dabei nicht überschrieben.

Diese Historie ist ein Verlauf gespeicherter Entwurfsdaten. Sie speichert noch
keine serverseitig attestierten Exportbytes, reserviert keine Rechnungen für
den Echtversand und belegt weder eine vollständige revisionssichere Archivierung
noch einen unabhängigen Herkunftsnachweis. Die Datenstand-Prüfsumme ist nicht
mit der Prüfsumme einer EDIFACT-Datei gleichzusetzen. Kopien behalten ihre
Quellrevisionen; veraltete Quellen blockieren den späteren Export wie bisher.

### Kostenträgerverzeichnis

Importe werden als vollständige Schnappschüsse behandelt, nicht als Patchfolge.
KOTR-1/2-Nachrichten, Hüllsegmente, Referenzen und Nachrichtenanzahl werden
geprüft. Gelöschte Institutionen werden nicht als aktive Empfänger verwendet.
Gültigkeitszeiträume von IDK, VKG, UEM und DFU werden beim Routing berücksichtigt.
Unbekannte nicht verwendete Segmentdaten bleiben als Rohdaten erhalten.

Das Routing folgt Pflegekasse → Kostenträger → entschlüsselnde und gegebenenfalls
physikalische Annahmestelle. LE-Gruppe, Bundesland, Leistungsart, Medium und
Lieferart werden gefiltert. Fehlende oder mehrdeutige Verweise blockieren die
Übernahme. Eine VZD-Angabe wird als noch aufzulösender KIM-Eintrag ausgewiesen.
Die Übernahme eines Routingvorschlags belegt noch keine Teilnahmevereinbarung.

Noch offen sind insbesondere Zusammenführung mehrerer amtlicher Kassenarten,
komplette Behandlung aller Gruppenschlüssel/Sonderregeln, automatische
Aktualisierung mit Herkunftsnachweis und TI-Verzeichnisabfrage. Fehlende Ziele
werden nicht durch erfundene Empfänger oder pauschale Fallbacks ersetzt.

## Schritte bis zur vollständigen Produktivfreigabe

1. **Fachliche Erweiterung:** übrige Vertragsvarianten, weitere ZUS-Berechnungen und stationäre Sonderfälle,
   Änderungen im Leistungsmonat, Korrektur-/Stornoverfahren, Abrechnungszentren
   und vollständige Vertragspreisbildung implementieren. Gegen echte, freigegebene
   Testfälle der jeweils relevanten Annahmestelle prüfen.
2. **Nachweise:** Den implementierten Quellabgleich um eine atomare Reservierung für den Echtversand und unveränderliche Exportartefakte erweitern; Doppelabrechnung über mehrere Pakete verhindern. Aufbewahrung, Wiederherstellung, Berichtigungen und Fristen mit
   dem bestehenden Dokumentensystem verbinden.
3. **Klassischer Versand:** eigenen SECON-/SMTP-Dienst mit kanonischer
   Freigabe und aktuellem Zertifikats-/Verzeichnisbetrieb verbinden;
   AUF-Metadaten entstehen bereits aus den tatsächlichen verschlüsselten Bytes.
   Versand erst nach Teilnahmeabstimmung, Virenprüfung und Annahmestellentest.
4. **KIM:** eigenen KIM-Client und Fachdienst vervollständigen, TI-Anschluss und SMC-B anbinden; amtliche XML-Schemata
   versioniert hinterlegen und tatsächlich validieren; jede vorgeschriebene
   Komponente signieren und Signaturen prüfen; Softwareprüfung und gültige
   PROD-/MOD-ID nachweisen. Größenlimit und Versandstruktur beachten.
5. **Versandsteuerung:** vorhandene persistente Outbox, Worker und Versandbindung
   mit kanonischer Rechnungsreservierung, serverseitiger Nummernvergabe und
   revisionsgebundener Übergabe verbinden. Der bestehende Timeoutpfad verhindert
   blinde Zweitübermittlung; eine belegte Auflösung unklarer Sendungen fehlt noch.
6. **Rückmeldungen:** vorhandenen Abruf und die verschlüsselte Inbox um echte
   Herkunftsprüfung, weitere Fachformate, TA-6-Fehlerbezug und Korrekturlauf ergänzen.
   Technische Zustellung, fachliche Annahme und Zahlung bleiben getrennt.
   `lifecycle.ts` darf erst nach dieser Prüfung mit einer transaktionalen
   kanonischen Übernahme verbunden werden.
7. **Betrieb:** Berechtigungs-, Wiederherstellungs-, Last- und Ende-zu-Ende-Tests
   abschließen, Dokumentationsaufbewahrung von mindestens zwei Jahren und
   Sicherung bis zur Zahlung organisatorisch/technisch belegen. Eine unveränderte
   SQL-Tabelle allein ist kein Nachweis revisionssicherer Archivierung.
8. **Versionswechsel:** TA 6.5.1 und zugehörige Anhänge vor dem 01.02.2027 separat
   implementieren, mit Versionsfixtures prüfen und freigeben.

Die noch fehlenden Anbieterzugänge, Teilnahmebestätigungen, Zertifikate und
Abnahmen lassen sich nicht durch Software-Schalter oder vom Benutzer gesetzte
Bestätigungshäkchen ersetzen.

## Integration und Veröffentlichung

Die verbundene Produktionsdatenbank enthält die abhängige Office-Struktur und
seit 19.10.2026 die drei GKV-Migrationen. Das vorhandene Stagingprojekt hat bei
der Metadatenprüfung einen älteren Rechnungsstand gezeigt und wurde nicht
verändert. Für dortige Tests muss der vorhandene Releaseprozess zuerst die
abhängigen Office-Migrationen bereitstellen.

Die Web-/API-Änderungen liegen im Draft-PR 129. Die Vercel-Vorschau führt im
verfügbaren Browser zur Vercel-Anmeldung; eine Sichtprüfung der neuen Oberfläche
ist noch nicht erfolgt. Der Datenbankstand allein gibt weder Oberfläche noch
Echtversand frei. Bei fehlender Migration zeigt die Oberfläche einen Fehler mit
Wiederholungsmöglichkeit. Die tatsächlichen TI-Einstellungen und vorhandenen
Edge-Funktionen enthalten derzeit keinen produktiven KIM-/DTA-Transportadapter.
Die eigenen Dienste werden nach Vervollständigung, unabhängiger Prüfung und
erforderlichen Zulassungen über die kanonische Freigabeschnittstelle angeschlossen;
Demo-KIM wird nicht als Echtversand ausgegeben.

Prüfprotokoll: [verification.md](verification.md).
