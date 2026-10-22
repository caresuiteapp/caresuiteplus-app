# Eigene DTA- und KIM-Dienste

Stand: 22.10.2026. Auftrag: vollständige Eigenentwicklung, anschließend unabhängige
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

## Versandworker und Rückmeldeeingang

`dispatch-worker.mjs` verarbeitet eine begrenzte Menge freigegebener, bereits
eingereihter Aufträge eines Mandanten. Nur genau eine aktivierte, passende
Serverroute darf senden. Vor dem Claim werden Route/Version, Zieladresse,
Message-ID, optionaler DSN-ENVID und die Dateifakten der tatsächlichen AUF
dauerhaft gebunden. Eine spätere Zieländerung oder mehrdeutige Route blockiert
den Auftrag. Veraltete Pakete bleiben bis zur neuen Freigabe gesperrt; ein
KIM-Paket wird nicht über gewöhnliches SMTP verschickt.

`exchange-worker.mjs` verbindet Versand, Wiederaufnahme noch nicht ausgewerteter
Eingänge und Postfachabruf in `runExchangeCycle`. Jeder Lauf ist begrenzt; der
Host entscheidet über die nächste Ausführung. Unterbrochene/unklare Sendungen
werden nicht erneut eingereiht. Der Host lädt die gemeinsamen TypeScript-Module
mit `node --import ./services/gkv/register.mjs <host-script.mjs>`; der Loader
öffnet selbst keine Verbindung. Es gibt weiterhin keinen öffentlich erreichbaren
Endpunkt zum Einstellen oder Freigeben von Echtaufträgen.

`inbox.mjs` bewahrt Originalnachrichten und Auswertung mit AES-256-GCM in SQLite
auf. Postfachkennung, Mandant, Server und Benutzername bilden eine unveränderliche
Bindung. UIDL-Dubletten werden bytegenau geprüft; dieselbe UID mit anderen Bytes
ist ein Konflikt. Quote, Größenlimit, Hash und Transaktion gelten vor der
Löschfreigabe im entfernten Postfach. Unausgewertete Originale bleiben nach einem
Prozessabbruch wiederaufnehmbar. Dies ist keine manipulationssichere Archivierung
gegen Datenbankadministratoren und enthält noch kein Aufbewahrungs-/Löschkonzept.

`pop3-client.mjs` verwendet ausschließlich implizites TLS mit Hostnamenprüfung.
Passwörter werden erst nach erfolgreicher TLS-Prüfung abgerufen. UIDL und LIST
müssen eindeutig zusammenpassen; RETR-Größe und Dot-Transparenz werden geprüft.
Ein Original wird zuerst dauerhaft gespeichert, dann mit DELE vorgemerkt und
erst durch ein erfolgreiches QUIT als entfernt bestätigt. Bei fehlender
QUIT-Antwort bleibt die Löschbestätigung offen. Wiederabruf ist idempotent;
unterschiedliche Bytes unter derselben UID werden niemals blind gelöscht.
Netzoperationen und asynchrone Hostcallbacks haben denselben Zeitrahmen.

`receipt-parser.mjs` und `receipt-worker.mjs` verarbeiten eine ausdrücklich
begrenzte Teilmenge der Rückmeldungen:

- RFC-3464-DSN als `multipart/report` mit genau einem Statuspart, optionalen
  Originalheadern und begrenzter Empfängerliste. Message-ID und ENVID sind
  verschiedene Kennungen; widersprüchliche Angaben werden zurückgewiesen.
  Bei unseren Einzelversänden muss genau der gebundene Empfänger vorliegen.
  `delivered`, `failed`, `delayed`, `relayed` und `expanded` bleiben getrennt.
- GKV-Anlage-7-Betreff für Annahmebestätigung/Dateiablehnung mit zwei vollständigen
  Dateizeilen: beide Namen, Größen, AUF-Erstellzeit, Transfernummer und physisches
  DAV-IK müssen zum Versand passen. Dateinamen allein reichen nicht. Zitierte
  Originalnachrichten werden nicht als Bestätigung ausgewertet. Plaintext mit
  ASCII/UTF-8/Latin-1 und 7bit/8bit/Base64/Quoted-Printable ist unterstützt.
- Doppelte kritische Header, Mehrdeutigkeit, Größen-/Kennungskonflikte,
  unbekannte Formate und nicht unterstützte MIME-Varianten bleiben mit ihren
  Originalbytes in Quarantäne. Das gilt auch für Ablehnungen ohne vollständige
  Dateiangaben. S/MIME, PFL/FEH-XML, freie TA-6-Fehlertexte, HTML und
  `multipart/alternative` werden hier nicht ungeprüft als Fachrückmeldung gelesen.

**Herkunft und Status:** TLS authentifiziert die Verbindung zum Postfach. Ein
Absenderheader, eine passende Message-ID oder ein Dateipaar beweisen nicht die
Herkunft einer darin enthaltenen Mail. Deshalb bleiben sämtliche Ergebnisse
dieses Empfängers ausdrücklich `authenticity: unverified`. Sie ändern keine
Rechnungs-/Versandzustände, geben keine Reservierung frei und starten keinen
Korrekturversand. Eine Annahmebestätigung nach Anlage 7 bedeutet Dateieingang zur
Weiterverarbeitung; sie ist keine fachliche Abrechnungsannahme. Für automatische
Statusänderungen fehlen noch der echte Herkunftsprüfer und die kanonische,
transaktionale Rückmeldeübernahme. Eine rein lokale Boolesche Freigabe wird
dafür nicht angeboten.

## Implementierte Teile des eigenen KIM-Fachdienstes

`services/kim/mailstore.mjs` implementiert reale, persistente Speicheroperationen:

- Kontopasswörter als gesalzene scrypt-Ableitung; temporäre Sperre spätestens nach
  drei Fehlversuchen, atomare Fehlversuchszähler und Passwortwechsel mit altem Passwort.
- Kontodeaktivierung, Postfachquote, stabile UID und Message-ID-Dublettenprüfung;
  veränderte Nutzbytes unter derselben Message-ID werden zurückgewiesen.
