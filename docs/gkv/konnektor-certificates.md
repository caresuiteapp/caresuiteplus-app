# Konnektor: Karten-Zertifikate lesen und prüfen

Stand: 22.10.2026. Der eigene CertificateService-Client führt echte SOAP-1.1-
Anfragen über HTTPS mit gegenseitiger TLS-Authentisierung aus. Implementiert sind
`ReadCardCertificate`, `VerifyCertificate` und ein gemeinsamer Lese-/Prüfablauf.
Die Nachweise stammen aus lokalen mTLS-Gegenstellen. Ein physischer Konnektor,
eine SMC-B und echte TI-Dienste wurden damit noch nicht geprüft. Alle Ergebnisse
bleiben ohne produktive Versand- oder Zustellfreigabe.

Die ergänzte [Kartenabfrage und SMC-B-Auswahl](konnektor-smcb.md) verwendet
GetCards und verbindet frische Kartensitzungen mit den drei tatsächlichen
Institutionszertifikaten, lokalen TSL-/OCSP-Belegen und VerifyCertificate.

## Vertrag und Schemaherkunft

`services/kim/connector-certificates.mjs` verwendet CertificateService WSDL 6.0.1
und XSD 6.0.2 aus dem offiziellen Repository `gematik/api-telematik`, fest auf
Commit `31dd17b7dbe76ba6016318a2dfdd028e63598419`. Die importierten Schemata und
die Repository-Lizenz liegen vollständig in `services/kim/connector-schema`.
`manifest.json` dokumentiert Herkunft und SHA-256 jeder Datei; nur die
Zeilenenden sind auf LF vereinheitlicht. Auch der Manifest-Hash ist im Worker
festgeschrieben. Es gibt keinen WSDL-/Schemaabruf während einer Anfrage.

Der vorhandene Python-3-/lxml-Prozess prüft jede erzeugte Anfrage und jede
Antwort gegen diese Schemata. SOAP-Version, Operation und Namensräume müssen
passen. Nur ein Body mit genau einer Nutzlast ist erlaubt; ein leerer Header
ist zulässig. Nichtleere SOAP-Header, SOAP-Encoding, DTDs, Entitäten,
Verarbeitungsanweisungen und externe Ressourcen werden abgelehnt. Eine
WSDL-Operation außerhalb der ausdrücklich implementierten Operationen ist dadurch
nicht automatisch verfügbar.

## Verwendung im Diensthost

```js
import {
  KonnektorCertificateClient,
  assertConnectorCertificate,
} from '../../services/kim/connector-certificates.mjs';
import { receiveEccKimMessageWithTsl } from '../../services/kim/receive-tsl.mjs';

// Vom Host provisionierte Konfiguration und Schlüssel, keine Browserparameter.
const connector = new KonnektorCertificateClient({
  url: configuration.certificateServiceHttpsUrl,
  eventServiceUrl: configuration.eventServiceHttpsUrl, // optional für GetCards
  ca: configuration.connectorCaPem,
  serverSha256: configuration.connectorServerLeafSha256,
  clientCertificate: credentials.clientCertificatePem,
  clientKey: credentials.clientPrivateKeyPem,
  clientPassphrase: credentials.clientKeyPassphrase,
  environment: configuration.environment, // test oder production
  context: {
    mandantId: configuration.mandantId,
    clientSystemId: configuration.clientSystemId,
    workplaceId: configuration.workplaceId,
    // userId ist optional; nur bei tatsächlich provisioniertem Benutzer setzen.
  },
  timeoutMs: 10_000,
});

try {
  const cards = await connector.readAndVerifyCardCertificates({
    cardHandle: configuration.cardHandle,
    certRefs: ['C.AUT', 'C.ENC', 'C.SIG'],
    crypt: 'ECC',
    requiredRoles: configuration.expectedProfessionOids,
    signal,
  });
  cards.revalidate(); // Nach späterem Warten erneut prüfen, vor weiterer Nutzung.
  // cards.deliveryStatus bleibt held-for-trust-validation.

  const proof = await connector.verifyCertificate({
    certificate: actualCertificateDer, // kanonisches DER, kein PEM und kein Hash
    requiredRoles: configuration.expectedProfessionOids,
    signal,
  });
  assertConnectorCertificate(proof, connector, {
    certificate: actualCertificateDer,
    requiredRoles: configuration.expectedProfessionOids,
  });

  const result = await receiveEccKimMessageWithTsl(messageOptions, reportOptions, {
    statusClient, directory, connector, signal,
  });
  // result.deliveryStatus bleibt diagnostic-only.
} finally {
  connector.close();
}
```

