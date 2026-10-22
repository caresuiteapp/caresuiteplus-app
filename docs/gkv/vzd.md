# KIM-Verzeichnisabfrage und Adressbindung

Stand: 22.10.2026. Ausführbarer Entwicklungsbaustein mit echten lokalen LDAPS-,
TSL- und OCSP-Prüfungen. Er bestätigt Zuordnungen gegenüber einem ausdrücklich
konfigurierten Verzeichnis. Der Sender-/Empfängerpfad prüft jetzt zusätzlich
Typ, technische Rolle, ECC-Profil und OCSP-Status des tatsächlichen TLS-Servers
vor LDAP. [Serverprüfung und Grenzen](vzd-server-certificate.md).
Authentisierte TI-Provisionierung und unabhängige Interoperabilität fehlen;
`identityStatus: unverified`, gesperrter Echtversand und reine Empfangsdiagnose
bleiben bestehen.

## Abfrage

`VzdLdapsDirectory` in `services/kim/vzd.mjs` erhält eine feste `ldaps://`-Adresse,
eine ausdrückliche CA-Liste, den SHA-256-Fingerabdruck des Serverzertifikats und
die Umgebung `test`, `reference` oder `production`. Optional kann die
Verbindungs-IP fest vorgegeben werden; Hostname/SNI bleiben dabei unverändert.
TLS prüft Kette und Hostnamen sowie anschließend den konfigurierten Leaf-Pin.
Es gibt keine öffentliche Root-Ausweichliste, automatische Pinübernahme,
Weiterleitung zu LDAP-Referenzen oder unverschlüsselte Rückfallverbindung.
Die höheren KIM-Abläufe übergeben zwingend den Statusclient für die Serverprüfung.
Eine direkte Protokollabfrage ohne diesen Client ist als `not-checked` markiert
und kann keine intern nachprüfbare Serverevidenz liefern.

Eine Verbindung führt einen anonymen LDAPv3-Bind und genau eine Subtree-Suche
unter `dc=data,dc=vzd` aus. Die Suche verbindet einen exakten `mail`-Wert mit
einem `kimData`-Präfix aus Adresse und Komma. Die Filterwerte werden als ASN.1
geschrieben; ein Stern im lokalen Adressteil wird kein Suchplatzhalter.
`komLeData` dient nur der Auswertung, nicht der Suche.

Die Antwort muss mit einem erfolgreichen SearchResultDone enden und genau
einen Eintrag enthalten. Zweite Treffer sind auch bei gleicher ID mehrdeutig.
Teilantworten vor einem Fehler, Suchreferenzen, fremde Message-IDs,
Zusatzoperationen, unbekannte Controls und nicht unterstützte Attribute werden
zurückgewiesen. Fehler enthalten weder LDAP-Diagnosetext noch Originalwerte.

`vzd-ldap.mjs` trennt LDAP-BER von der bestehenden Zertifikats-DER-Auswertung.
Nichtminimale **definite** BER-Längen werden akzeptiert; unbestimmte Längen,
High-Tags und konstruierte Stringvarianten sind nicht unterstützt. Fragmentierte
und zusammengefasste Netzwerkrahmen werden innerhalb derselben Grenzen gelesen.

| Grenze | Umsetzung |
| --- | --- |
| Antwort insgesamt | 2 MiB einschließlich Bind und LDAP-Rahmen |
| Laufzeit pro Verbindung | 50–30.000 ms, Standard 10 Sekunden, keine Verlängerung durch Teilantworten |
| Gleichzeitige Verbindungen | Höchstens acht pro Verzeichnisinstanz |
| Suchtreffer | Angeforderte Obergrenze zwei; genau einer wird akzeptiert |
| Attribute | Telematik-ID, mail, kimData, komLeData, userCertificate mit optionalem binary-Suffix |
| Werte | Genau eine ID, höchstens 1.000 Werte je Adress-/Metadatenattribut, 50 Zertifikate |
| Zertifikate | Höchstens 12.000 Byte je Wert; der Resolver verlangt exakte DER-Bytes |

Die Adresse wird gemäß dem vorhandenen KIM-Adressparser ohne Beachtung der
Groß-/Kleinschreibung verglichen. Die Telematik-ID behält dagegen ihre exakten
Zeichen. `providedBy`, Domain-ID, Zertifikats-Subject und SAN ersetzen keine
Adresszuordnung. Ein passender `kimData`-Eintrag genügt auch bei fehlendem
`mail`. `komLeData` allein genügt nicht. Mehrfachangaben und widersprüchliche
Versionsangaben werden abgelehnt.

Unterstützt sind Versionswerte 1.0/1.5 mit optionalem Pluszeichen; eine reine
Mail-Adresse ohne Versionsdaten erhält 1.0. `appTags` werden begrenzt gelesen
und ausgegeben. Daraus entsteht keine Anwendungs- oder KAS-Freigabe. Die
bestehende Nachrichtenimplementierung verarbeitet weiterhin nur Inline-Inhalt.

## Empfängerzertifikate