- Groß-/Kleinschreibung beider Adressteile ist bedeutungslos. Neue Konten verwenden
  das KIM-Zeichenalphabet; vorhandene gemischte Schreibweisen behalten ihre
  Speicher-/Verschlüsselungsidentität. Bereits kollidierende Altkonten stoppen
  die Öffnung, statt automatisch zusammengeführt zu werden.
- Verschlüsselte Mail-/Anhangsspeicherung, exklusive Postfachsitzung mit Ablauf
  und Tokenbindung. Ein veralteter Prozess kann keine Löschungen mehr bestätigen.
- KAS-Speicherkern mit zufälliger Ressourcenkennung, Empfängerliste, Besitzerlöschung,
  HEAD-Metadaten, Quote und Ablaufbereinigung einschließlich einstündiger Karenz.

`services/kim/pop3.mjs` implementiert den POP3-Zustandsautomaten für USER/PASS,
STAT, LIST, UIDL, RETR, TOP, DELE, RSET, NOOP, CAPA und QUIT. TOP liefert Header
und die angeforderte Zahl an Bodyzeilen mit Dot-Transparenz. Löschungen werden erst mit
QUIT transaktional bestätigt; ein Verbindungsabbruch verwirft sie. RETR verarbeitet
Dot-Transparenz. `pop3-server.mjs` verbindet den Kern jetzt mit einem echten
TLS-Listener. Ein gültiges Clientzertifikat und die zusätzliche serverseitige
Clientfreigabe sind vor dem Begrüßungstext erforderlich. Verbindungs-, Zeit- und
Eingabelimits sind begrenzt; der Host muss den Listener ausdrücklich starten.
Die Tests verbinden diesen Listener mit dem eigenen Abrufclient. Die gewöhnliche
Test-PKI ersetzt weiterhin keine TI-ECC-/TSL-/Sperrprüfung oder gematik-Zulassung.

### Lokale SMTP-Annahme und Zustellmeldungen

`smtp-server.mjs` verbindet nun einen echten mTLS-Listener mit diesem Postfach.
Er unterstützt EHLO/HELO, AUTH LOGIN/PLAIN, MAIL/RCPT/DATA, RSET/NOOP/QUIT,
SIZE, 8BITMIME, ENHANCEDSTATUSCODES sowie DSN-Parameter ENVID/RET/NOTIFY/ORCPT.
Nur ausdrücklich konfigurierte lokale KIM-Domains werden angenommen. Externe
Weiterleitung und FD-zu-FD-Verkehr werden nicht angeboten. Der authentisierte
Benutzer muss mit MAIL FROM übereinstimmen; fremde PLAIN-Authorization-IDs
scheitern. Passwortwechsel und Deaktivierung entziehen bestehenden SMTP-Sitzungen
die Berechtigung, auch unmittelbar vor DATA-Abschluss.

Zeilen, Befehle, Empfängerzahl, gleichzeitige Verbindungen und die gesamte
Verbindungsdauer sind begrenzt. Bare-LF/CR, NUL, überlange Zeilen, deklarierte
und tatsächlich überschrittene 21 MiB werden zurückgewiesen. Dot-Transparenz wird
vor der Größen-/Inhaltsprüfung entfernt. Nach einer ungültigen DATA-Rahmung wird
die Verbindung geschlossen, sodass anschließende Bytes keine neue Transaktion bilden.

`message-auth.mjs` prüft den tatsächlichen JWT-Signaturwert von `X-KIM-Auth`
mit BP256R1/Brainpool-P256r1 oder PS256/RSA-PSS/SHA-256/Salt 32. `aud`, `sub`,
`nbf`, TTL, optionales `exp`, `jti`, Tokenform und doppelte JSON-Schlüssel werden
kontrolliert. Die eingebettete AUT-Urkunde muss zeitlich gültig, zum Signieren
geeignet, mit C.HP.AUT-/C.HCI.AUT-Policy versehen und von einem explizit gepinnten
Aussteller mathematisch korrekt signiert sein. Der Ausstellerbestand läuft nach
höchstens 24 Stunden ab. Weder Betriebssystem-Wurzeln noch im Token mitgelieferte
Wurzeln oder URLs erzeugen Vertrauen.

**Das ist noch kein TSL-Prüfer:** Beschaffung, XML-Signatur, Service-Status und
Freigabe des TI-Vertrauensbestandes sowie die vollständige TI-PKI-/Algorithmuspolicy
fehlen. Die mathematische PS256-Prüfung akzeptiert Schlüssel ab 2048 Bit; daraus
folgt keine Zulässigkeit eines solchen Schlüssels im aktuellen TI-Betrieb. Für diese
Tests wird ausschließlich eine eigene, ausdrücklich unvertrauenswürdige Test-CA
konfiguriert. Der AUT-Check ersetzt ebenso wenig die TSL-/Sperrprüfung der mTLS-
Komponentenzertifikate. Der SMTP-FD muss gemäß A_23422-01 nicht selbst AUT-OCSP
oder Telematik-ID/VZD-Zuordnung pro Nachricht aufrufen; die vorgeschriebenen
Prüfungen des empfangenden Clientmoduls bleiben davon unberührt.

`message.mjs` prüft From/Sender/Reply-To, Auth-Header, Message-ID, Expires,
Version, Betreff und MIME-Hülle. Die normativ vorgegebene Ausnahme für Versand
genau an sich selbst gilt nur für Originator-/AUT-Prüfungen, nicht für die übrige
Annahme. Die Originatorprüfung unterstützt eine begrenzte RFC-5322-Teilmenge
(Dot-Atom-Adressen, Anzeigenamen und Adresslisten); vollständige Kommentare/
Gruppen und alle historischen Adressformen fehlen. Die konfigurative Deaktivierung
einzelner Prüfungen samt vorgeschriebenem Monitoring aus A_23422-01(4) fehlt;
es gibt aktuell keinen Abschaltpfad.

