# Prüfprotokoll: GKV-Datenaustausch

Stand: 21.10.2026. Reine Beispieldaten; keine Übermittlung an eine Pflegekasse.

## Ausgeführt

```bash
node --import ./tests/gkv-exchange/register.mjs --test tests/gkv-exchange/*.test.mjs
```

**418 Fach-/API-/Dienstprüfungen bestanden** mit der vorhandenen Node-24-Laufzeit.
Es wurde kein zusätzliches Testframework installiert.

## Zertifikatstyp und CA-Freigabe am 21.10.2026

Die bisherigen 378 Fälle und **40 neue Prüfungen** bestehen gemeinsam:
**418 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Der gemeinsame Policy-Parser
wird durch `certificate-policy.test.mjs` geprüft. Die bestehende
`tsl-ocsp.test.mjs` ergänzt vier Fälle mit tatsächlichen HTTPS-Anfragen und
geänderten signierten Listen.

Geprüft sind die fünf unterstützten OSIG-/AUT-/ENC-Typen, die Unterscheidung zur
Ausstellungsrichtlinie, Typ-Qualifier, doppelte und mehrdeutige Kennungen,
nichtminimale/abgeschnittene DER-OIDs, fehlerhafte erlaubte Listen und Größen.
Zertifikate mit absichtlich geänderten Erweiterungen werden tatsächlich neu
signiert; ihre gültige CA-Signatur hebt Typfehler nicht auf. OpenSSL liest die
Typ- und Richtlinienkennungen eines gültigen Testzertifikats unabhängig vom
eigenen DER-Parser. ECC-CMS und AUT lehnen ungültige Typstrukturen vor dem
Signieren ab.

Die vollständige TSL-Signatur-/XSD-Prüfung verarbeitet CA-ExtensionOIDs.
Fehlende Freigaben, OIDs in fremden Namespaces, verschachtelte Kennungen und
richtige Textetiketten mit falscher numerischer OID autorisieren keinen Typ.
Doppelte oder fehlerhafte Erweiterungen und kritische Angaben werden abgelehnt.
Opake komplexe Werte geben keine zusätzlichen OIDs frei. Ein OCSP-Diensteintrag
kann einer CA keine Typberechtigung erteilen.

Fehlender Zweck, Zweckwechsel und fehlende AUT-CA-Freigabe erzeugen keine
Statusanfrage. Wird die Typfreigabe entzogen, scheitert auch der vorhandene
positive Cachebeleg. Erst eine neue ausdrücklich erlaubende Liste ermöglicht
seine erneute Prüfung. Ein Entzug während der HTTPS-Anfrage verhindert eine
spätere positive Speicherung. Die Empfangsdiagnose enthält die geprüften Typen;
TI-Identität und normale Zustellung bleiben unbestätigt.

Zehn betroffene MJS-Dateien und beide geänderten Python-Dateien sind syntaktisch
geprüft; das Anforderungs-JSON ist gültig und `git diff --check` ohne Befund.
FD-Inventar unverändert: 106 Kennungen, 28 teilweise lokal belegt und 78 offen.
Vorhandene Laufzeiten, keine Installation und keine produktive TI-Abfrage.
Alle vier Vercel-Projekte haben den vorherigen Commit **3d8ba15** erfolgreich
gebaut. Der neue Commit wird separat in PR #129 geprüft.
[Schnittstellenänderung, Grenzen und Primärquellen](certificate-types.md).

## TSL-gebundene Statusprüfung am 21.10.2026

Die bisherigen 340 Fälle und **38 neue Prüfungen** bestehen gemeinsam.
`tsl-ocsp.test.mjs` verwendet echte lokale HTTPS-Verbindungen, authentisierte
TSL-Originale samt XSD, signierte OCSP-Antworten, verschlüsselte SQLite-Ablage
und eine tatsächlich ECC-verschlüsselte KIM-Nachricht. Gesamtlauf:
**378 bestanden, 0 fehlgeschlagen, 0 übersprungen**.

Geprüft sind die CA-ServiceSupplyPoint-Auswahl unabhängig von Leaf-AIA und
Responder-Service-URL, fehlende/unzulässige/mehrdeutige Routen, CA-Eingaben,
veränderte Zertifikate, fehlende AKI und das ausdrücklich gewählte
CA-Kompromissmodell mit Ausstellungszeitgrenze. Ein neuer CA-Endpunkt kann
keinen Beleg aus dem vorherigen Routencache übernehmen.

Die Cacheprüfungen umfassen Neustart, gleiche Listen mit erneuerten Handles,
negative Befunde, manipulierte Verschlüsselung, Konfigurations-/Namespacewechsel,
parallele Clients, Quoten, Timeout, Abbruch und dauerhaftes Protokollfehler-Backoff.
Entfernte Responder sowie Listenwechsel während eines laufenden Abrufs können
keine alten Belege freigeben. Neue Responder mit gleichem Namen werden über
ihre tatsächliche Signatur ausgewählt; eine frische Antwort vom entfernten
Schlüssel bleibt gesperrt. Das vorherige verschlüsselte Cacheformat bleibt
lesbar, scheitert beim gleichnamigen Schlüsselwechsel aber ohne neue
Respondermetadaten bis zum Ablauf. Diese Rollback-/Migrationsgrenze ist
ausdrücklich [dokumentiert](tsl-ocsp.md).

Der tatsächliche Empfang prüft beide Rohbelege erneut und erhält Diagnose 07
ohne Klartextanhang. Sperrung, unbekannter Status und Fehler einer Einzelrolle
werden getrennt berichtet. Fehlerhafte Nachrichten, fehlende Schlüssel und
ungültige Berichtsoptionen lösen keine Statusanfragen aus. Vorgetäuschte
`good`-Flags und asynchrone Änderungen an Originalbytes/Zertifikaten/Berichtsflags
geben keinen anderen Inhalt frei. Unverschlüsselte Nachrichten bleiben bytegleich.

Neun betroffene MJS-Dateien bestehen `node --check`, die geänderte Python-Fixture
und das Anforderungs-JSON die Syntaxprüfung. Die Änderungen bestehen
`git diff --check`. Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal
belegt, 78 offen. Keine Installation, UI-/Android-/Supabase-/Produktionsänderung
oder echte TI-/Statusabfrage. Alle vier Vercel-Projekte haben den vorherigen
Commit **176a9b1** erfolgreich gebaut. Inzwischen haben alle vier Vercel-Projekte
auch diesen Stand **3d8ba15** erfolgreich gebaut.

