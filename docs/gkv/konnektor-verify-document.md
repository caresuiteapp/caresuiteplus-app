# Konnektorprüfung der CMS-Signatur

Stand: 22.10.2026. `VerifyDocument` ergänzt den vorhandenen synthetischen
ECC-Kartenrundlauf. Die Umsetzung ist am lokalen mTLS-Peer mit Software-Testschlüsseln
geprüft. Sie ist noch kein Nachweis eines physischen Konnektors oder eines TI-Zugangs.

## Aufruf und Bindung

`KonnektorCertificateClient.verifySmcbDocument` verwendet den ausdrücklich
konfigurierten SignatureService 7.5. Derselbe CA-/Hostname-/Leafpin-/mTLS-Schutz
wie bei SignDocument bleibt wirksam. Es wird kein weiterer Endpunkt erraten.
Die offiziellen, unverändert festgeschriebenen WSDL/XSD-Dateien bleiben maßgeblich:
[gematik/api-telematik, Commit 31dd17b7](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419/conn).

Die umschließende CMS-Signatur wird als `dss:SignatureObject/Base64Signature`
mit Typ `urn:ietf:rfc:5652` übertragen. Der Inhalt steckt bereits im CMS;
ein separates Document wird nicht angegeben. Angefordert werden CurrentTime
und ein ausführlicher VerificationReport mit Zertifikats-/Sperrwerten, ohne
VerifierIdentity und ohne Expansion binärer Werte. IncludeRevocationInfo ist
false: Der Aufruf soll die eingereichte Signatur nicht verändern.
Die Berichtsprofilierung berücksichtigt gemSpec_Kon 5.28.0, Operation
VerifyDocument und Anhang B3/Abschnitt 6.3.

Vor dem SOAP-Aufruf prüft CareSuite den unterstützten CMS-DER-Aufbau, den
eingebetteten Inhalt, ECDSA, ESS-Zertifikatshash und das recipient-emails-Attribut
gegen das vorgegebene OSIG-Zertifikat. Nur ein aktueller, originaler
VerifyCertificate-Beleg derselben Clientinstanz darf den Aufruf begleiten.
Der Beleg wird unmittelbar vor dem Netzaufruf und nach der Antwort erneut
geprüft. Veränderbare Eingabepuffer werden vor der ersten Unterbrechung kopiert.

Die Operation selbst braucht weder CardHandle noch PIN. Sie wird mit den
übrigen Karten-/CMS-Aktionen serialisiert, fordert keine Freischaltung an und
wiederholt einen unklaren Netzaufruf nicht automatisch. Fehler einer reinen
Verifikation werden nicht fälschlich als unklarer privater Schlüsselzugriff
verbucht; der übergeordnete Host hält den fehlgeschlagenen Auftrag dennoch an.

## Auswertung des Berichts

Der XML-Worker validiert die Antwort anhand der festgeschriebenen Schemata und
begrenzt den Bericht zusätzlich auf 256 KiB. Er akzeptiert für diesen Ablauf
genau einen IndividualReport mit SignatureValue, vollständigem Gesamtergebnis,
Prüfzeitpunkt, Signaturdetail und Zertifikatspfaddetail. Fremde Erweiterungen,
Referenzauflösung, zusätzliche Signaturen, Warnungsantworten und fehlende
Bindungsinformationen scheitern. Es gibt keine Darstellung fremden XMLs im Browser.

Ein Erfolg benötigt zugleich:

- HighLevelResult VALID und ein dazu passendes positives IndividualResult;
- positive relevante Unterprüfungen, einschließlich Zertifikatsstatus;
- den in B3 benannten TrustAnchor-Identifier statt dessen Verwechslung mit
  einem normalen Prüfstatus;
- denselben binären Signaturwert wie im unabhängig geprüften CMS;
- dasselbe OSIG-Leaf als erstes Zertifikat der berichteten Kette;
- aktuelle Prüfzeiten innerhalb des Aufrufs, mit höchstens fünf Sekunden
  Uhrabweichung. SYSTEM_TIMESTAMP und USER_DEFINED_TIMESTAMP sind für das
  ausdrücklich angeforderte CurrentTime zulässig; ein eingebetteter historischer
  Signaturzeitpunkt ist in diesem Diagnoseprofil nicht zulässig.