`envelope.mjs` prüft ausschließlich die **äußere** CMS-DER-Teilmenge mit
TI-ECIES/Brainpool-P256r1 oder dem bisherigen RSA-OAEP/SHA-256, AES-256-GCM,
12-Byte-Nonce, 16-Byte-Tag, eingebettetem Ciphertext,
Issuer/Serial und vollständiger `recipient-emails`-Zuordnung für Sender und
Empfänger. Dieser Fachdienst besitzt keinen Empfänger-Privatschlüssel: innere
Signatur, GCM-Authentizität, signierte Attributkopie, VZD-Zuordnung, CAdES und
Pflege-XML sind damit nicht geprüft. TI-ECIES verwendet KeyTransRecipientInfo;
die frühere Bezeichnung der fehlenden KIM-ECC-Variante als „KARI“ war unzutreffend.
BER und weitere CMS-Varianten sind noch nicht implementiert; erkannte nicht unterstützte Varianten ergeben einen
temporären SMTP-Fehler, keine Freigabe.

Bei zulässiger lokaler Annahme speichert `commitLocalSubmission` die tatsächlichen
Nachrichten, alle benötigten DSNs und einen verschlüsselten Ergebnisdatensatz in
**einer** SQLite-Transaktion. Erst danach wird SMTP 250 gesendet. Deaktivierte oder
volle Empfänger werden getrennt als fehlgeschlagene Zustellung behandelt. Kann
eine notwendige DSN nicht gespeichert werden, werden auch sämtliche Original-
zustellungen zurückgerollt; der Client erhält einen temporären Fehler.

Der Wiederholungsschlüssel umfasst Absender und Message-ID; der Fingerprint bindet
Originalbytes, Empfänger und DSN-Parameter. Gleiche Wiederholungen erhalten dasselbe
Ergebnis, Änderungen einen Konflikt. Das Journal bleibt nach POP3-Löschung und
Neustart erhalten. Pro Absender sind standardmäßig 10.000 Journaleinträge erlaubt;
bei Erreichen der Grenze werden neue Aufträge temporär abgelehnt. Es gibt noch
keinen automatischen Aufbewahrungs-/Bereinigungslauf für dieses Journal; alte
Schlüssel werden nicht stillschweigend zugunsten neuer Sendungen entfernt.
Auch Wiederholungen durchlaufen die aktuelle Annahmeprüfung. Ein inzwischen
abgelaufener AUT-Nachweis wird nicht durch den Journalbestand freigegeben;
eine erneute Signierung mit veränderten Nachrichtenbytes unter derselben
Message-ID ist ein Konflikt. Die betriebliche Auflösung solcher späten Wiederholungen
ist noch zu ergänzen.

`dsn.mjs` erzeugt lokale RFC-3464-Meldungen mit Arrival-Date, äußerem In-Reply-To,
ENVID, optionalem Original-Recipient und einem Statusblock je betroffenem Empfänger.
Sie enthalten keine Originalheader, AUT-Token oder ursprünglichen Nutzdaten.
`fdgerr_1/2/3/4` führen ausschließlich zur Fehlermeldung. `fdgerr_6` übernimmt nur
einen eindeutig dekodierbaren einzelnen text/plain-Part (UTF-8/ASCII, 7bit/8bit/
Base64); andere MIME-Varianten bleiben offen. Bei Größenüberschreitung wird sicher
mit SMTP 552 abgelehnt; die zusätzliche `fdgerr_5`-Erzeugung ist noch nicht
implementiert. Lokal erzeugte DSNs tragen einen leeren Rückweg; ein Netzwerk-
versand solcher Meldungen an andere Fachdienste ist noch nicht vorhanden.

**Vertrauensgrenze:** Kontoprovisionierung und Speicheroperationen bleiben interne
Methoden. `installAccount` darf erst hinter erfolgreicher AUT-/VZD-Registrierung
angeschlossen werden. Es gibt keinen öffentlichen Registrierungs-/KAS-Endpunkt
und keinen gestarteten oder produktiv zugelassenen KIM-Dienst. Der CareSuite-
Versandworker gibt seine KIM-Sperre durch diesen neuen Listener nicht auf.

### Eigener ECC-CMS-Kern

`ecc-cms.mjs` implementiert nun den lokalen Weg von den Originalbytes über eine
Brainpool/ECDSA-Opaksignatur mit geschützter Empfängerzuordnung und ESS-Zertifikatsbindung
zur TI-ECIES/AES-GCM-Verschlüsselung. Der Empfänger prüft GCM, Signatur und die
Übereinstimmung der äußeren und signierten Empfängerzuordnung. Der echte lokale
SMTP-/POP3-Pfad ist damit ebenfalls geprüft. Ergebnisidentitäten bleiben
`unverified`; Software-KeyObjects ersetzen weder SMC-B noch Konnektor.
Unterstützte Teilmenge, 16 neue Prüfungen, Quellen und verbleibende Grenzen sind
in [ecc-cms.md](ecc-cms.md) beschrieben. Der CareSuite-Worker bleibt für KIM gesperrt.

### Eigener KIM-Nachrichtenablauf

`client-message.mjs` erzeugt die vollständigen Wire-Bytes der unterstützten
Inline-Teilmenge: AUT-Token vor der inneren Signatur, kopierte geschützte Header,
ECC-CMS und äußere Base64-MIME-Hülle mit tatsächlicher Größenprüfung. Der
Empfänger verbindet Entschlüsselung mit Headerabgleich und einer gesonderten
AUT-Prüfung ohne die FD-Annahmefrist. Das interne Ergebnis bleibt
`held-for-trust-validation`; es gibt keine normale Clientzustellung oder
Freigabe allein aufgrund mathematisch korrekter Signaturen.
17 weitere Prüfungen und der erweiterte echte SMTP-/POP3-Test bestehen im
Gesamtlauf mit **179 Fällen**. Details, Anforderungsbezug und ausdrücklich offene
Vertrauens-/Fehlerpfade: [kim-client-message.md](kim-client-message.md).

