# KIM-Nachrichtenaufbau und Empfang

Stand: 21.10.2026. Interner, lokal geprüfter Entwicklungsbaustein für Nachrichten
mit eingebettetem Inhalt und `X-KOM-LE-Version: 1.0`. Kein zugelassenes Clientmodul
und keine Freigabe für den CareSuite-Echtversand.

## Implementierter Ablauf

`services/kim/client-message.mjs` verbindet den [ECC-CMS-Kern](ecc-cms.md) mit
der äußeren Transportnachricht. `createEccKimMessage` erhält die ursprüngliche
MIME-Nachricht, MAIL-FROM-Absender, separate SMTP-Empfänger, deren ENC-Zertifikate
einschließlich Senderkopie sowie OSIG-/AUT-Zertifikate und Software-Schlüssel.
Produkt- und Produkttypversion müssen ausdrücklich übergeben werden. Die
Testkennung `TEST_0.1.0` weist keine VendorID oder Zulassung zu.

Der Erzeuger:

1. Vergleicht From/Sender mit MAIL FROM. To/Cc/Bcc dürfen nur ausdrücklich
   übergebene SMTP-Empfänger enthalten; nicht sichtbare SMTP-Empfänger sind
   möglich. Die Menge der Zertifikatsadressen muss genau Sender plus
   SMTP-Empfänger abdecken. Mehrere Zertifikate pro Adresse sind weiterhin möglich.
2. Erzeugt fehlende Date-/Message-ID-Felder einmalig. Ersetzt alle alten
   X-KIM-Auth-, CMVersion- und PTVersion-Felder, auch mehrfach übergebene Tokens.
   Vom Aufrufer behauptete Entschlüsselungs-/Integritätsergebnisse und
   Fehlervermerke werden zurückgewiesen.
3. Erstellt ein tatsächlich signiertes BP256R1-JWT mit AUT-Leaf, nbf, frischer
   UUID, Produktkennung, Absender und Audience. Schlüsselzugehörigkeit, Curve,
   Gültigkeit, AUT-Policy und digitalSignature-KeyUsage werden geprüft.
4. Fügt diesen Token vor der CMS-Signatur in die vorbereitete Originalnachricht
   ein. Anschließend erfolgen OSIG-Signatur, TI-ECIES-Schlüsseltransport und
   AES-GCM-Verschlüsselung.
5. Kopiert Date, From, Sender, Reply-To, To, Cc, Bcc, Message-ID, gegebenenfalls
   Expires und sämtliche X-KIM-Felder in die äußere Nachricht. Der äußere Betreff
   ist fest; der ursprüngliche Betreff und Body liegen im verschlüsselten Inhalt.
6. Kodiert den Container als Base64 mit 76 Zeichen pro Zeile. Prüft anschließend
   tatsächliche Gesamtgröße, Headergröße, Headeranzahl und physische Zeilenlängen.

Das Ergebnis enthält die Wire-Bytes, SMTP-Adressen, Message-ID und SHA-256 der
vorbereiteten geschützten Nachricht. Die Eingabe wird nicht verändert. Der Body
bleibt bytegleich; der geschützte Header enthält die neu erzeugten Metadaten.
Die Erstellung muss **vor der dauerhaften Versandablage** erfolgen. Für einen
Transportwiederholungsversuch sind genau die gespeicherten Bytes zu verwenden.
Erneutes Erzeugen erzeugt einen neuen Token und andere Ciphertextbytes; unter
derselben Message-ID würde dies mit dem bestehenden FD-Wiederholungsjournal
kollidieren. Eine späte Wiederholung nach AUT-Ablauf bleibt ein offener
betrieblicher Auflösungsfall.

## Empfang und Vertrauensgrenze

`openEccKimMessage` prüft die äußere MIME-Hülle, entschlüsselt und prüft die
mathematische OSIG-Signatur gegen ein ausdrücklich angegebenes Zertifikat.
Anschließend vergleicht es die kopierten Header mit der signierten inneren
Nachricht. Hinzugefügte, fehlende, veränderte und doppelte geschützte Felder
werden zurückgewiesen. From und sichtbare Empfänger müssen in der geschützten
Zertifikats-/Adresszuordnung vorkommen.

