# Eigene DTA- und KIM-Dienste

Stand: 20.10.2026. Auftrag: vollständige Eigenentwicklung, anschließend unabhängige
Prüfung und erforderliche Zulassungen. Dieser Stand ist ein **ausführbarer,
lokal geprüfter Dienstkern**, keine vollständige Gesamtimplementierung oder TI-Zulassung.
Keine Produktionsfreischaltung; kein Kontakt zu echten Empfängern.

## Implementierter DTA-Ablauf

`services/gkv/registration.mjs` erzeugt einen eigenen RSA-4096-Schlüssel,
verschlüsseltes PKCS#8 und einen DER-kodierten PKCS#10-Antrag mit PSS/SHA-256.
Die Anfrage enthält keine angeforderten Zertifikatserweiterungen. OpenSSL prüft
den Besitznachweis. Bestehende Schlüssel werden nicht überschrieben. Der
zurückgegebene `requestSha256` ist der Hash der Antragsdatei, **nicht** der
amtliche Hashcode-Ausdruck zum öffentlichen Schlüssel. Antragseinreichung,
Hashcode-Ausdruck, Organisationsprüfung und Zertifikatimport sind noch anzubinden.

`services/gkv/secon.mjs` implementiert den vorhandenen `DtaSecurityAdapter`:

1. Absender-/Empfänger-IK, RSA-4096/e=65537, KeyUsage, Gültigkeit, PSS-Zertifikat,
   gepinnte Wurzeln, vollständiger Zertifikatspfad und Sperrlisten prüfen.
2. Originalbytes binär als CMS SignedData mit RSA-PSS, SHA-256, MGF1/SHA-256,
   Saltlänge 32 und Zertifikatskette signieren.
3. SignedData mit einem frischen AES-256-CBC-Schlüssel und IV verschlüsseln;
   Schlüssel für Empfänger und Absender separat mit RSA-OAEP/SHA-256 verpacken.
   Der zusätzliche Absenderempfänger ist in SECON 3.2.2.3 vorgesehen.
4. DER-Struktur, Versionen, genaue Algorithmen/Parameter und Empfänger kontrollieren.
   Container über den Absenderschlüssel wieder entschlüsseln; Signatur auf das
   konfigurierte Absenderzertifikat festlegen und tatsächliche Originalbytes prüfen.
5. Der vorhandene Paketgenerator berechnet die 348-Byte-AUF aus den tatsächlichen
   Ciphertext-Bytes; das Manifest bindet alle Dateien und Empfänger-/Abrechnungsdaten.

`der.mjs` ist ein begrenzter Strukturprüfer für die erzeugte SECON-Teilmenge, kein
allgemeiner CMS-/ASN.1-Parser und kein KIM-CAdES-Verifizierer. Die Kryptoprimitiven
kommen aus OpenSSL. Zertifikats-/CRL-Vertrauen wird separat vollständig geprüft;
das `cms -verify -noverify` in der abschließenden mathematischen Signaturprüfung
überspringt **nur** die dort bereits erfolgte Kettenprüfung, nicht die Signatur.
Private Schlüssel werden verschlüsselt und nur mit restriktiven Dateirechten
akzeptiert. Passwörter laufen über einen eigenen Prozesskanal, nicht Argumente,
Umgebungsvariablen oder Logs. Temporäre Dateien werden entfernt.

`outbox.mjs` speichert Aufträge und Artefakte dauerhaft in SQLite. WAL, FULL-Sync,
sofortige Schreibtransaktionen und eindeutige Rechnungsreservierungen verhindern
konkurrierende Claims. Artefakte liegen als AES-256-GCM mit datensatzgebundener
Authentifizierung vor. Der Schlüssel liegt außerhalb der Datenbank.
Veränderte Wiederholungsaufträge und zweite Buchungen derselben Rechnung scheitern.
Der Journalzugriff ist mandantengebunden. Ein abgebrochener `sending`-Auftrag wird
niemals automatisch wieder zu `queued`; auch `delivery_unknown` bleibt reserviert.
Die Ereignistabelle ist kein gegen Datenbankadministratoren geschütztes Archiv.

