# KIM: Rollen und Telematik-ID im Zertifikat

Stand: 21.10.2026. Der KIM-Kern liest jetzt die Admission-Erweiterung des
Zertifikats, prüft die Rollenfamilie zum Zertifikatstyp und verlangt eine
eindeutige Telematik-ID. Die Prüfung ist im TSL-Statuspfad und im lokalen
ECC-CMS-/AUT-Ablauf eingebunden. Sie bestätigt keine KIM-Adresse im VZD und
erteilt keine Versand- oder Abrechnungsberechtigung.

## Herkunft und Prüfablauf

`certificate-admission.mjs` verarbeitet ausschließlich die DER-Bytes der
Erweiterung `1.3.36.8.3.3`. Rolle und ID werden weder aus Subject/SAN noch aus
Nachrichtenheadern, JWT-Feldern oder frei übergebenen Statusflags abgeleitet.
`der-oid.mjs` übernimmt die gemeinsame begrenzte OID-Auswertung für Admission
und CertificatePolicies; der bisherige Typprüfer verwendet denselben Decoder.

Der reine Parser prüft keine Zertifikatssignatur. Im TSL-Pfad geschieht dies
über `certificateAdmissionFor()` erst nach dem vorhandenen Abgleich mit der
tatsächlich ausstellenden CA, deren Typberechtigung, Gültigkeit, Dienststatus
und AKI/SKI. Das Ergebnis bindet die Attribute an Blatt-/CA-Hash und den
vorgegebenen Verwendungszweck. Der vom Manager ausgegebene Zugriff wird mit
jedem Listenwechsel ungültig.

`ocspPlanFor()` verlangt diese Admission-Prüfung vor der Routenwahl. Damit
scheitert ein unvollständiges Zertifikat vor einer Statusanfrage oder einem
OCSP-Cachezugriff, auch wenn eine ältere Programmversion bereits einen
positiven Rohbeleg gespeichert hat. Die vorhandene Prüfung nach dem Warten
auf Netzantworten bleibt wirksam. Ein neues Speicherformat wird nicht benötigt.

## Unterstütztes Profil

| Merkmal | Prüfung |
| --- | --- |
| Admission | Höchstens 8192 Byte, genau eine Admissions-Struktur, 1–16 ProfessionInfo-Einträge |
| ProfessionInfo | Je genau eine UTF8-Berufsbezeichnung und eine kanonische Rollen-OID; keine doppelten Rollen |
| Telematik-ID | In jedem Eintrag erforderlich; PrintableString, höchstens 128 Zeichen, derzeit vergebener Präfix 1–5 oder 7–11, Separator und nichtleerer Fortsatz |
| Mehrere Berufe | Alle Einträge müssen dieselbe Telematik-ID enthalten; Groß-/Kleinschreibung wird erhalten |
| HBA-Typen | C.HP.AUT und C.HP.ENC verwenden unterstützte Berufsgruppen aus Tab_PKI_402; die Versichertenrolle ist ausgeschlossen |
| SMC-B-Typen | C.HCI.AUT, C.HCI.ENC und C.HCI.OSIG verwenden Institutionen aus Tab_PKI_403 |
| Unbekannte Rollen | Werden abgelehnt; der Rollenbestand ist auf gemSpec_OID 3.26.0 festgelegt |
| Optionale Behördenangaben | Begrenzte directoryName-Strukturen; NamingAuthority mit optionaler OID, IA5-URL und UTF8-Text in festgelegter Reihenfolge |
| Ergänzende Angaben | addProfessionInfo bleibt ein opaker OCTET STRING von höchstens 1024 Byte; darin enthaltene OIDs/IDs werden nicht übernommen |
| Zertifikatserweiterung | Doppelte oder als kritisch markierte Admission-Erweiterungen werden in den integrierten Pfaden abgelehnt |

Mehrere ProfessionInfo-Einträge werden entsprechend GS-A_4709-01 und dem
Iterationsschritt von TUC_PKI_009 ausgewertet. Die Felder jedes Eintrags bleiben
auf die beschriebene TI-Teilmenge begrenzt. Ein gemischter HBA-/Institutionenbestand
oder widersprüchliche IDs geben kein Ergebnis frei. Die Berufsbezeichnung ist
keine Berechtigungsquelle; eine vollständige Prüfung ihres Wortlauts gegen alle
sektorspezifischen Zertifikatsprofile ist noch offen.

Der Fortsatz der Telematik-ID bleibt sektorspezifisch. Hier wird der gemeinsame
PrintableString-Rahmen geprüft, einschließlich der Ablehnung führender und
abschließender Leerzeichen im Fortsatz. Die Prüfung bestätigt weder die Vergabe
noch dessen sektorale Semantik. Es gibt keine automatische Zuordnung eines
Präfixes zu einer bestimmten Rolle. URLs in NamingAuthority werden nie abgefragt.
Weitere GeneralName-/DirectoryString-Formen sind in diesem lokalen Profil
nicht unterstützt und werden abgelehnt.

