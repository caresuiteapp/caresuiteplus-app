# ECC-Kern für KIM-Nachrichten

Stand: 21.10.2026. Ausführbare, lokal geprüfte Kryptokomponente im Entwicklungszweig.
Sie ist noch kein vollständiges KIM-Clientmodul, keine TI-Vertrauensprüfung und
kein freigegebener Echtversand.

## Ablauf und Schnittstellen

`services/kim/ecc-cms.mjs` bietet zwei interne Funktionen:

- `sealEccKimPayload({ message, sender, recipients, signingCertificate, signingKey, now? })`
  nimmt Originalbytes einer Nachricht, explizite Empfängerzertifikate einschließlich
  des Senders und einen Brainpool-Signaturschlüssel entgegen. Es erzeugt einen
  DER-kodierten AuthEnvelopedData-Container.
- `openEccKimPayload({ bytes, address, recipientCertificate, privateKey, expectedSignerCertificate, now? })`
  entschlüsselt für genau die angegebene Zertifikats-/Adresszuordnung. Es prüft
  anschließend Signatur und geschützte Empfängerzuordnung gegen das ausdrücklich
  übergebene Signaturzertifikat. Erst dann liefert es die Originalbytes zurück.
  Das Ergebnis enthält immer `identityStatus: 'unverified'` und den Hash des
  verwendeten Signaturzertifikats. `claimedSigningTime` ist eine signierte
  Behauptung des Absenders, kein vertrauenswürdiger Zeitstempel.

Die Eingabe wird in `message/rfc822` gekapselt. Die innere Opak-Signatur ist
ECDSA/SHA-256 auf brainpoolP256r1. SignedData enthält genau das Signaturzertifikat,
einen SignerInfo-Eintrag und die signierten Attribute content-type, message-digest,
signing-time, SigningCertificateV2 sowie recipient-emails. Der Hash im
SigningCertificateV2 bindet das Zertifikat; ein fremdes eingebettetes Zertifikat
wird nicht als Vertrauensanker übernommen. Der Empfänger vergleicht die
ungeschützte äußere Empfängerzuordnung mit ihrer signierten inneren Kopie.

Für die Verschlüsselung wird ein frischer zufälliger 256-Bit-Transportschlüssel
verwendet. Der Inhalt wird mit AES-256-GCM, zufälliger 12-Byte-Nonce und 16-Byte-Tag
verschlüsselt. Dieser Transportschlüssel wird je Empfänger separat mittels
TI-ECIES verschlüsselt. Auch dafür entsteht jedes Mal ein neues ephemeres
Brainpool-Schlüsselpaar. TI-ECIES verwendet hier **KeyTransRecipientInfo** mit
OID `1.2.276.0.76.4.222`, nicht den allgemein üblichen CMS-KeyAgreeRecipientInfo.

`ecies.mjs` setzt die Kartenkodierung aus gemSpec_COS um: ECDH auf Brainpool-P256r1,
SHA-256 über das gemeinsame Geheimnis mit den Zählern 1 und 2, AES-256-CBC mit
ISO-Padding, aus AES(Kenc, 0) abgeleitete IV und ISO-gepaddeter CMAC, auf acht
Bytes gekürzt. Das feste 145-Byte-DOA6 transportiert ausschließlich einen
32-Byte-Schlüssel. Andere Kurven, komprimierte/ungültige Punkte, falsche OIDs,
Längen, Tags und Paddingvarianten werden zurückgewiesen. Die MAC-Prüfung erfolgt
vor der CBC-Entschlüsselung. Die eigentlichen AES-, ECDH-, Hash- und
ECDSA-Operationen verwenden Node/OpenSSL; die CMAC-Zusammensetzung ist mit
veröffentlichten NIST-Vektoren geprüft.