`receiveEccKimMessage` ergänzt lokale Versions-/Entschlüsselungs-/Integritäts-
diagnosen. Originalbelege bleiben bytegleich, Klartextanhänge sind standardmäßig
deaktiviert, Referenzen und Ergebnisse werden pro Prüfvorgang neu erzeugt.
Eine noch ausstehende Vertrauensprüfung bleibt Ergebnis 07. 19 weitere Fälle
und die SMTP-/POP3-Anbindung bestehen im Gesamtlauf mit **198 Prüfungen**.
Die normale Zustellung bleibt gesperrt; vollständige Fehlertexte und die
Konnektor-/HSM-/KAS-Matrix sind noch offen. [Details](kim-receive-errors.md).

### Eigene OCSP-Statusprüfung

`ocsp.mjs` erzeugt Anfragen und verifiziert echte ECC-/RSA-PSS-Antworten gegen
explizite Aussteller-/Signierer-Pins. CertID, vollständiger certHash, Status und
producedAt werden geprüft. Ein begrenzter Prozesscache vermeidet doppelte
Beschaffung und verwirft abgelaufene oder verspätete Antworten. Optional
übergebene OSIG-/AUT-Belege werden im KIM-Empfang erneut geprüft und im
Bericht zum Original dokumentiert. Auch `good` bestätigt noch keine
TI-Identität; negative oder nicht prüfbare Befunde erhalten `XCS_CERT_STATUS`.
25 neue Fälle einschließlich OpenSSL-Gegenprüfung bestehen im Gesamtlauf mit
**223 Prüfungen**. TSL, produktiver Statusabruf und Konnektorintegration
bleiben offen. [Schnittstellen und Grenzen](ocsp.md).

### HTTP(S)-Abruf und dauerhafte OCSP-Belege

`ocsp-http.mjs` implementiert POST an einen festen konfigurierten Endpunkt mit
TLS-Prüfung, Größen-/Zeitgrenzen und Abbruch ohne Weiterleitungen. `ocsp-store.mjs`
speichert ausschließlich kryptografisch geprüfte Antwortbytes verschlüsselt auf
dem geschützten lokalen Volume und prüft sie bei jedem Zugriff erneut. Auch
negative Befunde überleben Neustarts. Prozessübergreifende Claims verhindern
konkurrierende Beschaffungen; abgelaufene Eigentümer können neuere Belege nicht
überschreiben. Vier OCSP-Protokollfehler führen zu fünf Minuten dauerhafter
Abfragesperre. Der Gesamtlauf mit 26 neuen Fällen besteht mit **249 Prüfungen**,
einschließlich HTTPS, echter Prozesskonkurrenz, SIGKILL und KIM-Empfang mit
wieder geöffneten OSIG-/AUT-Belegen. Noch keine authentisierte TSL, produktive
Route oder vollständige Konnektor-/Clientintegration. [Details](ocsp-online.md).

### TSL-Import und dauerhafte Versionskontrolle

`tsl.mjs` prüft die vollständigen XML-Bytes zuerst mit der separaten Signatur
gegen konfigurierte TSL-Signer-CA-Pins. Signiererstatus, das fest gebundene
gematik-XSD-Bündel, die eingebettete XML-Signatur, Zeitgrenzen und Dienststatus
werden tatsächlich geprüft. Die Ausgabe kann den vorhandenen OCSP-Prüfer mit
CA-/Responder-Identitäten aus der geprüften Liste versorgen; ein Status bleibt
ausdrücklich `unverified` hinsichtlich der vollständigen TI-Identität.

`tsl-store.mjs` hält die Originale verschlüsselt und die höchste akzeptierte
Listenkennung/Folgenummer dauerhaft. Rücksprünge und widersprüchliche gleiche
Versionen scheitern auch nach erneutem Öffnen. Jeder Zugriff benötigt erneut
einen gültigen Signiererstatusbeleg. Die vorhandene Python-/lxml-Laufzeit führt
XML/XSD/C14N begrenzt aus; ohne diese Laufzeit gibt es keine Freigabe.
43 neue Fälle bestehen mit den bisherigen Diensten: **292 Prüfungen**.
Authentisierte Ankerprovisionierung/-rotation, vollständige Pfad-/Rollenprüfung
und Konnektorintegration bleiben offen. Die anschließende automatische
Listenbeschaffung ist im folgenden Abschnitt beschrieben.
[Schnittstellen, Grenzen und Primärquellen](tsl.md).

### Automatische TSL-Beschaffung und Aktualisierung

`tsl-http.mjs`, `tsl-signer-status.mjs` und `tsl-refresh.mjs` ergänzen feste
HTTPS-Quellen, verpflichtenden Hashvergleich und periodische Aktualisierung.
Nur abweichende oder erstmals benötigte Listen werden heruntergeladen;
unveränderte Originale benötigen trotzdem eine vollständige Prüfung samt
aktuellem Signiererstatus. Dessen AIA wird erst nach Signaturauthentisierung
gelesen und ausschließlich einer konfigurierten dauerhaften OCSP-Route zugeordnet.
Es gibt keine Backup-Ermittlung und keinen XML-Fallback bei Hashfehlern.

Geschützte Handles und ihre bereits ausgegebenen OCSP-Prüfer kontrollieren
Generation, Frist und authentisierten aktuellen Listenstand bei Verwendung.
Listenwechsel, fehlgeschlagene Aktualisierung, Schließen und Manipulation sperren
die bisherigen Handles; der höchste gespeicherte Stand bleibt erhalten.
Die Testfälle umfassen echte lokale HTTPS-/OCSP-Verbindungen, beide Signaturen,
XSD, periodischen Betrieb, Neustart und Übernahme älterer verschlüsselter Ablagen.
48 neue Fälle bestehen zusammen mit den bisherigen Diensten: **340 Prüfungen**.
Produktiver Hostanschluss und authentisierte TI-Ankerinitialisierung bleiben offen.
[Schnittstellen, Grenzen und Primärquellen](tsl-refresh.md).

### TSL-gebundener OCSP-Abruf im KIM-Empfang

