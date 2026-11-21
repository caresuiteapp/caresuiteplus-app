# NEO R2.2.1: Start der Vercel-Endpunkte

Stand: 21.11.2026, Europe/Berlin. Dieser Nachtrag ergänzt die eingefrorenen R2.2-Bauunterlagen; deren Quell- und Messnachweise bleiben erhalten.

## Beobachteter Fehler

Die vom Nutzer bereitgestellte Bildschirmaufnahme von 09:31 zeigt zunächst die deutsche Sprachpaketprüfung und anschließend erneut `local-language-unavailable`. Zu diesem Zeitpunkt war das Update mit Commit `9509cdecd88de5a4bb460a5dc38f8f4f1dc5c31d` im bestehenden Vercel-Projekt als `READY` veröffentlicht. Die Erkennungsprüfung im Vercel-Build war erfolgreich: 3.265 ms nativ und 20.956 ms über WASM für die synthetische 5,42-Sekunden-Aufnahme. Das sind Build-Messungen, keine Antwortzeiten der veröffentlichten Funktion.

Die Laufzeitprotokolle zu `/api/neo/status` zeigten jedoch `ERR_REQUIRE_ESM`: Die übersetzte CommonJS-Datei `api/neo/status.js` versuchte, `neo-vercel-engine.mjs` über `require()` zu laden. Vercels Node-24-Laufzeit erlaubte diesen Import nicht. Der Fehler entstand vor der Benutzerprüfung und vor dem Aufruf von `engine.status()`. Die bis dahin vorhandenen TypeScript-, Komponenten- und direkten Engine-Prüfungen hatten diesen Startpfad nicht erfasst.

Die Oberfläche verschwieg den Dienstfehler, weil sie einen fehlgeschlagenen eigenen Bereitschaftstest anschließend mit der ursprünglichen lokalen Browserdiagnose ersetzte. Das fehlende deutsche Browsermodell war weiter vorhanden, erklärte aber den ausgefallenen Ersatzweg nicht.

## Änderung

`api/_lib/neo-vercel-runtime.ts` lädt die ESM-Engine erst mit nativem `import()`, wenn der bereits geladene Handler sie nach der Zugangsprüfung benötigt. Die API-Einstiege importieren nur den CommonJS-kompatiblen Handler und diesen Adapter. Der Adapter hält genau einen Initialisierungsversuch beziehungsweise eine Engine pro geladenem Einstieg vor. Ein vorzeitig abgebrochener Transkriptionsaufruf startet keine neue Verarbeitung. Ein Importfehler wird vom normalen Anfragefehlerpfad behandelt.

Es werden weder die Modulart des gesamten Projekts noch andere API-Endpunkte geändert. Die vorhandene `api/tsconfig.json` mit `NodeNext` erhält den dynamischen Import auch in ihrer CommonJS-Ausgabe. Die Engine, die Modellversion, die Berechtigungsprüfung und die zugelassenen Infrastrukturbetreiber bleiben dieselben.

Eigene Bereitschaftsfehler erscheinen nun als Dienst nicht bereit, Verbindung fehlgeschlagen oder Mikrofonstart fehlgeschlagen. Die Texte stammen aus festen Meldungen. Interne Ausnahmeinformationen und Dienstantworten werden nicht in die Oberfläche kopiert. Ohne eigenen Dienst bleibt die lokale Browserdiagnose erhalten. Späte Antworten einer beendeten Sitzung dürfen weiterhin keine neuere Sitzung oder Fehlermeldung verändern.

## Neue Prüfung des tatsächlichen Startpfads

`scripts/verify-neo-vercel-entrypoints.mjs` übersetzt die echten TypeScript-Einstiege samt Adapter und Handler mit den bestehenden NodeNext-Modulbedingungen in ein isoliertes temporäres Verzeichnis. Ein separater Node-Prozess läuft mit `--no-experimental-require-module`. Die echten Engine- und Worker-Dateien werden verwendet. Eine feste lokale Testantwort ersetzt Supabase ausschließlich in diesem Prüfprozess; es werden keine produktiven Zugangsdaten verwendet und keine Datenbankanfragen gesendet.

Der Prozess prüft beide API-Einstiege, die Ablehnung nicht angemeldeter Anfragen und den Bereitschaftsaufruf nach einer simulierten zulässigen Anmeldung. Im Produktionsbuild wird anschließend die vorhandene synthetische deutsche Aufnahme durch den tatsächlichen Transkriptionshandler verarbeitet. Verneinung, NEO-Anrede und Aufgabenbegriffe müssen erhalten bleiben. Der Build scheitert, wenn dieser Einstiegstest scheitert. Die Prüfung läuft zusätzlich zu den bestehenden Releaseprüfungen.

Die Regressionstests reproduzieren den vorherigen statischen Importfehler mit deaktiviertem `require(ESM)` und prüfen die korrigierten Einstiege unter derselben Einschränkung. Fehlende Modelle werden dabei als fehlende Bereitschaft behandelt. Eine erfolgreiche Modulprüfung darf kein vorbereitetes Sprachmodell vortäuschen.

Der abschließende Entwicklungsstand bestand 524 Tests in 38 Testdateien, die NEO-TypeScript-Prüfung und den Native-Abgleich mit 1.183 Modulen, 278 Routen und null veralteten Ausgaben. Mit den vorbereiteten Sprachdateien bestätigte der isolierte Einstiegstest `401` für beide nicht angemeldeten Aufrufe, `200` und Bereitschaft für den simulierten zulässigen Statusaufruf sowie `200` und die Inhaltsprüfung für die synthetische Transkription. Die acht simulierten Backend-Aufrufe blieben vollständig im Prüfprozess. Die vorhandene synthetische Engine-Prüfung bestand ebenfalls auf beiden Laufzeiten.

Die Git-Bash-Reparatur verwendet den vorhandenen NEO-R2.2-Arbeitsordner. Sie prüft die bisherigen Dateihashes, sichert geänderte Dateien, führt die bestehenden NEO-Prüfungen aus und erfasst den erweiterten Quellstand unter `.neo-runtime/construction-records/`. Ein anschließender normaler Push auf den vorhandenen Hauptzweig startet den bestehenden Vercel-Build. Ein direkter Vercel-Deploy und neue Softwareinstallationen sind kein Bestandteil dieses Ablaufs.

Die tatsächliche veröffentlichte Laufzeit und das Mikrofon des Nutzers sind nach dieser Veröffentlichung erneut zu prüfen. Der isolierte Starttest verwendet echte API- und Engine-Dateien, bildet aber weder Vercels vollständigen Loader noch dessen laufende Plattformumgebung nach. Eine klinische Freigabe, ein Signaturpaket für die native App oder eine Schutzrechtsprüfung wird mit dieser Reparatur nicht erklärt.
