# SMC-B: Authentisierung über den Konnektor

Stand: 22.10.2026. Der eigene Dienstkern kann über `ExternalAuthenticate` eine
Authentisierungssignatur anfordern und daraus ein `X-KIM-Auth`-Token erzeugen.
Die Nachweise verwenden lokale HTTPS-/mTLS-Gegenstellen, synthetische Karten
und Zertifikate sowie vorhandenes OpenSSL. Ein echter Konnektor, eine echte
SMC-B und ein KIM-Fachdienst sind damit noch nicht erprobt.

## Implementierter Vertrag

Festgeschrieben sind `AuthSignatureService_v7_4_1.wsdl` (7.4.1) und die darin
importierte `SignatureService.xsd` (7.4.2) aus `gematik/api-telematik`, Commit
`31dd17b7dbe76ba6016318a2dfdd028e63598419`. Die acht ergänzten Vertragsdateien
einschließlich transitiver Importe erhöhen den Schema-/Lizenzbestand auf 26
Dateien. Datei-Hashes und Manifest-Hash werden vor jeder XML-Prüfung kontrolliert.
Der vorhandene begrenzte XML-Prozess lädt keine Ressourcen aus dem Netz.

Die SOAPAction lautet
`http://ws.gematik.de/conn/SignatureService/v7.4#ExternalAuthenticate`.
Der Namespace der Nutzlast ist ebenfalls `SignatureService/v7.4`, obwohl der
Dienst `AuthSignatureService` heißt. Anfragen und Antworten müssen sowohl das
offizielle XSD als auch das engere unterstützte Profil erfüllen:

- ursprüngliche SMC-B-Auswahl und frischer PIN-Status `VERIFIED`;
- tatsächliches `C.HCI.AUT`, brainpoolP256r1, richtige KeyUsage, Admission und
  gültiger, exakt an die DER-Bytes gebundener Konnektorbeleg;
- höchstens 16 KiB ursprüngliche Authentisierungsdaten; daraus lokal genau
  einmal SHA-256, im SOAP-Aufruf ausschließlich dieser 32-Byte-Hash;
- `Base64Data` mit `MimeType="application/octet-stream"` und ausdrücklich
  angeforderter ECDSA-Typ `urn:bsi:tr:03111:ecdsa`;
- Antwort mit Status OK, genau einer `Base64Signature` und demselben ECDSA-Typ;
- kanonische DER-Sequenz aus zwei positiven Skalaren innerhalb der
  brainpoolP256r1-Gruppenordnung, höchstens 72 Byte;
- mathematische Signaturprüfung gegen das tatsächliche AUT-Zertifikat und die
  ursprünglichen Daten; anschließend Umwandlung in das 64-Byte-JOSE-Format.

Der aktuelle Konnektorvertrag bestimmt den Algorithmus anhand der Karte und
wertet den gewünschten SignatureType nicht als Garantie aus. Deshalb ist die
Kontrolle des **zurückgegebenen** Typs zwingend. RSA-/HBA-/HSM-Profile und die im
KIM-Text beschriebene RSA-Fallbackvariante sind hier nicht implementiert. Eine
abweichende Antwort führt zum Abbruch; es gibt keinen automatischen zweiten
Signaturversuch. Diese Schnittstelle ist für Authentisierung vorgesehen.
CMS-/Dokumentensignaturen mit `C.HCI.OSIG` brauchen weiterhin SignDocument.

## Diensthost und Verwendung

`KonnektorCertificateClient` erhält zusätzlich `authSignatureServiceUrl`.
Wie EventService und CardService muss dieser provisionierte HTTPS-Endpunkt
denselben Ursprung wie der CertificateService haben. CA, Hostname, Serverpin,
Clientzertifikat, Mandant-/Client-/Arbeitsplatzkontext und Umgebung bleiben
gebunden. Es gibt weder Discovery-Fallback noch Betriebssystem-Root-Fallback.
Ein fehlender Auth-Endpunkt wird ausdrücklich mit `AUTH_UNCONFIGURED` gemeldet.

