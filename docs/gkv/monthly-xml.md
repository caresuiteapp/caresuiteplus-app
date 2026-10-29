# Pflege-Leistungsnachweis als XML

Stand: 29.10.2026. `services/gkv/monthly-xml.mjs` erzeugt einen **unsignierten**
Leistungsnachweis und prüft dessen tatsächliche Bytes gegen das amtliche
`PFL_LNW_2.2.0.xsd`. Der private Monatsablauf bindet inzwischen vorab
[gespeicherte Fachangaben und das angezeigte Original](monthly-facts.md) an diese
Prüfung. XML/CMS-Archivierung, Komponentensignatur und Versand bleiben offen.
Bisherige Bestätigungen ohne diese Fachangaben werden nicht nachträglich zum
Fach-XML erklärt.

## Quellen und Geltungsbereich

- [TA 1, Version 6.4.0](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_6.4.0_20250707_oA.pdf), Abschnitt 4.6.2.
- [TA 3, Version 6.4.0](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA3_6.4.0_20250707_oA.pdf), Schlüssel für Leistungen, Bestätigung und Dateityp.
- [Original-XSD-Archiv, logische Version 1.2.0](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_6.4.0_20250707_XSD_PFL_log.Version_1.2.0.zip).
- [Vereinbarung vom 05.10.2023](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/2023_10_05_Vereinbarung__105_Abs.2_Satz_2_SGBXI_final.pdf), insbesondere 4.2.1 Nr. 7–11: angezeigter und bestätigter Inhalt, Einfügen der Unterschrift, elektronische Signatur und Korrektur.

Die am 29.10.2026 erneut abgerufenen ZIP-Bytes entsprechen dem bestehenden
Quellenregister: SHA-256
`d47f0fdfa1cfe4af3aa9592db60b0861936999e7b1f863276af2bc0837a7939a`.
LNW-Schema und importiertes Basisschema liegen unverändert unter
`services/gkv/pfl-schema/1.2.0/`. Das Manifest enthält Herkunft, Gültigkeit und
Einzelhashes; sein Hash ist im Node- und Python-Code festgelegt. Der Prüfer lädt
keine Schemata aus dem Netz. Die eigentümliche amtliche Schreibweise
`Beschaeftigtennumer_verantwortliche_Fachkraft` bleibt erhalten.

Das derzeitige Ausgabeprofil gilt für einen Prüftag vom 01.05.2026 bis
31.01.2027. Ab 01.02.2027 wird es gesperrt; die angekündigte neue Fassung wird
nicht automatisch übernommen. Pro XML ist genau eine Leistungsart 01, 07
oder 10 vorgesehen. Die vertragsbezogene Zulässigkeit des Anbieters, einzelner
Leistungsziffern und Ersatz-Beschäftigtennummern wird dadurch nicht bestätigt.

## Vertrag und Prüfung

`MonthlyXmlDocument` in `src/lib/gkvExchange/monthlyXml.ts` enthält die
eindeutige Nachweis-ID, Pflegedienst-IK, Monat, Versichertennummer, getrennte
Namen, verantwortliche Beschäftigtennummer und die Tages-/Einsatz-/Leistungsdaten.
Jede Einzelleistung hat eine vollständige Leistungsziffer, Bezeichnung, eine
Mengenangabe oder tatsächliche Minutendauer und ein bis drei Beschäftigtennummern.
Der Generator erfindet keine dieser Angaben aus Freitext, UUIDs oder Summen.

`generateMonthlyXml(document, { checkedAt })` liefert `{ bytes, verification }`.
`verifyMonthlyXml(bytes, { expected, checkedAt })` prüft vorhandene Bytes erneut.
`checkedAt` ist ein vom privaten Dienst bestimmter UTC-Zeitpunkt. `expected`
ist der erwartete vollständige Inhalt, einschließlich der eingebetteten Datei.
Ein Browser darf weder diesen Sollinhalt noch den Prüfzeitpunkt autorisieren.

Die Prüfung umfasst:

- Unabhängiges Einlesen der ausgegebenen XML-Bytes mit lxml und dem originalen XSD; anschließend Vergleich aller extrahierten Felder mit dem Sollinhalt. XML-Namespaces dürfen einen anderen Präfix und Elemente harmlose Zwischenräume verwenden. Der Hash gehört immer zu den tatsächlichen Bytes, nicht zu einer neu serialisierten Fassung.
- Reale Kalenderdaten, Monat, einheitliche Leistungsart, Einsatznummern ab 1 und Feldkombinationen für Mengen-/Zeitvergütung. Die Zeichenklassen des XSD ersetzen keine Prüfung der zulässigen TA-Schlüssel.
- Eindeutige Beschäftigtennummern je Einzelleistung. Registrierung, Beruf, Qualifikation und die personalisierte Erfassung dieser Nummern sind gesonderte Quellnachweise.
- Bestätigungszeit nach den enthaltenen Einsatzbeginnzeiten und nicht nach dem Prüfzeitpunkt. Die minutenbezogene Einsatzdauer und gemeinsame Leistungen brauchen zusätzlich eine Abnahme gegen die kanonischen Einsatzdaten.
- Deutsche Ortszeit über `Europe/Berlin`, unabhängig von Browser-/Hostzeitzone. Nicht existierende Zeiten beim Sommerzeitwechsel werden abgewiesen. Bei der doppelten Herbststunde muss mindestens eine mögliche Zeit passen; XML ohne Offset kann die tatsächliche UTC-Zeit nicht eindeutig beweisen. Der ursprüngliche Capture-Zeitpunkt muss deshalb erhalten bleiben.
- Höchstens 31 Tage, 99 Einsätze pro Tag, 99 Einzelleistungen pro Einsatz, 10.000 Einzelleistungen insgesamt, 8 MiB XML und 2 MiB eingebettete Datei. Die zusätzliche Gesamtgröße kann schon vor den maximalen Einzelanzahlen erreicht sein.

