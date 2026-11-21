# NEO R2: Sprachassistenz und Pflegedokumentation im Markt

Recherche: 21.11.2026. Geprüft wurden Herstellerdokumentation, veröffentlichte technische Beschreibungen und Modellkarten. Die Recherche ersetzt keinen Vergleich mit deutschen Pflegegesprächen auf den vorgesehenen Endgeräten. Anbieterangaben zu Genauigkeit, Geschwindigkeit und Zeitersparnis sind ohne eigene Messung keine zugesicherten NEO-Eigenschaften.

## Was sich von Siri, Alexa und Google übertragen lässt

Apple beschreibt eine mehrstufige lokale Aktivierungsworterkennung: ein sparsamer Erstfilter, ein genauerer Nachprüfer, Sprechervergleich und eine Prüfung, ob die Äußerung tatsächlich an Siri gerichtet ist. Ein lokaler Ringpuffer hält kurze Audioabschnitte; nicht aktivierende Audiodaten werden verworfen. Für NEO folgt daraus: Aktivierungswort, eigentlicher Auftrag und Hintergrundgespräch benötigen getrennte Behandlung. Eine beliebige Erwähnung des Namens darf keine Schreibaktion auslösen. [Apple, technische Architektur](https://machinelearning.apple.com/research/voice-trigger)

Amazon beschreibt die Nutzung von Gesprächs- und Gerätekontext zur Verbesserung der Spracherkennung. Stimmeigenschaften am Aktivierungswort können helfen, Hintergrundsprecher auszublenden. NEO braucht daher einen auf Fall und Sitzung begrenzten Gesprächskontext sowie einen nachvollziehbaren Sprecherbezug für Aufträge. [Amazon, kontextbezogene Spracherkennung](https://www.amazon.science/latest-news/the-engineering-behind-alexas-contextual-speech-recognition)

Google veröffentlichte kompakte Streaming-Spracherkennung für die Verarbeitung auf Mobilgeräten. Text entsteht bereits während des Sprechens; Netzwerkwege lassen sich damit vermeiden. Das ist ein Architekturbeleg, keine Geschwindigkeitszusage für NEO. [Google, On-device-Spracherkennung](https://research.google/blog/an-all-neural-on-device-speech-recognizer/)

Diese technischen Veröffentlichungen beschreiben bestimmte Entwicklungsstände. Sie sind keine vollständige Bestandsaufnahme aller aktuellen Produktfunktionen oder ihrer internen Implementierung.

## Geeignete Bausteine und offene Auswahl

| Baustein | Belegte Fähigkeit | Konsequenz für NEO |
| --- | --- | --- |
| Silero VAD | Sprachaktivitätserkennung, ONNX, 8/16 kHz, Browserbeispiel; MIT-Lizenz. | Kandidat für einen lokalen Sprache-/Stille-Filter. Erkennt weder Wörter noch Personen. Hersteller-Messwerte erst nach eigener Endgerätemessung übernehmen. |
| whisper.cpp | C/C++-Implementierung mit MIT-Lizenz und offiziellem Browserstreaming-Beispiel `stream.wasm`. | Den vorhandenen Whisper-Pfad fortführen; Browserinferenz vergleichen. Modelllizenz und konkrete Modellversion getrennt dokumentieren. VAD, Abschnittsgrenzen, Zeitstempel und Wiederholungsschutz bleiben eigene Aufgaben. |
| sherpa-onnx | Streaming- und Offline-ASR, Keyword Spotting, Sprechererkennung, Diarisierung, WASM; Apache-2.0-Code. | Kandidat für eine gemeinsame Audio-Laufzeit. Die ausgewählte Modelllizenz separat prüfen. Die dokumentierten kleinen KWS-Modelle sind Englisch/Chinesisch; ein zuverlässiges deutsches „NEO“ ist damit noch nicht nachgewiesen. |
| pyannote Community-1 | Offline-Sprechertrennung mit Zeitbereichen und Sprecherlabels; CPU standardmäßig, GPU optional; Modell CC-BY-4.0 und erforderliche Zugangsfreischaltung. | Vergleichskandidat für Sprecherwechsel und Überlappung. Ein Label wie `speaker_00` ist keine bestätigte Berufs- oder Familienrolle. Keine leichte Supabase-Edge-Aufgabe. |
| Porcupine/Picovoice | Eigene Aktivierungswörter, Deutsch und Web-WASM sind dokumentiert. | Kommerzieller Vergleichskandidat. Anbieter-AccessKey sowie Vertrags- und Lizenzentscheidung erforderlich. Kein als eigene Basistechnologie auszugebender Erkenner. |
| Speechmatics | Echtzeit-/Batch-Erkennung, Sprecherlabels, Fachwortschatz und eigene Container sind dokumentiert. | Vergleichskandidat für Funktionsumfang. Ein eigener Container ist unter der Vorgabe Vercel/Supabase noch kein bestätigter Betriebsweg. Eine zusätzliche Cloudverbindung wurde nicht eingerichtet. |
| openWakeWord | Apache-2.0-Code; mitgelieferte Modelle laut README nur Englisch und CC-BY-NC-SA-4.0. | Mitgelieferte Modelle für kommerzielles deutsches NEO nicht ungeprüft übernehmen. Eigene geeignete Modelle wären ein gesondertes Trainings- und Lizenzprojekt. |

Die Auswahlentscheidung lautet: bestehende NEO-Orchestrierung eigenständig erweitern und lokale, versionierte Audioverarbeitung bevorzugen. Silero, whisper.cpp und sherpa-onnx bleiben prüfbare Kandidaten. Es wurden keine kostenpflichtigen APIs aktiviert, Verträge abgeschlossen oder zusätzlichen Cloudanbieter angebunden. Ein deutsches akustisches NEO-Aktivierungswortmodell wurde durch diese Recherche weder trainiert noch auf Endgeräten validiert. Ein Namensfilter auf erkanntem Text ist kein gleichwertiger Nachweis für ein solches Modell.

## Was Pflegeanbieter dokumentieren

**voize** beschreibt in seinem aktuellen Hilfeartikel für die ORBIS-Integration einen konkreten Ablauf: Person prüfen, Mikrofon halten, Vorschlag kontrollieren und freigeben. Werte, Maßnahmen und Kategorien werden als Vorschläge aufbereitet. Für die Vivendi-Integration nennt die Dokumentation ausdrücklich Offline-Spracherkennung und eine spätere Datenübertragung. Diese Angaben belegen nutzbare Pflegeabläufe, keine fehlerfreie unbeaufsichtigte Dokumentation. [Freigabeablauf](https://help.voize.de/de/articles/855755-so-funktioniert-die-dokumentation-in-voize), [Infrastruktur und Offline-Verhalten](https://help.voize.de/de/articles/471875-voize-infrastruktur-voraussetzungen)

**myneva.care** beschreibt mobile KI-Spracheingabe am Einsatzort, Aufbereitung und Übersetzung. Die Produktseite nennt eine eigene EU-Cloud. Die dort beworbenen Zeitersparnisse sind Anbieterangaben und wurden hier nicht unabhängig überprüft. Dieser Betriebsweg würde die vorgegebene NEO-Infrastruktur erweitern. [myneva.care](https://www.myneva.eu/de/produkt/myneva.care)

**Tandem** beschreibt mit Stand November 2026 eine gestartete Gesprächssitzung, Erfassung relevanter Angaben, einen strukturierten Entwurf sowie fachliche Prüfung und Freigabe vor der Übertragung in die Patientenakte. Auch hier folgt aus Sprecherlabels keine sicher erkannte Rolle. [Offizielle Produktinformationen](https://tandemhealth.ai/de/ai-info)

## Sprechertrennung, Rollen und Aufträge

Diarisierung beantwortet, welche Abschnitte vermutlich von derselben Stimme stammen. Sprecheridentifikation vergleicht eine Stimme mit zuvor eingerichteten Profilen. Eine Rolle wie Pflegekraft, Angehöriger, Klient oder Arzt ist eine weitere fachliche Zuordnung. Diese Ebenen dürfen nicht gleichgesetzt werden.

NEO sollte neue Sprecher zunächst als unbekannt führen, die Rolle bestätigen lassen und Korrekturen auf die betroffenen Aussagen zurückführen. Überlappende oder unklare Abschnitte benötigen eine Rückfrage. Die Formulierung „Ich bin der Arzt“ allein beweist weder Identität noch Schreibberechtigung. Autorisierung kommt weiter aus dem angemeldeten Konto und den aktuellen Fallrechten.

Gleichzeitiges Zuhören, Zuordnen und Vorbereiten braucht voneinander unabhängige Warteschlangen. Sprachaufnahme darf nicht auf eine langsame Analyse warten. Aufträge benötigen eigene Zustände, Quellen, Wiederholschutz und eine überprüfte Speicherbestätigung. Klinische Aussagen bleiben überprüfbare Entwürfe; aus einem Gespräch darf keine unbelegte Diagnose oder Medikamentenänderung entstehen.

## Betrieb ausschließlich mit Vercel und Supabase

Browser-/Geräteinferenz mit versionierten Modellen von Vercel oder Supabase ist eine mögliche Umsetzung ohne zusätzlichen Inferenzanbieter. Ob ein konkretes Modell ausreichend schnell läuft, muss auf den vorgesehenen Geräten gemessen werden. Supabase eignet sich für Anmeldung, Fallrechte, persistente Aufgaben und Freigaben.

Hosted Supabase Edge Functions nennen derzeit 256 MB Arbeitsspeicher und zwei Sekunden aktive CPU-Zeit je Anfrage. Schwere ASR oder Diarisierung gehört daher nicht ungeprüft in diesen direkten Anfragepfad. [Supabase-Limits](https://supabase.com/docs/guides/functions/limits)

Vercels aktuelle Funktionsdokumentation nennt Standardpakete bis 250 MB, für Python 500 MB sowie große Funktionen bis 5 GB als Beta. Fluid Compute hat begrenzte Laufzeiten und je nach Tarif zwei oder vier GB RAM. Eigene Inferenz ist deshalb nicht pauschal ausgeschlossen, benötigt aber passende Artefakte, Projektkonfiguration und Betriebsmessungen. Ein offizieller Artikel vom Juli 2026 beschreibt WebSocket-Unterstützung als Beta; ältere Übersichten widersprechen. Eine dauerhafte Verbindung darf deshalb nicht allein aus einer Produktbeschreibung als im konkreten Projekt verfügbar vorausgesetzt werden. Kurze HTTP-Aufträge oder SSE mit wiederaufnehmbaren Zuständen bleiben eine prüfbare Alternative. [Funktionslimits](https://vercel.com/docs/functions/limitations), [WebSocket/SSE](https://vercel.com/i/websocket-vs-server-sent-events)

## Nachweis vor einer Zuverlässigkeitsaussage

Die Abnahme braucht deutsche Pflegeszenarien mit Verneinungen, Zahlen, Fachbegriffen, mehreren Sprechern, Fernsehton und Unterbrechungen. Zu messen sind Fehlaktivierungen pro Stunde, verpasste Aktivierungen, Latenz, Wort- und Zahlenfehler, Sprecherzuordnungen und falsch vorbereitete Aufträge. Netzwerk-, Konto- und Fallwechsel gehören in dieselbe Prüfung. Whisper nennt selbst erfundene oder wiederholte Transkripte als mögliche Einschränkungen. Eine reine Worterkennungsquote belegt daher noch keine sichere Pflegedokumentation. [Whisper-Modellkarte](https://huggingface.co/openai/whisper-large-v3)

Weitere technische Primärquellen: [Silero VAD](https://github.com/snakers4/silero-vad), [whisper.cpp Browserstreaming](https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream.wasm/README.md), [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), [sherpa Keyword Spotting](https://k2-fsa.github.io/sherpa/onnx/kws/index.html), [sherpa WASM](https://k2-fsa.github.io/sherpa/onnx/wasm/index.html), [pyannote Community-1](https://huggingface.co/pyannote/speaker-diarization-community-1), [Porcupine Web](https://picovoice.ai/docs/quick-start/porcupine-web/), [Picovoice-Bedingungen](https://picovoice.ai/docs/terms-of-use.html), [openWakeWord](https://github.com/dscripka/openWakeWord), [Speechmatics Diarisierung](https://docs.speechmatics.com/speech-to-text/features/diarization), [Speechmatics CPU-Container](https://docs.speechmatics.com/deployments/container/cpu-speech-to-text).
