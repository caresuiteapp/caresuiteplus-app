# TSL-Import und dauerhafte Versionskontrolle

Stand: 21.10.2026. `services/kim/tsl.mjs` prüft eine bereitgestellte TSL gegen
explizit konfigurierte TSL-Signer-CA-Zertifikate. `tsl-store.mjs` speichert die
geprüften Originale und den höchsten akzeptierten Listenstand dauerhaft.
Die Herkunft dieser anfänglichen Vertrauensanker muss weiterhin außerhalb des
Moduls authentisiert werden. Der Stand ist keine vollständige TI-PKI und keine
Produkt- oder Anbieterzulassung.

## Prüfablauf

1. Die separate DER-Signatur wird strukturell geprüft. Ihr Signierer muss aktuell
   gültig sein, durch genau eine konfigurierte CA ausgestellt sein und zu deren
   öffentlichem Schlüssel passen. Sein KeyUsage ist ausschließlich
   contentCommitment/nonRepudiation, seine ExtendedKeyUsage ausschließlich
   TSLSigning (`0.4.0.2231.3.0`). CA-Pins, Gültigkeit und unbekannte kritische
   Zertifikatserweiterungen werden geprüft.
2. Die separate Signatur muss die vollständigen, unveränderten XML-Bytes
   einschließlich der eingebetteten XML-Signatur authentisieren. Vorher wird
   kein XML-Parser gestartet. ECDSA/SHA-256 mit BrainpoolP256r1 und
   RSA-PSS/SHA-256 ab 3072 Bit mit MGF1/SHA-256 und 32-Byte-Salt sind unterstützt.
   Die direkte DER-ECDSA-Struktur des gematik-Beispiels und die BIT-STRING-
   Einbettung derselben Struktur sind explizit unterstützt.
3. Ein echter `PinnedOcspVerifier` prüft den Rohbeleg für genau dieses
   Signiererzertifikat und dessen Aussteller. Nur `good` ist zulässig. Der
   Prüfer wird unabhängig von der eingehenden Liste provisioniert. Ein
   JSON-Status, unbekannter oder gesperrter Signierer genügt nicht.
4. Ein begrenzter Python-/lxml-Prozess prüft UTF-8, XML-Struktur, das vollständige
   eingebundene XSD und die erlaubte XMLDSig-Struktur. DTDs, Entitäten,
   Verarbeitungsanweisungen, externe Referenzen, XPath-/XSLT-Transformationen,
   doppelte IDs, mehrere Signaturen und unbekannte kritische Erweiterungen
   werden abgelehnt. Schema-Imports werden nur aus der geprüften lokalen
   Schema-Menge aufgelöst. XML-URLs und `schemaLocation` lösen keine Abrufe aus.
5. Das Wurzelelement muss die einzige Referenz der eingebetteten Signatur sein.
   Der SHA-256-Digest und die Signatur über das kanonisierte SignedInfo werden
   tatsächlich geprüft; das KeyInfo-Zertifikat muss dem separaten Signierer
   bytegleich entsprechen. Unterstützt sind C14N 1.0 und Exclusive C14N 1.0,
   jeweils mit/ohne Kommentare, sowie enveloped-signature. InclusiveNamespaces-
   Parameter, C14N 1.1, weitere Referenzen/Objekte und andere Algorithmen werden
   ausdrücklich abgelehnt. XMLDSig verwendet ECDSA-SHA256 mit 64-Byte-P1363-
   Signatur oder `sha256-rsa-MGF1`.
6. Nach der asynchronen XML-Prüfung werden Uhrzeit, Anker und Signiererstatus
   erneut geprüft. Die Liste muss Version 3 verwenden, bereits ausgestellt und
   noch gültig sein. NextUpdate darf höchstens 30 Tage nach ListIssueDateTime
   liegen. Es gibt keine Ablaufkulanz. Das Profil `ecc-rsa` verlangt eine
   Folgenummer ab 10000 und einen ECDSA-Signierer; `rsa` verlangt 1 bis 9999
   und einen RSA-Signierer.

Der Ergebnis-Snapshot gilt nur bis zum frühesten Ablauf von Liste, Anker-
Provisionierung, Signierer-/Ankerzertifikat oder aktuellem OCSP-Beleg. Er enthält
Hashes, Zeiten, Listenkennung, Folgenummer, Umgebung und Schema-Bindung.
`trustSource` lautet `configured-tsl-anchors`, `identityStatus` weiterhin
`unverified`. Die Klasse kann nicht mit einem vom Aufrufer erfundenen Erfolg
instanziiert werden. Rohbytes werden kopiert; Metadaten und Dienstlisten sind
unveränderlich.

## Verwendung mit den bestehenden OCSP-Modulen