```js
import { prepareSmcbPin } from '../../services/kim/connector-pin.mjs';
import { createSmcbKimAuth, assertSmcbKimAuth } from '../../services/kim/connector-auth.mjs';

// connector mit authSignatureServiceUrl und statusClient sind bereits provisioniert.
const prepared = await prepareSmcbPin({
  connector, statusClient, expectedTelematikId, requiredRoles,
  iccsn, ctId, slotId, allowPrompt: false, signal,
});
if (prepared.state === 'pin-verified') {
  const token = await createSmcbKimAuth({
    connector, statusClient, prepared, sender, cmVersion, signal,
  });
  assertSmcbKimAuth(token, connector, statusClient);
  // token.header ist ein gesperrtes Artefakt für die weitere Hostintegration.
  // Aktuelle VZD-Absenderbindung und CareSuite-Versandfreigabe fehlen hier noch.
}
```

`signSmcbAuthentication` verarbeitet alternativ die ursprünglichen
Authentisierungsbytes. Es akzeptiert keinen frei vorgegebenen Digest, privaten
Softwareschlüssel, PIN-/PUK-Wert oder behaupteten Erfolgsstatus. Die niedrige
Methode `externalAuthenticateSmcb` liefert nur den geprüften Operationsbefund;
erst der darüberliegende Ablauf ergänzt die vollständige Nachprüfung.

## Ablauf und Bindungen

1. Nur ein ursprüngliches `prepareSmcbPin`-Ergebnis derselben beiden Clients
   wird akzeptiert. Die vollständigen Karten-, TSL-/OCSP-, Admission-, Rollen-,
   Konnektor- und PIN-Belege werden vor der Operation erneut bewertet.
2. Der PIN-Beleg wird vor dem einmaligen Netzaufruf verbraucht. Eingabebytes
   werden kopiert; spätere Änderungen durch den Aufrufer ändern den Hash nicht.
3. Nach der asynchronen XML-Prüfung werden die Bindungen unmittelbar vor dem
   Absenden nochmals kontrolliert. Ablauf während der Anfragevorbereitung
   verhindert damit bereits den Netzaufruf. Die Signatur muss anschließend
   zu exakt diesen Bytes und dem AUT-Zertifikat passen.
   Neue Kartenabfragen während des Aufrufs entwerten dessen Ergebnis.
4. Danach erfolgt eine vollständige neue Vorbereitung ohne PIN-Dialog:
   GetCards, AUT/ENC/OSIG lesen, lokale TSL-/OCSP-Prüfungen, VerifyCertificate,
   erneutes GetCards und GetPinStatus. ICCSN, Terminal, Slot, Kartenmerkmale und
   alle drei Zertifikat-Hashes müssen gleich geblieben sein; PIN muss VERIFIED sein.
5. Erst danach entsteht `authentication-signed` beziehungsweise
   `authentication-token-created`. Ursprüngliche private Ergebnisbelege binden
   Bytes und beide Clients. Ihre erneute Prüfung scheitert unter anderem nach
   Fristablauf, Abbruch, Karten-/PIN-Aktualisierung, TSL-Wechsel oder Schließen.

Der Nachlauf fragt nur Karten am provisionierten Arbeitsplatz ab. Eine vorherige
mandantenweite Auswahl erweitert diese Nachprüfung nicht automatisch. Ein
außerhalb dieses Arbeitsplatzkontexts liegender Treffer scheitert; der Host
muss eine passende Kartenzuordnung provisionieren.

Eine komplette Authentisierung hat höchstens 60 Sekunden Gesamtzeit; für den
einzelnen ExternalAuthenticate-Aufruf gilt das konfigurierte Limit von maximal
30 Sekunden. Die ursprüngliche Vorbereitung und ihr Abbruchsignal bleiben
gebunden. Die nachträglich beschafften Belege behalten ihre kürzeren eigenen
Fristen; sie werden nicht künstlich verlängert.

## Token und Fehlerverhalten

Der Tokenbau teilt die Eingabeaufbereitung mit dem vorhandenen Softwarepfad.
Er erzeugt `alg=BP256R1`, `typ=JWT`, das tatsächliche AUT-x5c-Blatt sowie `nbf`,
neue UUID `jti`, geprüfte CM-Versionssyntax, normalisierten SMTP-Absender `sub`
und `aud=I_Message_Service`. Der NBF-Zeitpunkt stammt aus der vorbereiteten
PIN-Beobachtung. Der tatsächliche Signaturtyp muss zum Header passen.
Ein erfundener Hersteller-/Produktzulassungsstatus wird nicht vergeben.