Der vorhandene Fachdienst erkennt diesen äußeren TI-ECIES-Container nun bei der
SMTP-Annahme. Er besitzt weiterhin keinen Empfänger-Privatschlüssel und kann
deshalb weder GCM noch innere Signatur prüfen. Die bisherige RSA-OAEP-Strukturprüfung
bleibt für ältere Container erhalten; daraus folgt keine RSA-Freigabe für den
aktuellen TI-Betrieb. Der neue Erzeuger schreibt ausschließlich ECC-Container.

## Begrenzung und Vertrauensgrenzen

- Die Zertifikate müssen Brainpool-P256r1 und die passende Policy/KeyUsage besitzen:
  C.HCI.ENC oder C.HP.ENC mit keyAgreement, C.HCI.OSIG mit nonRepudiation.
  Signieren mit AUT/digitalSignature wird abgelehnt. Zeitliche Gültigkeit wird
  bei Erzeugung und Signaturprüfung geprüft. Historische Empfängerschlüssel
  bleiben zur Entschlüsselung verwendbar. Diese Rollenprüfung ersetzt keine
  vollständige Zertifikatspfad-, TSL-, OCSP-, Rollen- oder VZD-Prüfung.
- Software-KeyObjects ermöglichen die lokalen Prüfungen. Der Konnektor-/SMC-B-
  Anschluss für nicht exportierbare Schlüssel fehlt. Die Tests verwenden eine
  kurzlebige eigene CA, keine TI-Zertifikate. Die Herkunft des erwarteten
  Signaturzertifikats und die Zuordnung von Telematik-ID und Postfach bleiben
  vom späteren vertrauenswürdigen Empfängerablauf zu belegen.
- Unterstützt werden die hier erzeugten kanonischen binären MIME-Hüllen und die
  beschriebene DER-/Attributteilmenge. BER, andere zulässige MIME-Kodierungen,
  weitere CAdES-Profile/Attribute und allgemeine MIME-Interoperabilität fehlen.
  Ein erfolgreicher OpenSSL-`-cades`-Test ist keine vollständige ETSI-/KIM-Zulassung.
- Die RFC822-/MIME-Semantik der Eingabe, äußere/innere Headergleichheit, AUT-Erzeugung,
  KAS-Auslagerung und fachliche PDF/XML/XSD-/CAdES-Prüfungen der Nutzkomponenten
  sind nicht Teil dieses Codecs. Aus einer korrekten Nachrichtensignatur folgt
  keine korrekte Pflegeabrechnung.
- Maximal 15.000.000 Originalbytes und 1.000 Empfängerzertifikate; der fertige
  Container ist auf 21 MiB begrenzt. Die spätere äußere Base64-Mail muss weiterhin
  separat in die SMTP-Grenze passen. Der Codec ist ein synchroner interner
  Dienstbaustein, kein neuer öffentlicher HTTP-Endpunkt.
- Mehrere Zertifikate je Postfach sind möglich, dieselbe Issuer-/Serial-Identität
  mehrfach in einer Empfängerliste nicht. Eine Zertifikatsidentität mit mehreren
  unterschiedlichen Postfachadressen ist in dieser Teilmenge nicht abgebildet.
- Temporäre Schlüssel-/Klartextbuffer werden soweit kontrollierbar überschrieben.
  Eine garantierte Löschung aller Kopien in JavaScript/V8/OpenSSL wird nicht behauptet.

Der CareSuite-Versandworker bleibt für KIM gesperrt. Es gibt durch diese Änderung
keine Rechnungsfreigabe, keine Supabase-Statusübernahme und keinen Kontakt zu
einem echten Fachdienst.

## Prüfbelege

`kim-ecc.test.mjs` enthält 15 neue Prüfungen. Vier veröffentlichte NIST-AES256-CMAC-
Vektoren prüfen leere, vollständige und angebrochene letzte Blöcke. Das
veröffentlichte gemSpec_Krypt-DOA6-Beispiel prüft die Kartenstruktur; es ist kein
Entschlüsselungsvektor, weil darin kein privater Schlüssel vorliegt.

