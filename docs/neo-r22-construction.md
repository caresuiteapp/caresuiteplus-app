# NEO R2.2: eigene Erkennung bei fehlendem Browser-Sprachpaket

Entwicklungsstand: 21.11.2026, Europe/Berlin. Ausgangsveröffentlichung: R2.1, Commit `5c29010fb53d83b4d0899064acee707f70c23658`. Der gemeldete Fehler `local-language-unavailable` bedeutet, dass der Browser keine nutzbare lokale deutsche Erkennung bereitstellt. Die R2.1-Bereitschaftsabfrage hat dies erkannt, aber keinen unabhängigen Erkennungsweg aktiviert.

## Ausführung

Der Desktop-Assistent versucht zunächst die ausdrücklich lokale Browsererkennung. Fehlt die Schnittstelle, das deutsche Modell oder eine nutzbare lokale Laufzeit, prüft er den eigenen authentifizierten NEO-Endpunkt. Ein fehlendes Mikrofonrecht wird dadurch nicht umgangen. Nach erfolgreicher Prüfung erfasst die bestehende AudioWorklet-Aufnahme begrenzte 16-kHz-Mono-PCM-Abschnitte und sendet sie an `/api/neo/transcribe` im bestehenden Vercel-Projekt. Öffentliche Modell-Downloads finden während des Builds statt und erhalten keine Audio- oder Kontodaten.

Die Anwendung verwendet Whisper Base Q5. Der Build prüft das Modell und die portable whisper.cpp-Laufzeit anhand fester Dateigrößen und SHA-256-Werte. Auf Linux x64 kompiliert er den unveränderten, vendorten whisper.cpp-Stand mit dem vorhandenen GCC/G++. Es wird kein Compiler installiert. Der Build verknüpft dynamisch gegen die Systembibliotheken seines Ziel-Build-Images. Die Anfrage-Laufzeit prüft Dateiintegrität, AVX2/FMA/F16C und den CLI-Start erneut. Ist der native Weg nicht nutzbar, steht die geprüfte WASM-Laufzeit innerhalb derselben Vercel-Funktion bereit.

Vor den bisherigen Produktionsprüfungen transkribiert die Build-Vorbereitung eine synthetische deutsche Aufnahme auf jedem verfügbaren Ausführungsweg. Die Verneinung „keine Schmerzen“, die Anrede „Neo“ sowie „Blutdruck“ und „morgen“ müssen erhalten bleiben. Der Bereitschaftsnachweis bindet das Ergebnis an Modell- und Laufzeithashes. Ohne diesen passenden Nachweis meldet der Endpunkt keine Bereitschaft. Die bisherigen Produktionsprüfungen bleiben erhalten; Node.js ist auf die bereits im Vercel-Projekt verwendete Hauptversion 24 festgelegt.

| Bestandteil | Aufgabe |
| --- | --- |
| `robotAssistantDom.ts` | Auswahl der Erkennung, stille Bereitschaft, direkte Ansprache, Abbruch und Wiederaufnahme nach einer Antwort |
| `neoCapture.web.ts` | Bestehende PCM-Aufnahme mit begrenzter Warteschlange; beim Desktop verbleibt der Mikrofonbesitz beim gesamten Assistentengespräch |
| `neoGateway.ts` | Authentifizierte Desktop- und Fallanfragen mit Prüfung des angemeldeten Akteurs vor und nach der Antwort |
| `neo-vercel-handler.ts` | Live-Berechtigungsprüfung vor und nach der Inferenz, getrennte Desktop-/Fallbezüge und begrenzte Anfrageverarbeitung |
| `neo-vercel-engine.mjs` | Integritätsprüfung, CPU-/ABI-Prüfung, native Erkennung, portable Ersatzlaufzeit und Löschung temporärer Dateien |
| `neo-wasm-worker.cjs` / `neo-wasm-runtime.cjs` | Eigener Worker-Lebenszyklus, privater Ergebnistransport, Beenden der zugehörigen Threads bei Abbruch |
| `build-neo-native.mjs` / `vendor/neo-whisper/` | Nachprüfbarer nativer Build aus festgelegtem Fremdquelltext |
| `prepare-neo-vercel.mjs` | Verifizierte Build-Artefakte und echter synthetischer Erkennungstest |

## Zugang und Lebenszyklus

Der Desktop-Sprachbezug besteht ausschließlich aus Mandant und angemeldetem Akteur. Der neue Supabase-Aufruf `neo_desktop_voice_authorize` verlangt den aktuellen Geschäftszugang, `office.access` und eine aktuelle zulässige Unternehmenszuordnung. Er gibt keine Klientenakten oder Schreibrechte frei. Personenbezogene Dokumentation verwendet weiterhin den engeren Fallbezug und `neo_voice_authorize`. Fehlerhafte Personenangaben werden nicht zu Desktop-Anfragen herabgestuft.

Die produktive additive Migration wurde unter `20261121065922_neo_desktop_voice_authorization.sql` angewendet. Es wurden keine Klienten- oder Testdatensätze geschrieben. Der Funktionsaufruf ist nur für authentifizierte Zugänge freigegeben; anonymer Aufruf und Service-Rollen-Aufruf sind gesperrt.