Der Prüfbeleg enthält XML-Hash, Hash der eingebetteten Datei, Schemahash,
Version und Prüfzeit. `sourceBindingVerified`, `componentSignatureVerified`
und `dispatchReady` bleiben ausdrücklich `false`. Der Beleg ist kein
`KimPackageVerifier` und kann keine Sendefreigabe ersetzen.

## Unterstützte Bestätigungen

| Amtlicher Typ | Eingebetteter Inhalt | Grenze dieses Bausteins |
| --- | --- | --- |
| 1 | PNG der persönlichen Bildschirmunterschrift, Dateityp 3; Zeitpunkt erforderlich | Der vorhandene PNG-Prüfer kontrolliert tatsächliche Bildintegrität. Er belegt keine Handschrift, Identität oder Vertretungsmacht. JPEG ist noch nicht implementiert. |
| 3 | Vollständiger gescannter Papier-LNW des abwesenden Vertreters, Dateityp 2 | Alle PDF-Bytes werden eingebettet; der Unterschriftsausschnitt reicht nicht. Der XML-Baustein prüft nur Header (PDF 1.0–1.7), EOF und Größe. Aktive Inhalte, Seitenvergleich, tatsächliche Unterschrift und Vertreterberechtigung müssen zuvor durch den privaten Papierablauf geprüft und gebunden sein. |

Die XML-Ausgabe für Angehörigen-Apps (Typ 2), bilateral vereinbarte alternative
Bestätigung (Typ 4) und begründetes Fehlen (Typ 5) ist noch nicht implementiert
und wird abgewiesen. Auch eine im bisherigen Papierablauf erfasste
Patientenunterschrift wird nicht automatisch zum Vertreterprofil 3.

## Laufzeit und Abwehr fehlerhafter Dateien

Verwendet werden das vorhandene Python 3 und lxml wie bei den Konnektor- und
TSL-Prüfern. Fehlt die Laufzeit oder POSIX-Ressourcenbegrenzung, gibt es keinen
erfolgreichen Prüfbeleg. Es wurde keine neue Abhängigkeit installiert.

Der isolierte Prozess erhält XML über stdin, keinen Dateipfad, keine
Zugangsdaten und keine Patientenwerte als Kommandozeilenargument. DTDs,
Entities, XInclude, Stylesheets, Kommentare, fremde Schemahinweise, Attribute
und nicht unterstützte Kodierungen werden abgewiesen. Ein fester Resolver
kennt nur die beiden anhand ihrer Hashes geprüften lokalen Schemata.
CPU-Zeit, Adressraum, Dateideskriptoren, Ausgabegröße, XML-Tiefe und Knotenzahl
sind begrenzt; der Elternprozess beendet Abbruch oder Überschreitung der
10-Sekunden-Frist. Fehler enthalten feste Codes und gegebenenfalls feste
Feldpfade, keine Versicherungsdaten, Signaturbytes oder Parserauszüge.
Das ist keine vollständige Betriebssystem-Sandbox.

## Noch erforderlicher Anschluss

Die [Fachangaben-Integration](monthly-facts.md) speichert und zeigt die
vollständigen unterstützten Felder vor der Bestätigung. Der private Dienst
vergleicht das Original und die gespeicherte Datei und prüft daraus erzeugte
XML-Bytes vor Ausgabe der Bestätigungsquittung. Weiter erforderlich:

1. Geprüfte produktive Quellen für die persönliche GKV-Beschäftigtennummer,
   Verantwortlichen-/Leistungserbringerzuordnung und Leistungspositionen.
   Gemeinsame Leistungen und Vertrags-/Tarifregeln vollständig abbilden.
2. Unmittelbare elektronische Komponentensignatur über genau diese XML-Bytes
   erzeugen und unabhängig prüfen. Die KIM-Nachrichtensignatur ersetzt sie nicht.
3. XML/CMS unveränderlich archivieren, Bestätigung und endgültigen Abschluss
   atomar verbinden; Antwortverlust und parallele Korrektur behandeln.
4. Abrechnung, IMG-/Nachweis-ID, Empfänger, zeitgültige PROD-/MOD-ID und
   vollständige PFL_DAT-/PFL_ABR-Hülle prüfen.
5. Zielhardware/TI, reale Oberfläche, Annahmestellen und unabhängige
   Softwareprüfung durchlaufen. Die ITSG-Fälle bleiben `not_executed`.

## Reproduzierbare lokale Prüfung

```bash
npm run verify:gkv:monthly-xml
npm run typecheck
```

Die XML-Suite verwendet synthetische Personen, Bilder und eine mehrseitige
Test-PDF. Sie prüft gültige Ausgaben, unveränderte Dateiinhalte, Schemafehler,
fachliche Widersprüche, den XSD-Zeichenklassenfall, Patient-/ID-/Signaturtausch,
XXE-/XInclude-/Kodierungsversuche, Schemaänderungen, Abbruch, fehlende Laufzeit,
Zeitumstellung und Eingabeänderungen während der Prüfung. Diese Prüfungen
ersetzen weder vollständige Vertragsregeln noch eine unabhängige Fachabnahme.