INVALID, INCONCLUSIVE, widersprüchliche Detailergebnisse, fremde Signatur/
Zertifikat und unpassende Zeiten haben eigene feste Fehlercodes. Remote-
ResultMessage, Subject und rohe Zertifikate gelangen nicht in das JSON-Ergebnis.
Der Report-Hash bezieht sich auf exklusive XML-C14N ohne Kommentare; der
Response-Hash im Transkript bindet zusätzlich die tatsächlich empfangenen Bytes.

## Host, Protokoll und Oberfläche

Nach Kartenentschlüsselung und bytegenauem Originalvergleich folgt eine frische
Karten-/TSL-/OCSP-/PIN-Vorprüfung, dann VerifyDocument und eine weitere vollständige
Nachprüfung. Ein Kartenwechsel nach positivem VerifyDocument verhindert den
Erfolg. Insgesamt gibt es fünf Vor-/Nachprüfungen und fünf SOAP-Transkripteinträge:
GetJobNumber, SignDocument, EncryptDocument, DecryptDocument und VerifyDocument.

Neue Berichte haben Version 2 und enthalten zusätzlich Ergebnis, Prüfzeit,
CMS-/Signatur-/OSIG-/Report-Hashes sowie die Bindungsart. Die Journal-/API-Hülle
bleibt Version 1. Vorhandene Berichte der Version 1 sind weiterhin lesbar und
werden als älterer Umfang ohne VerifyDocument angezeigt. Ein neuer Prüfbericht
kann die zusätzliche Bestätigung nicht weglassen oder eine Hardwarefreigabe
einschleusen. Die bisherigen nicht attestierten Hardware-/TI-Werte bleiben erhalten.

Der Hoststatus berücksichtigt jetzt die bestehende 30-Sekunden-Sperre und
liefert `nextStartAt`. Die Webansicht aktualisiert dann nur den Status; sie startet
keinen neuen Durchlauf automatisch. Ein noch angebotener Start aus einer alten
Ansicht liefert bei einer inzwischen bestehenden Sperre den aktuellen,
mandantengebundenen Zustand. Der verweigerte Auftrag wird nicht reserviert.
Fehlgeschlagene/unterbrochene Aufträge bleiben bis zur vorgesehenen lokalen
administrativen Überprüfung gesperrt. Auch ihr vorhandener Status kann jetzt als
JSON heruntergeladen werden.

## Verbleibende Grenzen

Die Unterstützung bleibt auf das vorhandene einzelne ECC-/DER-CMS-Profil begrenzt.
RSA_ECC-Mehrfachsignaturen, BER, weitere Attribute, Gegensignaturen und alle
Herstellervarianten ausführlicher Berichte sind nicht vollständig implementiert.
Ein Bericht allein ersetzt weder die unabhängige TSL-/OCSP-Prüfung noch die
normative Prüfung sämtlicher CMS-/CAdES-Varianten. Die gesamte normale
KIM-Empfangs-/Fehlermailpipeline ist noch mit diesem Konnektorpfad zu verbinden;
rohe VerificationReports werden dort noch nicht als Fehleranhang ausgegeben.

Am 22.10.2026 war das verbundene Gerät erneut offline; kein Hardwarelauf wurde
ausgeführt. Der Vercel-Zugriff auf Deploymentdetails scheiterte an fehlender
Teamfreigabe. GitHub meldete für den Vorgänger 1c2462ae alle vier Vercel-Builds
erfolgreich. Das ist kein Buildbeleg für diese Folgeänderung.

Die automatische Bereinigung der Arbeitsumgebung entfernte während dieser
Änderung auch die vorher vorhandenen Projektabhängigkeiten. Der Branch wurde
aus GitHub wiederhergestellt. Die Diensttests benötigen diese Pakete nicht.
TypeScript-Gesamtprüfung, React-DOM-Prüfung und Vercel-Public-Route-Audit sind
lokal deshalb nicht erneut ausführbar. Vorhandenes Babel prüft nur TS-/JSX-Syntax;
dies ersetzt keine Typprüfung. Die tatsächliche breite/schmale Darstellung bleibt
visuell abzunehmen. Es wurden keine zusätzlichen Pakete installiert.