`classic-provider.mjs` und `smtp.mjs` liefern exakt AUF und verschlüsselte Nutzdatei
als zwei Base64-Anhänge. Betreff ist die Absender-IK. Ein fest konfigurierter
Empfänger muss zur Paketbindung passen. TLS oder verpflichtendes STARTTLS,
erneutes EHLO, geprüfter Hostname/Zertifikatspfad, AUTH erst nach TLS, Größenlimit,
Antwort-/Zeitlimits, CRLF und Dot-Transparenz werden umgesetzt. Keine automatische
Wiederholung nach fehlendem DATA-Acknowledgement. `sent` bedeutet nur die
SMTP-Annahme nach DATA, keine Zustellung, Fachannahme oder Zahlung.

## Implementierte Teile des eigenen KIM-Fachdienstes

`services/kim/mailstore.mjs` implementiert reale, persistente Speicheroperationen:

- Kontopasswörter als gesalzene scrypt-Ableitung; temporäre Sperre spätestens nach
  drei Fehlversuchen, atomare Fehlversuchszähler und Passwortwechsel mit altem Passwort.
- Kontodeaktivierung, Postfachquote, stabile UID und Message-ID-Dublettenprüfung;
  veränderte Nutzbytes unter derselben Message-ID werden zurückgewiesen.
- Verschlüsselte Mail-/Anhangsspeicherung, exklusive Postfachsitzung mit Ablauf
  und Tokenbindung. Ein veralteter Prozess kann keine Löschungen mehr bestätigen.
- KAS-Speicherkern mit zufälliger Ressourcenkennung, Empfängerliste, Besitzerlöschung,
  HEAD-Metadaten, Quote und Ablaufbereinigung einschließlich einstündiger Karenz.

`services/kim/pop3.mjs` implementiert den POP3-Zustandsautomaten für USER/PASS,
STAT, LIST, UIDL, RETR, DELE, RSET, NOOP, CAPA und QUIT. Löschungen werden erst mit
QUIT transaktional bestätigt; ein Verbindungsabbruch verwirft sie. RETR verarbeitet
Dot-Transparenz. Dieser Kern ist noch kein erreichbarer POP3-Netzdienst.

**Vertrauensgrenze:** Kontoprovisionierung und Speicheroperationen sind interne
Methoden. Es gibt keinen öffentlichen Registrierungs-/KAS-Endpunkt und keinen
fertigen KIM-SMTP-Server. `installAccount` darf erst hinter erfolgreicher
AUT-/VZD-Registrierung angeschlossen werden; `tlsVerified` ersetzt keinen TI-
Zertifikatsprüfer. Die Speicherung eines BLOBs prüft keine KIM-S/MIME-Signatur.
Die lokalen Speicher-/POP3-Tests behaupten deshalb keine KIM-Interoperabilität.

## Anforderungen und verbleibende Implementierung

`kim-fd-requirements.json` inventarisiert die normativen Anforderungskennungen
der freigegebenen FD-Spezifikation 1.24.0. Die wenigen Komponenten mit lokalen
Nachweisen sind als **teilweise** belegt markiert. Alle anderen bleiben offen.
Dies ist noch nicht der vollständige Anforderungskatalog des Produktsteckbriefs:
Clientmodul, S/MIME, Kryptografie, PKI/TSL, Netz, Betrieb, Datenschutz und
Zulassungs-/Anbietervorgaben müssen zusätzlich vollständig zugeordnet werden.

