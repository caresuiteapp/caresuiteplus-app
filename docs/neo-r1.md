# NEO R1 · Sprache, Dokumentation und konkrete Arbeitsaufträge

Dieses Paket erweitert CareSuite lokal. Es enthält Quellcode für Web und App, die Datenbankmigration, den authentifizierten Gateway, einen selbst betriebenen Sprachdienst, Modellvorbereitung und Prüfungen. Der Installer veröffentlicht nichts und verändert den vorhandenen Arbeitsordner nicht. Es gibt keinen automatischen Git-Push, Vercel-Deploy oder signierten App-Build.

## Installation in Git Bash

Die heruntergeladene Datei ausführen:

```bash
bash "$HOME/Downloads/CareSuite_NEO_R1_GitBash.sh" --prepare-voice
```

Der Installer sucht zuerst ein vorhandenes CareSuite-Repository. Falls er keines findet, lädt er das bekannte Repository in einen eigenen Quellordner. Bei mehreren Checkouts kann der gewünschte Ordner ausdrücklich gewählt werden:

```bash
bash "$HOME/Downloads/CareSuite_NEO_R1_GitBash.sh" --repo "/c/Users/Kevin/CareSuite/caresuiteplus-app" --prepare-voice
```

Benötigt werden das vorhandene Git Bash und Node ab 20.19.4. Bereits vorhandene, zum Lockfile passende Projektabhängigkeiten werden über eine lokale Verknüpfung verwendet. Andernfalls stellt `npm ci` die unveränderten Projektabhängigkeiten her. Neue Paketabhängigkeiten fügt NEO nicht hinzu. Für die Windows-Spracherkennung lädt `--prepare-voice` eine geprüfte CPU-Engine und das mehrsprachige Modell nach. Dafür ist keine GPU erforderlich. Die vorhandenen NEO-Sprachausgabe-Assets werden ebenfalls geprüft und bei Bedarf ergänzt.

Der neue Ordner und Branch werden am Ende ausgegeben. Dort liegen die Änderungen zur Durchsicht im Git-Index. Bei einem Konflikt stoppt der Installer im getrennten Arbeitsstand und erhält den ursprünglichen Ordner. `--extract-only ORDNER` entpackt ausschließlich Patch und Unterlagen. `--no-check` überspringt ausdrücklich die lokale Prüfserie; dieser Modus ist keine Freigabe. Es gibt keine Option `--deploy`.

## Was sich verwenden lässt

| Ablauf | Verhalten |
| --- | --- |
| NEO sprechen lassen | Gemeinsame deutsche Aussprachevorbereitung für Zahlen, Zeiten, Einheiten, Gesetze und Abkürzungen. Kürzere erste Ausgabe, vorbereitetes nächstes Audiostück, paralleles Laden geprüfter Modellteile. Native Sprachausgabe wartet auf den vorherigen Stopp. |
| Still dokumentieren | In der Office-Dokumentation bei ausgewählten Klient:innen und im bearbeitbaren ambulanten Assessment. Aufnahme bewusst beginnen, Beteiligte informieren, Sprecher wählen, pausieren oder sofort widerrufen. NEO spricht währenddessen nicht. |
| Bereits vorhandene Aufnahme | Web: vom Browser decodierbare Audiodateien bis 30 MB / 30 Minuten. App: WAV mit 16-Bit-PCM, einer oder zwei Spuren, bis 30 MB / 30 Minuten. Verarbeitung in kleinen Abschnitten über den eigenen Dienst. Quellen starten als unklar und müssen zugeordnet werden. Zeitpositionen importierter Aufnahmen sind relative Positionen, keine behaupteten Aufnahmezeitpunkte. |
| Angaben vorbereiten | Eigene konservative Zuordnung zu sechs Themenfeldern. Originalaussagen, Sprecher, Verneinung, Unsicherheit und Fremdanamnese bleiben sichtbar. Optional kann ein selbst betriebener Sprachmodell-Endpunkt bei der Zuordnung helfen. |
| Angaben übernehmen | Geprüfte Zitate werden in den aktuellen lokalen Dokumentationsentwurf beziehungsweise die Themenperspektive der Anamnese eingetragen. Der bestehende Speichervorgang, Berechtigungen, Versionsprüfung und fachliche Freigaben bleiben maßgeblich. |
| Termine anlegen | Gesprochenen oder eingegebenen Auftrag prüfen, Person und Zeiten anzeigen, ausführen. Termin, Kalendereintrag und Wiederholschutz entstehen in einer PostgreSQL-Transaktion. Derselbe bestätigte Auftrag kann nach einer unterbrochenen Antwort ohne Doppelanlage geprüft werden. |
| Einzelnen Einsatz verschieben | Konkreten zukünftigen Einsatz wählen. NEO prüft aktuellen Stand, Person, Überschneidungen und bei zugewiesenen Mitarbeitenden die hinterlegte freie Verfügbarkeit. Dauer und Fachdaten bleiben erhalten. Der vorhandene Einsatzdienst erledigt die Änderung und ihre Folgearbeiten. |

