# Neo – lokale CareSuite-Stimme, Version 4

Neo nutzt weiterhin die feste deutsche Thorsten-Stimme. Bekannte Navigationsantworten und die Vorstellung werden als fertige Aufnahmen abgespielt. Profilnamen, Uhrzeit, Datum, Wettertexte und kurze Gesprächsantworten werden bei Bedarf im Browser mit derselben Stimme erzeugt. Es gibt keine externe Sprach-API, keine Stimmenauswahl und keinen API-Schlüssel.

Die Stimme nutzt ein vorhandenes Sprachmodell mit angepasster Sprechgeschwindigkeit und Lautstärke, keine exklusiv neu trainierte Sprecheridentität. Der Name des Assistenten lautet Neo. Die Vorstellung lautet exakt: „Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.“

## Laufzeit

`public/neo-voice/v1/` enthält einen eigenen Web Worker, Piper-Phonemize-WASM, ONNX Runtime Web 1.18.0 und die in 14 Teile aufgeteilten Modelldaten. Der Installer lädt das Modell einmalig von der festgelegten öffentlichen Quelle herunter, prüft die SHA-256-Summe und legt die Teile im Projekt ab. Dafür wird das bereits vorhandene Node.js verwendet. Es sind keine neuen npm-Abhängigkeiten, Sprachserver oder separaten Programme auf dem Zielrechner erforderlich.

Der Browser lädt die Sprachengine und das etwa 114 MB große Modell erst für eine Antwort, die nicht als feste Aufnahme vorliegt. Die Modellteile werden nach Möglichkeit im Browser zwischengespeichert. Beim ersten Mal kann die Antwort deshalb länger dauern. Mit geladener Engine funktioniert auch die Ausgabe neuer Namen und Uhrzeiten offline. Privates Browsen oder fehlender Speicherplatz können dauerhafte Zwischenspeicherung verhindern.

Persönliche Texte und erzeugte Audios bleiben im Arbeitsspeicher der angemeldeten Sitzung. Beim Abmelden wird der Sprachworker beendet; der begrenzte Audio-Cache wird geleert. Im dauerhaften Browser-Cache stehen nur öffentliche Modellteile. Die Einstellung der Stimme entspricht dem bisherigen Modell: noise_scale 0.60, length_scale 1.18 und noise_w_scale 0.70. Die Web-Ausgabe erhält eine begrenzte Lautstärke mit Spitzenwert unter 0,65.

## Verhalten

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

Die ursprünglich gelieferten MP3-Navigationsantworten wurden mit Piper 1.4.2 vorab erzeugt; ihr Bericht und Generator bleiben für die Pflege enthalten. Neue freie Antworten entstehen jetzt durch den separaten Browser-Worker. Die Android-Komponente bleibt unverändert leer.

## Produktionsbuild

`npm run build:web:production` stellt Sprachengine und Modell automatisch bereit. `scripts/neo-voice-assets.json` legt Quellen, Versionen, Größen und SHA-256-Summen fest. Alle Downloads finden während des Builds statt; der Browser lädt nur Dateien derselben CareSuite-Domain. Der Export wird vor der Veröffentlichung auf vollständige, unveränderte Sprachdateien und Lizenz-/Quellcode-Dateien geprüft.

## Feste Markenaussprache

„CareSuite Health OS“ wird mit englischen Lauten als „Care Suite Health O S“ gesprochen. Der Browser-Worker setzt dafür englische Phoneme ein; Stimme, deutscher Satz und sichtbarer Markenname bleiben konsistent. Die fest gespeicherte Vorstellung wurde mit dieser Aussprache neu erzeugt.
