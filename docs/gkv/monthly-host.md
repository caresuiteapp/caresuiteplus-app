# Persönliche Monatsbestätigung: Webansicht, Gateway und Host

Aktualisierung 31.10.2026: [CMS-Komponentensignatur und Monatsarchiv](monthly-component-signature.md) verbindet den konfigurierten Host mit dem dauerhaften XML-/CMS-Archiv. Die dort beschriebenen Sperren und offenen Nachweise gelten zusätzlich zum folgenden ursprünglichen Stand.

Stand: 29.10.2026. Implementierung für Web/Desktop auf dem GKV-Entwicklungszweig.
Die SQL-Entwürfe, Hostschlüssel und Zertifikate sind **nicht produktiv aktiviert**.
Ohne diese Einrichtung zeigt die App einen ausdrücklichen Verbindungsfehler.
Sie erzeugt keinen Ersatzbeleg und simuliert keinen Erfolg.

## Bedienung

Die aktuelle offene Fassung einer Leistungsart bietet „Original zur Bestätigung
öffnen“ oder den [Papierweg](monthly-paper.md) mit „Neue Druckfassung öffnen“. Der Server erstellt und archiviert die PDF aus seinen kanonischen
Quellen. Der Browser prüft den SHA-256 der tatsächlich erhaltenen Bytes und zeigt
die PDF mit einem zusätzlichen Link zum Öffnen in einem eigenen Tab.

Beim direkten Bildschirmweg wird erst nach dem Öffnen und einer ausdrücklichen Bestätigung, dass die Person alle
Seiten geprüft hat, das vorhandene Web-Unterschriftsfeld freigegeben.
Die neue PNG-Datei wird zum privaten Verifizierer übertragen. Ein gesonderter
Klick auf „Monatsbestätigung speichern“ verbraucht dessen Beleg im vorhandenen
atomaren SQL-Abschluss. Die Anzeige oder Checkbox allein beweist weder das
Lesen aller Seiten noch die Identität der zeichnenden Person.

Während einer Erfassung sind Quellen- und Auswahlwechsel gesperrt. Verlorene
Antworten behalten den genauen Auftrag im Arbeitsspeicher. „Erfassung prüfen“
liest ausschließlich den Zustand. Nur nach dieser Abfrage kann ein noch nicht
ausgeführter Auftrag ausdrücklich und unverändert wiederholt werden. Die
gesonderte Auftragsklärung für den endgültigen Abschluss bleibt erhalten.
Es gibt keine automatische Wiederholung und keine Ablage von PDFs, PNGs oder Tokens
in Browser-Speichern. Schließen oder Neuladen verliert den lokalen Erfassungsstand;
Papiererfassungen können ausdrücklich mit der gedruckten Erfassungskennung
innerhalb von sieben Tagen und derselben persönlichen Sitzung fortgesetzt werden.
Die Seitenprüfung wird vor einer noch ausstehenden Scanprüfung neu vorgenommen.

Benutzer-, Rollen- und Mandantenwechsel verwerfen die Ansicht und ignorieren
verspätete Antworten. Bestätigte und später entwertete Fassungen bieten einen
PDF-Archivabruf und gegebenenfalls den vollständigen unterschriebenen Scan mit aktuellem Status. Das ursprüngliche PDF bleibt bytegleich
und enthält den vor der Unterschrift angezeigten Inhalt; es ist kein nachträglich
mit dem Unterschriftsbild zusammengefügtes Dokument. Die Bestätigung wird getrennt
am Nachweis ausgewiesen. Der Archivabruf liefert keine wiederverwendbare PNG.

Die [Vertreteroption](monthly-representatives.md) ergänzt eine dokumentierte
Berechtigungsprüfung mit Auswahl, Originalbindung, Gültigkeit und Widerruf.

## Authentisierung und Vertrauensgrenzen

