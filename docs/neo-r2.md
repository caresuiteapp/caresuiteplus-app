# NEO R2: Sitzungen, Aufgaben und technische Nachweise

Ausgangspunkt ist der erfolgreich veröffentlichte Stand `5206930aa7b6d20b17b7495754e668d47b597a1a`. Dieses Paket bereitet R2 im vorhandenen NEO-Arbeitsordner vor. Vercel und Supabase bleiben die vorgesehenen Anbieter. Ein signierter App-Build gehört nicht zu diesem Schritt.

## Vorbereiten

```bash
bash "$HOME/Downloads/CareSuite_NEO_R2_GitBash.sh" --prepare
```

Der Ordner wird automatisch gefunden. `--repo ORDNER` wählt ausdrücklich einen anderen vorbereiteten NEO-Arbeitsstand. Das Paket prüft die bisherigen Inhalte, sichert ersetzte Dateien, übernimmt die Änderungen und führt die erweiterte NEO-Prüfung aus. Es installiert keine zusätzlichen npm-Pakete und lädt keine Sprachmodelle erneut.

Die technischen Unterlagen liegen unter `docs/neo-r2-construction.md`, die strukturierte Entwicklungsakte unter `docs/neo-r2-invention-record.json`, die Recherche unter `docs/neo-r2-market-research.md`. Nach erfolgreicher Prüfung legt `scripts/record-neo-construction.mjs` zusätzlich eine private Kopie des bezeichneten Quellstands und seiner Prüfsummen unter `.neo-runtime/construction-records` an. Dort werden keine Patientengespräche, Audiodaten oder Zugangsdaten gesammelt. Lokale Uhrzeit und Dateihashes sind kein unabhängiger Zeitstempel und kein Patentnachweis.

Ein ausdrücklich gewähltes `--publish` führt nach den Prüfungen einen normalen Git-Push auf den Hauptzweig aus. Der bestehende Vercel-Build übernimmt die vollständigen Produktionsprüfungen. Der Hauptzweig ist öffentlich; neue technische Einzelheiten werden dadurch öffentlich zugänglich. Die Bauunterlagen erläutern die Auswirkungen auf eine mögliche spätere Patentanmeldung. Die Vorbereitung selbst bleibt lokal.

## Verhalten

NEO startet nach dem Aktivieren ohne erneute Vorstellung. Im stillen Modus behandelt der Assistent allgemeines Sprechen nicht als Auftrag. Eine direkte NEO-Anrede öffnet ein 15 Sekunden langes Dialogfenster. Nach einer Antwort läuft dieses Fenster erneut. Ohne weitere Ansprache geht NEO zurück zum stillen Modus. Die Anrede wird in dieser Version am erkannten Text geprüft; ein eigenes akustisches Aktivierungswortmodell ist noch nicht validiert.

Die Dokumentationssitzung läuft nach bewusster Freigabe innerhalb des sichtbaren Arbeitsbereichs weiter. Der vorherige starre 30-Minuten-Stopp entfällt. Eine harte Grenze von 200 Abschnitten beziehungsweise 60.000 Zeichen hält die Verarbeitung begrenzt. Widerruf, Hintergrundwechsel, Fall-/Kontowechsel und Verlassen des Arbeitsbereichs beenden die Erfassung. Eine geschlossene oder vom Betriebssystem angehaltene Anwendung hört damit nicht weiter.

Aussagen werden während des Zuhörens bereits konservativ den Dokumentationsthemen zugeordnet. Die Quellen und manuell bestätigten Rollen bleiben sichtbar. Pflegekraft und Ärzt:in besitzen getrennte Quellenbezeichnungen. Eine akustische Sprecherkennung oder automatische Berufszuordnung ist damit nicht implementiert. Unbekannte Stimmen bleiben unbekannt. Ein nicht eindeutig abgegrenzter Sprecherwechsel erfordert eine ausdrückliche Korrektur.

Die neue Arbeitsvorbereitung enthält Aufgaben, Wiedervorlagen und Übergaben mit unveränderten Quellenzitaten. Eindeutige beschriftete Angaben können vorausgefüllt werden, zum Beispiel:

```text
NEO, erstelle eine Aufgabe: Rollator besorgen. Zuständig: Pflegekraft. Fällig: 25.11.2026
NEO, bereite eine Übergabe vor.
```

Fehlende oder mehrdeutige Zuständigkeiten und Fristen bleiben als Rückfragen offen. Weitere Aufträge warten, ohne den gerade bearbeiteten Entwurf zu ersetzen. Geprüfte Entwürfe können in der Office-Dokumentation in den aktuellen lokalen Dokumentationsentwurf übernommen werden. Eine Aufgabe ist damit noch nicht in der Aufgabenplanung gespeichert, und eine Wiedervorlage ist noch keine aktivierte Erinnerung.

Termine und einzelne zukünftige Einsätze verwenden die vorhandenen NEO-Schreibdienste mit gesonderter Prüfung und Bestätigung. Sie können aus der laufenden Sitzung vorbereitet werden, ohne eine zweite Mikrofonaufnahme zu beginnen. Eine erkannte Aussage oder eine belegte Analyse wird nie allein zur behaupteten Speicherbestätigung. Importierte Aufnahmen und eingefügter Text lösen keine neuen Live-Befehle aus.

„Ablauf erklären“ verwendet die laufende Anleitung, das ausgewählte Thema oder eine bekannte freigegebene Route. Fehlt ein eindeutiger Bezug, fragt NEO nach. Die Antwort erklärt den konkreten Einstieg und die nächsten Schritte; eine erneute Vorstellung gehört nicht dazu.

## Eigene Spracherkennung und offener Nachweis

Die neuen Vercel-Endpunkte `/api/neo/status` und `/api/neo/transcribe` prüfen den Benutzer und die aktuellen Supabase-Fallrechte vor und nach der Verarbeitung. Sie verwenden keinen Service-Role-Zugang für Falldaten und keinen automatischen Wechsel zu einem externen Spracherkennungsanbieter. Die lokale Browseroption verlangt `processLocally`; unterstützt der Browser das deutsche lokale Sprachpaket nicht, startet dieser Weg nicht. Die App verwendet ihr installiertes lokales Sprachpaket.

Die Vercel-Engine bleibt ohne geprüfte Linux-Dateien und ausdrückliche Betriebsfreigabe inaktiv. Das Paket liefert keine als produktionsfähig behauptete Linux-Binärdatei. `node scripts/prepare-neo-vercel.mjs --check` zeigt den Vorbereitungsstand. Das Windows-Programm des bisherigen lokalen Dienstes ist kein Linux-Programm.

Am 21.11.2026 wurde zusätzlich eine Linux-CPU-Ausführung aus den vorhandenen whisper.cpp-Quellen gebaut und mit einem synthetischen deutschen Piper-Clip geprüft. Der Clip dauert 5,422 Sekunden. Die generische SSE2-Ausführung mit zwei Threads lieferte innerhalb von 85 Sekunden kein Ergebnis. Eine gesonderte AVX2/FMA-Ausführung mit zwei Threads benötigte 8,259 Sekunden. Sie erhielt „keine Schmerzen“ und die NEO-Anrede in diesem einzelnen sauberen Beispiel, veränderte aber die Zeichensetzung. Das ist weder Echtzeitverarbeitung noch eine Genauigkeitsprüfung für Pflegegespräche oder ein Nachweis auf Vercel. Die Versuchsprogramme werden nicht mit diesem Produktpaket ausgeliefert; Laufzeitkompatibilität und Lizenzpflichten bleiben vor einer Auslieferung gesondert zu prüfen.

Die globale Sprachausgabe pausiert die Erkennung während der eigenen Antwort und nimmt sie danach wieder auf. Verlässliches Unterbrechen während der Ausgabe, automatische akustische Sprechertrennung und eine vollständige klinische Validierung sind offen. Die neuen Tests prüfen Zustände, Quellbezug, Rollen, Abbruch, Transport und Arbeitsvorbereitung. Eine Layoutprüfung im echten Browser war wegen dessen gesperrter Laufzeit in der Entwicklungsumgebung nicht möglich.