## Schnittstellen und Empfang

```js
const attributes = manager.current().certificateAdmissionFor(certificate, {
  policyList: ['1.2.276.0.76.4.78'],
});
// attributes.certificateSha256 / issuerSha256 / certificateTypeOid
// attributes.admission.telematikId / professionOids / professions / roleVersion
// attributes.identityStatus === 'unverified'

const status = await statusClient.check({ certificate, purpose: 'signing' });
// status.admission contains the attributes of the same checked certificate.
// OCSP status and identity/address authorization remain separate.
```

`messageEvidence()` bereitet beide Zertifikate vollständig vor der ersten
Netzanfrage vor. Neben `certificateTypes` liefert es die tief eingefrorenen
`certificateAdmissions.signing` und `.authentication`. Die asynchrone
Empfangsdiagnose übernimmt diese unter `statusAcquisition`. Eine fehlende
Admission kann bereits die vorgeschaltete CMS-/AUT-Prüfung verwerfen; dann
wird kein Statusabruf gestartet.

Die Daten sind eine Diagnose des geprüften Standes. Sie sind kein dauerhaftes
Autorisierungstoken. Ein gutes OCSP-Ergebnis, eine bekannte Rolle und eine
ausgelesene ID reichen weiterhin nicht für `identityStatus: verified` oder
eine normale Zustellung. Der niedrigere `ocspVerifierFor()` prüft ausschließlich
Statusbelege; `certificateTypeFor()` bleibt die Typprüfung. Keiner dieser
beiden Aufrufe allein bescheinigt eine gültige Admission.

## Mehrere Empfängerzertifikate

Der ECC-Erzeuger prüft alle zu einer kanonischen Empfängeradresse angegebenen
ENC-Zertifikate. Bei mehreren Telematik-IDs bricht die Nachrichtenerzeugung mit
`KIM_CMS_RECIPIENT_IDENTITY_CONFLICT` ab. Es gibt weder eine Auswahl des ersten
Zertifikats noch ein Weglassen des Konflikts. Ein Zertifikatswechsel mit zwei
Schlüsseln derselben ID bleibt möglich; beide können ihre Kopie entschlüsseln.
Die Zuordnung der Adresse zu dieser ID muss später der vertrauenswürdige VZD-
Ablauf belegen. Die vollständige ausgehende Fehlernachricht nach
KOM-LE-A_2192-03 ist noch nicht umgesetzt.

OSIG- und AUT-Zertifikate werden getrennt behandelt. Ihre IDs müssen nicht
pauschal übereinstimmen: Der CM-Ablauf sieht einen AUT-Nachweis gerade auch für
eine vom OSIG-Zertifikat abweichende Absenderzuordnung vor. Ohne VZD-Nachweis
erzeugt diese Kombination weiterhin nur lokale Prüf-/Diagnoseergebnisse.

## Nachweise und Grenzen

Die Tests verwenden tatsächlich signierte Zertifikate, signierte TSLs, echte
lokale HTTPS-/OCSP-Antworten und verschlüsselte SQLite-Ablage. OpenSSL erzeugt
eine Admission unabhängig vom eigenen Encoder und liest ihre Werte aus dem
anschließend signierten Zertifikat. Geprüft sind widersprüchliche und fehlende
Attribute, DER-/UTF8-Grenzen, Rollenfamilien, unzulässige optionale Felder,
alte positive Cachebelege, ungültig gewordene Managerzugriffe und der
Verschlüsselungsweg mit mehreren Empfängerzertifikaten.
Der aktuelle Gesamtlauf steht im [Prüfprotokoll](verification.md).

Offen bleiben vollständige sektorale Profil-/Policyprüfung, verlässliche
VZD-Adressbindung, authentisierte TI-Ankerbereitstellung/-rotation,
Konnektor/SMC-B, produktiver Dienstbetrieb und unabhängige Prüfung/Zulassung.
Der SMTP-Fachdienst verwendet weiterhin seinen eigenen begrenzten AUT-Prüfer;
die neue CM-Prüfung ist keine vollständige Fachdienst-PKI-Integration.
Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal belegt, 78 offen.
Echtversand und normale KIM-Zustellung bleiben gesperrt.

## Primärquellen

- [gemSpec_PKI 2.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): GS-A_4709-01, GS-A_4717-03 / Tab_PKI_226, GS-A_4587, GS-A_4710-02, GS-A_4712/4713 und GS-A_4660-02 / TUC_PKI_009.
- [gemSpec_OID 3.26.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_OID/gemSpec_OID_V3.26.0/): Tab_PKI_402 und Tab_PKI_403 für die unterstützten Rollenfamilien.
- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/): KOM-LE-A_2178, KOM-LE-A_2192-03, A_28582 und die VZD-abhängige AUT-Prüfung beim Empfang. Quellen geprüft am 21.10.2026.
