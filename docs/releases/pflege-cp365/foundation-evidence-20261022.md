# Pflegedokumentation, Grundpflege und Ernährung: begrenzte Staging-Nachweise

Diese Ergänzung hält tatsächliche SQL-Rollback-Nachweise und die zugehörigen Web-Vertragsprüfungen getrennt von Freischaltung, klinischer Abnahme und Veröffentlichung fest. Pflege bleibt global gesperrt. Bestandene Tests oder installierte Funktionen ergeben keinen Fertigstellungsprozentsatz.

## Pflegedokumentation

Die unveränderte Fassung von `supabase/patches/ambulatory_care_documentation_quarantined.sql` wurde in Staging als Version `20261022080425` angewandt. Ihr SHA-256 ist `0d8bd54acc3a3123c248a74c752e71760c6307b8d13db79ac1f8435545a0e173`. Der tatsächliche direkte SQL-Lauf von `supabase/tests/pflege_care_documentation_quarantined_staging.sql` bestand mit vollständiger synthetischer Bereinigung und äußerem `ROLLBACK`; Fixture-SHA-256 `bb209bb196ec2fe6cf14e3b86c9c4c5c855fc7af2cb78f76d79c64873feaffaf`.

Positiv geprüft wurden ausschließlich ausdrücklich verfasste, **unsignierte Pflegeberichte (`care_report`)** und angehängte Korrekturen. Sie bewahren native Originalzeilen, ursprüngliche Namen, vollständige frühere Inhalte, die tatsächliche Ereigniszeit und den getrennten serverseitigen Erfassungszeitpunkt. Eine Korrektur ersetzt kein früheres Original. Wiederholung und getrennte Bestätigungsabfrage liefern die gespeicherte eigene ursprüngliche Quittung, auch wenn inzwischen eine weitere Fassung entstand. Ein gleiches internes Profil unter einem anderen tatsächlichen Auth-Konto darf einen früheren Auftrag nicht übernehmen.

| Vertrag | Tatsächlich geprüfte Grenze |
| --- | --- |
| Vier Kern-RPCs | Anlage, Korrektur, vollständiges Lesen und eigenes historisches Quittungslesen unter synthetischen aktuellen Rollen und Sitzungen. |
| Sechs weitere Dokumentationsarten | `planned_service`, `refusal`, `incident`, `structured_protocol`, `control` und `external` bleiben mit `42501` gesperrt, solange die benötigten exakten nativen Fachbelege fehlen. Vollständig geformte negative Pakete erzeugten keine zusätzliche native Zeile oder Quittung. |
| Inhaltsbestätigung | Die Aktion `confirm` bleibt mit `42501` gesperrt. Ein synthetisches Signaturrecht belegt keine tatsächliche Qualifikation oder Identitätsgrundlage. Es entstanden keine Signaturen oder Bestätigungsoriginale. |
| Drei ältere Pfad-RPCs | Der eigene vollständige Kontext ist direkt im SQL-Test lesbar. Neue Pfadschreibvorgänge und historische Pfadquittungen ohne belegtes ursprüngliches Konto bleiben gesperrt. Die Web-Grenze sendet diese nicht unterstützten Schreib-/Bestätigungsschritte nicht. |
| Berechtigungen | Alle sieben öffentlichen Kern-/Pfad-APIs und die erfassten Familienhelfer besitzen keine EXECUTE-Freigabe für `anon`, `authenticated` oder `service_role`. Die privaten Familientabellen bleiben mit RLS und ohne CRUD-Freigaben quarantänisiert. Eine privilegierte direkte Fixture-Ausführung ist kein authentifizierter HTTP-Aufruf. |

Die SQL-Fixture prüft konkrete eigene Profil-/Mandantenzuordnung, tatsächliche aktuelle Sitzung, eigene Rolle einschließlich mandantenspezifischer Rechteübersteuerung, aktive Pflegezuordnung und bekannte Klientenstatus. Archivierung über Lebenszyklus oder `archived_at`, Löschung über `deleted_at`, fremde Akte/Person/Mandant, verlorene Rechte und Sitzungsverlust werden abgewiesen. Gezielte Fälle prüfen CAS, Anfragekonflikte, Cursorpaare, Mikrosekunden, UUID-Gleichzeitigkeit, vollständige Bestandsfingerabdrücke und unveränderliche Originale. Der native Mutationsschutz gilt für über neue eigene Versionen belegte Originalzeilen; die Fixture prüft ausdrücklich, dass dieser enge Schutz einen unabhängigen älteren nativen Schreiber nicht pauschal verändert.

Der Web-Leser verlangt denselben vollständigen Bestandsfingerabdruck auf allen Seiten einschließlich der leeren Abschlussseite und beim abschließenden erneuten Lesen der ersten Seite. Auch eine Änderung einer älteren Seite bei unverändertem ersten Ausschnitt verhindert die Veröffentlichung des geladenen Bestands. Der Cursor muss dem tatsächlichen letzten Original entsprechen; Zeitvergleich und Reihenfolge bewahren sechs Nachkommastellen. Der aktuelle Einzelabruf darf einen historischen ausgewählten Eintrag nur zu einer späteren Fassung auflösen, wenn dessen Kennung im vollständigen Originalverlauf liegt.

