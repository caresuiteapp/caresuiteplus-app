# Web: Unterschriften, Diktat und Medien

Basis: bdc0ea16f13e1e46b1d8ba9f30ebfb13659f1de3.

## Änderungen

- Die Web-Unterschrift verwendet eine stabile Schreibfläche für Desktop, Tablet und schmale Browserfenster. Änderungen der Fenstergröße wechseln nicht mehr zwischen zwei unterschiedlichen Modal-Bäumen. Vorhandene Striche bleiben im Canvas-Modell erhalten. Schließen und Navigation berücksichtigen ungespeicherte Striche; während eines abgewarteten Speichervorgangs sind weitere Bestätigungen und Schließen gesperrt. Fehlermeldungen erscheinen in der geöffneten Schreibansicht.
- Die vorhandene Unterschriftslogik und serverseitige Bestätigung bleiben maßgebend; ein lokales Bild allein bestätigt keine Speicherung. Zeichnungen werden nicht neu in Browser-Speichern abgelegt.
- Einsatzmedien werden zuerst ausgewählt und angezeigt, dann ausdrücklich hochgeladen. Fehler behalten die Auswahl bei. Mehrfachklicks starten keine parallelen Uploads. Veraltete Antworten nach einem Wechsel des Einsatzes ändern nicht den neuen Dialog.
- Audio kann angehört und bewusst gespeichert werden. Fehler schließen die Aufnahme nicht mehr. Eine lokale Sicherung der eigenen Aufnahme ist bei einem Uploadfehler verfügbar. Es werden keine Ersatznotizen für fehlgeschlagene Audio-Uploads in die Dokumentation geschrieben.
- Die Web-Dateiprüfung akzeptiert die bereits in der vorhandenen Speicher-Migration zugelassenen Audioformate, normalisiert MIME-Parameter und begrenzt Audio auf 50 MB. Die bestehende Prüfung für Fotos, Videos und PDF bleibt erhalten. Die Medienart vorhandener Metadaten wird korrekt als Bild, Video, Audio oder Dokument gelesen.
- Der gemeinsam verwendete Web-Audiorecorder wird einer aufnehmenden Komponente zugeordnet. Nicht aufnehmende Komponenten beenden beim Unmount keine fremde Aufnahme. Doppelte Start-/Stoppaufrufe werden abgefangen.
- Diktat ersetzt aktualisierte Erkennungsergebnisse an ihrer Position. Vorläufige Wörter werden nicht erneut angehängt. Beenden, Abbrechen und Aufräumen sind möglich. Erkannter Text wird vor der Übernahme bearbeitbar gezeigt und muss anschließend mit der Dokumentation gespeichert werden.
- Allgemeine Dokument-Uploads behalten Datei und Kommentar bei Fehlern, sperren Zuordnungsänderungen während der Übertragung und schützen ungespeicherte Eingaben. Suchbare Klientenauswahl, Lade-/Fehlerzustände, sichtbare Office-Rückmeldung und erneutes Laden der Liste sind enthalten.
- Bei einer unklaren Bestätigung des Upload-Datensatzes wird die exakt zugehörige ID samt Mandant, Mitarbeiter und Speicherpfad abgefragt. Erfolgreich hochgeladene Bytes werden bei einer unklaren Antwort nicht gelöscht. Nicht bestätigte Vorgänge werden nicht als erfolgreich dargestellt; vor einem erneuten Einreichen wird zum Aktualisieren der Liste aufgefordert.
- Web-Dialoge nutzen die sichtbare Browserhöhe bei geöffneter Bildschirmtastatur. Neue Texte beachten die vorhandene Schriftgrößeneinstellung.

## Umfang und Veröffentlichung

Ausschließlich Web-Overrides und diese Release-Notiz. Keine nativen App-Dateien, keine Änderungen an gespeicherten Einsätzen, Zeiten oder Unterschriften und keine neue Infrastruktur. Bestehende Authentifizierung, Mandantengrenzen und Speicherberechtigungen bleiben zuständig.

Auf ausdrücklichen Nutzerwunsch keine Tests, kein Lint-/Typprüflauf und keine Browser-Abnahme. Nur der erforderliche Expo-Web-Veröffentlichungsbuild wird ausgeführt. Die funktionale und visuelle Abnahme erfolgt manuell nach dem Deploy. Damit wird weder eine hundertprozentige Fehlerfreiheit noch die Vollständigkeit sämtlicher anderer Produktbereiche behauptet.
