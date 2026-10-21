# OCSP-Abruf und dauerhafte Statusbelege

Stand: 21.10.2026. Der eigene PKI-Kern kann OCSP-Antworten über eine fest
konfigurierte HTTP(S)-Route beschaffen, kryptografisch prüfen und verschlüsselt
über Neustarts hinweg wiederverwenden. Er ist noch keine authentisierte
TI-Vertrauensverwaltung und ersetzt keine Konnektoroperation.

## Schnittstellen

```js
import { OcspHttpTransport } from '../../services/kim/ocsp-http.mjs';
import { DurableOcspStatusCache } from '../../services/kim/ocsp-store.mjs';

// Alle Werte stammen aus der Dienstkonfiguration, nicht aus einer Nachricht.
const transport = new OcspHttpTransport({
  url: configuration.ocspUrl,
  timeoutMs: 10_000,
});
const cache = new DurableOcspStatusCache({
  path: configuration.absoluteDatabasePath,
  key: storageKey, // 32 Bytes; separat vom geschützten lokalen Volume
  scopeId: configuration.stableScopeUuid,
  verifier, // tatsächlicher PinnedOcspVerifier; siehe ocsp.md
  transport,
  maxEntries: 256,
  maxBytes: 67_108_864,
  timeoutMs: 10_000,
});
try {
  const signing = await cache.check({ certificate: osigCertificate });
  const authentication = await cache.check({ certificate: autCertificate });
  const result = receiveEccKimMessage({
    ...messageOptions,
    ocsp: { verifier: cache.verifier, signing, authentication },
  }, diagnosticOptions);
} finally {
  cache.close();
}
```

Der Host hält den Cache gewöhnlich für die Lebensdauer des Dienstes offen.
`prune()` entfernt abgelaufene Datensätze; `close()` beendet laufende Abfragen
und gibt die eigenen Claims frei. Der Rückgabewert enthält die bisherigen
Prüffelder, eigene Kopien von `request`/`response` und
`source: response | persistent-cache`. `good` bleibt `unverified`.
Fehler müssen als fehlender Prüfbeleg behandelt werden, niemals als Erfolg.

## Begrenzter Transport

`OcspHttpTransport.obtain(request, signal)` sendet die unveränderten DER-Bytes
als POST mit `application/ocsp-request` und erwartet
`application/ocsp-response`. HTTPS prüft Zertifikatskette und Hostnamen mit
mindestens TLS 1.2. Eine optionale PEM-CA ersetzt ausdrücklich die Systemwurzeln.
`connectAddress` darf nur eine feste IP sein; TLS-Name und HTTP-Host bleiben der
konfigurierte URL-Hostname. Unverschlüsseltes HTTP erfordert `allowHttp: true`.
Die signierte OCSP-Antwort wird bei beiden Transportarten separat geprüft.

Anfragen sind auf 4 KiB, Antworten auf 256 KiB und HTTP-Header auf 16 KiB
begrenzt. Es gilt eine Gesamtdauer je Anfrage, kein durch einzelne Bytes immer
wieder verlängerbarer Leerlauftimer. HTTP-Status, Medientyp, Mehrfachheader,
Komprimierung, Größen und vollständiger Empfang werden geprüft. Weiterleitungen,
URL-Zugangsdaten, Cookies, Proxy-Umgebungsvariablen und AIA-Auswertung sind nicht
Teil dieses Transports. Fehler enthalten ausschließlich feste Codes.

Die Route ist serverseitig fest. Eine spätere TSL-/AIA-Routenauflösung muss
Umgebung, Berechtigung und zulässige Ziele unabhängig prüfen. Das Modul ist
kein öffentlicher Abrufproxy und darf nicht mit Benutzer-URLs konfiguriert werden.

## Persistenz und Nebenläufigkeit

SQLite verwendet WAL, FULL-Synchronisierung und kurze `BEGIN IMMEDIATE`-
Transaktionen. Verzeichnis und Datei benötigen geschützte Rechte (0700/0600).
Anfrage und Antwort werden zusammen mit AES-256-GCM gespeichert. Die Bindung
umfasst Namespace, Zertifikathash, producedAt, Ablauf und Bytezahl. Öffentlich
sichtbare SQL-Metadaten sind Hashes, Zeitpunkte, Größen und Claim-Kennungen;
Zertifikate und Rohantworten liegen nur verschlüsselt vor. Es werden keine
Patienten-, Nachrichten- oder Postfachdaten in diesen Cache übernommen.

Ein Namespace bindet die Route einschließlich TLS-Konfiguration und IP-Override
sowie die Quoten. Falscher Schlüssel oder abweichende Konfiguration scheitern
beim Öffnen. Routen-/Quotenwechsel brauchen eine ausdrücklich neue Namespace-
Konfiguration; Schlüsselrotation und Migration sind noch nicht implementiert.

