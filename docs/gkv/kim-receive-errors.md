# KIM-Empfang: Fehlernachrichten und Originalbelege

Stand: 22.10.2026. Ausführbarer interner Empfangsbaustein, noch kein freigegebener
KIM-Client und keine vollständige Umsetzung aller Clientmodul-Fehlerprofile.

## Schnittstelle und Verhalten

`receiveEccKimMessage(options, reportOptions)` ergänzt den strikten Prüfer
`openEccKimMessage`. `options` enthält die gespeicherten Originalbytes, das
abholende Postfach, dessen ENC-Zertifikat/Schlüssel und die erwarteten
OSIG-/AUT-Zertifikate. `reportOptions` enthält die eigene CM-/Produkttypversion
und die optionale Einstellung `includeDecryptedOriginal`, standardmäßig `false`.

Die asynchrone TSL-Fassade bietet zusätzlich den ausdrücklich gewählten
[Kartenempfang](konnektor-card-receive.md) ohne Software-Schlüssel. Er verbindet
die echte SOAP-Aufrufkette mit derselben lokalen Diagnoseausgabe und kann einen
zum Aufruf gebundenen negativen VerificationReport anhängen.

Der Aufrufer muss zunächst das unveränderte Transportoriginal dauerhaft in der
Inbox sichern. Die Funktion ersetzt diese Ablage nicht und nimmt selbst keine
Netzwerk-, Lösch- oder Rechnungsstatusänderungen vor. Im Integrationstest stammen
die Bytes aus dem vorhandenen mTLS-SMTP-/Mailstore-/mTLS-POP3-/Inbox-Ablauf.

Eine Nachricht ohne X-KOM-LE-Version wird bytegleich als `unprotected`
zurückgegeben. Vorhandene positive X-KIM-Vermerke werden dabei nicht als
Vertrauensnachweis interpretiert. Nachrichten mit Versionsfeld werden geprüft
oder in eine lokale MIME-Diagnose umgewandelt. Auch eine im eigenen Kryptokern
erfolgreich geprüfte Nachricht erzeugt derzeit Ergebnis 07: Die ausstehende
TI-Vertrauensprüfung darf nicht als erfolgreiche Gesamtprüfung erscheinen.

Das Ergebnis besteht aus den erzeugten Bytes, dem SHA-256 des Transportoriginals
und begrenzten Diagnosedaten. Diagnosen tragen `identityStatus: unverified` und
`deliveryStatus: diagnostic-only`. Sie werden nicht automatisch an den Absender
oder einen anderen Empfänger gesendet. Eine normale Clientzustellung und der
CareSuite-KIM-Versandworker bleiben gesperrt.

## Zuordnung der Fehler

| Tatsächlich festgestellter Zustand | X-KIM-Fehlermeldung | Ergebnisfeld |
| --- | --- | --- |
| Nicht unterstützte KIM-Version | 4008 | Kein behauptetes Entschlüsselungsergebnis |
| ENC-Zertifikat oder privater Schlüssel ausdrücklich nicht vorhanden | 4009 | DecryptionResult 01 |
| Ungültige äußere MIME-/CMS-Struktur | 4010 | DecryptionResult 02 |
| Noch nicht unterstützte CMS-Variante | XCS_PROFILE | DecryptionResult XCS_PROFILE |
| Abholendes Postfach fehlt in der Zertifikatszuordnung | XCS_RECIPIENT | DecryptionResult XCS_RECIPIENT |
| Authentisierte Entschlüsselung gescheitert, Ursache nicht eindeutig | XCS_DECRYPT | DecryptionResult XCS_DECRYPT |
| Innere Signatur/Attribute/Zertifikatsbindung nicht erfolgreich geprüft | XCS_INTEGRITY | IntegrityCheckResult XCS_SIGNATURE |
| Header- oder Empfängerbindung fehlgeschlagen | XCS_INTEGRITY | IntegrityCheckResult XCS_HEADER |
| Erforderliche AUT-Tokenprüfung fehlgeschlagen | XCS_INTEGRITY | IntegrityCheckResult 10 |
| Optional übergebener OSIG-/AUT-Status gesperrt, unbekannt oder nicht prüfbar | XCS_CERT_STATUS | IntegrityCheckResult XCS_CERT_STATUS |
| Erforderliche VZD-Absenderzuordnung fehlt oder ist widersprüchlich | XCS_DIRECTORY | IntegrityCheckResult XCS_DIRECTORY |
| Konnektor-Dokumentenprüfung negativ, widersprüchlich oder nicht auswertbar | XCS_DOCUMENT | IntegrityCheckResult XCS_DOCUMENT |
| Abschließende Karten-/Zertifikats-/PIN-Nachprüfung fehlgeschlagen | XCS_CARD_STATUS | IntegrityCheckResult XCS_CARD_STATUS |
| Lokale Prüfungen bestanden, TI-Vertrauen noch nicht bestätigt | XCS_TRUST | IntegrityCheckResult 07 |