## Automatische TSL-Aktualisierung am 21.10.2026

Die bisherigen 292 Fälle und **48 neue Prüfungen** bestehen gemeinsam.
`tsl-refresh.test.mjs` verwendet eine echte lokale HTTPS-Gegenstelle, isolierte
Zertifikate mit AIA, signierte OCSP-Rohbelege, beide TSL-Signaturen, das komplette
XSD und die verschlüsselte SQLite-Ablage. Der vollständige Lauf ergibt
**340 bestanden, 0 fehlgeschlagen, 0 übersprungen**.

Geprüft sind Erstabruf, zwingender Hashvergleich ohne XML-Fallback, unveränderte
Originale mit erneutem Statuscheck, Statuserneuerung nach Ablauf, spätere Sperrung,
Neustart und Migration des bisherigen verschlüsselten v1-Ablageformats.
Listen-/Signaturspiegelabweichungen, gebrochene innere Signatur, ungültige Hashes,
fehlende/mehrdeutige/unzulässige AIA, unbekannter oder gesperrter Signierer sowie
vier OCSP-Protokollfehler mit anschließendem dauerhaftem Backoff scheitern.

Ein Listenwechsel entfernt bisherige Dienste auch aus bereits ausgegebenen
OCSP-Prüfern. Eine konkurrierende Store-Aktivierung, manipulierte Metadaten,
Quellenwechsel, gelöschte Kontroll-/Quellendatensätze und ein Zeitrücksprung geben
keinen alten Stand frei. Ablauf und Fehler erhalten den dauerhaften höchsten
Listenstand. Gleichzeitig gestartete Updates teilen einen Lauf. Gesamtabbruch,
Schließen und Abbruch im XML-Worker verhindern verspätete TSL-Aktivierung; ein
geteilter Statuscache kann seinen eigenen Abruf trotzdem gültig abschließen.

HTTPS-CA und Hostname bleiben bei fester IP geprüft. Getestet sind Weiterleitungen,
falsche/mehrfache Header, Medientypen, Komprimierung, Größen, unvollständige und
hängende Antworten, Abbruch, Konfigurationskopien und explizite HTTP-Freigabe für
separate Signaturen. Der periodische Ablauf einschließlich Fehlerwiederholung
und Schließen ist mit echten Netzwerkabrufen und kontrollierten Timern geprüft.

Neun betroffene MJS-Dateien bestehen `node --check`; Anforderungs-JSON und eigene
Änderungen bestehen Syntax-/Whitespace-Prüfung. Das FD-Inventar bleibt bei
106 Kennungen: 28 teilweise lokal belegt, 78 offen. Vorhandene Laufzeiten,
keine Installation oder neue Infrastruktur. Keine UI-/Android-/Supabase- oder
Produktionsänderung und keine Abfrage echter TSL-/OCSP-Dienste.
Alle vier Vercel-Projekte haben diesen Stand **176a9b1** erfolgreich gebaut.
Ein Web-Build belegt keine Python-/lxml-Laufzeit des Diensthosts.
[Ablauf und Betriebsgrenzen](tsl-refresh.md).

## TSL-Import und Versionskontrolle am 21.10.2026

Die bisherigen 249 Fälle und **43 neue Prüfungen** bestehen gemeinsam.
`tsl.test.mjs` prüft echte separate und eingebettete ECC-/RSA-PSS-Signaturen,
Signierer-EKU/KeyUsage, fremde CA-Schlüssel, tatsächliche OCSP-Rohbelege und
vier XML-Kanonisierungsvarianten mit Namespaces, Einrückung und Kommentaren.
OpenSSL bestätigt die separate ECC-Signatur unabhängig vom Node-Verifier.
Die vollständige XSD-Prüfung verwendet das fest gebundene gematik-Schema-Bündel
mit der vorhandenen lxml-6.1.1-/libxml2-2.14.6-Laufzeit. Kein vereinfachter
Testparser und keine Installation.

Manipulierte XML-/Signaturbytes, DTD/XXE, externe Referenzen, doppelte IDs,
Signatur-Wrapping, fremde kritische Erweiterungen, unzulässige Signierer,
gesperrte/unbekannte/veraltete Statusbelege und abgelaufene Listen scheitern.
Die Vorbereitung des Signiererstatus gibt noch keinen TSL-Snapshot frei.
Eingabekopien und nach der XML-Verarbeitung wiederholte Fristprüfungen schützen
gegen Änderungen während der asynchronen Prüfung.

Geprüft sind aktuelle und gesperrte CA-Dienste einschließlich expliziter
Ausstellungszeitgrenze, fehlende/zukünftige Responder und doppelte Identitäten.
Die verschlüsselte Ablage wird erneut geöffnet und vollständig nachgeprüft.
Falscher Schlüssel, Umgebungs-/Profilwechsel, veränderte Versionsmetadaten,
Rücksprünge und widersprüchliche gleiche Versionen werden abgewiesen.
Konkurrierende Instanzen können keinen höheren Stand überschreiben; Ablauf
löscht die Versionsgrenze nicht, und Schließen verhindert verspätete Aktivierung.

Gesamtlauf: **292 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vier MJS-Dateien, beide Python-Dateien und das Anforderungs-JSON sind syntaktisch
geprüft. Die eigenen Änderungen bestehen `git diff --cached --check`;
vorhandene Leerzeichen am Zeilenende in den bytegleich übernommenen und
hashgebundenen Original-XSDs bleiben absichtlich erhalten.
Keine UI-/Android-/Supabase- oder Produktionsänderung; keine echte TI-/OCSP-
Abfrage. Die Anker sind lokal provisioniert. Die in diesem Zwischenstand noch fehlende
automatische TSL-Beschaffung ist oben ergänzt; Ankerrotation, vollständige
TI-Pfad-/Rollenprüfung, VZD und Konnektorintegration bleiben offen. [Schnittstellen, Laufzeit und genaue Grenzen](tsl.md).
Alle vier Vercel-Projekte haben inzwischen auch diesen Stand **62bd8ba**
erfolgreich gebaut.
Die Python-Diensthost-Laufzeit wird durch einen Web-Build nicht nachgewiesen.

## OCSP-Abruf und dauerhafte Belege am 21.10.2026