| Grenze | Implementierte Prüfung |
| --- | --- |
| Browser → `/api/gkv/monthly-originals` | Persönlicher Supabase-Bearer, strenger Auftragsvertrag ohne frei gewählten Akteur, Unterzeichner oder Zieladresse. |
| Gateway → Host | Feste HTTPS-Adresse, CA-/Namensprüfung und Serverzertifikat-Pin; Clientzertifikat und zusätzlicher Client-Pin am Host. Keine Weiterleitungen. |
| Gateway und Host → Auth | Beide prüfen genau das empfangene Token beim fest konfigurierten `/auth/v1/user`; danach werden Subjekt, Sitzung, Ablauf, Issuer, Audience und Rolle geprüft. |
| Host → SQL | Dasselbe persönliche Token und zusätzlich ein eigener mandantengebundener HMAC-SHA-256-Schlüssel. Kein Service-Role-Token und kein Browserzugriff auf Schlüssel oder private Belegfunktionen. |
| Jede SQL-Operation | Aktuelle `auth.sessions`-Zeile für `auth.uid()` und `session_id`, Ablauf sowie bestehende Office-/Mandanten-/Beauftragungsprüfung. |
| Endgültiger Abschluss | Der Beleg muss zu derselben weiterhin aktiven Anmeldung gehören; ein Trigger schützt auch den direkten vorhandenen `confirm`-Aufruf. |

Der MAC umfasst die exakte UTF-8-Hülle einschließlich Mandant, Akteur, Sitzung,
Schlüsselkennung, Operation, Argumenten, Zeit und zufälliger Kennung. Das zulässige
Zeitfenster beträgt zwei Minuten. Die zufällige Kennung ist **kein Einmal-Nonce**;
innerhalb des Fensters kann dieselbe Hülle erneut geprüft werden. Idempotente
Erfassungs-/Belegkennungen, die Bindung an die aktuelle Fassung und die atomare
Belegverwendung verhindern dadurch doppelte Bestätigungen. Eine Schlüsselwiderrufung
sperrt folgende Hostaufträge; sie entwertet bereits erteilte Belege nicht rückwirkend.
Diese bleiben an Anmeldung, Rechte, Quellen, Fassung und Erfassungsfrist gebunden.

Der Host ist eine vertrauenswürdige Komponente: Die Datenbank kann seine lokalen
Originalbytes nicht selbst nachlesen. Die privaten Funktionen bleiben gesperrt;
der neue öffentliche Wrapper ist `SECURITY INVOKER`. Nur die private, eng begrenzte
Worker-Funktion erhält ein Ausführungsrecht für `authenticated` und verlangt
zusätzlich einen gültigen Host-MAC. Tabellenrechte werden nicht erteilt.

## Betriebskonfiguration vor einer Aktivierung

Der Vercel-Einstieg ist die erzeugte Datei `api/gkv/monthly-originals.mjs`.
Sie bündelt den gemeinsamen Handler und die TypeScript-Verträge als ein explizites
ES-Modul mit ausschließlich eingebauten Node-Abhängigkeiten. Der Webbuild prüft
mit `scripts/build-gkv-monthly-gateway.mjs --check`, dass sie unverändert zu den
Quellen passt. Nach einer Änderung wird sie mit demselben Skript ohne `--check`
erneuert. Vier Einstiegstests laufen ohne TypeScript-Testloader und mit gesperrtem
CommonJS-`require()` für ES-Module. Der vorherige TS-Einstieg hatte in Vercel
trotz grünem Build einen tatsächlichen `ERR_REQUIRE_ESM` beim Aufruf verursacht.

Der Einstieg verwendet einen vorhandenen Node-24-Host und eine lokale, vertrauenswürdige
Konfigurationsdatei, keine flüchtige Vercel-Dateiablage:

```sh
node --import ./services/gkv/register.mjs services/gkv/monthly-host-entry.mjs /absoluter/pfad/monthly-config.mjs
```

`createConfiguration()` muss `tenantId`, `storePath`, `archiveKey`, `supabase`
(`url`, öffentlicher `key`), `workerKeyId`, `workerKey`, `tls` (`ca`, `cert`, `key`,
gegebenenfalls `passphrase`), `clientSha256` und `port` liefern. Optional sind
`bindAddress` und `maxTenantBytes`. Archiv- und Worker-Schlüssel sind getrennte
32-Byte-Geheimnisse. Der Prozess bindet standardmäßig an `127.0.0.1`, bearbeitet
jeweils einen Archivvorgang und antwortet bei Belegung mit einem klärbaren Fehler.
Jeder Host ist auf genau einen Mandanten begrenzt. Das Gateway hat ein festes
Hostziel; eine allgemeine Zuordnung mehrerer Mandanten zu getrennten Hosts ist
in diesem Baustein noch nicht eingerichtet.

