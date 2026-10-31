# CMS-Komponentensignatur und Monatsarchiv

Stand: 31.10.2026, Entwicklungszweig. Keine produktive Aktivierung und kein
Hardware-, TI-, ITSG- oder Zulassungsnachweis.

## Fachliche Grenze

[TA1, Anhang 3, Version 2.1.2, Abschnitt 3.4](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH3_2.1.2_20250707_oA.pdf)
verlangt einzelne fortgeschrittene SMC-B-Signaturen der Abrechnungsbestandteile
mit CMS/CAdES enveloping. Die Signaturprüfung muss vor einer Verarbeitung der
extrahierten XML-Bytes erfolgen. Das äußere KIM-S/MIME ist eine weitere Schicht.
Die aktuellen Unterlagen wurden am 31.10.2026 erneut gelesen.

Der neue Pfad signiert ausschließlich die tatsächlich erzeugten und anhand der
fest eingebundenen XSD geprüften Leistungsnachweisbytes. Er ergänzt keine
Empfängeradresse oder KIM-Attribute im Bestandteil. Ein abgegrenztes ECC-Profil
prüft brainpoolP256r1/ECDSA-SHA256, genau einen erwarteten C.HCI.OSIG-Signer,
eingebetteten Inhalt, ContentType, MessageDigest, SigningTime und
SigningCertificateV2. Unbekannte oder zusätzliche Attribute, abgetrennte
Signaturen und abweichende Binärdaten werden nicht freigegeben. Andere gültige
CAdES-Ausprägungen können noch außerhalb dieses unterstützten Profils liegen.
Dies ist keine pauschale CAdES-Konformitätsaussage.

## Ablauf im vorhandenen Host

1. Persönliche Anmeldung, Beauftragung, Quelle, Fassung, Vertretungsbefugnis und
   vorab gespeicherte Fachangaben prüfen. Original-PDF reproduzieren; PNG im
   Arbeitsspeicher bzw. vollständigen Vertreter-Scan prüfen. Neue Fachnachweise
   speichern kein eigenständiges PNG; siehe [Einbettung und Wiederaufnahme](monthly-embedded-signature.md).
2. Die genauen XML-Bytes unabhängig im bestehenden Python/lxml-Worker prüfen und
   mit Prüfbeleg, Quittungskennung, Fassung und Inhaltshash verschlüsselt speichern.
3. SMC-B anhand der provisionierten Institution und Rollen auswählen; tatsächliche
   Kartenzertifikate, TSL/OCSP, Konnektorstatus und bereits freigeschaltete PIN prüfen.
   Es erfolgt keine automatische PIN-Eingabeaufforderung.
4. Quellen und Anmeldung nochmals prüfen. Den Signaturversuch im SQLite-Journal
   mit FULL-Sync atomar reservieren, bevor GetJobNumber/SignDocument aufgerufen wird.
5. SOAP-Korrelation, tatsächliche CMS-Signatur, Zertifikat, Zeit und unveränderten
   Inhalt prüfen. CMS und Zertifikat sofort dauerhaft zurücklesen.
6. Frische Karten-/Vertrauensprüfung, VerifyDocument mit Bindung an CMS, Signatur,
   Zertifikat und aktuelle Prüfzeit, danach erneut Karte und aktuellen SQL-Kontext
   prüfen. Den kanonischen vollständigen positiven Prüfbericht verschlüsselt speichern.
7. Erst danach die private Bestätigungsquittung ausstellen. Der bestehende
   ausdrückliche Monatsabschluss prüft und verbraucht diese gesondert.

`MonthlyOriginalHost` erzwingt diesen Pfad für Nachweise mit `xmlFacts`. Ohne
Signaturanbindung scheitert bereits das Vorbereiten vor der Patientenunterschrift.
Ältere Bestätigungen ohne vollständige Fachangaben bleiben PDF-/Bestätigungsbelege.
Sie werden weder nachträglich in XML umgewandelt noch als signierte Bestandteile
ausgegeben. Nur die isolierten Tests der unsigned XML-Schicht schalten die
Komponentensperre im privaten Verifizierer ausdrücklich aus.

## Dauerhafte Zustände und Wiederaufnahme

| Zustand | Verhalten |
| --- | --- |
| `prepared` | XML gespeichert; noch kein Kartenaufruf reserviert. Fehlende PIN bleibt ohne automatische Aufforderung. |
| `in-flight` | Schlüsseloperation reserviert; nach Prozessverlust ungeklärt. Kein erneuter Signaturaufruf. |
| `signed` | Unveränderte CMS-Bytes bereits gespeichert. Wiederaufnahme darf nur frische Prüfungen/VerifyDocument ausführen. |
| `complete` | CMS und positiver gebundener Prüfbericht gespeichert. Wiederholung verwendet genau diese Bytes. |
| `held` | Fehler/unklares Ergebnis nach Reservierung. Auch ein neuer Hostprozess oder eine andere Erfassung hebt die Mandantensperre nicht auf. |