Die bisherigen 223 Fälle und **26 neue Prüfungen** bestehen gemeinsam.
`kim-ocsp-online.test.mjs` verwendet echte HTTP-/HTTPS-Verbindungen auf Loopback
mit eigener Test-PKI. Geprüft sind CA-/Hostnamenprüfung trotz fester Verbindungs-IP,
exakte POST-Bytes, Weiterleitungsablehnung, Header-/Format-/Größengrenzen,
unvollständige Antworten, absolute Frist bei tröpfelndem Body und Abbruch.

Die verschlüsselte SQLite-Ablage überlebt Wiederöffnen und Prozesswechsel.
Falsche Schlüssel, Konfigurationswechsel, verschobene Datensätze und veränderte
Ablaufdaten scheitern. Aktuelle Rohbelege werden mit erneuerten Pins erneut
geprüft, auch negative Befunde; Zeitablauf und Rücksprünge werden kontrolliert.
Vier Protokollfehler erzeugen einen über Neustart wirksamen fünfminütigen Backoff.
Quoten, Timeout und Schließen geben keine verspäteten Belege frei.

Getrennte Instanzen und Prozesse teilen eine Beschaffung. Tatsächliches SIGKILL
während einer HTTP-Anfrage hinterlässt einen befristeten Claim; nach Ablauf
kann ein anderer Prozess sicher übernehmen. Ein alter Eigentümer kann weder
den neuen Claim löschen noch dessen Ergebnis mit seiner späten Antwort ersetzen.
Wieder geöffnete OSIG-/AUT-Belege durchlaufen den echten verschlüsselten
KIM-Empfang: Originalhashbindung, Diagnose 07 und kein Klartextanhang bleiben erhalten.

Gesamtprozess: **249 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vier neue MJS-Dateien bestehen `node --check`; `git diff --check` ist ohne Befund.
Keine Installation, UI-/Android-/Supabase- oder Produktionsänderung; keine Abfrage
echter OCSP-Dienste. Authentisierte TSL, produktiver Dienstanschluss und
Konnektorintegration bleiben offen. [Details](ocsp-online.md).
Alle vier Vercel-Projekte haben den Vorgänger **2cb559a** erfolgreich gebaut;
der Buildstatus des neuen Commits wird gesondert in PR #129 dokumentiert.

## Vorherige OCSP-Statusprüfung am 21.10.2026

Die bisherigen 198 Fälle und **25 neue Prüfungen** bestehen gemeinsam.
`kim-ocsp.test.mjs` prüft reale ECDSA-/RSA-PSS-Antworten, CertID-/certHash-
Bindung, Sperrstatus, strikte Zeitgrenzen, falsche Signierer, Manipulationen,
DER-/Erweiterungs-/Größenfehler, Snapshotablauf und den KIM-Empfangsbericht.
Positive Statusbelege allein erzeugen weiterhin keine TI-Identität oder Zustellung.

OpenSSL liest die eigene Anfrage und prüft die eigene Antwort samt Status.
Eine von OpenSSL erzeugte Antwort wird umgekehrt bis zu ihrer fehlenden
TI-certHash-Erweiterung verarbeitet und dort abgelehnt. Cacheprüfungen belegen
Wiederverwendung, gemeinsame laufende Beschaffung, negative Befunde, Ablauf,
Kapazität, Timeout und Schließen ohne Übernahme verspäteter Antworten.

Gesamtprozess: **223 bestanden, 0 fehlgeschlagen, 0 übersprungen**.
Vorhandene Laufzeit, keine Installation, UI-/Android-/Datenbank- oder
Produktionsänderung. Der damalige Stand enthielt noch keinen dauerhaften Abruf;
dieser ist oben gesondert belegt. Vollständige TI-Vertrauensprüfung und
Konnektorintegration bleiben offen. [Details](ocsp.md).
Alle vier Vercel-Projekte haben den Vorgänger **9746200** erfolgreich gebaut.

## KIM-Empfangsdiagnosen am 21.10.2026

Die bisherigen 179 Fälle und **19 neue Prüfungen** bestehen gemeinsam.
`kim-receive-error.test.mjs` prüft Versions-/Format-/Schlüsselfehler, GCM- und
Signaturmanipulationen, eigene Codes bei unklaren Ursachen, Headerbereinigung,
Ergebnis 07 bei ausstehendem Vertrauen, einmalige UUID-Referenzen, unveränderte
Originalbytes und den standardmäßig ausgeschalteten Klartextanhang.

Pythons eigenständiger Standardbibliotheksparser liest die tatsächlichen
MIME-Nachrichten, Unicode-Betreffzeilen, Quoted-Printable-Texte und Base64-Berichte.
RFC822-Anhänge werden zusätzlich bytegenau geprüft, auch mit Binärbytes und
fehlenden/abschließenden CRLFs. XML-Berichte sind an den Originalhash gebunden;
das belegt keine XSD- oder Echtheitsprüfung dieser externen Berichte.

Der bestehende echte SMTP-/POP3-/Inbox-Test erzeugt daraus die 07- und 4009-
Diagnosen. Das gespeicherte Original bleibt unverändert, es wird keine weitere
Mail an den Sender erzeugt. Eingabegrenze 21 MiB und Diagnosegrenze 22 MiB sind
einschließlich eines Originals an der SMTP-Grenze geprüft. Überschreitungen von
Headergrenzen führen zum Fehler, nicht zum Abschneiden von Belegen.

Die strikten Öffner geben nach Prüfungsfehlern weiterhin keinen Klartext zurück.
Eine gesonderte Diagnoseoption erlaubt einen ausdrücklich ungeprüften
Originalanhang erst nach erfolgreicher GCM-Authentisierung.
Weitere Grenzen: [kim-receive-errors.md](kim-receive-errors.md).
Alle vier Vercel-Projekte haben den Vorgänger **817a673** erfolgreich gebaut.

## KIM-Nachrichtenablauf und Headerbindung am 21.10.2026

Die bisherigen 162 Fälle und **17 neue Prüfungen** bestehen gemeinsam.
16 Fälle in `kim-client-message.test.mjs` prüfen tatsächliche AUT-Signaturen,
Rollen-/Schlüssel-/Versionsfehler, erneutes Tokenisieren, doppelte Header,
Absender-/Empfänger-/Zertifikatszuordnung, geschützte Metadaten, Folding und
Manipulationen, binäre Nutzdaten, Größen- und MIME-Grenzen. Ein zusätzlicher
ECC-Test prüft Base64-SignedData mit gefalteten und anders angeordneten MIME-Headern.

Nachrichten werden auch zwei Tage nach Erstellung mathematisch geprüft, ohne
fälschlich die FD-AUT-Annahmefrist anzuwenden. Zukunftstokens werden weiterhin
abgelehnt. Die Ergebnisse behalten ausdrücklich unbestätigte Identität und
`held-for-trust-validation`; Fehler liefern keine Klartextnachricht.

