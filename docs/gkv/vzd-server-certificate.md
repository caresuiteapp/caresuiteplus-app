# Prüfung des tatsächlichen LDAPS-Serverzertifikats

Stand: 22.10.2026. Der eigene Verzeichnisbaustein prüft jetzt auch Zertifikatstyp,
technische Rolle, erlaubtes ECC-Profil und Sperrstatus des tatsächlichen TLS-Peers.
Diese Prüfung arbeitet gegen konfigurierte Anker und Routen. Sie ist kein
Nachweis einer authentisierten TI-Inbetriebnahme oder einer vollständigen
Umsetzung aller Varianten von TUC_PKI_018.

## Ablauf vor LDAP

`resolveVzdRecipients` und der Verzeichniszweig von `receiveEccKimMessageWithTsl`
übergeben ihren `TslOcspStatusClient` zwingend an die LDAPS-Verbindung. Nach dem
TLS-Handshake wird genau das Zertifikat aus `getPeerCertificate().raw` geprüft.
Eine separat vom Aufrufer benannte Serveridentität wird nicht verwendet.

1. Explizite TLS-CA, Hostname/SNI und konfigurierter Leaf-Fingerabdruck müssen
   passen. TLS 1.2/1.3 verwenden ausschließlich die angebotenen AES-GCM-Suiten
   und P-256/P-384- beziehungsweise Brainpool-P256/P384-Gruppen. Die Verbindung
   erlaubt keine Neuaushandlung; Sitzungen werden nicht zur Wiederaufnahme gespeichert.
2. Der aktuelle TSL-Stand muss eine tatsächlich signierende, aktuell aktive CA
   enthalten. Ihre `ExtensionOIDs` müssen den Typ C.ZD.TLS-S erlauben. AKI und
   SKI müssen zusammenpassen. Der Pfad akzeptiert auch bei einem anderweitig mit
   `nonqes-compromise` betriebenen Statusclient ausschließlich aktuelle CA-Dienste.
3. Das Blatt muss das unten beschriebene ECC-Profil und die technische Rolle
   Verzeichnisdienst-TI enthalten. Ein Berufs-/Institutionszertifikat oder ein
   gewöhnliches, korrekt gepinntes TLS-Zertifikat genügt nicht.
4. Der Statusplan wählt genau eine konfigurierte Route anhand der signierten
   CA-ServiceSupplyPoints. Die Blatt-AIA wird strukturell geprüft, aber nicht
   als Abrufadresse übernommen. Die OCSP-Antwort muss Signatur, Responder,
   CertID, certHash und Zeitprüfung bestehen und `good` ergeben.
5. Erst danach wird der anonyme LDAP-Bind gesendet. Vor der Suche, nach dem
   Ergebnisabschluss und nach den anschließenden asynchronen Verarbeitungsschritten
   werden die ursprünglichen Statusbelege erneut geprüft. Ein Listenwechsel
   oder Ablauf macht den früheren Befund unbrauchbar.

Die vorhandene nonQES-Zeitregel folgt A_23225: `producedAt` höchstens eine Stunde
alt beziehungsweise fünf Minuten in der Zukunft. Die ältere zehnminütige
TUC-Voreinstellung wird dadurch nicht zur zusätzlichen Cachefrist. Die
Implementierung ist ein direkter eigener Dienstpfad. Der aktuelle CM-Ablauf mit
Konnektor-`VerifyCertificate` und seinem Ergebnis-Cache ist damit nicht umgesetzt.

Die feste LDAPS-Gesamtfrist umfasst TLS, Statusprüfung, Bind und Suche. Abbruch
oder Fristablauf beendet den wartenden Aufruf und schließt den Socket. Ein
gemeinsam genutzter OCSP-Cache darf seinen Abruf für andere Aufrufer abschließen;
die geschlossene Verbindung kann dadurch keine LDAP-Anfrage mehr senden.
Unaufgeforderte LDAP-Daten während der Serverprüfung werden abgewiesen.

## Unterstütztes Zertifikatsprofil

| Merkmal | Prüfung |
| --- | --- |
| Zertifikatstyp | `1.2.276.0.76.4.157`, C.ZD.TLS-S, einschließlich CA-Berechtigung |
| Ausstellungsrichtlinie | `1.2.276.0.76.4.163`; optional genau der definierte gematik-CPS-Verweis |
| Technische Rolle | `1.2.276.0.76.4.171` und `Verzeichnisdienst-TI` |
| Admission | Genau eine technische Rolle; keine registrationNumber/Telematik-ID oder zusätzlichen Profession-Daten |
| Schlüssel | EC mit benannter Kurve brainpoolP256r1 oder P-256 und unkomprimiertem Punkt |
| Verwendungszweck | Kritische KeyUsage digitalSignature und ausschließlich serverAuth als EKU |
| Namen | Genau CN, O, C und optional serialNumber; ein DNS-SAN muss zum CN passen; TLS prüft den konfigurierten Hostnamen |
| Erweiterungen | SKI, AKI, Policies, Admission, AIA, SAN, KU, EKU und kritische CA:false-BasicConstraints; CRLDistributionPoints optional und ohne Abruf |