RFC-5322-Unfolding entfernt CRLF und erhält die folgenden Leerzeichen/Tabulatoren.
Der Vergleich verändert keine Leerzeichen in Anführungszeichen. Bei AUT-Tokens
wird zusätzlich das für lange Tokenfelder notwendige Folding entfernt. Innere
und äußere Tokenwerte müssen identisch sein. Der Empfangsprüfer kontrolliert
die echte Signatur, das explizit erwartete AUT-Zertifikat, Audience, Absender,
UUID, Produktkennung und einen nicht zukünftigen Gültigkeitsbeginn.

Der Empfangsprüfer verwendet **nicht** die TTL_MSG_AUTH der SMTP-Annahme.
Eine zwei Tage später abgeholte Nachricht ist deshalb nicht allein wegen des
Tokenalters ungültig. Zertifikatsgültigkeit wird weiterhin zum Prüfzeitpunkt
kontrolliert. Historische Sperr-/Vertrauensevidenz ist noch nicht implementiert.

Das erfolgreiche interne Ergebnis enthält den geschützten Klartext und
`headerIntegrity: matched`, aber stets `identityStatus: unverified` sowie
`deliveryStatus: held-for-trust-validation`. Diese Werte erlauben die interne
Diagnose, keine normale Clientzustellung und keine Rechnungsfreigabe. Es werden
keine positiven X-KIM-IntegrityCheckResult-Vermerke erzeugt. Eingebettete
Zertifikate ersetzen weder TSL/OCSP noch die Telematik-ID-/VZD-Adressbindung.

Fehler werfen `KimMessageError` mit begrenztem Code und Verarbeitungsphase.
Diese Fehler enthalten weder Nachrichtentext noch Tokens, Schlüsselparameter
oder die ursprüngliche Exception. Nach einem Fehler wird kein Klartext
zurückgegeben. Der separate [Diagnosepfad](kim-receive-errors.md) ergänzt lokale
Fehler-MIME-Nachrichten, referenzierte Prüfberichte und eine ausdrücklich zu
aktivierende Originalanhangoption. Dieser Pfad gibt keine normale Zustellung frei.

## Unterstützte Teilmenge

- Maximal 100 SMTP-Empfänger, 1.000 ENC-Zertifikate, 15.000.000 vorbereitete
  Originalbytes und 21 MiB fertige Wire-Nachricht. Header: höchstens 64 KiB,
  500 physische Zeilen und 998 Zeichen je Zeile. Die vom AccountManager zu
  beziehenden individuellen Kontogrenzen fehlen noch.
- ASCII-Header, einschließlich bereits kodierter Displaynamen/Betreffwerte;
  einfache KIM-Adresslisten mit optionalen Displaynamen. Keine Gruppen,
  Kommentare, SMTPUTF8-Header oder allgemeine RFC-5322-Adressgrammatik.
- From enthält genau eine Adresse. Reply-To darf mehrere KIM-Adressen enthalten.
  Die strenge Headergleichheit umfasst auch Date/Message-ID/Bcc/X-KIM-Felder;
  dies ist enger als der minimale Empfangsvergleich von From/Sender/Reply-To/To/Cc.
  Zusätzliche äußere X-KIM-Felder ohne innere Kopie werden nicht akzeptiert.
- Dienstkennung, Konnektorversion und fachliche Nutzkomponenten werden nicht
  erfunden. Dienst-/Fachprofilprüfung, Produktregistrierung und die tatsächliche
  Konnektoranbindung fehlen. Ein fehlendes Dienstkennungsfeld wird hier nicht
  durch eine vorgetäuschte GKV-Kennung ersetzt.
- Der innere SignedData-MIME-Part kann binär oder streng Base64-kodiert sein;
  Groß-/Kleinschreibung, Reihenfolge und Folding der MIME-Header sind variabel.
  Der message/rfc822-Part unterstützt 7bit, 8bit und binary. Base64 bei
  message/rfc822, nicht unterstützte Transferkodierungen und mehrdeutige
  MIME-Parameter werden abgelehnt. Neue Nachrichten deklarieren binary explizit.