Jeder Zugriff prüft die gespeicherten Originalbytes erneut gegen aktuelle Pins
und die Uhrzeit. Ein bloß gespeichertes `good` wird nie ausgewertet. Auch
`revoked` und `unknown` werden wiederverwendet. Die Aufbewahrungsgrenze richtet
sich nach producedAt plus einer Stunde, einschließlich des letzten gültigen
Millisekundenwerts. Ein abgelaufener Pin-Snapshot verkürzt nicht die gespeicherte
Rohbelegdauer: Ein neuer gültiger Snapshot kann dieselben Bytes erneut prüfen.
Zur Nutzung gelten zusätzlich dessen aktuelle Zertifikats- und Zeitgrenzen.
Manipulierte oder unter den aktuellen Pins unprüfbare Einträge führen zum Fehler;
sie werden nicht unbemerkt durch eine neue positive Abfrage ersetzt.

Gleichzeitige Aufrufe desselben Prozesses teilen eine laufende Abfrage. Andere
Prozesse auf demselben lokalen Volume warten auf einen zeitlich begrenzten
Claim und lesen anschließend den committed Beleg. Der Claim gilt für die
konfigurierte Gesamtdauer plus eine Sekunde. Nach Prozessabbruch kann er nach
Ablauf neu beansprucht werden. Alte Eigentümer dürfen weder neue Claims löschen
noch verspätete Antworten darüber schreiben. Netzverkehr findet außerhalb der
Datenbanktransaktion statt; ein Ergebnis wird erst nach COMMIT zurückgegeben.

Die Eintragsquote zählt Belege, laufende Claims und Fehlersperren. Die Bytequote
zählt unverpackte Anfrage-/Antwortbytes, nicht SQLite-Dateigröße oder WAL.
Volle Quoten verdrängen keine aktuellen Befunde. Ablaufbereinigung erfolgt beim
Start, beim Zugriff und einmal pro Minute. Verifier und Cache müssen dieselbe
verlässliche Zeitquelle verwenden; Replikate auf unabhängigen Volumes teilen
weder Cache noch Claims. Vercel `/tmp` und Netzwerkdateisysteme sind ungeeignet.

## Fehler und Wiederholungen

Nur eine gültig codierte OCSP-Protokollfehlerantwort löst bis zu drei
Wiederholungen aus. Nach insgesamt vier solchen Antworten wird eine fünfminütige
Abfragesperre je Namespace/Zertifikat dauerhaft gespeichert. Danach ist erneut
ein Abruf möglich. HTTP-, Signatur-, Format- und Speicherfehler erzeugen weder
Erfolgsbelege noch automatische Wiederholungen. Die Gesamtdauer bleibt begrenzt;
ein Timeout kann die Wiederholungsfolge früher beenden. Fehlersperren sind keine
signierten Zertifikatsbelege. Diese Teilregel orientiert sich an A_30046; die
dort zusätzlich vorgeschriebene Vertrauens-/Routenprüfung ist noch offen.

## Nachweise und Grenzen

26 neue Fälle bestehen zusammen mit den bisherigen 223: **249/249 Prüfungen**.
Geprüft sind echte HTTP-/HTTPS-Listener mit isolierter Test-PKI, falsche CA/Hosts,
Weiterleitungen, Größen-/Formatfehler, abgebrochene und langsam gelieferte
Antworten, verschlüsselte Ablage, Neustart, Manipulation, Zeitgrenzen, negative
Befunde, Quoten, Backoff, parallele Prozesse und tatsächliches SIGKILL während
einer Abfrage. Ersetzte Claims sind gegen verspätete Antworten und fremdes
Aufräumen geprüft. Gespeicherte OSIG-/AUT-Belege durchlaufen den tatsächlichen
verschlüsselten KIM-Empfang nach Wiederöffnen und ergeben weiter Diagnose 07.

Der Baustein ist im Dienstcode vorhanden; ein laufender KIM-Clientproxy und
produktive OCSP-Endpunkte sind nicht angeschlossen. Authentisierte TSL,
vollständige Pfad-/Rollenprüfung, VZD-/Telematik-ID-Bindung, Konnektor/SMC-B,
Betrieb samt Backup/Rotation und unabhängige Prüfung/Zulassung bleiben offen.
Der Cache ist kein Langzeitarchiv und keine manipulationssichere Uhr. Die
KIM-Versandsperre und fehlende Freigabe zur normalen Zustellung bleiben bestehen.
Das FD-Anforderungsinventar wird durch diese lokale Teilimplementierung nicht
als vollständig umgesetzt markiert.

Quellen:

- [RFC 6960, Anhang A und C](https://www.rfc-editor.org/rfc/rfc6960): HTTP-POST und OCSP-Medientypen.
- [gemSpec_PKI 2.28.0 vom 18.09.2026](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): A_23225, A_30046 und TUC_PKI_006. Die Regeln ersetzen keine vollständige Konformitätsprüfung.
- [OCSP-Prüfer und KIM-Anschluss](ocsp.md): unterstützte Signaturen, Bindungen und Grenzen.