Der Host hält den Client üblicherweise über mehrere Vorgänge offen. Der
Konstruktor startet weder Listener noch Netzabfragen. Die Endpunkt-URL ist fest;
Hostname, ausdrücklich konfigurierte CA und SHA-256 des tatsächlichen
Server-Leafs müssen zusammenpassen, bevor SOAP-Anwendungsdaten übertragen
werden. Optionales `connectAddress` erlaubt eine feste IP bei unverändertem
TLS-Hostnamen. Mindestversion ist TLS 1.2. System-Root-Fallback, Redirects,
Umgebungs-Proxys, HTTP und Basic-Authentisierung sind nicht implementiert.
Ein Konfigurationswechsel erfordert einen neuen Client.

## Operationen und Belege

| Operation | Eingabe und Ergebnis |
| --- | --- |
| `readCardCertificates` | Explizites CardHandle, ein bis vier eindeutige Referenzen aus C.AUT/C.ENC/C.SIG/C.QES, ausdrücklich ECC oder RSA. Antwort muss genau die angefragten Referenzen enthalten. Fehlendes X509Data wird als `missing` ausgegeben. Vorhandene Zertifikate müssen echte DER-Blätter mit passender Schlüsselart sein. |
| `verifyCertificate` | Prüft das übergebene tatsächliche DER-Zertifikat zum aktuellen Konnektorzeitpunkt. `VerificationTime` wird absichtlich nicht gesetzt. Liefert Ausführungsstatus, getrennten Zertifikatsbefund, Rollen und begrenzte numerische Fehlercodes. |
| `readAndVerifyCardCertificates` | Liest alle angefragten Referenzen, verlangt Vollständigkeit und prüft jedes Zertifikat. Vor der Rückgabe werden sämtliche Belege erneut ausgewertet. Eine fehlende Referenz oder ein negativer Befund verhindert das gesamte Ergebnis. |
| `assertConnectorCertificate` | Akzeptiert nur den ursprünglichen privaten Beleg desselben offenen Clients für exakt dasselbe DER-Zertifikat und alle geforderten Rollen. Klone, fremde Clients, abgelaufene Belege und manuell gesetzte Statuswerte werden abgelehnt. |

HTTP 200 und `Status/Result = OK` bedeuten allein keine Zertifikatsgültigkeit.
`VerificationResult` kann `VALID`, `INCONCLUSIVE` oder `INVALID` sein. Nur
`VALID` mit Ausführungsstatus OK, ohne Fehlerdetails und mit allen geforderten
Rollen besteht die lokale Belegprüfung. Negative oder unbestimmte Antworten
müssen einen schemafähigen Fehlergrund enthalten. SOAP Faults werden auch bei
HTTP 200 erkannt; HTTP 500 mit einer scheinbar erfolgreichen Nutzlast scheitert.
Unbekannte/mehrdeutige Felder und widersprüchliche Statuskombinationen scheitern.

Ein Beleg ist an Client, Umgebung, Kontext, Route, Anfrage-/Antwortbytes und
Zertifikat gebunden. Die öffentliche Ausgabe enthält Hashes und Zeitpunkte,
keine Kontext-IDs, Schlüssel, SOAP-Texte oder fremden Fehlermeldungen.
Numerische Remote-Codes sind auf höchstens 32 Werte begrenzt. Die freie
Zertifikatsanzeige aus ReadCardCertificate wird nicht als Identität übernommen.
Die Zertifikatbytes selbst bleiben bei Leseoperationen Teil des Ergebnisses.

Die Nutzungsfrist beträgt höchstens 30 Sekunden ab Empfang und endet spätestens
mit dem Zertifikat. Sie ist eine lokale Verbrauchsfrist, **kein TI-Statuscache**.
Uhr-Rücksprung, geschlossenes Clientobjekt oder veränderte Zertifikatpuffer
entwerten den Beleg. Der kombinierte Lese-/Prüfvorgang hat zusätzlich eine
Gesamtfrist von 30 Sekunden. Seine `revalidate`-Funktion prüft auch diese Frist.

## Zusätzliche Pflichtprüfung im Empfang

Mit `connector` in `receiveEccKimMessageWithTsl` muss auch `directory` vorhanden
sein; beide Statusclients müssen dieselbe Test-/Produktionsumgebung verwenden.
Die bestehende TSL-/OCSP-/Typ-/Admission-Prüfung erfolgt zuerst. Nur nach einem
positiven lokalen Befund wird das identische Zertifikat dem Konnektor vorgelegt.
Die PEM-/DER-Eingaben des bisherigen Empfangs werden an dieser Grenze in die
tatsächlichen DER-Bytes umgewandelt. Geforderte Rollen stammen aus der bereits
geprüften Admission, nicht aus einem behaupteten Aufruferstatus.