- Der ursprüngliche Body bleibt opak. Es gibt noch keine allgemeine
  Multipart-/Anhangsvalidierung, KAS-Verarbeitung, Fach-XML-/PDF-/XSD-Prüfung,
  Virenprüfung oder Zulassungsbewertung für Nutzkomponenten.
- Der neue Empfangspfad benötigt immer ein passendes ECC-AUT-Token und das
  explizit erwartete Leaf. Die vollständig VZD-abhängige Entscheidung, wann
  ein AUT-Check beim Empfang notwendig ist, bleibt offen. Die bisherige
  RSA-PSS-Unterstützung des FD-Prüfers bedeutet keine RSA-Freigabe dieses Pfads.
- Received/Return-Path der äußeren Nachricht werden nicht als signierte
  Identitätsnachweise gewertet. Ihre normative Übernahme in eine später an den
  Mailclient ausgelieferte Nachricht ist noch nicht Teil dieses Diagnosepfads.

Der Versandworker bleibt für KIM gesperrt. TI-/SMC-B-Anbindung, vollständige
Vertrauensprüfung, externe FD-Weiterleitung, kanonische CareSuite-Freigabe und
unabhängige Prüfung/Zulassung bleiben erforderlich.

## Anforderungszuordnung und Prüfbelege

| Quelle / Anforderung | Lokaler Nachweis | Verbleibende Voraussetzung |
| --- | --- | --- |
| CM A_28582, A_21388-04 | Echter ECC-AUT-Token, frische UUID, Versionsformate, einmaliger Header vor CMS-Signatur | SMC-B/HBA/HSM-Anbindung, zugelassene Produktdaten und TID-/Adressbindung |
| CM A_23174-03, KOM-LE-A_2022-02 | Abgleich von SMTP-Empfängern, sichtbaren Adressen und ENC-Zertifikatsadressen | Vertrauenswürdige VZD-Suche, Mehrfach-TID- und Zertifikatspaarbehandlung |
| S/MIME KOM-LE-A_2097 bis _2104, CM KOM-LE-A_2193 | Innere/äußere Nachricht, Headerkopien, Message-ID, Betreff, MIME-Typen | Vollständige MIME-/Profilinteroperabilität, KAS |
| CM KOM-LE-A_2048-02 | Signaturmathematik, recipient-emails, Headervergleich, eigener AUT-Empfangsprüfer ohne FD-TTL | Vollständige Pfad-/Sperrprüfung, VZD, Konnektor und normative Fehlerausgabe |

16 neue Tests in `kim-client-message.test.mjs` und ein zusätzlicher MIME-Test
im ECC-Test prüfen tatsächliche Schlüssel und Nachrichten. Der SMTP-/POP3-Test
verwendet jetzt ebenfalls den neuen Erzeuger samt AUT und den neuen Empfänger:
Wire-Bytes bleiben im Mailstore/Inbox identisch, der geschützte Nachrichtenhash
stimmt nach Entschlüsselung überein, der ursprüngliche Body bleibt bytegleich.
Die vorhandene Wiederholung nach POP3-Löschung erzeugt weiterhin keine Dublette.

Beim Nachrichteninkrement: **179/179 bestanden**, keine übersprungenen Fälle;
mit dem danach ergänzten Fehlerpfad sind es **198/198**. Keine Installation
zusätzlicher Pakete/Container, keine Produktionsdaten oder echten Empfänger.
Der Vorgängercommit `280be44` hat vier erfolgreiche Vercel-Builds; der jeweilige
neue Commit wird unabhängig davon geprüft.

Quellen:

- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/)
- [gemSMIME_KOMLE 1.8.0](https://gemspec.gematik.de/docs/gemWeitere/gemSMIME_KOMLE/gemSMIME_KOMLE_V1.8.0/)
- [RFC 5322, Unfolding](https://www.rfc-editor.org/rfc/rfc5322#section-2.2.3)
- [RFC 2046, message/rfc822](https://www.rfc-editor.org/rfc/rfc2046#section-5.2.1)