```js
import { TslVerifier } from '../../services/kim/tsl.mjs';
import { TslTrustStore } from '../../services/kim/tsl-store.mjs';

// Serverkonfiguration: keine Anker/URLs aus einer eingehenden Nachricht.
const verifier = new TslVerifier({
  anchors: configuration.tslSignerCaPins,
  signerStatusVerifier, // separat provisionierter PinnedOcspVerifier
  environment: configuration.environment, // test | reference | production
  profile: 'ecc-rsa',
  validFrom: configuration.anchorSnapshotFrom,
  validUntil: configuration.anchorSnapshotUntil,
  python: configuration.existingPythonExecutable, // absolut oder python3
});
const store = new TslTrustStore({
  path: configuration.absoluteTslDatabasePath,
  key: storageKey, // 32 Bytes, getrennt vom dauerhaften Volume verwaltet
  scopeId: configuration.stableTslScopeUuid,
  verifier,
});
try {
  // bundle enthält xml und detachedSignature als Originalbytes.
  // Diese Vorbereitung authentisiert die separaten Bytes, gibt aber noch
  // keine Dienste frei. Die Signierer-OCSP-Route ist separat fest konfiguriert.
  const prepared = verifier.prepareSignerStatus(bundle);
  const signerStatus = await signerStatusCache.check({ certificate: prepared.certificate });
  const { snapshot, changed } = await store.activate({ ...bundle, signerStatus });
  const ocspVerifier = snapshot.ocspVerifierFor([osigCertificate, autCertificate]);
  // ocspVerifier passt zu OcspStatusCache / DurableOcspStatusCache sowie
  // receiveEccKimMessage(..., ocsp: { verifier, signing, authentication }).
  // Bei Wiederanlauf: store.load({ signerStatus: freshRawProof }).
} finally {
  store.close();
}
```

`verify()` prüft einen einzelnen Import ohne Versionshistorie. Für den aktiven
Dienststand müssen `store.activate()` und `store.load()` verwendet werden.
`prepareSignerStatus()` ersetzt keine dieser beiden Prüfungen. Für `load()`
benötigt der Host den aktuellen Signiererbeleg; es gibt keine persistierte
„good“-Freigabe und keinen automatischen Offline-Fallback.

`ocspVerifierFor()` akzeptiert ein Zertifikat oder bis zu 16 Zertifikate und
liefert den vorhandenen OCSP-Prüfer mit deduplizierten CA-/Responder-Zuordnungen.
Für jedes Blatt muss genau eine aktuelle CA/PKC aus der Liste passen. Aktuelle
OCSP-Dienstidentitäten werden aus der Liste entnommen; eine identische
ausstellende CA oder Provider-Zeile des Responders wird nicht vorausgesetzt.
Es sind höchstens 100 CA-/Responder-Paare zulässig. Die bekannten Begrenzungen
des OCSP-Kerns gelten weiterhin, insbesondere aktuelle Zertifikatsgültigkeit.

Der Standard `model: 'current'` verwendet nur `inaccord`-CAs. Bei ausdrücklich
gewähltem `nonqes-compromise` ist eine als revoked gelistete CA nur für Blätter
zulässig, deren notBefore strikt vor StatusStartingTime liegt. Das ist eine
begrenzte nonQES-Statuspfadauswahl, keine historische/QES-Pfadvalidierung.
Zukünftige Dienste, fehlende Responder, doppelte Dienstidentitäten und revoked-
OCSP-Einträge geben keinen Prüfpfad frei. ServiceHistory wird nicht unterstützt.
QES-, CVC-, DNS- und Wechsel-Dienste sind Metadaten, keine automatisch neuen
Vertrauensanker. ServiceSupplyPoints werden nur als Daten ausgegeben und niemals
automatisch als Netzwerkziele verwendet.

Die Zertifikate aller Diensteinträge werden beim Import nicht pauschal auf eine
selbst definierte Kette geprüft. Die benötigten CA-/OCSP-Zertifikate werden erst
bei der Pfadauswahl geprüft. Entfernte Dienste stehen in einem neu geladenen
Snapshot nicht mehr zur Verfügung. Der Host muss bei Aktivierung einer neuen
Liste seine alten Verifier-/Cache-Instanzen ersetzen; ein bereits ausgegebener
Snapshot wird nicht rückwirkend durch einen globalen Mechanismus widerrufen.

## Dauerhafte Ablage

SQLite verwendet das vorhandene geschützte lokale Volume, WAL und FULL-
Synchronisierung. XML und separate Signatur liegen gemeinsam AES-256-GCM-
verschlüsselt vor. Die authentisierte Bindung umfasst Namespace, Umgebung/
Profil/Anker-/Schema-Konfiguration, Root-ID, Folgenummer, XML- und Signiererhash.
Ein authentisierter Schlüsselprüfwert erkennt falsche Schlüssel schon beim
Wiederöffnen. Unterschiedliche Umgebungen oder Ankersätze dürfen denselben
Namespace nicht stillschweigend übernehmen.