Passt OSIG zur geprüften From-Zuordnung, erfolgt keine AUT-Anfrage. Andernfalls
benötigt auch das tatsächliche AUT-x5c-Leaf einen positiven Konnektorbefund.
Vor der abschließenden Diagnose werden lokale Rohbelege, VZD-Serverbeleg und
alle benötigten Konnektorbelege erneut geprüft. `INVALID`, `INCONCLUSIVE`,
fehlende Rollen, SOAP-/HTTP-/XML-Fehler, Ablauf und Schließen verhindern den
positiven Empfangszweig. Ein konfigurierter, fehlgeschlagener Konnektor wird
nicht durch den lokalen OCSP-Erfolg ersetzt. Die vorhandene Aufrufvariante
ohne Konnektor bleibt als eigener lokaler Diagnosepfad verfügbar.

`connectorAcquisition.certificates` enthält nur tatsächlich erhaltene Befunde
für `signing` und gegebenenfalls `authentication`. `statusAcquisition.failures`
enthält begrenzte Abruffehler; `diagnostic.certificateStatus` zeigt die erneute
Bewertung einschließlich Rollen- oder Fristfehlern. Eine frühere rohe
`verificationResult: VALID`-Ausgabe ist keine endgültige Freigabe. Der positive
Gesamtpfad bleibt Diagnose 07, `identityStatus: unverified`, ohne normalen
Klartextversand oder automatische Zustellung.

## Laufzeitgrenzen und offene Integration

Pro Client höchstens acht gleichzeitige Operationen, je Anfrage 50–30.000 ms
(Standard 10.000 ms), maximal 64 KiB Anfrage und 256 KiB Antwort. Der XML-Worker
hat fünf Sekunden Wandzeit, drei Sekunden CPU, 256 MiB Adressraum und feste
Knoten-/Tiefen-/Wertgrenzen. Er nutzt Python 3/lxml mit POSIX-Ressourcenlimits.
Es gibt keine Paketinstallation oder Ersatzinterpretation bei fehlender Laufzeit.
Abbruch und `close()` beenden laufende Arbeit; spätere Antworten erzeugen keinen
verwendbaren Beleg. SOAP-Nachrichten werden nicht wiederholt.

GetCards und eindeutige SMC-B-Auswahl sind als Dienstschnittstelle ergänzt.
Noch offen sind DVD/ServiceDiscovery, Terminalinventar und Auswahloberfläche, provisionierte
Konnektor- und Mandantenkontexte, reale mTLS-Interoperabilität, SMC-B-/HBA-
Schlüsseloperationen, PIN-Verwaltung, historische Prüfungen, QES-Sonderprofile,
weitere Transport-/SOAP-Profile, vollständige Kryptografie-/Fehlervorgaben und
unabhängige Abnahme. Das explizite Lesen von RSA oder C.QES ist keine Freigabe
dieser KIM-Nachrichtenprofile. Der VZD-Server wird weiterhin mit dem vorhandenen
eigenen TSL-/OCSP-Pfad geprüft; auch ENC-Auswahl und Nachrichtenerzeugung sind
noch nicht mit Konnektor-Schlüsseloperationen verbunden.

Ein extern gemeldetes VALID beweist für sich keinen TI-Vertrauenspfad: Der
Konnektorvertrag kennt auch manuell importierte CAs. Deshalb ersetzt dieser
Adapter weder die eigene Status-/Rollenprüfung noch authentisierte TI-
Ankerbereitstellung, Betriebsintegration, Zulassung oder den gesperrten
CareSuite-Echtversand. Das FD-Inventar bleibt bei 106 Kennungen, davon 28
teilweise lokal belegt und 78 offen. [Prüfprotokoll](verification.md).

## Primärquellen

- [Offizieller CertificateService-Vertrag, festgeschriebener Commit](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419): WSDL 6.0.1, XSD 6.0.2 und sämtliche Schemaimporte; am 22.10.2026 abgerufen.
- [gemSpec_Kon 5.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/gemSpec_Kon_V5.28.0/): TIP1-A_4700-03, ReadCardCertificate; TIP1-A_5449, VerifyCertificate und getrennte Statuswerte. Stand 22.07.2026, geprüft am 22.10.2026.
- [gemILF_PS](https://gemspec.gematik.de/docs/gemILF/gemILF_PS/latest/): Abschnitt CertificateService und A_13535; ausdrückliche ECC-/RSA-Auswahl, geprüft am 22.10.2026.
- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/): KOM-LE-A_2048-02 und Zertifikatsprüfung beim Empfang; Teilintegration, kein vollständiger Konformitätsnachweis.
