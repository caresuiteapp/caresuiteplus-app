# Original, Monatsnachweis und Rechnungsbezug auf Staging

Stand: 05.11.2026. Die drei beauftragten Datenbank- und Dienstschritte sind mit vier getrennten, tatsächlich angemeldeten Testkonten auf `caresuiteplus-staging` durchgelaufen. Der Test verwendete ausschließlich eine neue, als synthetisch bezeichnete Testeinrichtung und erzeugte keinen Versand und keine ausgestellte Rechnung. [Maschinenlesbarer Befund](checks/staging-authenticated-flow-20261105.json).

## Nachgewiesener Ablauf

| Schritt | Tatsächlich ausgeführte Prüfung |
| --- | --- |
| Anmeldung | Vier Passwörter gegen den gehosteten Auth-Dienst; jede zurückgegebene Identität anschließend über `/auth/v1/user` bestätigt. Keine selbst erzeugten JWTs. |
| Erfassung und Freigabe | Persönliche Beschäftigtenzuordnung mit getrenntem Prüfkonto; veröffentlichter Besuch mit real verstrichener Testminute, Zeitereignissen, Aufgabe und Dokumentation; Mitarbeiterfreigabe über die öffentliche Fachfunktion. |
| Klientenunterschrift | Freigegebene Fassung unter dem eigenen Konto gelesen; synthetisches Unterschriftsbild und tatsächliche PDF in den privaten Bucket hochgeladen, zurückgelesen und gehasht; Portalabschluss über die geprüfte Fachfunktion. Das Bild ist eine Testzeichnung und keine Unterschrift einer realen Person. |
| Verbindliches Original | Persönlicher Originalabschluss; Aufruf des gehosteten Abschlussdienstes mit dem Mitarbeiter-JWT. Der Dienst las das Bild, erzeugte seine PDF, verglich deren gespeicherte Bytes und schrieb die private Bestätigung. Der kanonische Leistungsnachweis verweist auf diese Quittung. Das Büro lud dieselben Bytes und bestätigte ihren SHA-256. Eine Änderung des gebundenen PDF-Hashes wurde abgewiesen. |
| Bürokontrolle | Freigabe der versiegelten Fassung und Festlegung von abrechenbarer Dauer, Stundensatz und Betrag durch das getrennt angemeldete Bürokonto. |
| Monatsnachweis | Erstellung aus genau diesem freigegebenen Datensatz. Die bestehende private Hostimplementierung arbeitete gegen echte Auth- und RPC-Endpunkte, speicherte ihre Originalbytes verschlüsselt, las sie zurück und bestätigte die Testzeichnung. Die Datenbank verbrauchte die Quittung einmalig und setzte die Fassung auf `final`. Das archivierte Original blieb bytegleich. |
| Rechnungsbezug | Öffentliche Office-Fachfunktion speicherte einen zugeordneten Rechnungsentwurf. Ein um einen Cent abweichender Betrag wurde mit HTTP 409 abgewiesen, ebenso die erneute Zuordnung zu einer zweiten Rechnung. Rechnung, Position, kanonischer Datensatz, alte `invoice_id`, Monatsquelle und Originalhash wurden abschließend erneut über die angemeldete Daten-API verglichen. |
| Fremdzugriff und Abschluss | Das zweite Klientenkonto konnte weder fremden Beleg noch Signaturzeile oder Signaturdatei lesen. Das eigene Original blieb lesbar; direkte Änderungen waren gesperrt. Anschließend wurden die Beschäftigtenzuordnung und die Testbeauftragungen widerrufen, der temporäre Worker-Schlüssel gesperrt, alle vier Konten gebannt und ihre Sitzungen entfernt. Alle vier erneuten Anmeldungen und der alte Klientenzugriff wurden abgewiesen. |

Der Vorabcheck findet jetzt **38/38 Voraussetzungen und 11/11 Objektmarker**. Die zehn Monats-SQL-Pakete sind auf Staging installiert. Diese Zahlen sind ein Katalogbefund, keine allgemeine Produkt- oder Zulassungsfreigabe.

## Im gehosteten Test gefundene und geschlossene Fehler

