# Ernährung und SIS: durchgehender Staging-Vertrag und Zugriffsprüfung

Der gesperrte Ernährungsablauf unterstützt jetzt die vollständige technische Kette aus ausdrücklich gewählter nativer Planbindung, offener Planung, ausdrücklicher Prüfanfrage und getrennten eigenen Bestätigungen. Das ist keine tatsächliche Aufnahme, Durchführung oder fachliche Annahme. Die vorhandenen Web-Abläufe verwenden dieselben Pakete und Quittungen; die globale Pflege-Sperre bleibt bestehen.

## Tatsächlich installierte Änderungen

| Staging-Version | Quelle | Wirkung |
| --- | --- | --- |
| `20261023164242` | `ambulatory_nutrition_planned_inspection.sql`, SHA-256 `dcc0cc32d7f7e65cd02c6e409b66b76ab92c7f00620710e2e81b8aedcf9771f9` | Eine ausdrücklich offene Planung darf eine technische Prüfanfrage erhalten. Tatsächliche Ausführung sowie klinische Annahme und Rückgabe bleiben gesperrt. Frühere eigene Quittungen bleiben unverändert. |
| `20261023164421` | `ambulatory_nutrition_canonical_ids_additive.sql`, SHA-256 `f3740dca5aa6d9050cef2d2aa0d3737c22dbca08b4bcbb4622d924e220d86fb0` | Drei neue private Helfer und drei neue Einfüge-Trigger weisen neue nicht kanonische Paketkennungen atomar ab. Historische Pakete und Bestätigungswege werden nicht umgeschrieben. |

Die angewandten Migrationsdateien sind bytegleich mit diesen Quellen. Vor der Änderung waren sämtliche erfassten Ernährungsfunktionen für `anon`, `authenticated` und `service_role` gesperrt; die Nachkontrolle bestätigt weiterhin null öffentlich freigegebene Funktionen in dieser Familie. Der neue Kennungsnachtrag verwendet ausschließlich `CREATE` für die neuen Objekte und scheitert bei Namenskollisionen. Er ersetzt oder löscht keine früheren Trigger oder Helfer.

Der ältere ersetzende Kennungskandidat lieferte beim Installationsaufruf keine Antwort. Zwei nachfolgende Katalogkontrollen bestätigten, dass seine Helfer, Trigger und Migration nicht vorhanden waren. Installiert wurde ausschließlich die anschließend separat geprüfte additive Fassung. Der ältere Kandidat bleibt eine historische Quelle und darf nicht zusätzlich installiert werden.

## Tatsächliche Ernährungsprüfung

`pflege_nutrition_linked_inspection_unit_staging.sql` bestand direkt in Staging. Die Fixture verwendet ausschließlich neu erzeugte synthetische Konten, Rollen, Fälle und native Plan-/Versions-/Maßnahmen-/Einsatz-/Assessmentzeilen. Alle Änderungen werden in einer inneren Rücknahme vollständig geprüft und durch ein äußeres `ROLLBACK` beendet. Die bisherigen kleinen und größeren Fixtures bleiben unverändert und behalten ihre jeweils eigene Nachweisgrenze.

Geprüft wurden vollständige native Originale und deren eigener Quellenhash, Capture mit separater Bestätigung, offene Getränkeplanung mit unverändertem eigenem Original sowie die anschließende Prüfanfrage mit eigener historischer Wiederholung und Bestätigung. Neue kanonische Aufträge funktionieren; je eine nicht kanonische Capture-, Pflege- und Prüfanfrage wurde abgewiesen, ohne Bindungs-, Ereignis- oder Quittungsreste zu hinterlassen. Ein geänderter früherer Auftrag, ein unterschobenes Pflegeoriginal und eine fremde Bestätigungsanfrage wurden zurückgewiesen.

Ein getrenntes synthetisches Konto besaß nachweislich aktuelle eigene Sitzung, Mandant und Signaturrecht. Seine Annahme- und Rückgabeversuche erreichten die ausdrückliche klinische Sperre. Der Nachweis beruht damit nicht nur auf einem fehlenden Recht oder derselben Verfasserperson. Er belegt trotzdem keine reale Qualifikation oder unabhängige fachliche Abnahme.

Pflege- und Prüfbestand liefern vollständige aktuelle Originale, passende Cursor, denselben Bestandsfingerabdruck und jeweils eine echte leere Abschlussseite. Die Nachprüfung fand weder neue Ernährungs-/Prüfereignisse noch synthetische Fixture-Mandanten oder UUID-Fixture-Konten. Drei andere nicht nach diesem UUID-Muster angelegte `example.invalid`-Konten lagen außerhalb des Fixture-Umfangs und wurden nicht verändert.

