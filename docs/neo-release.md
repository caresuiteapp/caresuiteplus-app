# NEO veröffentlichen

Das Veröffentlichungspaket übernimmt den bereits vorbereiteten NEO-Arbeitsstand. Es verwendet das bestehende Repository und dessen GitHub-Anbindung an Vercel. Die Infrastruktur bleibt bei Vercel und Supabase.

## Git Bash

Ein zweites Git-Bash-Fenster öffnen, falls im ersten noch der lokale Sprachdienst läuft. Die heruntergeladene Datei ausführen:

```bash
bash "$HOME/Downloads/CareSuite_NEO_Veroeffentlichen.sh" --publish
```

Der vorhandene Ordner `CareSuite_NEO_R1_20261121-003048-1668` wird automatisch gefunden. Bei Bedarf lässt sich ein anderer vorbereiteter NEO-Ordner mit `--repo ORDNER` angeben. Ohne `--publish`, beziehungsweise mit `--prepare`, bleibt der Ablauf lokal.

Das Paket prüft vor dem Schreiben die erwarteten Dateiinhalte und sichert ersetzte Dateien unter `.neo-runtime`. Es legt einen lokalen Sicherungszweig an, übernimmt ausschließlich die bezeichneten NEO-Dateien, holt den aktuellen Hauptzweig und führt beide Stände zusammen. Ein Konflikt in tatsächlichem Quellcode oder ein fehlgeschlagener Test hält den Push an. Die erzeugte Native-Quellkarte wird nach dem Zusammenführen neu berechnet. Private Dienstkonfiguration, Modelle, Umgebungsdateien und unabhängige lokale Änderungen werden nicht veröffentlicht.

Nach erfolgreicher NEO-Prüfung erfolgt ein normaler Git-Push auf `main`. Es gibt keinen Force-Push und keinen direkten Vercel-Deploy. Der vorhandene GitHub-Build führt anschließend die vollständigen Produktionsprüfungen aus. Erst dessen erfolgreicher Abschluss und die Produktionsfreigabe machen die Webänderung live. Das Skript erstellt keinen signierten App-Build.

## Enthaltene Änderungen und Grenzen

Die Webänderung umfasst die gemeinsame Aussprachevorbereitung, früher beginnende Sprachausgabe, die neue stille Dokumentationsoberfläche und prüfbare administrative NEO-Aufträge. Anamneseangaben werden mit Quellen als bearbeitbarer Entwurf vorbereitet; die bestehende Speicherung und fachliche Freigabe bleiben maßgeblich.

Die Terminmigration `20261121011544_neo_voice_and_appointments.sql` ist im produktiven Supabase-Projekt bereits angewendet. Sie ergänzt die abgegrenzten Datenbankfunktionen für NEO-Termine, Berechtigungsprüfung und Wiederholschutz. Der Veröffentlichungsschritt verändert keine Supabase-Einstellungen und spielt keine anderen ausstehenden Migrationen ein.

Der auf dem Windows-Rechner laufende Sprachdienst ist noch kein erreichbarer Dienst für die produktive Webanwendung. Der eigene Cloud-Erkennungsweg und die Verarbeitung hochgeladener Aufnahmen über diesen Weg sind damit noch nicht produktiv freigegeben. Das Veröffentlichen des Webcodes ersetzt diese Anbindung nicht. Die vorgesehene Umsetzung bleibt auf Vercel und Supabase beschränkt.

## Prüfungen

Die lokale NEO-Prüfung umfasst den abgegrenzten TypeScript-Projektstand, den Web-/Native-Quellabgleich, die NEO- und zugehörigen Dokumentationsregressionen sowie den Dienstbau. Der Veröffentlichungsablauf wird mit echten lokalen Git-Repositories auf Konflikte, fehlgeschlagene Prüfungen, konkurrierende Hauptzweigänderungen und den Ausschluss privater Dateien geprüft.

Die vollständige TypeScript-Prüfung des Gesamtprojekts ließ sich in der Entwicklungsumgebung wegen deren Speichergrenze nicht abschließen. Die bestehenden Produktionsprüfungen bei Vercel bleiben unverändert aktiv. Aus den NEO-Tests allein folgt weder eine bestandene Gesamtfreigabe noch eine bestätigte Bedienungs- oder Spracherkennungsqualität auf dem Endgerät.
