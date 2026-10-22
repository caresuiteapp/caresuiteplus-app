# CMS-Kartenprüfung und Diensthost

Stand: 23.10.2026. Implementiert ist ein ausführbarer ECC-Diagnoseablauf mit
Hostjournal, serverseitigem API-Zugang, Weboberfläche und zusätzlichem
[VerifyDocument-Prüfbericht](konnektor-verify-document.md). Die Prüfung verwendet
einen neu erzeugten synthetischen Inhalt. Sie verschickt keine Nachricht und
schaltet keine Abrechnung frei. Die bisherigen Nachweise stammen von lokalen
HTTPS-/mTLS-Gegenstellen mit Software-Testschlüsseln.

## Kartenoperationen

`KonnektorCertificateClient` erhält zwei zusätzliche, fest provisionierte
Endpunkte: `signatureServiceUrl` und `encryptionServiceUrl`. Beide müssen zum
gleichen HTTPS-Ursprung wie der CertificateService gehören. CA, Hostname,
Serverpin und Clientzertifikat bleiben verpflichtend.

| Operation | Implementierte Prüfung |
| --- | --- |
| GetJobNumber | Schemafähige Auftragsnummer vom Signaturdienst; keine lokal erfundene Nummer |
| SignDocument | Ein SignRequest mit eindeutiger RequestID, eingebettetem Inhalt, OSIG-Zertifikat und signiertem recipient-emails-Attribut; mathematische ECDSA-Prüfung und bytegenauer Originalvergleich |
| EncryptDocument | Empfängerzertifikate und dasselbe recipient-emails-Attribut; AuthEnvelopedData mit TI-ECIES/brainpoolP256r1 und AES-256-GCM; exakte Empfängerzuordnung |
| VerifyDocument | Eigenständige mathematische CMS-Prüfung und frischer Konnektorbericht mit Bindung an Signaturwert, OSIG-Leaf und Prüfzeit |
| DecryptDocument | Vor dem Aufruf Zuordnung von Abholadresse und Issuer/Serial zur ausgewählten ENC-Karte; anschließend Prüfung der inneren CMS-Signatur und des recipient-emails-Attributs |

`probeSmcbCms` verbindet alle fünf Operationen. Vor Signatur, Verschlüsselung,
Entschlüsselung, VerifyDocument und abschließendem Erfolg läuft jeweils die vorhandene vollständige
SMC-B-Vorprüfung: GetCards, tatsächliche AUT-/ENC-/OSIG-Zertifikate, TSL/OCSP,
VerifyCertificate, erneute Kartenauswahl und GetPinStatus VERIFIED. Kartenmerkmale
und alle drei Zertifikat-Hashes müssen über den gesamten Durchlauf gleich bleiben.
PIN oder PUK werden weder angenommen noch automatisch angefordert.

Der Host erzeugt eine zufällige 32-Byte-Challenge und einen neuen Durchlaufbezeichner.
Die vom Konnektor gelieferte Signatur wird als binäre signed-data-MIME-Entität an
EncryptDocument übergeben. Nach DecryptDocument muss diese Entität vollständig
mit dem Original übereinstimmen. Unklare Schlüsseloperationen sperren weitere
Versuche derselben Clientinstanz. Es gibt weder Software-Schlüssel-Fallback noch
automatische Wiederholung. Ergebnisse bleiben `held-for-trust-validation`.

SignDocument ist auf 15.000.000 Eingabebytes, CMS auf 22.020.096 Bytes und die
SOAP-Hülle auf 32 MiB begrenzt. Nur die neuen Dokumentoperationen verwenden den
größeren XML-Prozessrahmen: 10 CPU-Sekunden, 15 Sekunden Wandzeit und 768 MiB
Adressraum. Die vorhandenen kleineren Zertifikats-/PIN-/AUT-Grenzen bleiben
bestehen. DTDs, Entitäten, Kommentare, externe Referenzen, zusätzliche Antworten,
Warning-Ergebnisse und nicht unterstützte Erweiterungen werden abgewiesen.

## Vertragsstand