`tsl-ocsp.mjs` wählt die Statusadresse eines Nachrichtenzertifikats anhand des
passenden CA/PKC-Dienstes der geprüften Liste. Ausstellername, tatsächliche
Signatur und AKI/SKI müssen passen. Nur eine eindeutig passende vorkonfigurierte
Route wird verwendet; Leaf-AIA und Responder-Service-URL ersetzen sie nicht.
Dauerhafte Belege werden pro Aufruf gegen den aktuellen geschützten Prüfer
validiert. Die erneute Prüfung gilt auch nach Listenwechsel und bei gemeinsam
laufenden Abfragen. Responderwechsel mit gleichem Namen werden anhand der
autorisierten Schlüssel und tatsächlichen Signatur behandelt.

Ohne Verzeichnis prüft `receive-tsl.mjs` zunächst Nachricht, AUT und Headerbindung, beschafft dann
beide Statusbelege und führt sie durch den bestehenden Empfangsprüfer. Fehlerhafte
Nachrichten lösen keine Statusabfrage aus; ein Transportfehler einer Rolle
verwirft nicht den gültigen Beleg der anderen. Positive lokale Befunde bleiben
Diagnose 07, Klartextanhänge standardmäßig aus und normale Zustellung gesperrt.
38 neue Fälle ergeben zusammen mit dem bisherigen Stand **378 Prüfungen**.
Cacheformat-Kompatibilität, Grenzen und weiterhin fehlender produktiver
TI-/Konnektoranschluss sind in [tsl-ocsp.md](tsl-ocsp.md) beschrieben.

### Zertifikatstyp und CA-Ausstellungsberechtigung

Die [Zertifikatstypprüfung](certificate-types.md) ergänzt den TSL-Statuspfad:
Der Aufruf gibt den Zweck vor, das Zertifikat muss die passende Typ-OID tragen
und der ausstellende CA/PKC-Dienst muss diesen Typ durch eine ExtensionOID
erlauben. Entzogene Freigaben sperren auch vorhandene positive Statusbelege.
Die gemeinsame DER-Auswertung prüft außerdem die Typkennungen in ECC-CMS und AUT.
40 neue Fälle ergeben **418 Prüfungen**. Admission-Rollen, Telematik-ID und
vollständige normative Policy-/Identitätsprüfung sind dadurch nicht erledigt.

### Admission-Rollen und Telematik-ID

Die [Admission-Prüfung](certificate-admission.md) liest nun die Rollen-OIDs und
eine konsistente Telematik-ID aus dem tatsächlich signierten Zertifikat. Die
Rollenfamilie muss zum HBA-/SMC-B-Typ passen. Der TSL-Statusplan verlangt diese
Prüfung vor Netz- und Cachezugriffen; der Empfang gibt OSIG-/AUT-Attribute getrennt
als Diagnose zurück. Die Prüfung gilt auch für lokale ECC-CMS-/AUT-Erzeugung
und Empfang. Mehrere ENC-Zertifikate für dieselbe Adresse mit unterschiedlichen
IDs blockieren die Erzeugung. Identische IDs erlauben den Schlüsselwechsel.
55 neue Fälle ergeben zusammen mit dem bisherigen Stand **473 Prüfungen**.
Die anschließende Verzeichnisanbindung ist im folgenden Abschnitt beschrieben;
normale Zustellung bleibt gesperrt.

### LDAPS-Verzeichnis und KIM-Adressbindung

Der [Verzeichnisbaustein](vzd.md) fragt eine fest konfigurierte LDAPS-Gegenstelle
mit CA-, Hostnamen- und Leaf-Pin-Prüfung ab. Mail-/kimData-Suche, begrenztes LDAP-BER,
eindeutige Treffer, Versionsdaten und binäre ENC-Zertifikate sind umgesetzt.
Die Zertifikatsauswahl verlangt positive TSL-/OCSP-Belege und dieselbe ID wie
im Verzeichniseintrag. Der Empfang gleicht die geschützte From-Adresse mit
OSIG- und AUT-ID getrennt ab. Fehler liefern `XCS_DIRECTORY`; Treffer bleiben
Diagnose 07. Zusätzliche Netzwartezeiten umgehen keine TSL-Aktualisierung.
50 neue Fälle ergaben zunächst **523 Prüfungen**. Die anschließende
Serverprüfung ist im folgenden Abschnitt ergänzt. Konnektoranschluss und
unabhängige Interoperabilitätsnachweise bleiben offen.

### Zertifikat und Sperrstatus des LDAPS-Servers

Der [Serverprüfer](vzd-server-certificate.md) verwendet die tatsächlichen
Zertifikatbytes der geöffneten TLS-Verbindung. Typ C.ZD.TLS-S, aktive und
ausstellungsberechtigte TSL-CA, technisches Admission Verzeichnisdienst-TI,
begrenztes ECC-Serverprofil und positiver OCSP-Status sind vor dem ersten
LDAP-Bind erforderlich. Die technische Rolle enthält keine Telematik-ID.
Listenwechsel und ablaufende Belege werden vor Suche, Ergebnisrückgabe und
abschließender Sender-/Empfängerverwendung erneut geprüft.
51 zusätzliche Fälle ergeben **574 unterschiedliche erfolgreich geprüfte Fälle**;
die ausgeführten Gesamt- und Abschlussläufe stehen in [verification.md](verification.md).
Vollständige Profilvarianten, authentisierte TI-Provisionierung und reale
Interoperabilität bleiben offen; Echtversand und normale Zustellung bleiben gesperrt.

### AUT nur bei abweichender OSIG-/VZD-Identität

Der [bedingte Empfangszweig](conditional-aut-receive.md) entscheidet erst nach
CMS-/Headerprüfung, positivem OSIG-Status und geprüftem VZD-Eintrag. Passt die
OSIG-ID zur From-Adresse, entfallen AUT-Prüfung und AUT-Statusabfrage. Andernfalls
werden der tatsächliche Token, das eingebettete Leaf und dessen
TSL-/OCSP-/Admission-Nachweis gegen denselben Verzeichniseintrag geprüft.
Fehlende oder fehlerhafte erforderliche Nachweise bleiben gesperrt.
Alle Rohbelege werden nach dem letzten Warten erneut ausgewertet. Ein fremder
Statusflag oder eine überschriebene Clientmethode ersetzt diese Prüfung nicht.
Die gezielten Fälle und der gemeinsame Gesamtlauf stehen in
[verification.md](verification.md). Den optionalen Konnektor-Zertifikatsadapter
beschreibt der folgende Abschnitt. TI-Anschluss, vollständige Altprofile und
unabhängige Interoperabilitätsprüfung bleiben offen.

