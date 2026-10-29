# Prüfvorbereitung GKV / KIM

Stand 2026-10-23; Codebasis `aa695d12407521b24e1c90d6c83819b3d6fdda8b`.

Diese Matrix ist eine Arbeitsgrundlage. Sie ist keine Prüfbestätigung, keine Zulassung und keine Freigabe zum Versand. Ein erfolgreicher Katalogcheck bestätigt nur die Konsistenz dieser Dateien.

Erfasst: **744 KIM-Anforderungsverweise**, **711 Kennungen innerhalb ihrer jeweiligen Steckbriefe**, **14 ITSG-Prüffälle** und **25 Arbeitspakete**. Mehrere Nachweisarten und gleiche IDs in verschiedenen Spezifikationen bleiben getrennt. Keine Fertigstellungsquote.

## Quellen und Abdeckung

[Quellen mit Versionsstand und SHA-256](source-lock.json), [vollständiges KIM-Verweisregister](kim-register.json), [Arbeitsplan und ITSG-Fälle](workplan.json). Die Originaltexte bleiben bei den jeweiligen Herausgebern.

| Steckbrief | Festgelegte Version | Verweise | Kennungen |
| --- | --- | ---: | ---: |
| icm | [PTV_1.0.3-2_V1.0.0](https://gemspec.gematik.de/docs/gemProdT/gemProdT_iCM_KIM/gemProdT_iCM_KIM_PTV_1.0.3-2_V1.0.0/) | 253 | 237 |
| fd | [PTV_1.6.5-2_V1.0.0](https://gemspec.gematik.de/docs/gemProdT/gemProdT_FD_KOMLE/gemProdT_FD_KOMLE_PTV_1.6.5-2_V1.0.0/) | 297 | 286 |
| provider | [ATV_1.6.9-0_V1.0.0](https://gemspec.gematik.de/docs/gemAnbT/gemAnbT_FD_KOMLE/gemAnbT_FD_KOMLE_ATV_1.6.9-0_V1.0.0/) | 194 | 188 |

Die drei Steckbriefe wurden am 22.10.2026 freigegeben. Sie verweisen unter anderem auf FD 1.25.0 und CM 1.24.0. Die 28 Teilbelege im älteren FD-Inventar beziehen sich auf FD 1.24.0. Sie sind nur Kandidaten für einen erneuten Abgleich und erhöhen keinen aktuellen Erfüllungsstatus.

- DTA-Feld-, Schlüssel- und Vertragsregeln sind noch nicht vollständig in Einzelanforderungen zerlegt.
- Die 744 KIM-Verweise sind vollständig aus den drei fixierten Steckbriefen importiert; Einzelbewertung gegen deren Spezifikationsstände steht aus.
- Antragskonstellation, §302-Leistungsbereiche und Zielversion müssen vor einer Einreichung bestätigt werden.
- Reale Hardware-/TI-, Oberflächen-, Annahmestellen- und externe Zulassungsnachweise fehlen.

Die Anbieter-Konstellation muss vor Einreichung feststehen. Arbeitsannahme ist Eigenbetrieb mit eigener Kontovergabe. Zwei Tabellenverweise nennen GS-A_4088-01, obwohl diese Kennung in den primären Anforderungstabellen dieses Steckbriefs nicht vorkommt. Die Versionszuordnung bleibt offen; es erfolgt keine automatische Ersetzung oder Ausnahme.

## Reihenfolge und Zuständigkeit

| Priorität | Arbeitspaket | Stand | Nächster Schritt | Abschlussnachweis |
| ---: | --- | --- | --- | --- |
| 0 | **Prüfumfang und Zielversionen festlegen** (scope); Geschäftsführung / Entwicklung | Offen | Produktnamen, Versionen, §302-Leistungsbereiche und KIM-Antragskonstellation schriftlich festlegen. | Eine genehmigte Umfangsentscheidung trennt Pflege, §302, integrierten Client und Anbieterbetrieb. |
| 1 | **Erfassung und personenbezogene Zuordnung** (proof-capture); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Private Fachzuordnungen, Originalzeiten und ursprüngliche Personenbindung werden vor Bestätigung eingefroren. Herkunft bleibt not-attested: produktiver, persönlich authentifizierter GKV-Nummernerfassungs-/Prüfablauf, Mehrpersonenleistungen und Vertrags-/Tarifprüfung fehlen. Interne Personalnummern werden nicht umgedeutet. | ITSG-Fälle 3.1 bis 3.5 und 4.1 mit mobilen Testkonten und gespeicherten Originalen vorführen. |
| 1 | **Bestätigung und endgültiger Monatsnachweis** (proof-confirmation); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Bildschirm-/Druckoriginal zeigt die vorab gespeicherten Fachangaben. Der private Host reproduziert das PDF, bindet gespeichertes PNG bzw. vollständigen Vertreter-Scan und prüft erzeugte XML-Bytes vor der Quittung. Persönliche Erfassungsnachweise, Provisionierung, Zieloberflächen, unmittelbare Komponentensignatur und XML/CMS-Archivierung bleiben offen. | ITSG-Fälle 3.6 bis 3.10 mit getrennten Nachweisfassungen und Wiederverwendungsversuchen vorführen. |
| 1 | **Korrektur und Archivierung** (proof-correction); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Fachangaben sind an Revision und Inhaltshash gebunden; Änderungen sperren alte Erfassungen. Quellenabgleich entfernt Fachangaben, Korrektur erhält die ursprüngliche Beschäftigtennummer ohne alte Bestätigung. Reale Parallelverbindungen, produktive Berichtigung fehlerhafter Erstzuordnung und gebundene XML/CMS-/Abrechnungsübergabe bleiben offen. | ITSG-Fälle 3.11 und 4.2 gegen parallele Änderung, alte Unterschrift und alte Exportfassung vorführen. |
| 1 | **Pflege-XML und Signaturen je Bestandteil** (proof-xml); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | LNW-Generator und amtliche XSD-/Feldprüfung sind an vorab eingefrorene Fachangaben, reproduziertes Original und gespeicherte Bestätigung angeschlossen. Der Kandidat wird geprüft, aber noch nicht archiviert oder freigegeben. Persönliche Herkunft, Komponentensignatur, atomare XML/CMS-Speicherung, vollständige Abrechnungs-/IMG-/PRODMOD-Prüfung und Zielnachweise ergänzen. | Unabhängige Prüfung der erzeugten Bytes, Negativfälle für Schema, Signatur, IMG-Zuordnung und zeitgültige PROD-/MOD-ID. |
| 2 | **Mobile Vorführung und Lesbarkeit** (proof-usability); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Lesbarkeit und Signierablauf mit echten schmalen und breiten Darstellungen prüfen und dokumentieren. | ITSG-Fall 5.1 anhand tatsächlicher Darstellung und Bedienung belegen. |
| 1 | **§105-Dateien, Verträge und Versionswechsel** (dta105); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Feld- und Vertragsmatrix aus TA1/TA3 vollständig zuordnen; offene Zuschlags-, stationäre und Sammelabrechnungsfälle umsetzen. | Bytegenaue unabhängige Testvektoren und Versionsgrenzen; jede ausgeschlossene Variante bleibt ausdrücklich gesperrt. |
| 1 | **§302-Fachmodell und Abrechnungsformate** (dta302); CareSuite-Entwicklung | Offen | §302-Segmente, Schlüssel, Verordnungen, Genehmigungen, Originalnachweise und Korrekturen für die vereinbarten Leistungsbereiche entwickeln. | Eigenständige §302-Prüfdateien mit positiven und negativen Fremdtestfällen; kein Verweis auf §105 als Ersatz. |
| 1 | **Verbindliche Übergabe der Rechnungen an den Versand** (release); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Kanonische Rechnungsreservierung, Revisionen, aktuelle Empfänger und Inhaltsprüfungen bis zum dauerhaften Worker verbinden. | Parallele Freigabe, nachträgliche Quellenänderung und verlorene Versandantwort führen zu keiner Doppelübermittlung. |
| 2 | **Klassischer Transport und Rückmeldungen** (dta-transport); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Zertifikats-/Verzeichnisbetrieb, Herkunftsprüfung und fachliche Rückmeldungsverarbeitung im Host anschließen. | Wiederanlauf und unbekannte Ausgänge mit Originalquittungen nachweisen; Zustellung, Annahme und Zahlung bleiben unterscheidbar. |
| 1 | **Vollständiger KIM-Nachrichtenablauf** (kim-message); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Alle referenzierten Clientanforderungen einzeln zuordnen; normale Sende- und Empfangszustellung, Header, MIME, Fehler und große Anhänge integrieren. | Jede referenzierte Anforderung bekommt passende positive und negative Tests der tatsächlichen Nachrichtenbytes. |
| 1 | **Kryptografische Profile und fachliche Signaturen** (kim-crypto); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Vorgeschriebene Krypto-/S/MIME-Profile und Übergangsbedingungen der festgelegten Version mit dem begrenzten ECC-Kern abgleichen. | Unabhängige Parser, Testvektoren und Kartenoperationen bestätigen jede unterstützte Kombination. |
| 1 | **Zertifikate, Vertrauensanker und Sperrstatus** (kim-trust); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Authentisierte Ankerbereitstellung, vollständige Profile, aktuelle Statusdaten und Rotation auf dem späteren Host belegen. | Ungültige Identität, Rolle, Sperre, veraltete Liste und abgebrochener Statusabruf bleiben bis zur Klärung gesperrt. |
| 1 | **Verzeichnis und Adressbindung** (kim-directory); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Ausgehende Identitätsbindung und vorgesehene LDAP-/FHIR-Varianten verbinden; gleiche Anforderungs-ID in unterschiedlichen Quellen getrennt prüfen. | Abweichende Adresse, Identität oder Zertifikatssituation wird vor Nachrichtenfreigabe erkannt. |
| 1 | **Karte, Konnektor und Host im echten Durchlauf** (kim-hardware); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Realen Karten-/TI-Aufbau anbinden, vollständige Bedienung prüfen und Messprotokolle mit Produkt-/Firmwareversionen sichern. | Signieren, Entschlüsseln, Sperrstatus, Abbruch und Wiederaufnahme mit realen Karten einschließlich unabhängiger Gegenstelle nachweisen. |
| 2 | **Installation, Konfiguration und Updates** (kim-management); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Dauerhafte Hostbereitstellung, sichere Konfiguration, Kontobindung, Update und Rücknahme als unterstützte Betriebsabläufe fertigstellen. | Neue und aktualisierte Installation sowie Wiederanlauf mit tatsächlich provisionierten Zugängen prüfen. |
| 2 | **TI-Netz und externe Gegenstellen** (kim-network); Betrieb / Entwicklung | Offen | Netzanschluss, TLS-Profile, DNS, Komponenten-PKI und externe Erreichbarkeit im vorgesehenen Betriebsmodell nachweisen. | Verbindung zu unabhängigen Gegenstellen einschließlich Fehler- und Ausfallszenarien dokumentieren. |
| 1 | **Teilnehmerverwaltung, Fachdienstverkehr und KAS** (fd-services); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | AccountManager, Verzeichnisverwaltung, Relay zwischen Fachdiensten und verschlüsselte große Anhänge vollständig implementieren. | Registrierung bis Abmeldung, externe Zustellung und KAS-Übertragung mit unabhängigen Gegenstellen durchlaufen. |
| 2 | **Sicherheits- und Datenschutzunterlagen** (security); Entwicklung / Informationssicherheit | Offen | Anforderungen je Produkt und Betrieb zuordnen; Architektur, Bedrohungen, Rollen, Schlüssel, Löschung und Entwicklungsprozesse dokumentieren. | Erforderliche Hersteller-/Anbietererklärungen und begutachtungsfähige Unterlagen mit festem Versionsbezug vorlegen. |
| 2 | **Last, Grenzen und Wiederherstellung** (performance); CareSuite-Entwicklung | Bausteine vorhanden; Abnahme offen | Geforderte Last- und Betriebswerte auf den vorgesehenen Komponenten messen; lokale Größenprüfungen gesondert behandeln. | Reproduzierbare Messungen einschließlich Ressourcenknappheit, Ausfall und Wiederherstellung auf Zielumgebung. |
| 2 | **Betriebshandbuch und Anbieterprozesse** (provider-ops); Betrieb / Geschäftsführung | Offen | Eigenbetrieb mit Kontovergabe als Arbeitsannahme festlegen; Monitoring, Support, Incident-/Change-Prozesse, Backups und Schlüsselrotation nachweisen. | Betriebshandbuch und Prozessnachweise decken sämtliche anwendbaren Anbieteranforderungen ab. |
| 3 | **Eigenverantwortliche gematik-Tests** (kim-evt); CareSuite-Entwicklung | Offen | Testfälle aus den fixierten Steckbriefen vollständig zuordnen, PKI-Testsuite und Produkt-/Interoperabilitätstests durchführen. | Unterschriebener EVT-Bericht mit nachvollziehbaren Ergebnissen für jede anwendbare Anforderung. |
| 3 | **ITSG-Anmeldung und Prüfung** (itsg-submission); Geschäftsführung / ITSG | Offen | Unternehmensdaten, Betriebsnummer, eindeutige Prüfversion und Vorführprotokoll zusammenstellen; Prüfung beauftragen. | ITSG-Prüfbestätigung mit tatsächlicher PROD-/MOD-ID und Gültigkeit dokumentiert. |
| 3 | **Annahmestellenprüfungen** (payer-tests); Entwicklung / Annahmestellen | Offen | Testpartner, IK, Leistungsbereiche, Formatstände, Verbindungstests und Testkennzeichnung abstimmen. | Originale Testsendungen und zugehörige bestätigte Prüfergebnisse liegen je vereinbartem Verfahren vor. |
| 4 | **Produktzulassung, Anbieterzulassung und KIB** (kim-approval); Geschäftsführung / gematik / Gutachter | Offen | Antragsumfang und Produktausgaben abstimmen; erforderliches Sicherheitsgutachten bestätigen lassen, Anträge und KIB-Unterlagen bearbeiten. | Gültige externe Bescheide und die für den Betriebsumfang erforderlichen KIB-Nachweise dokumentieren. |

Priorität 0 legt den Umfang fest. Priorität 1 schließt Fach- und Integrationslücken; Priorität 2 bearbeitet Betriebsfähigkeit und Bedienung. Priorität 3 liefert externe Tests, Priorität 4 die KIM-Zulassungsabschlüsse. Anmeldung und Abstimmung können früher beginnen. Die Abhängigkeiten im JSON beziehen sich auf den Abschluss des Arbeitspakets, nicht auf die erste Kontaktaufnahme.

## ITSG-Vorführung

Alle 14 Fälle sind einzeln erfasst; keiner ist als bestanden gekennzeichnet. Kandidatencode stammt aus den bestehenden Einsatz-, Portal- und Nachweisabläufen. Ein Test des Rechnungsimports ersetzt keinen ITSG-Prozessnachweis.

| Fall | Prüfgegenstand | Arbeitspaket | Ausführung |
| --- | --- | --- | --- |
| [3.1](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Personalisierter Zugriff | proof-capture | Offen |
| [3.2](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Leistung und Pflegekraft verbinden | proof-capture | Offen |
| [3.3](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Mehrere Leistungsarten erfassen | proof-capture | Offen |
| [3.4](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Gemeinsam erbrachte Leistung | proof-capture | Offen |
| [3.5](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | PDL-Änderung nachvollziehen | proof-capture | Offen |
| [3.6](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Nachweis verbindlich bestätigen | proof-confirmation | Offen |
| [3.7](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Bestätigung je Leistungsart | proof-confirmation | Offen |
| [3.8](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Vertretungsbestätigung | proof-confirmation | Offen; Anwendbarkeit prüfen |
| [3.9](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Papierbestätigung zuordnen | proof-confirmation | Offen |
| [3.10](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Unterschriftsausnahme begründen | proof-confirmation | Offen |
| [3.11](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Neue Fassung nach Korrektur | proof-correction | Offen |
| [4.1](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Unbefugte Erfassung verweigern | proof-capture | Offen; Anwendbarkeit prüfen |
| [4.2](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Finale Fassung schützen | proof-correction | Offen |
| [5.1](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf) | Lesbarkeit am Mobilgerät | proof-usability | Offen |

Für die Vorführung werden synthetische Personen und Mitarbeitende, ein Monat mit drei Leistungsarten, ein gemeinsamer Einsatz, Änderungen vor und nach Bestätigung sowie getrennte Rollen verwendet. Pro Fall werden Ausgangsstand, Schritte, Originale/Hashes, tatsächliches Ergebnis, geprüfte Version und Prüfer erfasst. Fehlende Protokolle bleiben offen. Der bestehende Testexport wird dabei nicht an eine Kasse versandt.

ITSG prüft den Nachweisprozess. EDIFACT, Versand und die gesamte TI-Anbindung liegen außerhalb dieses Prüfumfangs. Die XML-Fachprüfung und Annahmestellentests bleiben eigenständige Aufgaben.

## Nachweisregeln

- Codepfade und Testdateien unter `packages[].code/tests` sind Fundstellen. Sie belegen keine Ausführung des amtlichen Prüffalls.
- KIM-Anforderungen erben den Status `unassessed`. Die Zuordnung über `specPackages` bestimmt das Arbeitspaket, nicht die Erfüllung.
- MUSS, SOLL, KANN und DARF NICHT bleiben erhalten. Auch optionale Anforderungen benötigen eine dokumentierte Umfangsentscheidung.
- Lokale Softwaretests, echte Hardware/TI, externe Interoperabilität und Zulassung werden getrennt nachgewiesen.
- Prüfbestätigungen, PROD-/MOD-ID, Sicherheitsgutachten und Bescheide werden erst nach tatsächlichem Eingang erfasst.

## Reproduzieren

```bash
node scripts/check-gkv-approval-readiness.mjs --check
node --test tests/gkv-exchange/approval-catalogue.test.mjs
python scripts/import-gkv-approval-profiles.py --source-dir /pfad/zu/originalen
```

Der Python-Import verwendet ausschließlich die drei HTML-Dateien `icm.html`, `fd.html` und `provider.html`, deren Hashes in der Quellenliste stehen. Er lädt nichts herunter und ändert ohne `--write` keine Datei. Geänderte Bytes erfordern eine erneute Quellenprüfung. `--require-ready` beim Node-Check endet für diese Arbeitsgrundlage absichtlich mit Exitcode 3.