Ein Stopp, Kontowechsel oder anderer Mikrofonbesitzer beendet die Aufnahme und verwirft späte Ergebnisse. Während NEO spricht, wird die eigene Aufnahme angehalten; anschließend kann dieselbe gestartete Sitzung weiterhören. Das ist kein nachgewiesener Vollduplexbetrieb. Ohne direkte Ansprache bleibt der Desktop-Assistent still. Fachliche Entwürfe und Datenbankaktionen behalten die vorhandenen Fall-, Quellen- und Freigabeprüfungen.

Audio und Erkennungstexte werden nicht als normale Sprachdienstprotokolle ausgegeben. Native temporäre Audiodateien liegen nur im privaten temporären Verzeichnis und werden nach Abschluss beziehungsweise Abbruch gelöscht. Die portable Laufzeit verarbeitet Samples und Texte im Speicher und über private Worker-Nachrichten. Bei Abbruch werden der verantwortliche Worker und seine zugehörigen Threads beendet.

## Entwicklungsbelege und Grenzen

Der vollständige Vorbereitungsablauf hat eine 5,4223125 Sekunden lange synthetische deutsche Aufnahme nativ in 2.173 ms und in der erzwungenen WASM-Ersatzlaufzeit in 21.238 ms verarbeitet. Beide Ergebnisse erfüllten die oben genannten Inhaltsprüfungen. Ein zusätzlicher nativer Quellenbuild benötigte 2.369 ms. Diese Zeiten stammen aus der Entwicklungsumgebung. Sie sind keine gemessenen Vercel-Antwortzeiten und keine Qualitätsaussage für reale Pflegegespräche.

Der laufende Erkennungsabbruch wurde mit beiden Backends geprüft. Im portablen Weg wurde nach einer erfolgreichen Erkennung derselbe warme Worker für eine zweite Aufnahme verwendet und währenddessen abgebrochen. Die beiden zugehörigen Threads wurden beendet; es wurde kein Teiltranskript zurückgegeben. Eine ohne ausdrückliches Dispose behaltene, untätige WASM-Laufzeit verhindert das normale Ende des Node-Prozesses nicht.

Die abschließende NEO-Prüfung bestand 510 Tests in 37 Testdateien einschließlich TypeScript-Prüfung und Native-Abgleich. Die automatisierten Prüfungen umfassen Audioformate, Worker-Abschluss, Abbruch, Berechtigungswechsel, die getrennten Desktop-/Fallverträge und die Desktop-Anbindung. Der vollständige Quellstand wird vom Git-Bash-Paket erneut geprüft. Die Produktionsfreigabe erfolgt anschließend durch die bestehenden Vercel-Prüfungen. Ein erfolgreicher Entwicklungsbuild belegt noch nicht, dass die neue Funktion bereits produktiv läuft. Ein Endgerätetest am Mikrofon nach dieser Veröffentlichung steht aus. Eine visuelle Abnahme wird durch die DOM-Tests nicht ersetzt.

Die eigenständige native App behält ihre lokale Geräteerkennung. Diese Reparatur ergänzt den browserabhängigen Desktop-Aufnahmepfad; der gemeinsame Vercel-Endpunkt und die Fallautorisierung stehen auch den vorhandenen eigenen Dokumentationsaufnahmen zur Verfügung. Dieses Paket erstellt kein signiertes App-Update.

Akustisches Aktivierungswortmodell, belastbare Sprechertrennung, automatische Rollenidentifikation, klinische Erkennungsqualität und Arbeiten während einer laufenden Sprachausgabe werden durch diesen Stand nicht als fertig erklärt. Die direkte Anrede wird weiterhin im erkannten Text ausgewertet.

## Herkunft und Entwicklungsunterlagen

CareSuite-eigen sind die Sitzungs-, Mikrofon-, Autorisierungs- und Worker-Steuerung sowie ihre Einbindung. Whisper, whisper.cpp und das portable Laufzeitartefakt sind fremde Bausteine. Der native Quellstand ist whisper.cpp v1.8.4, Commit `9386f239401074690479731c1e41683fbbeac557`, einschließlich Lizenz-, Autoren- und eingebetteter Dritthinweise. Modellrevision: `5359861c739e955e79d9a303bcbc70fb988958b1`. Modell- und Laufzeithashes stehen im Code und im Buildmanifest. Für das portable Artefakt ist die Herkunft von `https://ggml.ai/whisper.cpp/main.js` und dessen Byte-Hash festgelegt; eine genaue Zuordnung zu demselben nativen Quellcommit wird nicht behauptet.

Das Paket erweitert die vorhandene Quellstandsicherung: Manifest, veröffentlichter Quelltext und diese Bauunterlage werden vor dem Push unter `.neo-runtime/construction-records/` mit SHA-256 erfasst. Die historische R2-Erfindungsakte bleibt unverändert. Der neue Stand und die dokumentierten KI-Beiträge sind ein Entwicklungsnachweis. Eine Neuheitsrecherche, Erfinderfeststellung oder Schutzrechtsanmeldung wird damit nicht behauptet.

Geprüfte Plattformdokumentation vom 21.11.2026: [Vercel Build Image](https://vercel.com/docs/builds/build-image), [Node.js-Versionen](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Function Limits](https://vercel.com/docs/functions/limitations). Die Konfiguration reserviert für die beiden Erkennungsfunktionen 4 GB und bis zu 100 Sekunden im vorhandenen Projekt; sie ändert keinen Tarif.