Das Gateway benötigt `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
sowie die ausschließlich serverseitigen Werte `GKV_MONTHLY_HOST_URL`,
`GKV_MONTHLY_HOST_CA`, `GKV_MONTHLY_HOST_SHA256`, `GKV_MONTHLY_CLIENT_CERT`,
`GKV_MONTHLY_CLIENT_KEY` und gegebenenfalls `GKV_MONTHLY_CLIENT_PASSPHRASE`.
`GKV_MONTHLY_HOST_CONNECT_ADDRESS` darf eine feste IP zum konfigurierten Host
angeben; Zertifikatsname und Pin bleiben verbindlich. Der URL-Pfad ist ausschließlich
`/v1/monthly-originals`. Es werden keine echten Schlüssel mitgeliefert.

Nach gesonderter Prüfung der Zielrechte ist die Reihenfolge der SQL-Entwürfe:
`monthly-proofs-draft.sql`, `monthly-workspace-draft.sql`,
`monthly-original-verifier-draft.sql`, `monthly-worker-bridge-draft.sql`,
`monthly-authorities-draft.sql` und für die Fachangaben
`monthly-facts-draft.sql`. Alle sechs sind gemeinsam zu prüfen.
Die [Fachangaben-Integration](monthly-facts.md) benötigt im privaten Host
zusätzlich das vorhandene Python 3/lxml und die fixierten LNW-XSD-Dateien.
Eine fehlende Laufzeit gibt keine erfolgreiche Bestätigungsquittung für solche
Fassungen aus. Es wurde kein Host provisioniert.
Die Brücke setzt das vorhandene `pgcrypto` im Schema `extensions` sowie das
Supabase-Auth-Schema voraus. Hostfreigaben werden separat in der privaten
Schlüsseltabelle provisioniert. Kein Skript aktiviert oder befüllt sie automatisch.

Die HTTP-Verbindung unterstützt höchstens 2 MiB pro PDF/PNG und 2.850.000 Bytes
pro JSON-Nachricht. Größere Dateien werden ausdrücklich abgewiesen. Das allgemeine
private Archiv hat weitere, getrennte Grenzen. Zeitüberschreitungen bedeuten
keinen nachgewiesenen Abbruch einer bereits gestarteten Speicherung und werden
deshalb über dieselbe Auftragskennung geklärt. Backup, Wiederherstellung,
Aufbewahrung, Zertifikats-/Schlüsselrotation und Zielbetrieb benötigen weiterhin
einen tatsächlich geprüften Betriebsablauf.

## Nachweise und offene Punkte

Die Host-Suite enthält 21 Unterfälle plus Hauptfall. Sie verbindet den echten
Browservertrag, Gatewayhandler, lokale HTTPS-/mTLS-Verbindung, Host, verschlüsseltes
Archiv und die fünf tatsächlichen SQL-Entwürfe mit `pgcrypto` in PGlite.
Auth-/REST-Server und Office-Quellrechte sind ausdrücklich Vertragsdoubles.
Alle Unterschriften und Zertifikate sind synthetisch. Das belegt keinen echten
Supabase-Login, keine konkurrierenden PostgreSQL-Verbindungen und keine TI.

Die React-Suite umfasst 21 Abläufe mit tatsächlicher Monatsansicht und Office-Seite.
API, PDF-Viewer und Zeichenfläche haben synthetische Grenzen. Die Bedienfolge,
getrennte Finalisierung, verlorene Antworten, Rechtewechsel und späte Antworten
sind geprüft. Das DOM-Modell berechnet kein Layout. Eine breite/schmale Prüfung
mit Schriftvergrößerung, Tastaturfokus, tatsächlichem PDF-Viewer und realen
Zeichenereignissen ist offen: lokal fehlt die Browserlaufzeit, das verbundene
Gerät war bei der erneuten Prüfung offline. Zusätzliche Browser- oder Testinfrastruktur wurde nicht installiert.

Weiter offen bleiben die tatsächliche Vertreterprüfung im Zielbetrieb, reale Druck-/Scan-Abnahme, signiertes Fach-XML,
XSD-/CMS-Prüfung, Hardware-/TI-Nachweise und unabhängige ITSG-/gematik-Abnahme.
Der bestehende CMS-/KIM-Code wird durch diese lokale Monatsbestätigung weder
zugelassen noch zum Echtversand freigegeben.

Die Prüfung der Anmeldung folgt der offiziellen Dokumentation zu
[Get User](https://supabase.com/docs/reference/javascript/auth-getuser) und
[Auth-Sitzungen](https://supabase.com/docs/guides/auth/sessions), gelesen am 29.10.2026.

Der begrenzte Papierablauf ist in [Monatsbestätigung über Druck und Scan](monthly-paper.md) beschrieben.