Unbekannte, doppelte, falsch kritische oder fehlende Pflichtfelder scheitern.
Mehrere DNS-Namen, Wildcards, otherName für überlange Organisationsnamen, weitere
Subject-Attribute, RSA-Serverblätter und andere Kurven sind in diesem bewusst
begrenzten Profil nicht implementiert. Die bestehende CA-Signaturprüfung erlaubt
Brainpool-P256/ECDSA-SHA256 oder RSA ab 3072 Bit mit dem bestehenden PSS-Profil;
andere CA-Signaturprofile bleiben offen.

## Schnittstellen und Nachweise

`manager.current().directoryServerFor(certificate)` liefert die anhand des
geschützten aktuellen Listenstands geprüften Attribute.
`directoryServerOcspPlanFor(certificate)` ergänzt den Statusplan.
`statusClient.check({ certificate, purpose: 'directory-server', signal })`
führt den tatsächlichen Statusabruf beziehungsweise die Cacheprüfung aus.
Alle Pfade prüfen Typ und Profil auch vor Wiederverwendung alter Cachebelege.

`directory.lookup(address, { serverStatusClient, signal })` ergänzt
`serverEvidence` mit Zertifikatshash, Typ, technischer Rolle, Profil, Status,
Fristen und TSL-Version. Die Rohbelege bleiben im privaten Prüfabschluss.
`revalidateVzdRecord(record)` akzeptiert nur das ursprüngliche intern registrierte
Ergebnis; kopierte Objekte und vorgegebene `good`-Felder reichen nicht.
Die reine Protokollabfrage ohne Statusclient bleibt möglich, liefert ausdrücklich
`serverEvidence.state: not-checked` und besteht diese Nachprüfung nicht. Die
höheren Sender-/Empfängerpfade verwenden diesen Weg nicht.

32 neue Zertifikats-/Admission-Fälle und 19 neue Integrationstests prüfen echte
lokale TLS-Verbindungen, neu signierte geänderte Zertifikate und OCSP-Rohbelege.
Sie decken insbesondere ausbleibende LDAP-Bytes vor positiver Prüfung,
Cachewiederverwendung, Sperrung, falsche Rolle, entzogenes CA-Recht, fremde
Statusbelege, Listenwechsel, Ablauf, Abbruch und beide TLS-Versionen ab.
Das [Prüfprotokoll](verification.md) hält die ausgeführten Läufe fest.

Offen bleiben authentisierte TI-Anker-/Endpointprovisionierung und Rotation,
Konnektor-/SMC-B-Anbindung, vollständige Krypt-/PKI-Varianten, unabhängige
VZD-Interoperabilität, produktiver Diensthost und CareSuite-Versandfreigabe.
`identityStatus: unverified`, reine Empfangsdiagnose und die Echtversandsperren
bleiben bestehen. Das FD-Inventar bleibt bei 106 Kennungen: 28 teilweise lokal
belegt, 78 offen.

## Primärquellen

- [gemSpec_PKI 2.28.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_PKI/gemSpec_PKI_V2.28.0/): §4.6.1, GS-A_4615/Tab_PKI_247, GS-A_4652-02/TUC_PKI_018, GS-A_5077 und A_23225.
- [gemSpec_OID 3.26.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_OID/gemSpec_OID_V3.26.0/): Typ, Ausstellungsrichtlinie und technische Rolle.
- [gemSpec_VZD 1.20.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_VZD/gemSpec_VZD_V1.20.0/): TIP1-A_5566 und LDAPS.
- [gemSpec_Krypt 2.51.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_Krypt/gemSpec_Krypt_V2.51.0/): Tab_KRYPT_002a, GS-A_4359-02 und GS-A_4384-03.
- [gemSpec_CM_KOMLE 1.23.0](https://gemspec.gematik.de/docs/gemSpec/gemSpec_CM_KOMLE/gemSpec_CM_KOMLE_V1.23.0/): Abgrenzung zum Konnektor-Verfahren und A_22348-02. Quellen geprüft am 22.10.2026.