Ein falscher Schlüssel oder beschädigter GCM-Tag wird nicht als sicher
nachgewiesenes Fehlen eines Schlüssels ausgegeben. Die standardisierten
Integritätscodes 08/09 setzen weitere Zertifikatsnachweise voraus; sie werden
deshalb hier nicht vorgetäuscht. Ergebnis 00 besagt ausschließlich, dass die
authentisierte Entschlüsselung gelang. Ergebnis 01 für erfolgreiche vollständige
Integritätsprüfung wird durch diesen Pfad nicht erzeugt.

Die optionale [OCSP-Anbindung](ocsp.md) prüft nun echte Statusantworten gegen
die tatsächlich verwendeten OSIG-/AUT-Zertifikate und konfigurierte Signierer-Pins.
Der Bericht enthält die getrennten Befunde und Antworthashes. Zwei positive
lokale Befunde bleiben Ergebnis 07; sie ersetzen keine TI-TSL/VZD-Prüfung.

Mit konfiguriertem Verzeichnis entscheidet die asynchrone Fassade anhand von
OSIG-Status und VZD-ID, ob AUT erforderlich ist. Bei passender OSIG-ID enthält
`certificateStatus` nur den OSIG-Befund. Ein übersprungenes AUT wird nicht als
positiv ausgewiesen. Bei abweichender ID bleiben fehlende/doppelte/ungleiche
oder kryptografisch ungültige Tokens Ergebnis 10; negativer AUT-Zertifikatsstatus
wird als `XCS_CERT_STATUS`, eine fremde AUT-ID als `XCS_DIRECTORY` ausgewiesen.
[Ablauf und verbleibende normative Grenzen](conditional-aut-receive.md).

## Aufbau der Diagnose

Versions-/Entschlüsselungsfehler erzeugen multipart/mixed mit genau einem
UTF-8-Textteil in Quoted-Printable und einer message/rfc822-Kopie der unveränderten
Transportnachricht. Absender-/Datums-/Adressfelder und X-KIM-Metadaten stammen,
soweit eindeutig und auswertbar, aus deren äußeren Headern. Bei ungültigen
Headern erzeugt der Baustein einen an das abholende Postfach adressierten
Diagnoseumschlag. Mehrdeutige Felder werden nicht als aktive Header übernommen.
Der Originalanhang bleibt vollständig erhalten.

Integritätsdiagnosen übernehmen die auswertbaren Header der entschlüsselten
Nachricht. Ihre alte MIME-Struktur, Betreffzeile und behauptete Prüfergebnisse
werden durch die Diagnose ersetzt. Jede Diagnose erhält eine neue UUID.
IntegrityCheckRefID kommt genau einmal vor; alle Anhänge tragen diese UUID.
Ein eigener JSON-Bericht enthält Fehlercodes, Originalhash, Größenangabe,
Verarbeitungszeitpunkt und ausgelassene Headernamen. Er enthält keine Tokens,
Originaltexte oder nativen Kryptografie-Exceptions und ist kein Konnektorbericht.

Ein entschlüsselter Originalanhang wird nur bei ausdrücklich gesetzter Option
angefügt. Er erhält den Namen `<Referenz>.eml` und einen Hinweis auf seinen
ungeprüften Inhalt. Standardmäßig enthält die Diagnose keinen Originalbody.
Diese Option gilt auch für einen lesbaren Inhalt mit abgelehnter innerer
Signatur. Sie erlaubt keine normale fachliche Weiterverarbeitung.

Der dafür eingeführte interne `inspectEccKimPayload` authentisiert zuerst GCM.
Erst danach kann er einen noch unbestätigten RFC822-Inhalt für den Diagnoseanhang
extrahieren. Bei GCM-Fehlern gibt es keinen Klartext, auch nicht mit aktivierter
Anhangsoption. Bei unlesbarem SignedData gibt es keinen vorgetäuschten
Originalanhang. Die strikten Funktionen `openEccKimPayload` und
`openEccKimMessage` werfen bei Prüfungsfehlern weiterhin ohne Klartextrückgabe.

Ein bereits vorhandener externer XML-Prüfbericht kann als
`verificationReport: { bytes, sourceSha256 }` übergeben werden. Sein Originalhash
muss zur bearbeiteten Transportnachricht passen. Die Bytes werden unverändert
unter `VerificationReport_<Referenz>.xml` angefügt. Das ist keine XML-/XSD-,
Konnektor-, Signatur- oder Herkunftsprüfung des Berichts. Der Bericht kann
keinen negativen oder ausstehenden Prüfbefund in einen positiven ändern.

Der Kartenpfad nimmt diese externe Option nicht an. Sein XML-Anhang stammt aus
dem tatsächlichen VerifyDocument-Aufruf, nach XSD-, Signaturwert-, Zertifikats-
und Zeitbindung. Er enthält den kanonisierten originalen Berichtsteilbaum.
`connectorReportSha256` und Aufrufmetadaten kennzeichnen ihn gesondert. Ein
unlesbarer, fehlender oder unpassend gebundener Bericht wird nicht ersetzt.

