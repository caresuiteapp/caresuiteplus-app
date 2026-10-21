# Automatische TSL-Beschaffung und Aktualisierung

Stand: 21.10.2026. Die eigenen Dienstmodule können konfigurierte TSL-Quellen
periodisch abrufen, ihren Signiererstatus beschaffen und ausschließlich vollständig
geprüfte Listen aktivieren. Die anfänglichen CA-/Responder-Pins werden weiterhin
separat provisioniert. Dieser Baustein startet keinen produktiven Dienst, ersetzt
keine TI-Ankerinitialisierung und gibt keine normale KIM-Zustellung frei.

## Ablauf und Quellenbindung

1. `TslHttpSource` liest den SHA-256-Hash über eine feste HTTPS-Adresse. Der Hash
   ist nur ein Änderungsanzeiger. Ein Fehler führt zum Abbruch, niemals zu einem
   ersatzweisen XML-Abruf. Akzeptiert werden 32 Binärbytes oder 64 Hex-Zeichen
   mit optionalem LF/CRLF; zusätzliche Zeichen werden abgelehnt.
2. Ohne gespeicherte Liste oder bei abweichendem Hash werden die XML-Datei und
   ihre separate Signatur von zwei fest konfigurierten Adressen geladen. Die
   XML-Bytes müssen zum Hash passen. Bei gleichem Hash werden die verschlüsselt
   gespeicherten Originale verwendet, auch wenn ihre letzte Freigabe abgelaufen
   ist. Eine unveränderte abgelaufene Liste wird abgelehnt und nicht neu geladen.
3. `TslVerifier.prepareSignerStatus()` authentisiert die Originalbytes, die
   separate Signatur, Signierer-CA, KU/EKU, Profil und Zeitgrenzen. Erst danach
   liest es OCSP-Adressen aus der AIA-Erweiterung des Signiererzertifikats.
   Es gibt weiterhin keinen Dienst-Snapshot frei.
4. `TslSignerStatusSource` verlangt genau eine OCSP-AIA-Adresse und genau eine
   passende, vom Betreiber eingerichtete `DurableOcspStatusCache`-Route. Fehlende,
   doppelte, mehrdeutige oder nicht konfigurierte Adressen scheitern ohne OCSP-
   Netzaufruf. Die Liste selbst liefert hierfür keinen Responder. Zertifikats-
   AIA erzeugt keine neue Route und keine neuen Vertrauensanker.
5. Der Cache beschafft oder wiederverwendet einen echten signierten Rohbeleg.
   Seine vorhandene CertID-/certHash-/Signaturprüfung, Gültigkeitsgrenzen,
   prozessübergreifenden Claims und vier Versuche bei OCSP-Protokollfehlern mit
   anschließender fünfminütiger Sperre gelten unverändert. Negative Belege werden
   berücksichtigt; nur `good` kann eine Liste aktivieren.
6. `TslTrustStore.activate()` prüft beide Signaturen, das gebundene XSD, Status,
   Zeit und Version vollständig erneut. Erst danach schreibt eine kurze
   Transaktion Originale und authentisierten Kontrollpunkt. Ein anderer Prozess
   kann während der Netzwerk-/XML-Prüfung einen neueren Stand aktivieren; ein
   danach eingehender älterer Stand wird abgewiesen.

Hashvergleich, feste Umgebungsadressen ohne Backup-Ermittlung, AIA-Auswahl und
OCSP-Wiederholung folgen den Internet-Konkretisierungen aus **A_30044** der
`gemSpec_PKI` 2.28.0. Die Implementierung verlangt zusätzlich die separate
Signatur aus `gemSpec_TSL` und unterstützt nur die in [tsl.md](tsl.md)
beschriebenen Signatur-/XML-Profile. Das ist ein begrenzter Implementierungsstand,
kein Nachweis der vollständigen Umsetzung von TUC_PKI_001.

`officialTslInternetRoutes({ environment, profile })` liefert ausschließlich
Konfiguration. Die Umgebungen `production`, `reference` und `test` sowie die
Profile `ecc-rsa` und `rsa` bleiben getrennt. XML/Hash verwenden die offiziellen
HTTPS-Downloadpunkte; die separate Signatur den dafür veröffentlichten HTTP-
Spiegel. Dieser erfordert ausdrücklich `allowHttpSignature: true`. Die Signatur
wird unabhängig vom Transport kryptographisch geprüft. Der Signaturspiegel kann
gemäß `gemSpec_TSL` bis zu einer Stunde nachlaufen. In dieser Zeit kann der
kombinierte Abruf an abweichenden Originalbytes scheitern; es gibt weder eine
Herabstufung der Prüfung noch einen Wechsel auf andere Adressen.

## Verwendung im vorhandenen Diensthost