Beispiele für Arbeitsaufträge:

```text
Erstelle einen Termin morgen um 14 Uhr für 30 Minuten: Beratung
Verschiebe den Einsatz am 25.11.2026 um 15 Uhr
```

Ein Auftrag führt genau eine administrative Aktion aus. Fehlende Angaben werden abgefragt; NEO erfindet weder eine Dauer noch einen Titel. Zeitangaben beziehen sich auf Europe/Berlin. Mehrdeutige Uhrzeiten bei der Zeitumstellung und Serienänderungen werden hier abgewiesen. Bereits begonnene oder unterschriebene Einsätze bleiben diesem Ablauf entzogen. Nach fehlender Bestätigung einer Einsatzänderung gibt es keinen automatischen zweiten Schreibversuch.

## Eigenen Sprachdienst starten

Im vom Installer ausgegebenen Arbeitsordner:

```bash
node scripts/start-neo-local.mjs
```

Das Modell und die Windows-CPU-Engine werden durch `node scripts/prepare-neo-local.mjs` vorbereitet. Unter Linux/macOS wird eine bereits vorhandene passende `whisper-cli` über `NEO_WHISPER_BINARY` verwendet. Das Paket installiert dort keine zusätzliche Systemsoftware. Der Node-Dienst ist bereits über `node scripts/build-neo-service.mjs` baubar und benötigt keine weiteren npm-Pakete.

Der Dienst hört standardmäßig nur auf `127.0.0.1:43179`. Er dient als lokales Entwicklungswerkzeug. Die produktive Infrastruktur ist auf Vercel und Supabase festgelegt. Die laufende Windows-Instanz verbindet sich nicht automatisch mit der veröffentlichten Webanwendung. Die eigene Spracherkennung muss dafür noch für den Betrieb auf der vorgesehenen Infrastruktur angepasst und geprüft werden.

Die private Konfiguration wird in `.neo-runtime/settings.json` erstellt. Sie wird nicht ausgegeben und ist von Git ausgeschlossen. Start mit gesetzter `NEO_SERVICE_URL` erzeugt zusätzlich `.neo-runtime/supabase-secrets.env`. Das Geheimnis gehört ausschließlich in den Gateway und den eigenen Dienst, niemals in `EXPO_PUBLIC_*`, einen Browser-Build oder ein öffentliches Repository.

Die Migration `supabase/migrations/20261121011544_neo_voice_and_appointments.sql` wurde am 21.11.2026 im bestätigten produktiven Supabase-Projekt angewendet. Der Dateiname entspricht dem dort gespeicherten Migrationsstand. Der Veröffentlichungsschritt spielt keine weiteren Migrationen ein. Der beigefügte Gateway und die eigene Cloud-Spracherkennung sind damit noch nicht aktiviert. Vor deren Freigabe sind Mikrofon, Aufnahmeabbruch, Zuordnung, Speichern und Terminbestätigung in einem freigegebenen Testfall zu prüfen. Der aktuelle Veröffentlichungsablauf steht in `docs/neo-release.md`.

Ein eigenes lokales Sprachmodell ist optional. Der Sprachdienst verwendet dafür einen selbst betriebenen OpenAI-kompatiblen Chat-Completions-Endpunkt über `NEO_REASONING_URL`, optional `NEO_REASONING_TOKEN`. HTTP ist dabei nur für Loopback erlaubt, sonst HTTPS. Ohne diesen Endpunkt bleibt die eigene regelbasierte Zuordnung verwendbar. Es gibt keinen voreingestellten externen KI-Anbieter und keinen versteckten API-Schlüssel.

## Datenbezug und Grenzen