Received wird in der äußeren Reihenfolge übernommen; Return-Path darf höchstens
einmal aus dem Transportoriginal stammen. Innere Return-Path-/Received-Behauptungen
werden entfernt. Doppelte äußere Return-Path-Felder werden ausgelassen und im
Diagnosebericht vermerkt. Diese Transportfelder sind keine signierten Identitäten.
X-KOM-LE-Version fehlt im erzeugten Diagnoseumschlag, damit eine erneute Übergabe
nicht nochmals den Entschlüsselungsweg startet.

## Grenzen und offene Konformität

- Eingangsgrenze 21 MiB; lokale Diagnosegrenze 22 MiB einschließlich Umschlag.
  Ein Original an der SMTP-Grenze wird nicht zur Aufnahme des Fehlerumschlags
  gekürzt. Externe XML-Berichte sind auf 256 KiB beschränkt. Headergrenzen gelten
  auch für erzeugte Diagnosen. Überschreitungen werfen feste Fehlercodes;
  das gesicherte Original muss für die spätere Bearbeitung erhalten bleiben.
- Die MIME-Kodierung erhält auch Binärbytes und abschließende oder fehlende
  CRLFs. Dies belegt noch keine POP3-Clientproxy-Interoperabilität für beliebige
  binäre Originalanhänge. Der externe Fachdienst behält seine bisherige SMTP-Grenze.
- Fehlerstruktur, Zuordnungen und Referenzen orientieren sich an A_28602,
  A_20650-07, A_23165-02 und KOM-LE-A_2046/2047. Die Texte sind derzeit eigene
  Diagnoseformulierungen. Wortgleiche Pflichttexte und die vollständige
  Konnektor-/HSM-/KAS-Fehlermatrix sind vor einer Konformitätsfreigabe noch umzusetzen.
- Es gibt keinen laufenden Clientproxy und keine automatisch versendeten
  Senderfehler nach A_28601. Der interne Kartenempfang kann inzwischen gebundene
  Konnektor-VerificationReports anhängen. Erfolgreiche normale Clientzustellung mit vollständiger
  TI-TSL-/OCSP-/VZD-Prüfung bleibt offen.
- Standardeinstellung und Diagnoseergebnisse sind hier interne Dienstparameter.
  Eine mandanten- und rollenbezogene Bedienoberfläche, betriebliche Freigaben
  für ungeprüfte Anhänge, Virenprüfung und deren Auditierung fehlen noch.
- Es wurden keine Produktionsdaten geändert, keine echten Empfänger kontaktiert
  und keine Installationen vorgenommen. Unabhängige Prüfung und Zulassung fehlen.

## Nachweise

Der ergänzte [Konnektor-Zertifikatsclient](konnektor-certificates.md) bindet
VerifyCertificate-Befunde an tatsächliche SOAP-/mTLS-Anfragen. Die zusätzliche
VerifyDocument-Operation stellt nun gebundene Signaturberichte bereit.
Negative/fehlende Zertifikatsbefunde werden
im konfigurierten Empfang als lokale `XCS_CERT_STATUS`-Diagnose behandelt;
fremde SOAP-Fehlertexte werden nicht übernommen. Die vollständige normative
Konnektorfehlermatrix und normale Clientzustellung bleiben offen.

19 neue Fälle in `kim-receive-error.test.mjs` prüfen tatsächliche ECC-Nachrichten,
GCM- und Signaturmanipulationen, Standard-/Herstellercodes, Headermehrdeutigkeit,
fehlende Schlüssel, explizite Anhangsfreigabe, Originalhashbindung, Replay ohne
Rekursion und Größenlimits. Ein getrennt implementierter MIME-Leser aus Pythons
Standardbibliothek prüft MIME-Struktur, Unicode-Betreff, Quoted-Printable und
Base64. Die rohen RFC822-Anhangsbytes werden zusätzlich exakt verglichen.

Der bestehende echte SMTP-/POP3-Test erzeugt aus dem gespeicherten Original eine
07-Diagnose und eine 4009-Meldung. Die Inbox bleibt unverändert, es wird keine
weitere Mail an den Sender erzeugt, der Wiederholschutz bleibt erhalten.
Beim Diagnoseinkrement: **198/198 bestanden**, ohne übersprungene Fälle;
mit der danach ergänzten OCSP-Prüfung **223/223**.
Die vier Vercel-Builds des Vorgängers `817a673` sind erfolgreich.

Quelle: [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/),
insbesondere A_21390, A_21391-04, A_21236-01, A_20628, A_28602, A_20650-07,
A_23165-02 und KOM-LE-A_2046-02/_2047-03. Die zugeordneten Kennungen sind auch
im [Produkttypsteckbrief](https://gemspec.gematik.de/docs/gemProdT/gemProdT_CM_KOMLE/latest/) enthalten.