```js
import { TslHttpSource, officialTslInternetRoutes } from '../../services/kim/tsl-http.mjs';
import { TslSignerStatusSource } from '../../services/kim/tsl-signer-status.mjs';
import { TslRefreshManager } from '../../services/kim/tsl-refresh.mjs';

// store: TslTrustStore mit separat authentisierten Ankern und eigener Ablage.
// configuredSignerCaches: echte DurableOcspStatusCache-Instanzen mit
// unabhängig provisionierten Prüfern, festen Routen und externen Speicherschlüsseln.
const source = new TslHttpSource({
  ...officialTslInternetRoutes({ environment: configuration.environment, profile: 'ecc-rsa' }),
  allowHttpSignature: true,
});
const manager = new TslRefreshManager({
  source,
  signerStatusSource: new TslSignerStatusSource({ caches: configuredSignerCaches }),
  store,
  intervalMs: 15 * 60 * 1000,
  retryMs: 5 * 60 * 1000,
  timeoutMs: 30 * 1000,
});

await manager.start(); // erste Prüfung abwarten; weitere Prüfungen werden geplant
const snapshot = manager.current();
const verifier = snapshot.ocspVerifierFor([osigCertificate, autCertificate]);
// verifier an die bestehenden OCSP-/KIM-Prüfbausteine weiterreichen.
// manager.status liefert Zustand, letzte Fehlerkennung und nächsten Versuch.
// Beim Beenden zuerst manager.close(), danach die hosteigenen Caches/Stores schließen.
```

Die Konstruktion bindet den Namespace dauerhaft an Umgebung, Profil, Anker,
Schema, Downloadrouten und zugelassene Signierer-Statusrouten. Konfigurierte
TLS-CA und feste Verbindungs-IP gehören ebenfalls zur Bindung. Änderungen
benötigen einen gesonderten kontrollierten Migrationsablauf; Löschen einzelner
Kontroll-/Quellendatensätze erlaubt keine stille Wiederinitialisierung.

`start()` beginnt sofort. `refresh()` erlaubt einen einzelnen Lauf; gleichzeitige
Aufrufer derselben Instanz erhalten dasselbe Promise. Ein weiterer `start()`
fordert ebenfalls eine Prüfung an und verwendet einen bereits laufenden Abruf.
Nach Erfolg wird spätestens nach dem konfigurierten Intervall oder beim Ablauf
des Snapshots erneut geprüft. Zulässig sind 1 Minute bis 24 Stunden; Standard
sind 15 Minuten. Bei einem Fehler folgt der nächste Versuch nach `retryMs`
(Standard 5 Minuten, mindestens 1 Minute und höchstens das Prüfintervall).
Die OCSP-Sperre bleibt unabhängig davon fünf Minuten dauerhaft wirksam.

Timer laufen nur im vorhandenen gestarteten Host und halten allein keinen Node-
Prozess am Leben. Es gibt keinen externen Scheduler und keine automatische
Produktionsaktivierung. Nach einem Neustart ist zunächst keine Liste freigegeben;
`start()` prüft sie neu. Mehrere Manager können dieselbe TSL parallel herunterladen.
Die bestehende OCSP-Beschaffung und die TSL-Aktivierung koordinieren sich über
SQLite, der TSL-Download selbst besitzt keinen prozessübergreifenden Lease.

## Gültigkeit bereits ausgegebener Prüfer

Der Manager gibt geschützte Handles aus, niemals den zugrunde liegenden rohen
`TslTrustSnapshot`. Ein Handle und seine OCSP-Prüfer kontrollieren bei weiterer
Verwendung Managergeneration, Zeit und den authentisierten aktuellen Listenstand
in der gemeinsamen Ablage. Erfolgreiche Aktualisierung, Ablauf, Schließen,
fehlgeschlagene Aktualisierung oder erkannte Manipulation sperren die Handles
dieser Instanz. Eine Aktivierung eines anderen Listenstands über eine zweite
Store-Instanz sperrt sie ebenfalls. Bereits ausgegebene OCSP-Prüfer können einen
entfernten Dienst somit nicht weiter zur Prüfung verwenden. Der Host muss nach
Erfolg aktuelle Prüfer und zugehörige Cache-Instanzen beziehen.

Die kurze Versionskontrolle authentisiert einen kleinen AES-GCM-Kontrollwert,
ohne bei jedem OCSP-Zugriff mehrere MiB XML zu entschlüsseln. Originale bleiben
separat verschlüsselt und werden vor Wiederverwendung vollständig geprüft.
`candidate()` liefert lediglich Kopien der gespeicherten Originale und Metadaten;
daraus entsteht keine Freigabe. `currentVersion()` ist ebenfalls kein Trust-
Snapshot. Direkte, manuell erzeugte Snapshots aus `store.activate()`/`load()`
haben keinen Managerbezug; für automatische Invalidierung muss der Host die
Handles aus `manager.current()` verwenden.