Neue Schlüsseloperationen prüfen die authentisierten Journalzustände innerhalb
derselben SQLite-Transaktion. Die Klartextspalte allein kann keine Sperre aufheben.
Ein ausdrücklich angeforderter Wiederholungsversuch ersetzt weder XML noch CMS.
Nach verlorener Datenbankantwort kann der vorhandene Statusabruf die bereits
erteilte Quittung finden. Ein gespeicherter erfolgreicher CMS-Vorgang wird dabei
nicht neu signiert. Quellenänderungen während SignDocument verhindern die Quittung;
bereits erhaltene CMS-Bytes bleiben zur Klärung gespeichert.

Der private Archivleser verwendet die bestehende persönliche Archivberechtigung
und die bestätigte Datenbankfassung. Korrekturen behalten das alte CMS-Original
und dessen Status `invalidated`; sie reaktivieren es nicht. Der Web-Endpunkt gibt
keine XML-/CMS-, Zertifikat- oder Prüfberichtbytes aus.

## Konfiguration und noch offene Arbeiten

Die vorhandene lokale Hostkonfiguration kann `smcb` mit `connector`
(`KonnektorCertificateClient`), `statusClient` (`TslOcspStatusClient`),
`expectedTelematikId`, `requiredRoles` sowie optional `iccsn`, `ctId`, `slotId`
liefern. Beide Clients müssen vollständig und passend zur Umgebung provisioniert
sein. Hosteintritt, Mandant und Archiv werden vom Einstieg gebunden. Es werden
keine privaten Signaturschlüssel, Zieladressen oder Zertifikate aus dem Browser
übernommen. Ein dedizierter Hostprozess und ein dediziertes Journal pro Mandant
bleiben Betriebsanforderungen; unabhängige Hosts dürfen dieselbe Karte nicht ohne
übergreifende Koordination für konkurrierende Vorgänge verwenden.

Die SQLite-Ablage ist verschlüsselt und auf Anwendungsebene unveränderlich,
aber kein WORM-Archiv und kein Schutz gegen Löschung/Rollback durch Administratoren.
Ein belegter Wiederherstellungsablauf nach Hardwarefehlern und die administrative
Auflösung einer Sperre sind noch offen; es gibt bewusst keinen Freigabeknopf oder
automatischen zweiten Kartenaufruf. Negative/unterbrochene Prüfungen archivieren
bislang keinen vollständigen negativen Bericht in diesem Monatsjournal.

Weiter offen sind die reale Zuordnung Institution/IK, persönliche ursprüngliche
Beschäftigtennummernerfassung, die Bereinigung älterer separater
Unterschriftsbilder einschließlich alter Sicherungskopien, vollständige EDIFACT-/IMG-/PRODMOD-Übergabe,
Aufbewahrungs-/Backupnachweise und das kommende XML-Profil ab Februar 2027.
Die [Vereinbarung, Abschnitt 4.2.1](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/2023_10_05_Vereinbarung__105_Abs.2_Satz_2_SGBXI_final.pdf)
ist damit noch nicht vollständig nachgewiesen. `dispatchReady` bleibt false;
`hardwareEvidence` und `tiEvidence` bleiben `not-attested`.

## Build- und Testgrenzen

Der Vercel-Webbuild prüft weiterhin SQL-Bindungen, Originale, Verträge, Gateway
und DOM-Bedienabläufe. Python-abhängige Erzeugung und Prüfung liegen getrennt in
`monthly-captured-xml.test.mjs`, bleiben Bestandteil von `verify:gkv:services`
und `verify:gkv:monthly-xml` und werden nicht durch eine Ersatzprüfung abgeschwächt.
Vercel muss dafür keinen Python-/lxml-Dienst installieren. Der tatsächliche
Signaturhost benötigt diese bereits vorhandene Laufzeit weiterhin und scheitert
bei deren Fehlen geschlossen.

Die Tests verwenden synthetische Daten und Schlüssel am tatsächlichen lokalen
mTLS-Transport, die vorhandenen PostgreSQL-Entwürfe und verschlüsselte SQLite-Dateien.
OpenSSL prüft zusätzlich mathematisch die CMS-Datei und liefert die exakten XML-Bytes
zurück; `-noverify` bedeutet ausdrücklich, dass dies keine unabhängige TI-Vertrauensprüfung ist.