Die fünf zusätzlichen unveränderten Vertragsdateien stammen aus
[gematik/api-telematik, Commit 31dd17b7](https://github.com/gematik/api-telematik/tree/31dd17b7dbe76ba6016318a2dfdd028e63598419/conn).
Manifest und einzelne SHA-256-Werte werden vor jeder XML-Prüfung kontrolliert;
insgesamt sind jetzt 31 Schema-/WSDL-/Lizenzdateien festgeschrieben.

- SignatureService-WSDL 7.5.7 importiert im amtlichen Original XSD 7.5.6.
  Beide sowie XSD 7.5.7 sind enthalten; die Nutzlastprüfung verwendet 7.5.7.
- EncryptionService-WSDL 6.1.1 importiert XSD 6.1.2.
- Die DecryptDocument-SOAPAction enthält zusätzlich `/crypt/`:
  `http://ws.gematik.de/conn/crypt/EncryptionService/v6.1#DecryptDocument`.
  Der Nutzlast-Namespace enthält dieses zusätzliche Segment nicht.
- Zielprofil ist die in gemSpec_Kon 5.28.0 beschriebene Schnittstelle:
  `PrivateKeyOnCard/KeyReference=C.ENC`, kein Crypt-Element bei DecryptDocument.
  Das tatsächliche ECC-Profil wird anhand der Zertifikate und CMS-Algorithmen
  geprüft. Ältere KIM-Texte nennen noch C.ENC_RSA/C.ENC_ECC; dafür wird hier kein
  ungeprüfter Kompatibilitätsmodus ergänzt. SignDocument übergibt ausdrücklich ECC;
  in der aktuellen Konnektorspezifikation wird Crypt nicht mehr ausgewertet.

Grundlagen: [gemSpec_Kon](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Kon/),
[gemSpec_CM_KOMLE](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/)
und [gemSMIME_KOMLE](https://gemspec.gematik.de/docs/gemSMIME/gemSMIME_KOMLE/).
Die Umsetzung ist eine begrenzte ECC-Teilmenge, kein vollständiger Nachweis aller
KIM-/CAdES-Vorgaben. RSA_ECC-Doppelsignaturen, BER, zusätzliche Zertifikatsketten,
weitere Signaturattribute und vollständige Hersteller-/Berichtsprofile sind noch
zu ergänzen. VerifyDocument ist im begrenzten Diagnoseablauf ergänzt; eine
unabhängige Zulassung oder vollständige CMS-Konformität ist damit nicht belegt.

## Host und Webanbindung

`services/kim/host-entry.mjs` startet den vorhandenen Node-24-Dienst auf einem
ausdrücklich konfigurierten Host mit Zugang zum Konnektor. Er ist kein
Vercel-Hintergrundjob. Start mit vorhandener Software:

```bash
node --import ./services/gkv/register.mjs services/kim/host-entry.mjs /absoluter/pfad/kim-host-config.mjs
```

Das lokal provisionierte Konfigurationsmodul exportiert `createConfiguration()`.
Es liefert `tenantId`, `storePath`, `port`, optional `bindAddress` (Standard
127.0.0.1), `tls` mit Serverzertifikat/Schlüssel/Client-CA, `clientSha256` sowie
`probe`. `probe` enthält die bestehenden echten Instanzen von
`KonnektorCertificateClient` und `TslOcspStatusClient`, `expectedTelematikId`,
`requiredRoles`, `address` und bei Bedarf `iccsn`, `ctId`, `slotId`.
Die Einrichtung der Statusclients folgt [tsl-ocsp.md](tsl-ocsp.md).
Ein optionales `close()` beendet deren Ressourcen. Der Dienst muss ungebündelt
mit den Python-Dateien und dem vollständigen Schemaordner betrieben werden.
Keine Schlüssel oder Zertifikate gehören in eine Browserkonfiguration.

Der Listener nimmt ausschließlich POST `/v1/diagnostics` mit `action=status`
oder `action=start` entgegen. Für lokal vorbereitete, bereits gespeicherte
Nachrichten stehen außerdem `receive-start` und `receive-status` mit einer
Auftrags-UUID bereit, siehe [Empfangshost](konnektor-receive-host.md).
mTLS und ein zusätzlicher Client-Leaf-Pin sind
verpflichtend. Ein Host ist genau einem Mandanten zugeordnet. Start benötigt
eine UUID als `requestId`; doppelte IDs erzeugen keinen neuen Durchlauf.
Die Antwort auf Start kommt sofort, der dauerhaft laufende Host erledigt die
Prüfung. Der Browser fragt den Status anschließend ab.

Das SQLite-Journal nutzt den bestehenden privaten Speicher mit 0700-Verzeichnis,
0600-Datei, WAL und FULL-Sync. Eine atomare Reservierung kommt vor der ersten
Kartenoperation. Ein beim Neustart vorgefundenes `running` wird als ungeklärt
angezeigt und nicht erneut ausgeführt. Auch fehlgeschlagene Prüfungen benötigen
eine ausdrückliche Überprüfung. Nach Klärung von Host, Karte und laufendem Prozess
kann die Administration den Host mit frischen Clients und
`recoveryReviewedRequestId` der letzten fehlgeschlagenen/unterbrochenen Anfrage
neu starten. Diese Prüfung wird im Journal vermerkt. Die ursprüngliche Anfrage
bleibt reserviert. Der Betrieb setzt genau einen Hostprozess pro Journal voraus;
die Wiederherstellung darf erst nach Beendigung des alten Prozesses erfolgen.
Empfang und Rundlauf teilen die atomare Reservierung, Wiederherstellungssperre
und einen Mindestabstand von 30 Sekunden zwischen neuen Prüfungen.
Der Status bildet ihn über canStart und nextStartAt ab; die Oberfläche fragt
nach Ablauf nur den Status ab und startet keine Prüfung automatisch.

Die Web-API `/api/gkv/kim-host` prüft die Anmeldung beim Supabase-Authserver und
die bestehenden mandantenbezogenen Abrechnungsrechte über
`gkv_exchange_export_allowed`. Es gibt keine neue Datenbankmigration.
Benutzer-Token werden nicht an den Konnektorhost weitergeleitet. Die API benutzt
eigene mTLS-Zugangsdaten und diese ausschließlich serverseitigen Variablen:

| Variable | Inhalt |
| --- | --- |
| KIM_DIAGNOSTIC_HOST_URL | Feste HTTPS-Adresse mit Pfad `/v1/diagnostics` |
| KIM_DIAGNOSTIC_HOST_SHA256 | SHA-256 des tatsächlichen Server-Leafs |
| KIM_DIAGNOSTIC_HOST_CA | Ausdrücklich provisionierte CA |
| KIM_DIAGNOSTIC_CLIENT_CERT / KIM_DIAGNOSTIC_CLIENT_KEY | API-Clientzertifikat und Schlüssel |
| KIM_DIAGNOSTIC_CLIENT_PASSPHRASE | Optionales Schlüsselpasswort |
| KIM_DIAGNOSTIC_HOST_CONNECT_ADDRESS | Optionale feste IP; Hostnamen- und Zertifikatsprüfung bleiben aktiv |

Redirects, komprimierte Antworten, unpassende Mandanten und übergroße Antworten
scheitern. Ohne Host-URL wird ein ausdrücklicher Einrichtungszustand angezeigt.
Die Oberfläche unter „Konnektorprüfung“ bietet Start, Statusaktualisierung,
laufende Prüfung, Fehlerzustand und JSON-Protokolldownload auch für angehaltene Durchläufe.
Eine Empfangssperre wird mit eigenem Grund angezeigt; während eines laufenden
Empfangs wird der Status ebenfalls aktualisiert. Empfangsnachrichten und
XML-Berichte werden über diese Oberfläche nicht heruntergeladen.
Neue Berichte verwenden Version 2 mit VerifyDocument; alte Version-1-Berichte
bleiben sichtbar und werden ausdrücklich als früherer Prüfumfang gekennzeichnet. Rollen-/Mandantenwechsel
und Verlassen der Ansicht verwerfen ausstehende UI-Antworten. Ein gestarteter
Hostauftrag wird dadurch nicht automatisch abgebrochen oder wiederholt.

## Was die Nachweise aussagen

Das Protokoll enthält Challenge-/Inhalts-/Container-Hashes, Zertifikat-Hashes,
Zeitpunkte sowie Request-, Response-, Routen- und Kontext-Hashes der fünf
Operationen. Neue Berichte enthalten außerdem den kanonischen VerifyDocument-
Report-Hash sowie CMS-, Signatur- und OSIG-Hashes. Es enthält weder Originalnachricht noch Schlüssel, PIN, Kartenhandle,
ICCSN oder Zertifikatssubjekte. Es ist kein unabhängig signierter Auditbeleg und
nicht gegen Änderungen durch lokale Datenbankadministratoren geschützt.

`hardwareEvidence` und `tiEvidence` bleiben ausdrücklich `not-attested`.
Ein bestandenes synthetisches Roundtrip-Protokoll kann keine physische Karte,
authentisierte TI-Ankerbereitstellung, Produktzulassung, echte Empfängerannahme
oder vollständige produktive Nachrichtenpipeline bestätigen.

Am 22.10.2026 meldete die verbundene Geräteverwaltung nur `ChristianLaptop` als
offline. Es konnte kein Hardwaretest durchgeführt werden. Die Vercel-Projekte
ließen sich auflisten; die Abfrage ihrer Umgebungsmetadaten scheiterte an fehlender
Teamfreigabe (403). Daraus lässt sich keine Aussage über dort vorhandene
Konnektorzugänge ableiten. Es wurden keine produktiven Zugangsdaten geändert.

Die ursprüngliche lokale React-Prüfung belegt die damaligen Bedienabläufe.
Nach der automatischen Arbeitsbereichsbereinigung fehlen die dafür verwendeten
Projektpakete; die neue Erweiterung ist lokal nur syntaktisch geprüft.
Eine echte visuelle Prüfung bleibt
offen: kein lokales Chromium vorhanden; der Cloudbrowser erreicht den lokalen
HTTP-Server nicht und erlaubt keine lokale Datei-Navigation. Es wurde keine
Browser-Schutzregel umgangen und keine zusätzliche Software installiert.