Die Erweiterung übernimmt das bisherige v1-Ablageformat erst nach erfolgreicher
Authentisierung der Originale und des Schlüsselprüfwerts. Ein zusätzlicher
versionsgebundener Prüfwert kennzeichnet die aktualisierte Ablage. Ältere
Programmbuilds können sie nicht unverändert wieder öffnen. Austausch der gesamten
Datenbank gegen ein altes Backup benötigt weiterhin einen externen monotonen
Kontrollpunkt; AES-GCM allein schützt nicht vor vollständigem Zurücksetzen.

## Grenzen und Fehlerverhalten

- XML/Hash müssen HTTPS verwenden. CA-/Hostnamenprüfung bleibt bei fester IP
  aktiv. Signatur-HTTP braucht eine explizite Freigabe. Keine Weiterleitungen,
  Backup-Ziele, URL-Zugangsdaten, Cookies, Proxy-Konfiguration oder Komprimierung.
- Höchstens 8 MiB XML, 16 kB Signatur, 66 Byte Hash und 16 KiB HTTP-Header.
  Zulässige Medientypen sind ausdrücklich begrenzt. Leere, unvollständige und
  übergroße Antworten werden verworfen. Die Gesamtdauer je HTTP-Abruf beträgt
  standardmäßig 10 Sekunden, höchstens 30 Sekunden.
- Ein Aktualisierungslauf hat standardmäßig 30 Sekunden Gesamtfrist, höchstens
  60 Sekunden. Abbruch beendet Downloads und den XML-Worker; der Store übernimmt
  nach erkanntem Abbruch kein Ergebnis. Ein bereits laufender, vom Host geteilter
  OCSP-Cache kann seinen eigenen begrenzten Abruf noch abschließen. Dieser Beleg
  aktiviert die abgebrochene TSL-Prüfung nicht nachträglich.
- Vertrauenswürdige Hostzeit bleibt Voraussetzung. Rückwärtsbewegungen innerhalb
  einer Managerinstanz werden erkannt; die Implementierung ist keine gesicherte
  Uhr. Sämtliche bestehenden Snapshot-, Zertifikats- und OCSP-Fristen gelten weiter.
- Fehler sind feste `KIM_TSL_*`-/`KIM_OCSP_*`-Codes ohne heruntergeladene Inhalte,
  Zertifikatsnamen, URL-Zugangsdaten oder native Prozessdiagnosen.

## Nachweise und offene Integration

Der anschließende [TI-nonQES-Statusclient](tsl-ocsp.md) verwendet diese geschützten
Handles für Nachrichtenzertifikate. `ocspPlanFor()` wählt deren CA-Statusadressen;
der Client bezieht pro Vorgang einen aktuellen Prüfer und verifiziert auch
wiederverwendete dauerhafte Belege erneut. Dieser Weg ist vom hier beschriebenen
Internet-AIA-Abruf für den TSL-Signierer getrennt.

Die lokalen Tests verwenden echte HTTPS-Verbindungen, eine isolierte Test-PKI,
signierte OCSP-Antworten, beide TSL-Signaturen, den vollständigen XML-Worker und
verschlüsselte SQLite-Dateien. Sie prüfen Erstabruf, Hash-Wiederverwendung,
Statuserneuerung, Sperrung, Neustart und Übernahme älterer Ablagen, Versionswechsel,
veränderte/gelöschte Kontrollwerte, Rücksprünge, Fristen, Abbruch und den periodischen
Ablauf. HTTP-Fehler und unzulässige AIA-Adressen können keine Liste freigeben.
Der konkrete Gesamtlauf steht im [Prüfprotokoll](verification.md).

Weiter offen sind authentisierte TI-Ankerbereitstellung und Rotation, produktive
Host-/Quellen-/Statusprovisionierung, vollständige Pfad-/Rollen-/Policyprüfung,
VZD-/Telematik-ID-Bindung, Konnektor/SMC-B, vollständiges KIM-Clientmodul und
Fachdienst sowie unabhängige Interoperabilitäts- und Zulassungsnachweise.
Es fand kein Abruf echter TSL-/OCSP-Endpunkte und kein realer KIM-Versand statt.

## Primärquellen

- [gemSpec_PKI 2.28.0, §8.2.6 und A_30044](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): Internet-Download, Hashvergleich, Signierer-AIA und Protokollfehler; außerdem TUC_PKI_001 und Tab_PKI_294.
- [gemSpec_TSL](https://gemspec.gematik.de/docs/gemSpec/gemSpec_TSL/latest/): offizielle Umgebungsadressen, Profile und separate Signaturspiegel, insbesondere A_17680 und A_21182; geprüft am 21.10.2026.
- [ETSI TS 119 612 V2.3.1](https://www.etsi.org/deliver/etsi_ts/119600_119699/119612/02.03.01_60/ts_119612v020301p.pdf): Hash als Änderungshinweis; die hier verbindlichen Internet-Konkretisierungen folgen der gematik-Spezifikation.