`resolveVzdRecipients({ addresses, directory, statusClient, signal })` aus
`vzd-bindings.mjs` verbindet die Abfrage mit `TslOcspStatusClient`. Die Liste
enthält die SMTP-Empfänger **und die Adresse für die Senderkopie**. Maximal
101 verschiedene Adressen, 1.000 Zertifikate insgesamt und eine Gesamtfrist
von 30 Sekunden werden akzeptiert. Es gibt keinen Adresscache und keine
erfolgreiche Teilmenge, wenn ein benötigter Eintrag fehlschlägt.

Jedes zurückgegebene ENC-Zertifikat wird anhand seines tatsächlichen DER-Inhalts
auf Typ, CA-Ausstellungsberechtigung, Admission und signierten OCSP-Status
geprüft. Seine Telematik-ID muss exakt der ID des gefundenen Eintrags entsprechen.
Der Abgleich umfasst auch jedes zusätzliche Zertifikat beim Schlüsselwechsel.
Nach dem letzten Warten werden sämtliche Rohbelege erneut geprüft; eine
zwischenzeitliche TSL-Aktualisierung macht ältere Prüfer ungültig.

Das Ergebnis enthält `recipients`, `directoryEvidence` und `revalidate()`.
Unmittelbar vor `createEccKimMessage` ist `revalidate()` aufzurufen. Es prüft
zusätzlich, dass ausgegebene Zertifikatpuffer nicht verändert wurden und die
Frist noch gilt. Der ECC-Erzeuger prüft anschließend das unterstützte
Schlüssel-/CMS-Profil. Weder die Auswahl noch `revalidate()` ist eine
Versandfreigabe oder ein dauerhafter Identitätsnachweis.

## Absender beim Empfang

`receiveEccKimMessageWithTsl` akzeptiert zusätzlich die Option `directory`.
Erst nach erfolgreicher Nachrichtenkryptografie, Header-/AUT-Prüfung und zwei
positiven Statusprüfungen wird die **geschützte innere From-Adresse** abgefragt.
Der entschlüsselte Nachrichtenpuffer bleibt während der Netzabfragen gelöscht.

`directoryAcquisition` unterscheidet:

- `matched`: Verzeichnis-ID passt zum OSIG-Zertifikat (`matchedBy: signing`)
  oder, bei abweichendem OSIG, zum geprüften AUT-Zertifikat (`authentication`).
  Die beiden Übereinstimmungen werden getrennt ausgegeben.
- `mismatch`: Der eindeutige Eintrag passt zu keiner der beiden Identitäten.
- `unavailable`: Abfrage, Format oder Eindeutigkeit konnten nicht bestätigt werden.
- `not-checked`: Die vorgeschaltete Zertifikatsprüfung war nicht positiv.

Eine fehlende oder widersprüchliche Zuordnung erzeugt die Herstellerdiagnose
`XCS_DIRECTORY`. Negative/zwischenzeitlich ungültige Zertifikatsbelege haben
weiterhin Vorrang als `XCS_CERT_STATUS`. Ein Treffer bleibt Diagnose 07 und
gibt keine normale Zustellung frei. Das interne `directoryRejected`-Flag kann
nur eine Ablehnung hinzufügen, niemals eine Prüfung als erfolgreich ersetzen.

## Nachweise und offene Arbeit

35 neue Protokolltests und 15 Integrationstests prüfen echte lokale TLS-Sockets,
signierte TSL-/OCSP-Belege und tatsächlich verschlüsselte Nachrichten. Zwei
Empfängerschlüssel derselben ID entschlüsseln die mit Verzeichniszertifikaten
erzeugte Nachricht. Die Tests umfassen widersprüchliche IDs, negative Statuswerte,
mehrdeutige Treffer, Parsergrenzen, Abbruch, falschen Peer/Hostnamen und
TSL-Wechsel während der Abfrage. [Gesamtergebnis](verification.md).

Der folgende Ausbau ergänzt 32 Zertifikats- und 19 Server-Integrationstests.
Noch offen: vollständige TUC_PKI_018-/Krypt-Varianten,
authentisierte TI-Anker-/Endpointprovisionierung und Rotation, Konnektor-LDAP-Proxy,
Prüfung gegen einen unabhängigen VZD/KIM-Client und reale TI-Umgebungen.
Der Empfang verlangt weiterhin immer AUT und beide positiven Statusbelege;
der normative Empfangszweig ohne erforderlichen AUT-Check ist noch nicht
implementiert. Ebenso fehlen vollständige Versions-/Anwendungsverhandlung,
allgemeine LDAP-Funktionen, RSA-/Altadressprofile, normative Teilversandfehler,
AccountManager-Registrierung, KAS, SMC-B und die produktive CareSuite-Anbindung.
Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal belegt, 78 offen.

## Primärquellen

- [gemSpec_VZD 1.20.0, 07.09.2026](https://gemspec.gematik.de/docs/gemSpec/gemSpec_VZD/gemSpec_VZD_V1.20.0/): TIP1-A_5566–5570, A_23819 und Informationsmodell.
- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/): KOM-LE-A_2023, KOM-LE-A_2178 und KOM-LE-A_2048-02.
- [gematik api-vzd, LDAP-Attribute](https://github.com/gematik/api-vzd/blob/main/docs/LDAP_Attribute.adoc).
- [RFC 4511](https://datatracker.ietf.org/doc/html/rfc4511): Bind, SearchRequest/SearchResult und BER-Übertragung. Quellen geprüft am 22.10.2026.