- Die alte Rechnungsstruktur hatte weder die vollständigen kanonischen Quellfelder noch passende Rechnungsstatuswerte. Die Erweiterung erhält alte Daten und Statusbezeichnungen. Ein Altbestand erhält dadurch keine Unterschrift, Freigabe, Ausstellung oder Zahlung. Die neue Kostenträger-Spalte bleibt ohne erfundene Vorbelegung.
- Eine vorhandene restriktive Storage-Regel benötigte Leserechte auf zwei Spalten der neu angelegten Payroll-Hilfstabelle. Nur diese Spalten sind lesbar; RLS bleibt ohne Freigabepolicy und liefert keine Payroll-Zeilen. Beträge und Snapshots bleiben unzugänglich.
- Die allgemeinen Mandantenrechte machten fremde Belegzeilen im selben Mandanten sichtbar. Neue restriktive Tabellenregeln begrenzen Klientenzugriff auf den eigenen freigegebenen Besuch. Direkte Belegänderungen bleiben der geprüften Abschlussfunktion vorbehalten. Büro- und Mitarbeiterrechte werden durch diese Client-Regeln nicht erweitert.
- Ein fachlicher Rechnungswiderspruch mit SQLSTATE `40001` löste fortlaufende Wiederholungen aus. Die beiden anhand der Fehlerprotokolle eindeutig identifizierten Testverbindungen wurden beendet. 15 geprüfte öffentliche JSON-Funktionsgrenzen übersetzen solche Konflikte in `PT409`; private Fachprüfungen und Berechtigungen bleiben bestehen. Die Web- und Hostclients behandeln die Antwort als eindeutigen Konflikt. Ursache und Statusabbildung sind in der [Supabase-Dokumentation](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b) beschrieben. Andere, nicht zu diesen 15 Funktionen gehörende API-Grenzen sind dadurch nicht pauschal geprüft.
- Die Projektion der neuen Rechnungsreferenz in das alte `invoice_id` lief vor der Unveränderlichkeitsprüfung und wurde als fremde Änderung abgewiesen. Sie läuft jetzt nach den kanonischen Schutzprüfungen. Deren Feldvergleich bleibt vollständig erhalten; eine Betragsänderung an einer zugeordneten Quelle wird weiter abgewiesen.

## Reproduzierbare Installation

Der [Paketgenerator](../../scripts/build-gkv-staging-sources.mjs) gibt nur SQL aus. Die Zielprüfungen beziehen sich auf den jeweils beobachteten Zustand vor der einmaligen Installation. Nicht entfernen, auf bereits installierten Datenbanken erzwingen oder ungeprüft auf Produktion übertragen.

| Staging-Version | Generatoroption | SHA-256 des tatsächlich gespeicherten SQL |
| --- | --- | --- |
| `20261105061732` | `--migration-body` | `e88e5d9f44f0ac4e66b00970ace0e02ab519a265a2bc5d01cb7baf1d11107e7a` |
| `20261105062000` | `--monthly-migration-body` | `03e252e26b68a107049b4825591f784ddbd7e67587cf025e87d397e261ff1b7d` |
| `20261105063303` | `--storage-migration-body` | `cb0aead68af94ef1d93730b57ac61785a436dff6d51c616a79077cf90c9dd28b` |
| `20261105064141` | `--portal-rows-migration-body` | `4ae2e053aef07c0a4d4756f5d19a99592ffe0d5f1599d37d94a4d04b01d3542e` |
| `20261105065358` | `--rpc-conflicts-migration-body` | `30fe0e46d39c8c2c26cf2a2733e3615ca44db12b5d32bb2f2aa0f6f4b98865d7` |
| `20261105065759` | `--invoice-status-migration-body` | `82be0b0386edb593abf87e378139f58dd55b90d27796f6c16bdeee81e6d2ef17` |
| `20261105070046` | `--source-trigger-migration-body` | `ed71dfefc2ffb9b08373400ce7f1050c335ab5a7bbb526367e2bed8588c5adc9` |

Die Quellpakete sind auf ihre ursprünglichen Workflow-/Rechnungsdefinitionen und die beobachtete Staging-Struktur begrenzt. Das Rechnungsmodell wurde für diesen Ablauf angepasst. Weitere Altanwendungen, Payroll, Datenübernahmen und produktive E-Rechnungsprozesse werden damit nicht automatisch aktiviert.