| Arbeitspaket | Verbleibender Nachweis / Implementierung |
| --- | --- |
| CareSuite-Versandfreigabe | Kanonische Supabase-Autorisierung, atomare Office-Rechnungsreservierung samt Revisionen, vertrauenswürdige Übergabe an den Worker, erneute Quellen-/KOTR-/Virenprüfung |
| Zertifikatsbetrieb | Vertrauenswürdig provisionierte Trust-Center-Wurzeln, Zertifikatimport/Rotation, aktuelle CRL-/Verzeichnisbeschaffung, Backup-/Wiederanlauf und Schlüsselverwaltung im Betrieb |
| Klassischer Empfang | Originalquittungen abrufen/authentifizieren, Nachrichten korrelieren, TA-6-Fachrückmeldungen verarbeiten, unklare Sendungen anhand echter Annahmestellenbelege auflösen |
| Eigener KIM-Client | Konnektor-/SMC-B-Anbindung, VZD, ECC-S/MIME, CAdES je Nutzkomponente, XML-Erzeugung und echte XSD-/Beziehungsprüfung, Empfang/Fehlerpfade |
| Eigener KIM-Fachdienst | TI-Netzanbindung, TSL-/OCSP-/AUT-Prüfer, vollständiger AccountManager und VZD-Schreibvorgänge, mTLS-SMTP/POP3/HTTPS, geschlossenes Relay und Authentizitätsprüfung, Routing/DNS, DSN, Abwesenheit, KAS-REST |
| Betrieb | Abgesicherte dauerhafte Volumes, Ausfallsicherung, Quoten-/Missbrauchsschutz, Schlüsselrotation, Monitoring, Datenschutzkonzept, nachweisbare Löschung auch in WAL/Backups/Replikaten |
| Fachprofile | Noch offene Vertrags-/Sonderfälle und Versionswechsel aus implementation.md; unabhängige Testfälle der Annahmestellen |
| Abnahme | Unabhängige Code-/Sicherheitsprüfung, ITSG-Nachweissoftwareprüfung, gematik Produkt-/Anbieterzulassung, kontrollierte Inbetriebnahme und Interoperabilität |

## Laufzeit und Prüfungen

Die Dienste verwenden die bereits vorhandenen Node-24-APIs, einschließlich
`node:sqlite`, und OpenSSL 3. Keine neuen Pakete, Container oder Testwerkzeuge.
Sie gehören in einen eigenen dauerhaften Prozess mit geschütztem lokalem Volume.
Vercel-Funktionen, Browser, mehrere unkoordinierte Replikate mit getrennten
Datenbanken oder flüchtiges `/tmp` sind dafür keine Betriebsumgebung.
Der konkrete Betrieb ist noch nicht eingerichtet. Ein lokaler SQLite-Claim
reserviert keine Supabase-Rechnung; diese verteilte Grenze bleibt ein Freigabeblocker.

Aus dem Repository mit der vorhandenen Node-24-Laufzeit:

```bash
npm run verify:gkv:services
```

Die neuen Tests verwenden eine frisch erzeugte, **nicht produktiv vertraute** CA,
echte signierte CRLs, echte TLS-/STARTTLS-Sockets auf Loopback sowie separate
Prozesse und SIGKILL. Kein Netzwerkzugriff auf eine Annahmestelle oder die TI.
Prüfbelege zu Vertragsfreigabe, Quellen, Teilnahme und E2E-Abnahme im Pakettest
bleiben explizite Fixtures. Die Kryptografie, SMTP-Verarbeitung und lokale
Haltbarkeit dieses Inkrements sind echte Implementierungen.

## Primärquellen

- [GKV SECON, gültig ab 01.01.2026](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Anlage_16_-_Security_Schnittstelle.pdf), insbesondere 2, 3, 4 und 5.8.
- [SECON Best Practice](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Best_Practice_Security.pdf), PSS/OAEP-Defaultparameter und CMS-Version.
- [GKV E-Mail-Anlage 7](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Anlage_7_-_E-Mail.pdf), 3.2.
- [KIM Fachdienst 1.24.0, freigegeben 04.05.2026](https://gemspec.gematik.de/docs/gemSpec/gemSpec_FD_KOMLE/gemSpec_FD_KOMLE_V1.24.0/).
- [KIM Produktsteckbriefe](https://gemspec.gematik.de/docs/gemProdT/gemProdT_FD_KOMLE/) und [Zulassungsverfahren](https://fachportal.gematik.de/zulassung/antraege-und-verfahrensbeschreibungen/anwendungen).
- [OpenSSL CMS](https://docs.openssl.org/3.0/man1/openssl-cms/).