Der vorhandene echte mTLS-SMTP-/Mailstore-/mTLS-POP3-/Inbox-Test verwendet jetzt
den vollständigen neuen Inline-Erzeuger mit AUT-Token und den neuen Empfangspfad.
Wire-Bytes, Hash der geschützten Nachricht und ursprünglicher Body stimmen
überein. Wiederholung nach POP3-Löschung erzeugt keine Dublette.

Grenzen und Quellen: [kim-client-message.md](kim-client-message.md).
TSL/OCSP/VZD, SMC-B/Konnektor, weitere Profile/KAS, vollständige normative
Fehlerprofile und normale Clientzustellung fehlen weiterhin. Die später ergänzten
lokalen Diagnosemails sind oben gesondert belegt. Der CareSuite-Worker bleibt
für KIM gesperrt. Keine UI-/Android-/Datenbankänderung.
Alle vier Vercel-Projekte haben den Vorgänger **280be44** erfolgreich gebaut.

## ECC-CMS und durchgehender lokaler Transport am 21.10.2026

Die 146 bisherigen Fälle und **16 neue Prüfungen** bestehen gemeinsam, ohne
übersprungene Fälle. `kim-ecc.test.mjs` prüft echte Brainpool-Schlüssel,
TI-ECIES-Kartenformat, CMAC, AES-GCM, ECDSA und signierte Empfängerzuordnung.
Vier veröffentlichte NIST-Vektoren, das veröffentlichte gematik-Strukturbeispiel
und eine getrennte OpenSSL-CLI-Zusammensetzung in beiden Richtungen ergänzen die
eigenen Roundtrips. OpenSSL `cms -verify -cades` prüft die innere Signatur und
ESS-Zertifikatsbindung gegen die isolierte Test-CA.

Eine zusätzliche Prüfung transportiert eine tatsächlich signierte und ECC-
verschlüsselte Nachricht durch den eigenen mTLS-SMTP-Listener, das dauerhafte
Postfach und den mTLS-POP3-Abruf. Entschlüsselung und Signaturprüfung ergeben die
exakten Originalbytes. Wiederholung nach POP3-Löschung erzeugt keine Dublette.

**Grenzen:** Die neuen Tests enthalten eine echte innere Testsignatur; die ältere
RSA-Fixture darunter bleibt opak. Software-Schlüssel und Test-CA sind keine
SMC-B/TI-Identitäten. Der neue Empfänger liefert immer `identityStatus: unverified`.
TI-PKI/OCSP/VZD, allgemeine MIME-Verarbeitung, Fach-XML und Konnektoranbindung fehlen.
Der danach ergänzte Headerabgleich ist oben gesondert belegt. Der gesamte äußere ECC-Container wurde
noch nicht von einem zweiten KIM-Client verarbeitet; die CLI-Gegenprüfung
verwendet dieselbe OpenSSL-Kryptoprimitivenbibliothek wie Node.

Details und Quellen: [ecc-cms.md](ecc-cms.md). Keine UI-/Android-/Datenbankänderung.
Alle acht geänderten/neuen MJS-Dateien bestehen `node --check`;
`git diff --check` ist ohne Befund.
Der Vorgänger **6667975** hat vier erfolgreiche Vercel-Builds. Der neue Commit
wird gesondert geprüft; diese Aussage ist keine Freigabe eines Produktivbetriebs.

## Eigener lokaler KIM-SMTP-Pfad am 20.10.2026

Die 127 bisherigen Fälle und **19 neue Prüfungen** aus `kim-smtp.test.mjs` wurden
gemeinsam erfolgreich ausgeführt. Es gab keine übersprungenen oder ausstehenden Tests.

- Tatsächliche Brainpool-P256r1- und RSA-PSS-Token-Signaturen, Aussteller-Pins,
  AUT-Zertifikatspolicy, Signaturmanipulation, Sender/Audience/Gültigkeit und
  doppelte JSON-Schlüssel einschließlich maskierter Schreibweise.
- Echter mTLS-SMTP-Listener mit LOGIN/PLAIN, Groß-/Kleinschreibung, Senderbindung,
  geschlossenen Empfängerdomains, Zustandswechseln und unzulässiger Authorization-ID.
  Fehlendes Clientzertifikat, falscher TLS-Hostname und fehlende Hostfreigabe
  scheitern, bevor Zugangsdaten abgefragt werden; die Verbindungsdauer ist begrenzt.
- Prüfung der äußeren OAEP/GCM-Struktur und Empfängerzuordnung; tatsächlicher
  verschlüsselter Testinhalt. Manipulierte/fehlende Zuordnung wird erkannt.
  Erkannte nicht unterstützte CMS-Varianten und abgelaufenes Vertrauen werden
  nicht als gültige Zustellung behandelt.
- From/Sender/Reply-To, ungültiger/doppelter AUT-Header und die normativ vorgegebene
  Self-Send-Ausnahme. Betreff-/Versions-/Content-Type-/CMS-Fehler erzeugen nur die
  zugehörige fdgerr-DSN. Die erlaubte fdgerr_6-Plaintextkopie bleibt begrenzt.
- Original und selbst erzeugte DSN landen tatsächlich im eigenen Postfach;
  der eigene mTLS-POP3-Client ruft die exakten Bytes in die verschlüsselte Inbox ab.
  DSNs enthalten Arrival-Date, In-Reply-To, Empfängerblöcke, ENVID/ORCPT und keinen
  AUT-Token oder gewöhnlichen Originalbody. NOTIFY NEVER erzeugt keine Erfolgs-DSN.
- Mehrere lokale Empfänger, doppelte RCPT-Adressen, volle/deaktivierte Postfächer
  und ein volles Absenderpostfach für die notwendige DSN. Beim letzten Fehler
  wird auch eine bereits innerhalb der Transaktion geschriebene Zustellung zurückgerollt.
- Gleichzeitige Wiederholung, geänderte Bytes/ENVID, Journalquote, Wiederöffnen
  und POP3-Löschung. Ein eigener Serverprozess stirbt per SIGKILL nach SQLite-COMMIT
  vor der 250-Antwort; danach erzeugt die Wiederholung weder Original noch DSN erneut.
- Passwortwechsel während DATA entzieht die Annahmeberechtigung. Alte gemischte
  Adressschreibweisen bleiben mit ihrer Verschlüsselungsbindung lesbar; neue
  Case-Aliase erzeugen kein zweites Konto.