Die Web-Quittungsprüfung bindet Anfrage, eigenen Verfasser, exakten neuen Inhalt, Korrekturgrund, erwartete Revision, Vorgänger, Wurzel und alle unveränderten früheren Versionen. Ein anderes für sich gültiges Original oder ein inzwischen späterer Kopf bestätigt den eigenen Auftrag nicht. Ganze SDK-Antworten und native Pakete werden vor inhaltlichen Feldzugriffen ohne Ausführung fremder Getter geprüft. Unbekannte Felder, versteckte beziehungsweise symbolische Felder, Klasseninstanzen, `toJSON`, Zyklen und lückenhafte Arrays werden nicht stillschweigend verworfen. Die Historienprüfung verlangt konsistente tatsächliche Ereigniszeiten, Erfassungszeiten, Namen, Personen und Vorgangsarten. Quellen ohne ausdrückliche eigene Mandanten-/Fallzuordnung sowie vom vollständigen Verlauf losgelöste Pfadquellen werden abgewiesen.

Auth-Konto und internes Profil dürfen unterschiedliche Kennungen besitzen. Die Web-Grenze bestätigt das tatsächliche Konto, dessen unveränderten Token und bekannten Ablauf, das exakt aufgelöste interne Profil, den eigenen Mandanten und das unveränderte SDK um jeden betroffenen Abruf. Ein Wechsel nach einem Schreibversand führt zu einem ungeklärten Ausgang statt zu einer falschen Speicherbestätigung. Die allgemeine Auth-Verwaltung und Android wurden für diesen Familienblock nicht verändert.

Die tatsächliche synthetische SQL-Projektion liegt unverändert in `scripts/checks/fixtures/care-documentation-staging-synthetic-20261022.json`; SHA-256 `08faefffb517502c4faad9abb15c822267aeea0681e44fd21f5ccaa1228ef244`. Die Herkunftsdatei bewahrt angewandte Version, Patch-/Fixture-Hashes und Prüfgrenzen. Die rekursive Prüfung fand keine Auth-Claims, Sitzungen, Zugangstoken oder andere Auth-Geheimnisse; es mussten keine Paket-, Original- oder Quittungswerte umgeschrieben werden.

| Wiederholbarer Aufruf | Ergebnis |
| --- | --- |
| `node scripts/checks/validate-care-documentation-postgres-evidence.mjs scripts/checks/fixtures/care-documentation-staging-synthetic-20261022.json` | 18 tatsächliche Original-/Quittungsprüfungen bestanden. |
| `node --test scripts/checks/care-documentation-*.node.test.mjs` | 264 Prüfungen bestanden; darunter 20 aufbewahrte SQL-/Herkunftsprüfungen und 38 Produktionsadapterfälle mit tatsächlichen SQL-Originalen und gezielt veränderten Gegenbeispielen. |
| `node --test scripts/checks/care-documentation-*.node.test.mjs scripts/checks/care-workspace-authority-web.node.test.mjs` | 322 Prüfungen bestanden, ohne Fehler oder übersprungene Fälle. Die gemeinsamen Autoritätsfälle und die vorherigen Teilmengen werden nicht addiert. |

Die Produktionsadaptertests verwenden echte zurückgegebene SQL-Originale im lokal nachgebildeten Transport. Sie sind kein PostgREST-, Browser- oder echter HTTP-Anmeldetest. Ein direkt bestandener SQL-Test unter synthetischen Claims ist ebenfalls kein Nachweis einer realen Qualifikation, paralleler Transaktionen oder eines freigeschalteten Benutzerablaufs.

## Grundpflege und Ernährung

Diese beiden Familien erhalten getrennte tatsächliche Migrations-, Rollback-, Original- und Web-Nachweise. Vorbereitete SQL-Dateien oder angekündigte Ausführung werden nicht als bestandene Staging-Prüfung gewertet. Ihre endgültigen Nachweise werden nach bestätigter Ausführung ergänzt.

## Offene Nachweisgrenzen

Dieser Block belegt keine echte HTTP-Anmeldung, tatsächliche Qualifikationsbereitstellung, universelle Sperre sämtlicher älterer klinischer Schreiber, vollständige Typprüfung mit dem Projektcompiler, Expo-Export oder breite und schmale Browserdarstellung. Eine Entfernung von TypeScript-Syntax in Node ersetzt keinen Compiler. Die globale Pflege-Sperre und die übergreifende Abnahmematrix bleiben maßgeblich. Es wurde keine neue Testinfrastruktur installiert, keine Produktionsmigration ausgeführt und kein Deployment oder Freischalten vorgenommen.