## Prüfung und Grenzen

`verify:gkv:staging-sources` besteht mit 10 Prüfungen zu den beobachteten alten Spalten und Statusbedingungen, echter Quellprüfung mit signierter Bytequittung, Überabrechnung, falschem Preis, widerrufener Freigabe, Fremdmandanten, unverfälschten Altbeständen, Payroll-Spaltenrechten, kanonischem Rechnungsentwurf, Triggerreihenfolge und atomarem HTTP-Konflikt. `verify:gkv:portal-integrity` besteht mit 86 Prüfungen von Datenbank, Dateidienst und Webclient. `verify:gkv:monthly-web` meldet 304 bestandene Prüfpunkte; TypeScript besteht mit einem Heap-Limit von 6656 MiB. Frühere lokale TypeScript-Anläufe wurden durch Speichergrenzen beendet und sind keine erfolgreichen Prüfungen. Die Testzeichnungen sind synthetisch; angemeldete Konten wurden automatisiert bedient.

Für einen neuen explizit freigegebenen Staginglauf verwenden die Skripte `gkv-staging-auth-check.mjs`, `gkv-staging-flow-check.mjs` und `gkv-staging-monthly-check.mjs` eine private Konfiguration außerhalb des Git-Verzeichnisses. `--init` verweigert das Überschreiben eines vorhandenen Laufs; `--seed-sql` und `--key-sql` bereiten die begrenzten Testdaten vor, wenden sie aber nicht an. Der Ablauf nutzt `--login`, `--start`, nach einer realen Minute `--finish`, `--sign`, `--isolation`, `--complete`, `--approve`, `--monthly`, anschließend die Hostbestätigung `--confirm`, `--invoice` und `--verify-chain`. Die Rückgaben jedes Schritts müssen geprüft werden; nach einem unklaren Schreibfehler zuerst den gespeicherten Vorgang abgleichen. `--retire-sql` bereitet das Sperren genau dieser vier Konten vor, `--retired-check` prüft die Sperre. Zugangsdaten und Worker-Geheimnisse gehören nicht ins Repository.

Die monatliche Hostprüfung lief in der vorhandenen Arbeitsumgebung mit einem privaten verschlüsselten Testarchiv und einem zeitlich begrenzten, mandantengebundenen Worker-Schlüssel. Sie belegt keinen dauerhaft bereitgestellten privaten Host, keine mTLS-Verbindung zu diesem Host und keine Betriebs-/Wiederherstellungsabnahme. Der bestätigte Monatsnachweis war eine Quellzusammenstellung ohne eingefrorene normative XML-Fachangaben. XML/CMS-Signatur, echte Karte/TI, Prüfinstitutionen und DTA-/KIM-Versand wurden in diesem Lauf nicht nachgewiesen.

Eine visuelle Browserabnahme des vollständigen Ablaufs mit angemeldeten Personen steht weiter aus. Rechnungsausstellung, E-Rechnungsvalidierung und Versand sind nicht Teil dieses Erfolgsbefunds; die Testrechnung blieb `draft`. Produktion und Android wurden nicht verändert. Markierte synthetische Testbelege bleiben auf Staging als Prüfnachweis erhalten, ihre Zugänge sind gesperrt. Die bereits vor dem Umbau gemeldeten Sicherheitsberater-Kategorien (Security-Definer-Ausführbarkeit, Passwortschutz und RLS ohne Policy) sind keine erteilte Sicherheitsfreigabe und bleiben gesondert zu bewerten.

Der abschließende Beratervergleich zeigt [RLS ohne Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) bei 136 statt 110 Tabellen, darunter die absichtlich gesperrten neuen privaten Tabellen. [Anonym ausführbare Security-Definer-Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) bleiben bei 53. [Für angemeldete Konten ausführbare Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) steigen von 99 auf 103: die bestehenden Workflow-Funktionen für Quellabruf, Capability, Datensatzabschluss und Storage-Unveränderlichkeit. Der Hinweis zum deaktivierten [Prüfen kompromittierter Passwörter](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) bleibt bestehen. Diese globalen Einstellungen wurden nicht nebenbei geändert.