### Konnektor-CertificateService über SOAP und mTLS

Der [eigene Zertifikatsclient](konnektor-certificates.md) liest explizit gewählte
Karten-Zertifikate und ruft VerifyCertificate mit tatsächlichen DER-Bytes auf.
Anfragen und Antworten werden gegen festgeschriebene offizielle XSDs geprüft.
Hostname, provisionierte CA, Serverpin und Clientzertifikat sind verpflichtend.
HTTP-Erfolg, Ausführungsstatus und Zertifikatsgültigkeit werden getrennt bewertet;
fremde SOAP-Fehlertexte gelangen nicht in den Bericht. Nur ursprüngliche Belege
des passenden offenen Clients mit passender Rolle und kurzer Nutzungsfrist
können erneut verwendet werden.

Im entsprechend konfigurierten Empfang müssen sowohl die bisherige TSL-/OCSP-
Prüfung als auch VerifyCertificate bestehen. Der bedingte AUT-Zweig wird dabei
beibehalten. Ein Konnektorfehler, abgelaufener Beleg oder geschlossener Client
erlaubt keinen Rückfall auf den lokalen Erfolg. Die Ausgabe bleibt diagnostisch.
Lokale mTLS-/SOAP- und Empfangsnachweise stehen in [verification.md](verification.md).
Die begrenzten CMS-/Entschlüsselungsoperationen sind inzwischen im
[CMS-/Host-Prüfablauf](konnektor-cms-host.md) ergänzt. Reale Konnektor-/SMC-B-
Anbindung, Discovery und vollständige TI-/Betriebs-/Zulassungsnachweise bleiben offen.

### Kartenabfrage und SMC-B-Auswahl

Der [EventService-/SMC-B-Ablauf](konnektor-smcb.md) fragt verfügbare Karten
über schemafähiges GetCards am separat konfigurierten Endpunkt ab. Er verlangt
eine eindeutige Auswahl und prüft tatsächliche AUT-, ENC- und OSIG-Zertifikate
gegen erwartete Institutions-ID und Rollen, lokale TSL-/OCSP-Belege sowie
VerifyCertificate. Vor der Ausgabe müssen eine zweite Kartenabfrage und die
erneute Belegprüfung bestehen. Ein Kartenwechsel, eine fehlgeschlagene
Aktualisierung oder ein veralteter Snapshot behält kein früheres Ergebnis.
Die Dienstschnittstelle bleibt ohne Karten-Schlüsseloperation, automatische
Ereignisüberwachung und produktive Versandfreigabe. Es gibt dafür noch keine
Auswahloberfläche. Reale Hardware-/TI- und unabhängige Nachweise bleiben offen.

### SMC-B-PIN-Status und Terminalfreischaltung

Der [CardService-/PIN-Ablauf](konnektor-pin.md) liest den PIN-Status der gebundenen
SMC-B und erlaubt auf ausdrücklichen Aufruf einen einzelnen Terminalversuch.
Er nimmt keine PIN oder PUK entgegen. Gesperrte, noch nicht initialisierte und
bereits verifizierte PINs lösen keine erneute Eingabe aus. Nach VerifyPin OK
müssen frisch gelesene Kartenmerkmale, alle drei Zertifikat-Hashes, ihre
Statusbelege und GetPinStatus VERIFIED bestehen. Kopierte oder veraltete
Belege können diesen Ablauf nicht ersetzen. Ein unklar unterbrochener Versuch
sperrt weitere PIN-Aufrufe auf derselben Instanz. Der neue CMS-Diagnosehost
koordiniert seine eigenen Prüfaufträge dauerhaft und bietet eine Webansicht.
Reale Terminals und die vollständige PIN-Verwaltungsoberfläche bleiben offen. Ein positiver Vorbereitungsbeleg gibt weder Authentisierung noch Versand frei.

Die [PIN-Verwaltung](konnektor-pin-maintenance.md) ergänzt ChangePin für
Initialisierung und Änderung sowie UnblockPin mit ausdrücklich gewähltem
SetNewPin. Nur ein passender frischer PIN-Zustand erlaubt den einzelnen
Terminalversuch. PUK- und PIN-Restversuche werden getrennt behandelt; eine
gemeldete PUK-Sperre bleibt in der Instanz an die Kartenseriennummer gebunden.
Nach OK müssen Karte, Zertifikate und regulärer PIN-Status erneut bestehen.
Eine nachträglich gescheiterte Prüfung darf nicht als unveränderte PIN erscheinen.
Der Verwaltungsbeleg ersetzt keine anschließende Schlüsseloperation.

### Authentisierung mit dem SMC-B-Schlüssel

Der [AuthSignatureService-Ablauf](konnektor-auth.md) fordert ExternalAuthenticate
über einen provisionierten SOAP-/mTLS-Endpunkt an. Nur ein ursprünglicher
vollständig geprüfter PIN-Vorbereitungsbeleg kann den einmaligen Aufruf auslösen.
Die Antwort muss eine gültige brainpoolP256r1-Signatur zu den Originaldaten und
dem tatsächlichen AUT-Zertifikat enthalten. Danach werden Karte, alle drei
Zertifikate und PIN-Status vollständig neu geprüft. Erst dann kann ein
X-KIM-Auth-Token mit dem tatsächlichen AUT-x5c-Blatt ausgegeben werden.
Kopierte/veraltete Belege, Karten-/Zertifikatswechsel und unklare Ausgänge
geben kein Token frei. Automatische Wiederholungen und RSA-/Softwareschlüssel-
Fallbacks fehlen ausdrücklich. Die Implementierung verwendet bestehende lokale
Prüfmittel; echte SMC-B-/Konnektor-/TI-Interoperabilität bleibt nachzuweisen.
Ausgehende VZD-Absenderbindung, Account-Manager, vollständige Hostpipeline
und Zulassung bleiben offen. Die begrenzten CMS-/Entschlüsselungsoperationen
stehen im nachfolgenden Diagnoseablauf zur Verfügung.
Die Artefakte behalten den gesperrten Vertrauens-/Versandstatus.