Alle Ergebnisse bleiben `identityStatus: unverified` und
`deliveryStatus: held-for-trust-validation`. Beim Token ist zusätzlich
`senderBinding: unverified` ausdrücklich ausgewiesen. Die Konnektor-/Karten-
Identität ersetzt keine aktuelle VZD-Zuordnung des SMTP-Absenders.

Während der Schlüsseloperation blockieren weitere PIN-/Authentisierungsaufrufe
derselben Instanz. Abbruch, Timeout, SOAP-/HTTP-/XML-Fehler, falscher Schlüssel,
falsche Daten, ungültige Signatur oder Kartenwechsel ergeben keinen nutzbaren
Signaturwert und sperren weitere PIN-/Authentisierungsaufrufe der Instanz mit
`AUTH_OUTCOME_UNKNOWN`. Es gibt keinen automatischen Reset oder Wiederholungsweg.
Die Sperre ist konservativ: Eine fehlende Antwort beweist nicht, dass der
Konnektor keinen Kartenbefehl ausgeführt oder keinen Dialog geöffnet hat.
Der Host muss den Ausgang und einen etwaigen Terminaldialog klären.

Ein Fehler erst in der vollständigen Nachprüfung liefert ebenfalls kein Token.
Der schon erfolgte Signaturbefehl wird dadurch nicht rückgängig gemacht; der
alte Vorbereitungsbeleg bleibt verbraucht. Keine Fehlermeldung übernimmt fremde
SOAP-Freitexte. Kein Token wird automatisch an einen Fachdienst geschickt.

## Nachweise und offene Arbeit

Das [Prüfprotokoll](verification.md) enthält Transport-, Profil-, Signatur-,
Abbruch-, Konkurrenz- und vollständige Vor-/Nachprüfungen. Der lokale Peer
signiert den empfangenen Hash unabhängig mit OpenSSL `pkeyutl`; eine versehentliche
zweite Hash-Bildung wird dadurch erkannt. Der vorhandene Empfangsprüfer prüft
das erzeugte Token zusätzlich. Dies belegt keine physische Karte oder TI-Zulassung.

Der [CMS-Diagnosehost](konnektor-cms-host.md) ergänzt inzwischen die begrenzten
ECC-SignDocument-/EncryptDocument-/DecryptDocument-Aufrufe, dauerhafte
Prüfauftragskoordination und eine Webansicht. Offen bleiben Account-Manager-
Anbindung, aktuelle ausgehende VZD-Absenderbindung, vollständige Nachrichtenpipeline,
weitere Karten-/Kryptoprofile, die gesamte PIN-/Kontenverwaltung in der Oberfläche
und echte Hardware-/TI-Nachweise.
Snapshots und Signaturprüfung ersetzen keine kontinuierliche Entnahmeüberwachung
oder nachgewiesene atomare Konnektor-/Kartensitzung. Produktive Sperren sowie
unabhängige Prüfung/Zulassung bleiben bestehen. Das Fachdienstinventar bleibt
bei 106 Kennungen: 28 teilweise lokal belegt, 78 offen.

## Primärquellen

- [Offizielle Verträge am festgeschriebenen Commit](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419), AuthSignatureService 7.4.1 und importierte SignatureService 7.4.2.
- [gemSpec_Kon 5.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/gemSpec_Kon_V5.28.0/), TIP1-A_5437-02, TIP1-A_5149-01, TIP1-A_5665-03 und TIP1-A_5439-02, TAB_KON_780–784; geprüft am 22.10.2026.
- [gemSpec_CM_KOMLE](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/), A_28582 und A_19457-05: AUT-Token und DER-/RAW-Umrechnung; Account-Manager-Ablauf und RSA-Fallback hier noch offen.
- [RFC 5639, Abschnitt 3.4](https://www.rfc-editor.org/rfc/rfc5639.html#section-3.4), brainpoolP256r1-Gruppenordnung.
