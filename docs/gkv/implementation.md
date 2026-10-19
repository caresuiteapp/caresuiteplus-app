# Pflegekassen-Datenaustausch nach § 105 SGB XI

Stand: 19.10.2026. Diese Änderung ist ein prüfbarer Entwicklungsstand für den
klassischen Datenaustausch. Sie ist **keine vollständige produktive Umsetzung**
aller GKV-Fachprofile und keine Bestätigung einer Abnahme oder Zertifizierung.
Veröffentlichung, Datenbankfreigabe und Echtbetrieb sind eigenständige Schritte.

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
3. Rechnungs- und Personendaten aus einer vorhandenen Rechnung übernehmen oder
   einen Fall erfassen. Preise, Leistungsziffern, Beschäftigtennummern und
   Nachweisbestätigung ausdrücklich ergänzen. Es gibt keine erfundenen Tarife.
4. Die fall- und positionsbezogenen Prüfhindernisse bearbeiten und den Entwurf
   speichern. Unvollständige Textangaben sind als Entwurf zulässig; ungültige
   Zahleneingaben müssen vor der Speicherung korrigiert werden.
5. Für unterstützte Varianten eine interne Prüfdatei erzeugen. Nutzdaten und
   Auftragsdatei werden getrennt heruntergeladen. Sie sind unverschlüsselt und
   werden von dieser Anwendung nicht an eine Annahmestelle versandt.
6. Bearbeitungsvermerke im Verlauf erfassen. Ein solcher Vermerk kann weder
   Annahme, Zustellung noch Bezahlung setzen.

Das Verzeichnis zeigt die 100 zuletzt geänderten Pakete, maximal 100 zur
Übernahme angebotene Rechnungen, 30 Verzeichnisimporte und 100 Protokolleinträge.
Diese Begrenzungen werden in der Oberfläche ausgewiesen. Ein historisches
Vollarchiv mit serverseitiger Suche/Paginierung ist noch nicht implementiert.

## Fachliche Grenzen der Dateierzeugung

| Fall | Stand |
| --- | --- |
| Selbstabrechnung, eigenes Absender-IK | Implementiert |
| Leistungsarten 01, 07, 09, 10, 13 | Grundprofile für klassische Prüfdateien |
| Vergütungsarten 01, 06 mit Pauschalen 01–03, 07, 08, 99 | Einzelpreis × Menge mit ganzzahliger Centberechnung |
| Beratungspauschale | Schlüssel 1 vor Ort / 2 Video, nur Leistungsart 09 |
| Entlastungsleistung | Anbieterbezogene Schlüssel aus TA 3, nur Leistungsart 10 |
| Steuerbefreiung | Ausschließlich ausdrücklich bestätigter Schlüssel 01; andere Steuerfälle blockiert |
| Zeitvergütung, Punktwert, Kilometervergütung | Noch nicht exportierbar; keine pauschale Ersatzberechnung |
| Zuschläge/Abzüge, Hilfsmittel, stationäre Fachprofile, besondere Abrechnungsfälle | Noch zu implementieren und fachlich abzunehmen |
| Sammelabrechnung über Abrechnungszentrum | Noch nicht exportierbar |
| Automatischer Nachweisabgleich mit dem Mitarbeiterportal | Noch nicht implementiert; vorhandene Referenzen werden übernommen, Bestätigung ist manuell |
| KIM, XML-Leistungsnachweise, SMC-B-Signaturen | Noch nicht angeschlossen |
| Verschlüsselter klassischer Echtversand | Noch nicht angeschlossen |

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
Geldbeträgen. Für Multiplikation und Cent-Rundung werden ganze Zahlen verwendet.

`edifact.ts` erzeugt UNB/UNZ und PLGA-/PLAA-Nachrichten, zählt UNH/UNT und
maskiert EDIFACT-Steuerzeichen. Der Parser verarbeitet Aufhebungszeichen in
einem Durchlauf. Die Ausgabe ist verlustfrei ISO 8859-1; nicht darstellbare
Zeichen werden abgewiesen. Die Auftragsdatei hat feste Bytepositionen.
Entschlüsselnde und physikalische Annahmestelle werden getrennt geführt.

### Authentifizierter Export

`POST /api/gkv/test-export` nimmt nur `tenantId`, `batchId` und `revision` an.
Der Dienst lädt mit dem JWT des Aufrufers über Supabase/RLS. Er verwendet
keinen Service-Role-Schlüssel und akzeptiert keine frei eingereichte Abrechnung.
Die zusätzliche RPC `gkv_exchange_export_allowed` prüft serverseitig sowohl
Lese- als auch Erstellrechte.