### CMS-Diagnosehost und Oberfläche

Der [CMS-/Host-Prüfablauf](konnektor-cms-host.md) verbindet GetJobNumber,
SignDocument, EncryptDocument, DecryptDocument und VerifyDocument mit fünf frischen vollständigen
SMC-B-/TSL-/OCSP-/PIN-Vorprüfungen. Ein zufälliger synthetischer Inhalt wird
signiert, verschlüsselt, über C.ENC entschlüsselt und bytegenau verglichen.
Signatur, Empfängerzuordnung, Schlüsselrolle und SOAP-Korrelation werden geprüft.
Der ausführbare Node-Host reserviert Aufträge dauerhaft in SQLite, verhindert
Doppelstarts und sperrt ungeklärte Ausgänge auch nach Neustart. Die Web-API prüft
Supabase-Anmeldung und Mandantenrechte und erreicht ausschließlich den fest
provisionierten mTLS-Host. Die neue Ansicht „Konnektorprüfung“ zeigt echte
Hostzustände an und erlaubt den Download des zugehörigen Diagnoseprotokolls.

Das ist eine ECC-Diagnoseintegration, keine vollständige KIM-Versandpipeline.
RSA_ECC/weitere CMS-Profile, vollständige Berichtsprofile, normale Nachrichtenverarbeitung und
unabhängig bestätigte Hardware-/TI-/Zulassungsnachweise bleiben offen. Der
Protokollstatus lautet ausdrücklich `hardwareEvidence=not-attested` und
`tiEvidence=not-attested`. Die ursprüngliche Oberflächenbedienung wurde lokal geprüft. Die Erweiterung
um VerifyDocument und Wiederholsperre benötigt nach dem Verlust der lokalen
Projektabhängigkeiten noch eine erneute lokale React-/Typprüfung; die vier
Vercel-Builds von ca4b6db2 sind inzwischen erfolgreich. Die visuelle
Freigabe bleibt offen. Details: [VerifyDocument](konnektor-verify-document.md).

### Kartenempfang und negative Dokumentenberichte

Der [interne Kartenempfang](konnektor-card-receive.md) verbindet jetzt ein
gespeichertes INLINE-ECC-Original mit der tatsächlich ausgewählten C.ENC,
DecryptDocument, unabhängigem Header-/Signaturvergleich, VerifyDocument,
VZD/AUT und einer vollständigen Kartennachprüfung. Er verwendet keine
Software-Schlüssel und fordert keine PIN-Eingabe an. Falsche Empfängerzuordnung,
Kartenwechsel, negative Statusbelege oder Abbruch geben keine Nachricht frei.

Negative Dokumentenberichte können aus dem tatsächlichen, schema- und
signaturgebundenen Aufruf einmalig als XML-Anhang in die lokale Fehlerdiagnose
übernommen werden. Kopierte Fehler, fremde Signaturen und veraltete Berichte
werden nicht übernommen. Die klare Trennung von Kartenbefund, Nachrichtenbefund
und nicht attestierten Hardware-/TI-Nachweisen bleibt bestehen. Dieser Pfad ist
über die vorhandene TSL-Empfangsfassade aufrufbar; produktiver Postfach-/Host-
anschluss, Empfangsoberfläche und normale Clientzustellung bleiben offen.

### Begrenzung der vorhandenen Kryptolaufzeit

Das installierte OpenSSL 3.0.13 verwendet in `crypto/cms/cms_asn1.c` für
AuthEnvelopedData `authAttrs/unauthAttrs` die Tags 2/3. RFC 5083 §2.1 verlangt 1/2.
Der eigene Strukturprüfer folgt RFC 5083. Der Test prüft die echte OAEP/GCM-
Verschlüsselung durch Entschlüsselung **vor** Ergänzung des normgerechten
unauthAttrs-Attributs. Die anschließende ASN.1-Prüfung ist getrennt; ein vollständiger
unabhängiger CMS-Roundtrip mit diesem Attribut ist hier nicht nachgewiesen.
Der neue ECC-Kern schreibt und liest die normgerechte äußere Struktur selbst;
seine innere CMS-Signatur wird zusätzlich von OpenSSL geprüft. Ein vollständiger
Vergleich des gesamten Containers mit einem zweiten KIM-Client bleibt offen.
Es wurden weder Pakete installiert noch Transportbytes an den abweichenden Decoder angepasst.

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
| Klassischer Empfang | Abruf, verschlüsselte Ablage und begrenzte technische Korrelation sind implementiert; Herkunftsprüfung, weitere MIME-/Rückmeldeprofile, TA-6-Fachrückmeldungen und kanonische Statusübernahme samt Auflösung unklarer Sendungen fehlen |
| Eigener KIM-Client | ECC-CMS, AUT-Erzeugung, Inline-/Headerprüfung, lokale Fehler-MIME, OCSP-Prüfer/-Abruf mit dauerhaftem Cache sowie TSL-Signatur-/XSD-Prüfung, Versionskontrolle und periodische Beschaffung mit Hash-/AIA-Prüfung gegen konfigurierte Anker vorhanden; TSL-CA-Statusrouten, LDAPS-Adressbindung, begrenzte C.ZD.TLS-S-/Rollen-/Sperrprüfung und SOAP-/mTLS-CertificateService mit zusätzlicher Empfangssperre ergänzt. ExternalAuthenticate samt geprüftem AUT-Token und vollständiger Nachprüfung ergänzt. Begrenzte ECC-Kartenoperationen sowie dauerhafter Diagnosehost, mTLS-Web-API und Webansicht ergänzt. Begrenzte VerifyDocument-Prüfung samt Berichtsbindung und interner Kartenempfang mit VZD/AUT, Nachprüfung und originalem negativen XML-Berichtsanhang ergänzt. Reale Konnektor-/SMC-B-Anbindung, weitere CMS-/Berichtsprofile, ausgehende VZD-Absenderbindung, vollständige VZD-Serverprofile/TI-Anbindung, authentisierte TI-Ankerbereitstellung, produktiver Postfach-/Host-/TSL-/Statusanschluss, weitere MIME-Profile/KAS, CAdES je Nutzkomponente, Fach-XML-/XSD-/Beziehungsprüfung, normale Clientzustellung und vollständige normative Fehlerprofile fehlen |
| Eigener KIM-Fachdienst | Lokaler mTLS-SMTP-/POP3-Pfad, gepinnte AUT-Mathematik, begrenzte äußere CMS-Prüfung und lokale DSNs sind implementiert; TI-Netz/TSL/Komponenten-PKI, vollständiger AccountManager/VZD, vollständige CMS-/Fehlerprofile, FD-zu-FD-Relay/Routing/DNS, HTTPS, Abwesenheit und KAS-REST fehlen |
| Betrieb | Abgesicherte dauerhafte Volumes, Ausfallsicherung, Quoten-/Missbrauchsschutz, Schlüsselrotation, Monitoring, Datenschutzkonzept, nachweisbare Löschung auch in WAL/Backups/Replikaten |
| Fachprofile | Noch offene Vertrags-/Sonderfälle und Versionswechsel aus implementation.md; unabhängige Testfälle der Annahmestellen |
| Abnahme | Unabhängige Code-/Sicherheitsprüfung, ITSG-Nachweissoftwareprüfung, gematik Produkt-/Anbieterzulassung, kontrollierte Inbetriebnahme und Interoperabilität |