- Echte Übertragung von mehr als 21 MiB ohne SIZE-Ankündigung, Überschreitung eines
  kleineren SIZE, Bare-LF/SMTP-Smuggling-Versuch und abgebrochene DATA-Eingabe.
  Keine dieser Eingaben erzeugt eine gespeicherte Zustellung.
- POP3 TOP liefert nur Header und die angeforderte Zahl Bodyzeilen, korrekt
  dot-escaped, ohne implizite Löschung.

**Beleggrenzen:** Testkonten und Test-PKI haben keine TI-Identität/Zulassung.
AUT-Aussteller sind lokal gepinnt, nicht durch einen fertigen TSL-Prüfer gewonnen.
Der CMS-Testinhalt ist eine ausdrücklich opake Fixture, keine gültige innere
KIM-Signatur oder Pflege-XML. Die echte Verschlüsselung wird unabhängig entschlüsselt,
bevor das normgerechte unauthAttrs-Attribut ergänzt wird. Der installierte
OpenSSL-3.0.13-Decoder hat dort eine von RFC 5083 abweichende Tagdefinition;
dieser vollständige CMS-Roundtrip bleibt offen (Details in `own-services.md`).
Zum damaligen Stand waren ECC-CMS, vollständige TI-PKI, FD-zu-FD-Weiterleitung,
fdgerr_5, übrige MIME-Varianten, AccountManager/VZD und Betrieb noch nicht vollständig
implementiert. Den inzwischen ergänzten ECC-Kern beschreibt der Eintrag vom 21.10.2026.

Alle elf geänderten/neuen MJS-Dateien wurden mit `node --check`, der Diff mit
`git diff --check` geprüft. Keine Oberflächen-/Android-Änderung in diesem Inkrement.
Am Vorgänger **e211462** waren beim letzten Abruf zwei Vercel-Projekte erfolgreich
und zwei noch ausstehend. Der Status des neuen Commits wird separat im PR dokumentiert.

## Versandworker und Empfang am 20.10.2026

Die 108 bisherigen Fälle plus **19 neue Dienstprüfungen** wurden gemeinsam
erfolgreich ausgeführt (`npm run verify:gkv:services`). Die neuen Tests belegen:

- Message-ID, DSN-ENVID, Ziel und AUF-Dateifakten liegen vor SMTP dauerhaft vor;
  zwei konkurrierende Worker versenden nur einmal. Fehlende DATA-Bestätigung
  bleibt auch nach Wiederöffnen unklar und löst keine Wiederholung aus.
- Veraltete Freigaben, mehrdeutige/abgeschaltete/fremde Routen und nachträglich
  geänderte Empfänger werden vor dem Versand blockiert; ENVID-Injektion scheitert.
  Andere Groß-/Kleinschreibung einer Rechnungs-UUID umgeht keine Reservierung.
- RFC-3464-Aktionen bleiben getrennt. Doppelte/kollidierende Kennungen, widersprüchlicher
  Status, falscher Empfänger und ein Hinweis auf einen noch ungesendeten Auftrag
  führen zur Quarantäne. ENVID allein kann einen zuvor damit versendeten Auftrag zuordnen.
- Anlage-7-Rückmeldung wird nur über beide Dateifakten, AUF-Zeit, DAV-IK und
  Transfernummer zugeordnet. Zitierte Originale/Dubletten reichen nicht aus;
  Base64 und Quoted-Printable werden vor der Prüfung dekodiert.
- Originalbytes und Auswertung bleiben verschlüsselt erhalten. Falscher
  Speicherschlüssel, andere Mandanten, UID-Inhaltskonflikt und geänderte
  Postfachidentität werden erkannt. Unausgewertete Originale sind wiederaufnehmbar.
- Echter mTLS-POP3-Listener des eigenen Mailstore mit dem eigenen TLS-Abrufclient:
  Clientfreigabe, Authentisierung, UIDL/LIST/RETR, Dot-Transparenz, Speicherung,
  Auswertung, DELE und QUIT. Die entfernte Löschung erfolgt erst nach lokaler Persistenz.
- Tatsächliches SIGKILL eines separaten Abrufprozesses nach dem Speichern:
  Original bleibt im Postfach, Neustart erkennt Dublette und schließt den Abruf ab.
- Falscher TLS-Hostname, fehlendes/nicht freigegebenes Clientzertifikat,
  Inbox-Quote, übergroße Nachrichten, doppelte UID, falsche RETR-Größe,
  verlorene QUIT-Antwort und geänderte Bytes beim Wiederabruf.
- Zeitgrenzen für eine stumme TLS-Gegenstelle und eine hängende Passwortabfrage.
- Gemeinsamer Dienstlauf: echte TLS-SMTP-Übermittlung des SECON-Pakets, synthetische
  DSN vom lokalen Testserver, eigenes mTLS-POP3, verschlüsselte Inbox und genaue
  Zuordnung. Der nächste Lauf versendet und verarbeitet nichts erneut.

**Grenzen:** Es handelt sich um lokale Integration mit fiktiver PKI und Testkonten,
nicht um TI-/Annahmestellen-Interoperabilität. Auch korrekt korrelierte Quittungen
bleiben `unverified`; die Tests prüfen ausdrücklich, dass weder Rechnungsstatus
noch Versandreservierung verändert werden. Vollständige Herkunftsprüfung,
PFL/FEH-XML/CMS, TA-6-Fachrückmeldungen und die kanonische Office-/Supabase-
Übernahme fehlen weiterhin. Der eigene Dienst ist noch nicht bereitgestellt.

Die geänderten/neuen MJS-Dateien wurden mit `node --check` geprüft;
`git diff --check` bestand. Keine neue Software oder Testinfrastruktur installiert.
Der vorherige Commit **51d15b2** hat vier erfolgreiche Vercel-Deployments.
Für dieses Inkrement wird der Buildstatus ausschließlich am neuen Commit gelesen
und im PR #129 festgehalten.

## Vorheriger eigener Dienstkern am 20.10.2026 (51d15b2)

Die 87 bisherigen Fälle plus **21 neue Dienstprüfungen** wurden gemeinsam
ausgeführt (`npm run verify:gkv:services`). Der neue Dienstkern verwendet echte
Implementierungen von OpenSSL, TLS/STARTTLS und SQLite. Geprüft sind:

- SECON RSA-PSS/OAEP/SHA-256/AES-256-CBC, DER-Parameter, unabhängige Entschlüsselung
  mit dem Empfängerschlüssel, Byteidentität, frische Zufallswerte und manipulierte Daten.
- Tatsächlich signierte CA-/Teilnehmerzertifikate und Sperrlisten; gesperrter Empfänger,
  falsche IK, falscher Vertrauensanker, abgelaufene Gültigkeit und unsichere Key-Dateirechte.
- PKCS#10-Antrag, verschlüsseltes RSA-4096-Schlüsselmaterial, mathematischer
  Besitznachweis, Schutz vor Überschreiben und DN-Injektion.
- Persistenz nach Wiederöffnen, datensatzgebundene Verschlüsselung, falscher
  Speicherschlüssel, Mandantentrennung und doppelte Rechnungsreservierung.
- Gleichzeitiger Claim aus zwei separaten Prozessen und tatsächliches SIGKILL
  unmittelbar nach einem Claim: kein erneuter Versand nach Wiederöffnen.
- Echte TLS-/STARTTLS-Verbindung auf Loopback, genau zwei DTA-Anhänge, EHLO nach
  TLS, Authentisierung erst nach TLS, DSN-Envelope, Dot-Transparenz, falscher Host,
  Empfängerablehnung, Handshake-Timeout und Verbindungsabbruch nach DATA.
- KIM-Kontokern: echte scrypt-Passworthashes, atomare Fehlversuchszähler,
  persistente Sperre, Passwortwechsel, Sitzungsinvalidierung und Deaktivierung.
- KIM-Mailstore/POP3: Quote, stabile UID, Inhaltskonflikt, Postfachsperre,
  RETR/DELE/RSET/QUIT, kein Löschen bei Abbruch und keine Löschung durch alte Sitzung.
- KAS-Speicher: Ressourcenkennung, Empfänger-/Besitzerbindung, HEAD-Metadaten,
  Quoten und Ablauf einschließlich einstündiger Karenz.

**Nachweisgrenze:** Lokale, fiktive Test-PKI; keine produktiv vertrauten
Trust-Center-/TI-Zertifikate. Kein TI-Konnektor, keine SMC-B und kein KIM-Netzverkehr.
Die zusätzlichen KIM-Tests prüfen Speicher- und Protokollkern, keine vollständige
gematik-Konformität. Quellen-/Vertrags-/Teilnahme-/E2E-Freigaben im DTA-Pakettest
bleiben Fixtures. Die PostgreSQL-Reservierung und Übergabe an den eigenen Dienst
sind nicht implementiert. Unabhängige Prüfung und Inbetriebnahme bleiben offen.

Die 13 neuen MJS-Quelldateien werden durch die nativen Prüfläufe eingelesen;
zusätzlich erfolgt `node --check`. Web-/Android-Oberflächen wurden in diesem
Inkrement nicht verändert. Vercel-Buildstatus wird getrennt am neuen Commit
ausgelesen; grüne Builds älterer Commits werden nicht übertragen.

| Bereich | Nachweis |
| --- | --- |
| Dateiaufbau | Vollständige erwartete PLGA-/PLAA-Referenzdatei mit einem fiktiven Beratungsfall |
| Auftragsdatei | 348 Bytes, feste Positionen, Byteanzahl, deutsche Ortszeit und getrennte Empfängerrollen |
| Zeichensatz | Latin-1, Umlaute, EDIFACT-Aufhebungszeichen, Ablehnung nicht darstellbarer Zeichen |
| Parser | Abgebrochene Segmente, falsche Zähler, doppelte/falsche Referenzen |
| Fachprüfung | Beträge, Dubletten innerhalb des Pakets, Nachweise, Beschäftigtennummern, Steuer- und Versionsgrenzen |
| Berechnung | Sechs Zeit-Einheiten, anteilige/angefangene Einheiten, Kilometergrenzen, fünfstellige Punktwerte, halbe Centbeträge und Überlaufablehnung |
| Pflegeprofile | Tatsächliche Endzeit, Halbtag mit eigenem Vertragspreis, Nachtpflege über Mitternacht, expliziter Folgetag, stationäre Tagesbereiche/Abwesenheit, Monatspauschale mit ESK 99, Schaltjahr, Überschneidungen, Anbietergruppe und DiPA-Zeitart |
| Monatliche Quellen | Originaler Positionstag bleibt erhalten, vollständiger Quellrechnungszeitraum erforderlich, einzelner Einsatznachweis reicht nicht für eine Monatspauschale |
| Zuschläge/Abzüge | Prozent/fester Betrag, unveränderter Basisbetrag, einzelne Cent-Rundung, Vorzeichen, ZUS-Feldpositionen und Ende-Kennzeichen, fünf Dezimalstellen, Tarifbereiche, Pflichtangaben, negative Summen, Feldgrenzen und weiterhin genauer Quellrechnungsabgleich |
| Routing | Mehrstufige Zuordnung, Ablaufdaten, falscher Übermittlungsweg, Mehrdeutigkeit, UEM-Gültigkeit, VZD-Kennzeichen |
| Rückmeldemodell | Korrelation, wiederholte Zustellmeldung, unzulässige Statussprünge |
| Export-API | Authentifizierung, Berechtigung, kein vom Client eingereichter Dateikörper, Mandant, Revision und parallele Änderung |
| Quellen | Rechnung und vollständige Positionen, Steuer, Datum, Person, Revisionen, Leistungsdauer, Nachweisauswahl und Hash |
| Original-PDF | Tatsächliche Byteprüfung, geänderte/fehlende PDF, Größenlimit, fremde Pfade, Traversal und URL-Ablehnung |
| Fehlerausgabe | Keine Nutzdaten bei Fehlern, keine Details aus internen Ausnahmen, kein alternativer Versandpfad |

## Vorherige Erweiterung am 20.10.2026 (943ceaa)

Die 87 Tests wurden nach den Änderungen an Hilfsmitteln, Sondervereinbarungen,
Quellprüfung und Transportvorbereitung vollständig erneut ausgeführt. Sie enthalten
23 neue Tests gegenüber dem vorherigen Stand mit 64 Tests:

- HIL-Feldfolge, Einzelsteuer, enthaltene Steuer ohne doppelte Addition,
  ausdrückliche Befreiung, Genehmigung, reservierte Schlüssel, Wiedereinsatz,
  Produktnummer, Mengen und Zuzahlungen.
- Steuerpflichtige Quellübernahme und tatsächlicher Prüfexport-API-Handler:
  exakter Abgleich von Netto, Steuer, Brutto, Stückpreis, Menge und Steuersatz;
  geänderte Werte liefern keine Datei.
