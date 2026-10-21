# Eigene OCSP-Prüfung und KIM-Statusbelege

Stand: 21.10.2026. `services/kim/ocsp.mjs` erzeugt echte OCSP-Anfragen und prüft
signierte Antworten gegen konfigurierte Zertifikat-Pins. Authentisierte TI-TSL,
vollständige Pfadprüfung und Konnektoroperation `VerifyCertificate` fehlen noch.

## Schnittstellen

```js
const verifier = new PinnedOcspVerifier({
  authorities: [{
    issuer: { certificate: issuerPem, sha256: issuerDerSha256 },
    responder: { certificate: responderPem, sha256: responderDerSha256 },
  }],
  validFrom, validUntil, // Millisekunden; lokaler Snapshot maximal 24 Stunden
});
const request = verifier.createRequest(leafPem);
const evidence = verifier.verify({ certificate: leafPem, request, response });
```

Die Anfrage enthält genau ein Zertifikat, keine Absenderkennung, Signatur oder
Nonce. CertID verwendet standardmäßig SHA-256, optional ausdrücklich SHA-1 nur
zur Identifikation. Die Antwort muss zu Anfrage, Ausstellername/-schlüssel und
Seriennummer passen; NULL und fehlende Algorithmusparameter sind gleichwertig.

CA und OCSP-Signierer müssen zu ihren Pins passen und aktuell gültig sein.
Die CA benötigt keyCertSign, der Signierer digitalSignature und ausschließlich
OCSPSigning als ExtendedKeyUsage. Das Blatt wird gegen die CA geprüft. Ein
separat autorisierter Signierer darf eine andere ausstellende CA haben. Diese
Zuordnung muss später aus geprüften TSL-Diensteinträgen stammen. Eingebettete
Zertifikate, Betriebssystemwurzeln und AIA-URLs begründen hier kein Vertrauen.
ResponderID wird gegen Namen oder Schlüsselhash geprüft; Mehrdeutigkeit scheitert.

Unterstützte Antwort- und Blattzertifikatssignaturen: BrainpoolP256r1/ECDSA/
SHA-256 sowie RSA ab 3072 Bit mit PSS/SHA-256, MGF1/SHA-256 und Saltlänge 32.
Das ist keine vollständige zeitabhängige TI-Algorithmusfreigabe.

## Status und Zeitprüfung

Das unveränderliche Ergebnis enthält `good | revoked | unknown`, die Hashes von
Blatt, CA, Signierer und Antwort, Zeitangaben und ein exklusives `validUntil`.
Auch `good` bleibt `identityStatus: unverified`, `trustSource: configured-pins`.
Für `good` und `revoked` ist certHash über das vollständige DER-Blatt zwingend,
mit SHA-256/384/512. SHA-1 ist dafür unzulässig. Bei `unknown` entfällt diese
positive Hashbestätigung. Sperrzeitpunkt/-grund bleiben negative Metadaten;
historische QES-Bewertungen sind nicht unterstützt.

Dieser aktuelle nonQES-Pfad verwendet die producedAt-Regel aus A_23225:
höchstens eine Stunde alt und höchstens fünf Minuten voraus, Grenzen inklusive.
thisUpdate/nextUpdate werden streng als Kalenderzeiten gelesen, bestimmen hier
aber nicht die Aktualität. Snapshot- und Zertifikatsablauf können die Gültigkeit
früher beenden. Das ist kein allgemeiner RFC-/QES-Zeitprüfer und keine Aussage,
dass A_23225 dem CM selbst zugewiesen wäre.

Falsche Signaturen/Bindungen, ungültige Pins, Zeitformate, doppelte CertIDs,
doppelte oder unbekannte kritische Erweiterungen scheitern mit festen Codes.
Grenzen: 256 KiB je Antwort, 100 Statusdatensätze, 10 eingebettete Zertifikate,
32 Erweiterungen. BER/indefinite Längen und angehängte Bytes werden abgelehnt.
Native Exceptions und Zertifikatsinhalte werden nicht in Fehlermeldungen ausgegeben.

## Prozesslokaler Cache