Ein gesonderter CLI-Pfad führt ECDH, SHA-256-Ableitung, AES-ECB/CBC und CMAC aus.
Er entschlüsselt einen vom eigenen Code erzeugten Schlüsseltransport und erzeugt
einen Transport, den der eigene Code entschlüsselt. Auch korrekt authentifiziertes,
aber falsches Padding wird abgewiesen. Beide Pfade verwenden OpenSSL als
Kryptoprimitivenbibliothek; dies ist eine Gegenprüfung der Zusammensetzung und
kein Vergleich zweier unabhängiger Kryptobibliotheken.

OpenSSL verifiziert den tatsächlichen inneren CMS-Container einschließlich
SigningCertificateV2 mit `cms -verify -cades` gegen die isolierte Test-CA.
Weitere Tests verändern Schlüssel, Zertifikate, Ciphertext, GCM-Tag, signierte
Attribute und äußere Empfängerzuordnung. Eine gültig neu erzeugte GCM-Hülle
verbirgt eine beschädigte innere Signatur nicht.

Eine zusätzliche Prüfung in `kim-smtp.test.mjs` durchläuft den tatsächlichen
lokalen Weg: Signieren/Verschlüsseln, mTLS-SMTP mit AUT-Prüfung, dauerhafte
Postfachzustellung und DSN, mTLS-POP3 in die verschlüsselte Inbox, Entschlüsseln
und Signaturprüfung. Die Originalbytes bleiben identisch. Erneuter SMTP-Versand
nach POP3-Löschung erzeugt keine zweite Zustellung.

Mit den bisherigen Fällen bestehen **162/162 Prüfungen**. Kein Test wurde
übersprungen; keine neue Software oder Infrastruktur wurde installiert.

## Zuordnung zu Originalunterlagen

| Grundlage | Lokaler Beleg | Noch offen |
| --- | --- | --- |
| gemSpec_Krypt 2.48.0, A_17220 und GS-A_4389 | TI-ECIES-Schlüsseltransport und AES-256-GCM, Sender-/Empfänger-Roundtrip | Offizielle Entschlüsselungs-Testvektoren und Gegenstelle |
| gemSpec_COS 3.14.0, N001.520, N002.810/820, N004.492/500/800, N085.068.b.7 | Ableitung, CMAC, Kartenformat und Manipulationsfälle | Tatsächliche Karte/Konnektor und unabhängige Sicherheitsprüfung |
| gemSMIME_KOMLE 1.8.0, A_2095, A_2097, A_2103/2104, A_2106/2107/2108/2109, A_2111/2112 | Signieren vor Verschlüsseln, kanonische MIME-Hüllen, CMS-Struktur | Vollständiger Nachrichten-/Clientablauf und andere zulässige Kodierungen |
| gemSMIME_KOMLE 1.8.0, A_2114 bis A_2127 | Empfängerzuordnung, innere Attributkopie, Einzelzertifikat/Einzelsignatur | Vollständige Interoperabilitäts- und CAdES-Prüfung |
| gemSMIME_KOMLE 1.8.0, A_2128/2129 | ENC-/OSIG-Rollenprüfung, KeyUsage und Brainpool | TI-TSL/OCSP, VZD und SMC-B-Nachweis |

Quellen, am 21.10.2026 abgeglichen:

- [gemSpec_Krypt 2.48.0, insbesondere 4.7](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Krypt/gemSpec_Krypt_V2.48.0/).
- [gemSpec_COS 3.14.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_COS/gemSpec_COS_V3.14.0/).
- [gemSMIME_KOMLE 1.8.0](https://gemspec.gematik.de/docs/gemWeitere/gemSMIME_KOMLE/gemSMIME_KOMLE_V1.8.0/).
- [gemSpec_OID](https://gemspec.gematik.de/docs/gemSpec/gemSpec_OID/latest/index.html).
- [NIST CMAC-Beispiele](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/AES_CMAC.pdf).
- [RFC 5083](https://www.rfc-editor.org/rfc/rfc5083), [RFC 5652](https://www.rfc-editor.org/rfc/rfc5652) und [RFC 5035, SigningCertificateV2](https://www.rfc-editor.org/rfc/rfc5035).
