# Neo – lokale CareSuite-Stimme, Version 6

Neo nutzt weiterhin die feste deutsche Thorsten-Stimme. Bekannte Navigationsantworten und die Vorstellung werden als fertige Aufnahmen abgespielt. Profilnamen, Uhrzeit, Datum, Wettertexte und kurze Gesprächsantworten werden bei Bedarf im Browser mit derselben Stimme erzeugt. Es gibt keine externe Sprach-API, keine Stimmenauswahl und keinen API-Schlüssel.

Die Stimme nutzt ein vorhandenes Sprachmodell mit angepasster Sprechgeschwindigkeit und Lautstärke, keine exklusiv neu trainierte Sprecheridentität. Der Name des Assistenten lautet Neo. Die Vorstellung lautet exakt: „Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.“

## Laufzeit

`public/neo-voice/v1/` enthält einen eigenen Web Worker, Piper-Phonemize-WASM, ONNX Runtime Web 1.18.0 und die in 14 Teile aufgeteilten Modelldaten. Der Installer lädt das Modell einmalig von der festgelegten öffentlichen Quelle herunter, prüft die SHA-256-Summe und legt die Teile im Projekt ab. Dafür wird das bereits vorhandene Node.js verwendet. Es sind keine neuen npm-Abhängigkeiten, Sprachserver oder separaten Programme auf dem Zielrechner erforderlich.

Der Browser lädt die Sprachengine und das etwa 114 MB große Modell erst für eine Antwort, die nicht als feste Aufnahme vorliegt. Die Modellteile werden nach Möglichkeit im Browser zwischengespeichert. Beim ersten Mal kann die Antwort deshalb länger dauern. Mit geladener Engine funktioniert auch die Ausgabe neuer Namen und Uhrzeiten offline. Privates Browsen oder fehlender Speicherplatz können dauerhafte Zwischenspeicherung verhindern.

Persönliche Texte und erzeugte Audios bleiben im Arbeitsspeicher der angemeldeten Sitzung. Beim Abmelden wird der Sprachworker beendet; der begrenzte Audio-Cache wird geleert. Im dauerhaften Browser-Cache stehen nur öffentliche Modellteile. Die ruhigere Einstellung ab Version 6 lautet: noise_scale 0.55, length_scale 1.45 und noise_w_scale 0.45. Das Modell erzeugt die langsamere Aussprache direkt; Tonhöhe und Wiedergaberate bleiben unverändert. Vollständige Sätze werden getrennt synthetisiert und mit 240 ms zusätzlicher Sprechpause verbunden. Die vollständigen Samples bleiben erhalten; 10-ms-Randblenden verhindern harte Audioübergänge. Jede Antwort erhält 70 ms Vorlauf und 120 ms Nachlauf. Die Web-Ausgabe erhält eine begrenzte Lautstärke mit Spitzenwert unter 0,65.

## Verhalten

- Während des Startvideos wird Neo nicht eingeblendet und keine Sprachengine angelegt. Erst die vorhandene Intro-Freigabe aktiviert ihn für berechtigte angemeldete Nutzer. Das gilt auch bei automatischer Wiederanmeldung, Autoplay-Sperre und Videofehlern.
- Erst vollständig sprechen, dann navigieren. Auch Zurück und Klientenakten folgen dieser Reihenfolge.
- Zweiter Klick, Escape, Ziehen, Tabwechsel oder Abmelden brechen die laufende Aktion einschließlich anstehender Navigation ab.
- Berechtigungen werden vor der Antwort und nochmals unmittelbar vor dem Seitenwechsel geprüft.
- Der Profilname kommt aus der aktuellen angemeldeten Sitzung. Fehlt ein geeigneter Name, erfolgt eine neutrale Begrüßung ohne erfundenen Namen oder E-Mail-Adresse.
- Uhrzeit und Datum kommen von der lokalen Gerätezeit bei der Anfrage.
- Wetter: aktuelle DWD-Beobachtungen über Bright Sky, maximal 90 Minuten alt und aus höchstens 50 km Entfernung. Die Standortfreigabe des Browsers wird nur für eine Wetterfrage benötigt. An den Wetterdienst gehen auf zwei Nachkommastellen gerundete Koordinaten, keine Profilnamen oder Sprachaufnahmen. Prognosen und frei gewählte Städte sind noch nicht eingebaut.
- Der vorhandene Browserdienst für Mikrofonerkennung bleibt bestehen und kann Internet benötigen.

## Position

Neo startet etwas tiefer, an der vertikalen Mitte der vorhandenen Profil-/Bedienleiste. Bei Platzmangel wird eine Überlagerung dieser Leiste vermieden. Maus- und Touch-Ziehen ändern die Position, ohne das Mikrofon zu starten. Der Browser speichert sie pro Nutzer und Mandant. Größenänderungen halten Neo im sichtbaren Bereich. Bei Tastaturfokus verschieben Pfeiltasten den Roboter; Umschalt vergrößert den Schritt; Pos1 stellt die Startposition wieder her.

## Herkunft und Lizenzen

Modellquelle und Prüfsummen: `model-source.json`; Teile: `public/neo-voice/v1/voice-manifest.json`. Vollständige Hinweise, Lizenztexte, verfügbare Quellcode-Snapshots und Bauanleitung: `public/neo-voice/v1/licenses/THIRD-PARTY.md`.

Alle 52 Navigationsaufnahmen und die feste Vorstellung wurden mit demselben Browser-Worker neu erzeugt, der auch freie Antworten spricht. `render-browser.mjs` ist die aktuelle reproduzierbare Rendering-Vorlage; sie verwendet die vorhandene Playwright-Entwicklungsabhängigkeit und FFmpeg. `generate_voice.py` bleibt nur als historische Vorlage für die früheren Aufnahmen enthalten. `voice-report.json` dokumentiert Dauer, Pegel, Prüfsummen und den exakten Worker-Stand der neuen Aufnahmen. Die Android-Komponente bleibt unverändert leer.

## Produktionsbuild

`npm run build:web:production` stellt Sprachengine und Modell automatisch bereit. `scripts/neo-voice-assets.json` legt Quellen, Versionen, Größen und SHA-256-Summen fest. Alle Downloads finden während des Builds statt; der Browser lädt nur Dateien derselben CareSuite-Domain. Der Export wird vor der Veröffentlichung auf vollständige, unveränderte Sprachdateien und Lizenz-/Quellcode-Dateien geprüft.

## Feste Markenaussprache

„CareSuite Health OS“ wird mit englischen Lauten als „Care Suite Health O S“ gesprochen. Der Browser-Worker setzt dafür englische Phoneme ein; Stimme, deutscher Satz und sichtbarer Markenname bleiben konsistent. Die fest gespeicherte Vorstellung wurde mit dieser Aussprache neu erzeugt.

## Hörprobe und Grenzen

Die Hörprobe enthält dieselben kodierten Aufnahmen wie die App: Vorstellung, Begrüßung, Kalenderantwort, Uhrzeit und eine Fehlerrückmeldung. Gemessene Dauer und störungsfreie Audiodaten belegen Tempo und technische Integrität, nicht subjektive Natürlichkeit. Das bestehende deutsche Modell begrenzt weiterhin Prosodie und englische Aussprache.