Neue Aufnahmen benötigen einen bestätigten Mandanten, Teamzugang und Klientenbezug. Konto- oder Personenwechsel verwerfen alte laufende Antworten. Der Gateway prüft Rechte vor und nach einer Inferenz. Roh-Audio wird im Node-Dienst nur vorübergehend für die lokale Engine verarbeitet und anschließend entfernt; der Dienst protokolliert weder Audio noch Gesprächsinhalte. Es werden keine Patientendaten für Trainingszwecke gesammelt. Transkripte bleiben bis zur geprüften Übernahme im lokalen Formular. Beim Hintergrundwechsel und bei Widerruf stoppt die Erfassung.

Die Web-Browsererkennung ist eine ausdrücklich wählbare Alternative und kann den Sprachdienst des Browseranbieters verwenden. In der App erfolgt die alternative Erkennung mit dem lokalen Gerätesprachpaket. Die native Mikrofonaufnahme verwendet ebenfalls die vorhandene lokale Geräteintegration; das eigene Whisper-Modell transkribiert den aufgezeichneten Abschnitt im eigenen Dienst. Dafür muss die lokale Aufnahme-/Spracherkennungsfunktion des Geräts verfügbar sein.

Automatische Sprechertrennung, sicheres Erkennen aller medizinischen Sachverhalte und eigenständige klinische Entscheidungen sind mit R1 nicht nachgewiesen. Bei mehreren Sprechern muss der Wortlaut in eindeutig zugeordnete Abschnitte aufgeteilt werden. Das Modell darf vollständige belegte Aussagen zuordnen und keine Verneinung aus einem Zitat abschneiden. Auch ein belegtes Zitat kann falsch erkannt oder dem falschen Thema zugeordnet sein; deshalb bleibt die Sichtprüfung erforderlich. NEO erzeugt keine Risikobewertung, Diagnose oder fachliche Freigabe.

Bei Einsatzänderungen werden aktueller Stand und Konflikte vor dem bestehenden Planungsdienst geprüft. Die vorhandene Folgeprozesskette ist keine neu eingeführte atomare Gesamttransaktion; konkurrierende Änderungen und fehlgeschlagene Folgearbeiten müssen über die bestehenden Bestätigungen abgeglichen werden. Dafür zeigt NEO ausdrücklich einen unbestätigten Zustand an.

## Rechte an der Entwicklung

NEO-Orchestrierung, Quellenprüfung, Zuordnungsregeln, Oberflächen und die CareSuite-Anbindung sind im Paket als eigene Implementierung enthalten. Die Basismodelle und Laufzeitbibliotheken sind fremde quelloffene Komponenten: whisper.cpp v1.8.4, das Whisper-small-Modell und die bereits im Projekt vorhandenen Sprachausgabe- und Gerätebibliotheken. Das ist keine selbst trainierte Foundation-Engine. Die bestehende NEO-Stimme und ihre Lizenzen bleiben maßgeblich. Quellen und Hinweise: [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [Whisper](https://github.com/openai/whisper), [Modellartefakt](https://huggingface.co/ggerganov/whisper.cpp).

Ein eigener Quellcode belegt keine Neuheit oder Patentfähigkeit. Das ursprüngliche Installationspaket veröffentlicht den Arbeitsstand nicht. Der nachfolgend angeforderte Veröffentlichungsschritt steht gesondert in `docs/neo-release.md`.

## Prüfungen und offene Abnahme

`node scripts/verify-neo.mjs` prüft den NEO-TypeScript-Umfang, den gemeinsamen Web-/App-Quellabgleich, die einschlägigen vorhandenen Regressionstests und den Bau des eigenen Node-Sprachdienstes. Die SQL-Tests führen die echte neue Migration auf synthetischen PostgreSQL-Daten aus. Sie kontaktieren keine produktiven Konten.

Der separate Prüfbericht im Download nennt den tatsächlich geprüften Stand. Die Prüfserie ersetzt keine vollständige Webrelease-Prüfung, keine Layout-Abnahme am Gerät, keine Messung des echten Mikrofon-/Netzwerkwegs und keine klinische Validierung. Der vollständige Projekt-Webbuild scheiterte in der vorhandenen Client-Intake-Prüfung am Speicherlimit; das ist kein erfolgreicher Gesamtbuild. Ein produktiver Vercel-Deploy wurde nicht ausgeführt.