- Sonderprofile 08/11/12/14, Bewilligungs-/Vertragszeitraum, Fallhöchstbetrag,
  Vereinbarung zum Datenaustausch und vollständige Monatspauschale.
- DTA-AUF mit tatsächlicher Ciphertext-Länge, falsche Signatur-/Empfängerbindung,
  KIM-Dateiname, MIME-Anhang, DSN-Optionen, Größen-/UTF-8-Grenzen, manipulierte
  Dateien/Empfänger und veraltete Prüfstände.
- Gleichzeitige Versandversuche, Timeout, fehlende Quittung, Speicherfehler nach
  Versand und fehlender Provider: kein blinder zweiter Aufruf.

**Grenze der damaligen 87 Transporttests:** Kryptografie, XSD-/CMS-Prüfung, Provider und
atomarer dauerhafter Journalzugriff sind injizierte Testdoubles. Der Prüflauf
belegt die Aufruf- und Ablehnungslogik, keine echte Verschlüsselung, SMC-B-Signatur,
dauerhafte Outbox, Annahmestellenvalidierung oder Ende-zu-Ende-Übermittlung.

Die 11 geänderten/neuen TS-/TSX-Dateien wurden zusätzlich mit dem bereits in
Playwright vorhandenen Babel-Transform verarbeitet. Das ist eine Syntaxprüfung,
kein TypeScript-Typcheck. Die lokale Umgebung enthält diesmal weder den Compiler
noch die React-/happy-dom-/esbuild-/PGlite-Abhängigkeiten der früheren Zusatzläufe.
Gemäß `AGENTS.md` wurde nichts installiert. Die folgenden DOM-/Datenbank-/gezielten
Typprüfungen stammen daher aus dem vorherigen Stand und sind **kein neuer Nachweis
für diese Erweiterung**. Der neue vollständige Build wird über die bestehende
Vercel-Anbindung geprüft; Ergebnis siehe PR #129.

Die verbundene Tabelle `public.ti_providers` war am 20.10.2026 leer. Kein DTA-/KIM-
Dienst ist in den vorhandenen Edge-Funktionen implementiert. GitHub-Zugriff ist
verfügbar; der Vercel-Pluginzugriff auf das Projektteam liefert 403 wegen fehlendem
Scope. Die Vorschau bleibt geschützt. Es erfolgte kein erneuter Passkey-/Login-
Versuch; eine visuelle Prüfung der neuen Eingabefelder ist weiter offen.

## Frühere Zusatzprüfungen (Stand vor dieser Erweiterung)

Zusätzlich wurden **19 Datenbankfälle (20 Testeinträge einschließlich Suite)** mit der bereits vorhandenen PGlite-Laufzeit auf PostgreSQL 17.5 ausgeführt:

```bash
node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/database.mjs /pfad/zur/vorhandenen/pglite/dist/index.js
```

Alle drei tatsächlichen GKV-Migrationen werden im Arbeitsspeicher ausgeführt. Geprüft sind RLS, Mandanten-/Portal-/Rollenwechsel, entzogenes Direkt-Schreibrecht, private Wiederholungsquittungen, idempotente Aufträge, Inhaltskonflikte, Revisionen, Fremdrechnungen, Profilrevisionen, Abbruch bei ungültigen Quellen und fehlende Berechtigung öffentlicher RPCs. Die Revisionsmigration wird im Test nach dem ersten Paket angewendet: Übernahme des vorhandenen Stands, spätere unveränderte Historie, Datenstand-Hashes, Herkunftsverknüpfung, neue Entwurfskennung, zurückgesetzte Bestätigungen, wiederholte Kopieraufträge und Seiten über 20 Revisionen werden tatsächlich in PostgreSQL geprüft. Authentifizierte Benutzer können die Historie weder ändern noch löschen oder ergänzen; Portal-, Fremdmandanten- und anonyme Zugriffe scheitern. Die Tests für veraltete Revisionen verwenden aufeinanderfolgende Konflikte; ein Lasttest konkurrierender Datenbankverbindungen ist damit nicht belegt.

In dieser isolierten Datenbanksuite sind Office-Helfer und Auth-Claims ausdrücklich
Vertragsdoubles. Ergänzend bestehen **fünf Integrationsszenarien** mit den
tatsächlichen vorhandenen Office-SQL-Funktionen und dem GKV-API-Handler:

```bash
node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/office-flow.mjs /pfad/zur/vorhandenen/pglite
```

Geprüft: Entwurf aus Leistungs-/Nachweisdaten, Ausstellen über Office-RPCs,
Quellübernahme, GKV-Speicherung, EDIFACT-/AUF-Bytes und SHA-256; Ablehnung
geänderter Dokumente, Unterschriften, Leistungsabschlüsse und Attestierungen;
fehlende/geänderte Original-PDFs sowie Änderungen während des Exports;
entzogene Rechte, inaktive Profile, Portal-/Fremdmandanten-/anonyme Zugriffe;
historische Kopie mit zurückgesetzter Nachweisbestätigung und erneuter Prüfung.
Der Legacy-Einsatzpfad wird tatsächlich durch die Office-Nachweisprüfer geführt.
Auth-Claims, HTTP/Storage-Transport und PDF-Erzeugung sind Doubles. Der alternative
Assist-Visit-Nachweispfad und echte Supabase-Auth-/PostgREST-Requests sind damit
nicht belegt. Im Remoteprojekt wurden keine fachlichen Testdaten angelegt.

Die echten Komponenten `CaseEditor` und `RevisionHistory` wurden zusätzlich mit den vorhandenen React-/happy-dom-/esbuild-Paketen bedient (`editor-check.mjs`): Zeitberechnung, ungültiger Geldwert und Korrektur, Kilometer, Rückkehr zur Wegepauschale, Punktwerte und Entfernen der Punktregel, erneute Quellübernahme, Zuschlag/Abzug mit ungültiger Eingabe/Korrektur/Entfernen bestanden. Neu geprüft sind halber Pflegesatz ohne automatische Halbierung, Nachtpflege-Folgetag, Tageszählung aus Von/Bis, Monatspauschale mit Kennzeichen 99 und Rücksetzen ungeeigneter Angaben beim Profilwechsel. Historie: Nachladeaktion, schreibgeschützter Stand, Auswahl einzelner Fälle, erforderliche Übernahmebegründung, Leser ohne Kopieraktion, Ladefehler/Wiederholung und Schließen bestanden. Transportcallbacks der Historienoberfläche sind ausdrücklich Doubles. **Dies sind DOM-Funktionsprüfungen, keine visuellen oder vollständigen Ende-zu-Ende-Prüfungen.**