`new OcspStatusCache({ verifier, maxEntries: 256, timeoutMs: 10_000 })` bietet
`check({ certificate, obtain })`, `prune()` und `close()`.
Der Hostcallback `obtain(requestBytes, signal)` muss über eine unabhängig
konfigurierte Route Antwortbytes liefern. Das Modul öffnet selbst keine Verbindung.

Aktuelle Einträge werden zuerst wiederverwendet und gegen die Pins nachgeprüft.
Gleichzeitige Prüfungen desselben Zertifikats teilen eine Beschaffung; auch
negative Befunde werden gespeichert. Abgelaufene Einträge werden beim Zugriff
und einmal pro Minute entfernt. Kapazitätsgrenzen berücksichtigen laufende
Beschaffungen und verdrängen keine noch gültigen Befunde. Bei voller Kapazität
entsteht ein ausdrücklicher Fehler.

Der Callback erhält eine Anfragekopie und ein AbortSignal. Timeout und `close()`
beenden wartende Prüfungen; verspätete Antworten werden nicht übernommen.
Transportfehler werden nicht positiv gecacht. Der Cache ist nicht dauerhaft;
nach Neustart wird neu geprüft. Vollständiger Betrieb nach A_23225 bleibt offen.

## Anschluss an den KIM-Empfang

Die optionale Eingabe `receiveEccKimMessage({ ...options, ocsp })` besteht aus:

```js
{
  verifier,
  signing: { request: osigRequest, response: osigResponse },
  authentication: { request: autRequest, response: autResponse },
}
```

Nach den mathematischen Nachrichtenprüfungen werden beide Antworten gegen
genau die dort verwendeten OSIG-/AUT-Zertifikate erneut geprüft. Übergebene
`good`-Flags oder freie Prüferobjekte genügen nicht. Der JSON-Empfangsbericht
enthält Befunde, Zertifikats-/Antworthashes und die bestehende Originalhashbindung;
keine Zertifikate, OCSP-Rohbytes, Schlüssel oder nativen Exceptions.

Zwei positive lokale Befunde bleiben Integritätsergebnis 07. Negative, fehlende
oder ungültige übergebene Belege erzeugen `XCS_CERT_STATUS`; der Bericht trennt
gesperrt, unbekannt und nicht prüfbar. Ohne OCSP-Option gilt der bisherige Ablauf.
Klartextanlagen bleiben standardmäßig deaktiviert, KIM-Versand und normale
Zustellung gesperrt. Es gibt keinen automatischen Online-Abruf im Empfangsmodul.

## Prüfung und offene Integration

25 neue Fälle prüfen reale ECC-/RSA-PSS-Signaturen, Bindung, Zeitgrenzen,
Signiererersetzung, Manipulationen, DER, Cache-Nebenläufigkeit/-Ablauf/-Abbruch
und den tatsächlich verschlüsselten KIM-Empfang. OpenSSL liest die eigene
Anfrage und prüft die Antwort samt Status. Umgekehrt wird eine OpenSSL-Antwort
bis zum fehlenden TI-certHash verarbeitet und dort abgelehnt. Das ist ein
separater Parser-/Protokollweg, aber dieselbe Kryptoprimitivenbibliothek wie Node.
Gesamtlauf **223/223 bestanden**. Vier Vercel-Builds des Vorgängers `9746200`
sind erfolgreich. Keine Installation, echten OCSP-Endpunkte oder Produktionsdaten.

Offen: authentisierte TSL-Beschaffung/Rotation, vollständige Pfad-/Rollenprüfung,
VZD-/Telematik-ID-Zuordnung, dauerhafte Statusbeschaffung, SMC-B/Konnektor sowie
unabhängige Prüfung/Zulassung. Der Prüfer ersetzt die vorgeschriebene
Konnektorintegration nicht. Das FD-Anforderungsinventar bleibt unverändert.

Quellen:

- [gemSpec_PKI 2.28.0 vom 18.09.2026](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): TUC_PKI_006, A_25838, A_23225, GS-A_4957-01, GS-A_4693-01, Tab_PKI_288/290.
- [RFC 6960](https://www.rfc-editor.org/rfc/rfc6960): CertID, BasicOCSPResponse, ResponderID und Signaturprüfung.
- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/): Konnektoroperationen und Empfangsprüfung.