Die unveränderte Antwort liegt unter `scripts/checks/fixtures/nutrition-linked-inspection-staging-synthetic-20261023.json` (114.706 Bytes, SHA-256 `c357f030c23cd56c0ea59e2e426fbd503eb80ae88b8c03a984a9f146645a62ba`). Die Herkunft bindet die tatsächliche SQL-Fixture und alle drei angewandten Grundlagen einschließlich der Basismigration `20261022115155`.

Die wiederholbare Suite `nutrition-linked-inspection-postgres-evidence.node.test.mjs` besteht mit **20/20 Prüfungen**. Sie führt die tatsächlichen Produktionsdecoder und Repositories mit den erhaltenen SQL-Antworten aus. Ein geänderter Bestandsbeleg auf einer leeren Seite, Eigentümerverlust und eine unterschobene eigene Schreibquittung werden vor einer falschen Vollständigkeits- beziehungsweise Speicherbestätigung abgefangen. Der Transport ist lokal nachgebildet; das ist kein authentifizierter HTTP-Aufruf.

## Ergänzende tatsächliche SIS-Zugriffsprüfung

Die neue eigenständige Fixture `pflege_assessment_planning_v2_access_unit_staging.sql` bestand mit vier isolierten Fällen: Verlust des Verwaltungsrechts bei weiter zulässiger eigener Lesebestätigung, vorrangige eigene Mandanten-Rollenübersteuerung, deaktivierte Pflegezuordnung und tatsächlich beendete Sitzung. Nach jedem Fall wurden eigener Kontext und ursprüngliche Quittung wiederhergestellt. Der vollständige Originalverlauf blieb erhalten; anschließend wurden alle synthetischen Zeilen zurückgenommen.

Die unveränderte Antwort liegt unter `scripts/checks/fixtures/assessment-planning-v2-access-staging-synthetic-20261023.json` (34.605 Bytes, SHA-256 `4404d7ecd9cca4cfd6cade5762f25a9afa80afb7146565827d780d1139d245c3`). Ihre Herkunft bindet die konkrete Teilfixture, die unveränderte umfassendere Autoritätsquelle und die tatsächlich angewandte V2-Migration `20261023010345`. Die Suite `assessment-planning-v2-access-postgres-evidence.node.test.mjs` besteht mit **8/8 Prüfungen** einschließlich tatsächlicher Web-Repositories, doppeltem vollständigem Lesen, eigener Bestätigung und Schutz bei Eigentümerverlust.

Die ursprüngliche umfassendere Autoritätsfixture und ein separat vorbereiteter enger Kontowechselfall lieferten weiterhin kein verfügbares Ergebnis. **Ein tatsächlicher Nachweis für verschiedene Auth-Konten unter demselben internen Profil wird daraus nicht behauptet.** Die vier bestandenen Zugriffsfälle ersetzen diesen offenen Fall nicht. Der vorbereitete isolierte Kontowechsel entfernt nur einen frisch erzeugten leeren Fixture-Profilstummel mit ausdrücklichen Konto-/Mandanten-/E-Mail-Bedingungen; er ist ohne Ergebnis nicht bestanden.

## Verbleibende Grenzen

Der abschließende zusammengeführte Aufruf `node --test scripts/checks/*.node.test.mjs` bestand mit **14.926 Tests, null Fehlern und null übersprungenen Fällen**. Die 20 Ernährungs- und acht SIS-Nachweisprüfungen sind darin enthalten und werden nicht addiert. Der Lauf ersetzt keinen TypeScript-/Expo-Compiler, echten HTTP-Zugriff oder Browsernachweis.

Alle aufbewahrten Antworten sind rein synthetisch und wurden nicht normalisiert oder redigiert. Die wiederholbaren Prüfungen kontrollieren Datei-/Quellenhashes und schließen Zugangsdaten, JWTs, Sitzungen und private Auth-Zuordnungen aus. Projektweite bereits vorhandene Security-Advisor-Hinweise werden nicht als behoben oder als globale Sicherheitsfreigabe bezeichnet.

Offen bleiben insbesondere der genannte Kontowechselfall, echte HTTP-/RLS- und Parallelitätsnachweise, Browserdarstellung, reale Qualifikation und Fachabnahme sowie die ältere Pflegeplan-/SIS-Verbindung ohne gespeicherte native Zuordnung. Dieser Block verändert weder Android-Laufzeitdateien noch produktive Daten, Produktionsrechte oder die globale Pflege-Sperre.