Ein gezielter strenger TypeScript-Check für Fachkern einschließlich Pflegeprofilen, Quellprüfung, Export-API, `GkvEditors.web.tsx` und `GkvRevisionHistory.web.tsx` mit den vorhandenen echten Node-/React-Typen besteht. Er umfasst nicht den gesamten Expo-Abhängigkeitsbaum. Die beiden im Vercel-Log gemeldeten Fehler wurden mit Commit `a1e122d` korrigiert: explizite Env-Felder und ein ausdrücklich als `string` deklarierter Request-Identifier. Am 20.10.2026 meldeten alle vier Vercel-Projekte für den vorherigen Stand `4f28da4` erfolgreiche Deployments. Dieser Build enthält die Pflegeprofile, aber noch nicht die in diesem Dokument neu beschriebenen Hilfsmittel-/Sonder- und Transportänderungen.

Die TSX-/TypeScript-Quelldateien der neuen Oberfläche, der Eingabekomponenten,
des Datenzugriffs und der geänderten Rechnungsnavigation wurden mit dem bereits
in Playwright enthaltenen Babel-Parser und Transform geprüft. Das belegt
syntaktische Verarbeitbarkeit, **keinen vollständigen TypeScript-Typcheck**.

Die drei GKV-Migrationen wurden am 19.10.2026 im verbundenen Projekt
`euagyyztvmemuaiumvxm` angewendet. Anschließend wurden die bestätigten Versionen
`20261019214752`, `20261019214757` und `20261019214802`, Tabellen, RLS,
direkte Rollenrechte, RPC-Ausführungsrechte und feste Suchpfade ausgelesen.
Alle fünf öffentlichen Tabellen haben RLS und keine direkten Schreibrechte für
Anwendungsbenutzer. Öffentliche RPCs laufen als Invoker; anonyme Aufrufe haben
kein Ausführungsrecht. Die private Quittungstabelle ist direkt unzugänglich.
Die Advisor-Zahlen auf Warnstufe blieben unverändert. Hinzu kam ausschließlich
der erwartete Infohinweis `rls_enabled_no_policy` für die absichtlich direkt
gesperrte private Quittungstabelle. Bestehende, nicht durch GKV eingeführte
Advisor-Warnungen wurden nicht geändert.

## Nicht ausgeführt / noch erforderlich

- **Visuelle Prüfung und Browserinteraktionen:** Die tatsächliche Vercel-Vorschau
  wurde im vorhandenen Cloud-Browser geöffnet und leitet zur Vercel-Anmeldung
  weiter. Der lokale Umgebung fehlt außerdem Chromium; gemäß `AGENTS.md` wurde
  keine zusätzliche Software installiert. Damit liegen keine Screenshots oder
  Layoutfreigabe für die neue Oberfläche vor.
- **Vollständiger Projektbuild und Typcheck:** Die Projektabhängigkeiten sind in
  dieser Arbeitsumgebung nicht vollständig vorhanden. Die zusätzliche Babel-
  Prüfung ersetzt weder Metro/Expo-Build noch `tsc`.
- **Supabase-Integration:** Migrationen sind remote angewendet und katalogseitig geprüft. Der vollständige Weg mit echter Anmeldung, Office-Autorisierung, PostgREST und Storage bleibt erforderlich. Die tatsächlichen Office-Nachweisprüfer sind im isolierten Integrationslauf für den Legacy-Einsatzpfad geprüft. Das vorhandene Stagingprojekt benötigt zuvor die aktuelle Office-Rechnungsstruktur.
- **Echte Dienstintegration:** DTA-Kryptografie, lokaler TLS-/STARTTLS-Transport
  und dauerhafte lokale Outbox sind neu tatsächlich getestet. Kanonischer
  Supabase-Versandablauf, Annahmestellenverkehr, SMC-B/KIM-TI und fachliche
  Ende-zu-Ende-Abnahme bleiben offen. Die Test-PKI ist keine amtliche Freigabe.

## Verbindliche Abnahme vor dem Zusammenführen

1. Bestehenden Web-Build und Typcheck ausführen.
2. Migration im vorgesehenen Test-/Releaseablauf prüfen. Owner, berechtigter
   Office-Leser, Office-Ersteller, Benutzer ohne Recht und Portalzugang testen.
   Mandantenwechsel, Null-Mandant und fremde Rechnungsreferenzen einschließen.
3. Derselbe Auftrag muss dasselbe Ergebnis ohne zweite Mutation liefern;
   abweichender Inhalt unter derselben Auftragskennung muss scheitern. Parallele
   Speicherungen mit gleicher Revision dürfen höchstens einmal erfolgreich sein.
4. Oberfläche bei breitem Fenster, geöffneter Navigation, schmalem Bereich und
   vergrößerter Schrift prüfen. Keine horizontalen Überläufe oder überdeckten
   Aktionen; Speicher-, Fehler-, Leer- und Ladezustände sowie Tastaturbedienung prüfen.
5. Paket anlegen, Profil speichern, Rechnung übernehmen, Positionen ergänzen,
   speichern, Prüfdateien erzeugen/herunterladen und nach Neuladen wieder öffnen.
   Zuschläge anhand vertraglich freigegebener Referenzfälle prüfen. Frühere
   Paketstände ansehen, nachladen und mit Begründung in einen neuen Prüfentwurf
   übernehmen; Original, Herkunft und zurückgesetzte Nachweisbestätigung prüfen.
   Unvollständige Zahlen, veraltete Rechnungen und fehlende Nachweise müssen
   die vorgesehenen Aktionen blockieren.
6. Rollen-/Mandantenwechsel während laufender Requests darf keine fremden Daten
   anzeigen oder Downloads aus dem alten Arbeitsbereich auslösen. Ungespeicherte
   Änderungen und ein unklarer Speicherausgang müssen erkennbar bleiben.
7. Freigegebene amtliche Testfälle gegen einen unabhängigen Validator und die
   Annahmestelle prüfen. Die verbleibenden Fachprofile und Versandanschlüsse aus
   `implementation.md` sind weiterhin gesondert umzusetzen.

**Freigabeentscheidung:** Draft-Review geeignet; produktiver Echtbetrieb und
vollständige Ende-zu-Ende-Funktion derzeit nicht belegt.