Vor der Ausgabe werden der gespeicherte Stand, Modus, Fachprüfungen und die
verknüpften Quellrechnungen geprüft: Mandant, Änderungsstand, Rechnungsnummer,
Betrag, Person und Stornierung. Die Paketrevision wird nach der Dateierzeugung
erneut gelesen. Der Rückgabewert enthält Byteinhalt, SHA-256 und die Einordnung
`unencrypted_test`. Es gibt keine Versandfunktion, keinen Mail-Fallback und
keinen Endpunkt, der Produktionsdateien herausgibt.

Die Quellprüfung im Prüfexport ist keine atomare Reservierung einer Rechnung
für den Echtversand. Dafür ist später eine serverseitige Transaktion mit
Quellrevisionen, eindeutiger Zuordnung und unveränderlichen Artefakten nötig.

### Datenbank

Migration: `20261019192628_gkv_exchange_workspace.sql`, Dateiname mit der
bereits vorhandenen Supabase CLI erzeugt. Die Migration wurde nicht auf einem
Remoteprojekt eingespielt.

- `gkv_exchange_batches`: mandantenbezogene Entwürfe und Revisionen.
- `gkv_exchange_settings`: versioniertes Anbieterprofil.
- `gkv_exchange_directories`: importierter Quelltext und SHA-256 zur Dublettenerkennung.
- `gkv_exchange_events`: vom Server geschriebener Bearbeitungsverlauf.
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

1. **Fachliche Erweiterung:** übrige Vergütungsprofile, ZUS/HIL, stationäre Fälle,
   Änderungen im Leistungsmonat, Korrektur-/Stornoverfahren, Abrechnungszentren
   und vollständige Vertragspreisbildung implementieren. Gegen echte, freigegebene
   Testfälle der jeweils relevanten Annahmestelle prüfen.
2. **Nachweise:** Rechnungspositionen atomar an tatsächlich erbrachte Leistungen
   und freigegebene Nachweise binden; Doppelabrechnung über mehrere Pakete
   verhindern. Aufbewahrung, Wiederherstellung, Berichtigungen und Fristen mit
   dem bestehenden Dokumentensystem verbinden.
3. **Klassischer Versand:** vorhandenen/ausgewählten DTA-Dienst anschließen,
   tatsächliche Verschlüsselung und Zertifikatsprüfung durchführen, AUF-Metadaten
   aus dem verschlüsselten Ergebnis bilden; Versand nur nach Teilnahmeabstimmung,
   Virenprüfung und Annahmestellentest.
4. **KIM:** echten KIM-/TI-Anschluss und SMC-B bereitstellen; amtliche XML-Schemata
   versioniert hinterlegen und tatsächlich validieren; jede vorgeschriebene
   Komponente signieren und Signaturen prüfen; Softwareprüfung und gültige
   PROD-/MOD-ID nachweisen. Größenlimit und Versandstruktur beachten.
5. **Versandsteuerung:** unveränderliche Dateiartefakte, serverseitig vergebene
   Nummern, Versandwarteschlange, dokumentierte Wiederholungsregeln und einen
   Zustand für unklaren Versand implementieren. Ein Timeout darf keine blinde
   Zweitübermittlung auslösen.
6. **Rückmeldungen:** authentifizierten Provider-Rückkanal/Import, eindeutige
   Message-ID-/Hash-Korrelation, Dublettenschutz, Fehlerbezug und Korrekturlauf
   implementieren. Technische Zustellung, fachliche Annahme und Zahlung bleiben
   getrennte Sachverhalte. `lifecycle.ts` ist dafür ein getestetes Grundmodell,
   derzeit kein angeschlossener Rückmeldeprozess.
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

Die derzeitige Produktionsstruktur besitzt die verwendeten Rechnungsfelder.
Das vorhandene Stagingprojekt hat bei der Metadatenprüfung einen älteren
Rechnungsstand gezeigt. Vor einem Integrationstest muss der passende vorhandene
Releaseprozess die abhängigen Office-Migrationen bereitstellen. Es wurden nur
Metadaten gelesen, keine Patienten- oder Rechnungsdatensätze und keine
Remote-Schreibvorgänge ausgeführt.

Danach die neue Migration im vorgesehenen Releaseablauf anwenden und die
Web-/API-Änderungen gemeinsam bereitstellen. Bei fehlender Migration zeigt die
Oberfläche einen Fehler mit Wiederholungsmöglichkeit. Erst die dokumentierte
Integrations- und Sichtprüfung berechtigt zur Freigabe der neuen Oberfläche.

Prüfprotokoll: [verification.md](verification.md).