Ein Update benötigt eine andere Root-ID und eine höhere Folgenummer. Gleiche
ID/Folgenummer mit identischen XML-Bytes sind idempotent, auch bei einer neu
randomisierten separaten Signatur. Gleiche ID/Folgenummer mit anderen XML-Bytes
sind ein Widerspruch und werden abgelehnt. Alle anderen Rücksprünge oder
ID-/Folgenummer-Kombinationen scheitern. Die kurze Schreibtransaktion liest den
aktiven Stand erst nach vollständiger Prüfung erneut; konkurrierende Importe
können dadurch keinen neueren Stand überschreiben. Während `load()` erfolgte
Aktivierungen werden erkannt. Innerhalb einer SQL-Transaktion wird nicht auf
einen Parser oder auf Netzwerkantworten gewartet.

Ablauf löscht den gespeicherten höchsten Stand nicht. Geschlossene Instanzen
dürfen keine verspäteten Ergebnisse übernehmen. Schutz gegen Austausch der
gesamten Datenbank durch ein altes Backup erfordert zusätzlich einen externen
monotonen Kontrollpunkt; lokale Verschlüsselung allein verhindert diesen Angriff
nicht. Ankerrotation, Wiederherstellung und Schlüsselwechsel benötigen noch
einen gesonderten authentisierten Betriebsablauf.

## Laufzeit, Schemata und Nachweise

Verwendet wurden die bereits vorhandenen Node-24-/OpenSSL- und Python-3-/lxml-
Laufzeiten, ohne Installation oder neue Infrastruktur. Der XML-Worker benötigt
Python mit `lxml` und POSIX-`resource` auf dem Diensthost. Fehlt diese Laufzeit,
scheitert die Prüfung geschlossen; es gibt keinen vereinfachten Parserersatz.
Die geprüfte Umgebung verwendet lxml 6.1.1/libxml2 2.14.6. Dieser zusätzliche
Diensthost-Nachweis ist von den Vercel-Web-Builds zu unterscheiden.

Grenzen: 8 MiB XML, 16 kB separate Signatur, 4 MiB Worker-Ausgabe, 100000
XML-Elemente, Tiefe 64 und 2048 Dienste. Der separate Prozess hat zehn Sekunden
Gesamtfrist, acht CPU-Sekunden und 512 MiB Adressraum. Fehler enthalten feste
Codes ohne XML, Zertifikatsnamen, native Diagnosen oder Schlüssel.

`services/kim/tsl-schema/` enthält das gematik-Schema-Bündel zu ETSI TS 102 231
V3.1.2 einschließlich XML- und XMLDSig-Schema. Es stammt aus dem unten verlinkten
festen Commit, nicht aus einer zur Laufzeit wechselnden URL. Originalhinweise
und die Repository-Lizenz sind erhalten. Alle drei Dateien und das Manifest
sind SHA-256-gebunden. Dieses gematik-Bündel ist nicht bytegleich mit dem
ursprünglichen ETSI-Download und wird nicht als solcher bezeichnet.

Die synthetischen Tests verwenden eine eigene lokale PKI, echte ECC-/RSA-PSS-
Signaturen und echte signierte OCSP-Belege. Sie prüfen vier C14N-Varianten,
Namespaces/Einrückung/Kommentare, OpenSSL-Gegenprüfung, manipulierte Dateien,
Signiererprofile, Signiererstatus, XML-/XSD-Grenzen, Dienststatus, Ablauf,
Wiederöffnen, Verschlüsselung und konkurrierende Aktivierungen. Der konkrete
Gesamtlauf steht im [Prüfprotokoll](verification.md).

Noch offen sind automatisierte authentisierte TSL-Beschaffung samt Refresh/
Hashverfahren, initiale TI-Ankerprovisionierung und Rotation, weitere normative
XMLDSig-Profile, vollständige Pfad-/Rollen-/Policyprüfung, VZD-/Telematik-ID-
Bindung, Konnektor/SMC-B, produktiver Statusanschluss und unabhängige gematik-
Interoperabilitäts-/Zulassungsnachweise. Normale KIM-Zustellung bleibt gesperrt.

## Primärquellen

- [gemSpec_PKI 2.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): insbesondere TUC_PKI_001, 011, 012, 019 und 020.
- [gemSpec_TSL](https://gemspec.gematik.de/docs/gemSpec/gemSpec_TSL/latest/): Listenprofil, Signierer, ServiceStatus, separate Signaturen und Umgebungen; geprüft am 21.10.2026.
- [gematik-Schemata, Commit 31dd17b](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419/ext).
- [gematik-Beispiele für separate Signaturen](https://github.com/gematik/examples-TelematikInterfaces/tree/master/tslService/detachedSignature): insbesondere die tatsächliche ASN.1-Struktur des ECC-Beispiels.
- [XML Signature Syntax and Processing](https://www.w3.org/TR/xmldsig-core/): Referenzen, Transformationen, Digest und SignedInfo.