## Laufzeit und Prüfungen

Die Dienste verwenden die bereits vorhandenen Node-24-APIs, einschließlich
`node:sqlite`, und OpenSSL 3. Der TSL-XML-Worker verwendet die vorhandene
Python-3-/lxml-Laufzeit mit POSIX-Ressourcenlimits; der CertificateService-
XML-Worker verwendet dieselbe Laufzeit. Keine neuen Pakete, Container
oder Testwerkzeuge. Die Verfügbarkeit dieser Laufzeit auf dem späteren
Diensthost ist vor Inbetriebnahme gesondert nachzuweisen.
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
Haltbarkeit dieses Inkrements sind echte Implementierungen. Ein gemeinsamer
Test führt einen Auftrag über tatsächliches TLS-SMTP, eine synthetische DSN des
lokalen Testservers, den eigenen mTLS-POP3-Dienst, die Inbox und die Korrelation.
Die DSN bleibt auch dort unbestätigter Herkunft. Ein separater Prozess wird nach
dem dauerhaften Empfang mit SIGKILL beendet; beim Neustart bleiben Original und
Dublettenprüfung erhalten. Dies ist lokale Integration, kein Annahmestellen-E2E.

Der zusätzliche SMTP-Test betreibt den eigenen Listener, authentisiert einen
echten signierten AUT-Testtoken, nimmt echte äußere CMS-Ciphertextbytes an,
erzeugt die DSN und ruft das Original über den eigenen POP3-Pfad ab. Der verschlüsselte
innere Inhalt ist ausdrücklich nur eine Fixture, kein vollständiges signiertes
KIM-/Pflege-Dokument. Ein weiterer Prozess wird nach SMTP-COMMIT, aber vor Ausgabe
der 250-Antwort mit SIGKILL beendet; Wiederholung nach Neustart und POP3-Löschung
erzeugt keine zweite Zustellung.

Normative Grundlage dieses Inkrements: [FD 1.24.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_FD_KOMLE/gemSpec_FD_KOMLE_V1.24.0/),
[CM 1.23.0 / A_28582](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/),
[S/MIME 1.8.0](https://gemspec.gematik.de/docs/gemWeitere/gemSMIME_KOMLE/gemSMIME_KOMLE_V1.8.0/),
[OID 3.26.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_OID/gemSpec_OID_V3.26.0/),
[RFC 5083](https://www.rfc-editor.org/rfc/rfc5083),
[OpenSSL-3.0.13-Quelltext](https://github.com/openssl/openssl/blob/openssl-3.0.13/crypto/cms/cms_asn1.c),
[RFC 3461](https://www.rfc-editor.org/rfc/rfc3461) und
[RFC 3464](https://www.rfc-editor.org/rfc/rfc3464).

## Primärquellen

- [GKV SECON, gültig ab 01.01.2026](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Anlage_16_-_Security_Schnittstelle.pdf), insbesondere 2, 3, 4 und 5.8.
- [SECON Best Practice](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Best_Practice_Security.pdf), PSS/OAEP-Defaultparameter und CMS-Version.
- [GKV E-Mail-Anlage 7](https://www.gkv-datenaustausch.de/media/dokumente/standards_und_normen/technische_spezifikationen/Anlage_7_-_E-Mail.pdf), 3.2.
- [RFC 3464: Delivery Status Notifications](https://www.rfc-editor.org/rfc/rfc3464) und [RFC 1939: POP3](https://www.rfc-editor.org/rfc/rfc1939).
- [GKV TA 1 Anhang 6: Fehlermeldeverfahren](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/20030131_TA1_ANH6.pdf): unterschiedliche Rückmeldeformen, keine universelle maschinenlesbare Fachquittung.
- [KIM Fachdienst 1.24.0, freigegeben 04.05.2026](https://gemspec.gematik.de/docs/gemSpec/gemSpec_FD_KOMLE/gemSpec_FD_KOMLE_V1.24.0/).
- [KIM Produktsteckbriefe](https://gemspec.gematik.de/docs/gemProdT/gemProdT_FD_KOMLE/) und [Zulassungsverfahren](https://fachportal.gematik.de/zulassung/antraege-und-verfahrensbeschreibungen/anwendungen).
- [OpenSSL CMS](https://docs.openssl.org/3.0/man1/openssl-cms/).
