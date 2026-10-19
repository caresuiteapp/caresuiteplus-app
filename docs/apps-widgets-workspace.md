# Apps & Widgets: Web-Desktop

## Verhalten

Das Center zeigt Apps, Widgets, Workflows und Hintergründe in einer hellen Oberfläche. Beim Öffnen sind alle Einträge des gewählten Bereichs sichtbar. Die Suche berücksichtigt Titel, Beschreibung und Kategorie; Filter lassen sich zurücksetzen. Tabs sind per Tastatur bedienbar, aktive Auswahl und Speicherzustand sind beschriftet.

Auf dem Desktop bleibt die bisherige Ansicht mit den Bereichsreitern unter „Mein Desktop“ erhalten. Die globale Kopfzeile enthält keine zusätzliche Desktop-Auswahl. Nur im Apps-&-Widgets-Center gibt es die neue, helle Bereichsauswahl: Alle acht Desktops sind als Schaltflächen mit Bild-Icon sichtbar; der aktive Bereich ist hervorgehoben. Nicht freigegebene Bereiche sind im Katalog gekennzeichnet und nicht auswählbar. Beim Bereichswechsel bleibt das Center mit dem gewählten Reiter geöffnet, Such- und Kategoriefilter werden zurückgesetzt und die Einträge sowie Zähler wechseln zum neuen Bereich. Ein Wechsel zum bereits aktiven Bereich löst weder einen Neustart noch einen weiteren Speichervorgang aus.

Jede verfügbare Seite erhält ein plastisches Bild-Icon aus dem vorhandenen Premium-Bildsatz in der Navigation, im App-Katalog und als Widget. Verwandte Seiten verwenden passende gemeinsame Motive. Apps, Widgets und Workflows haben im Center gleich hohe, zentrierte Bildflächen mit `contain`; auch Notizen und zusätzliche Seiten verwenden echte PNG-Bilder. Bestehende Premium-Motive bleiben erhalten. Google-Widgets behalten auf dem Desktop ihre Live-Inhalte und erhalten ein Bild-Icon in der Kopfzeile; im Katalog zeigen sie eine Bildvorschau. Workflow-Karten öffnen den jeweiligen Arbeitsbereich; sie behaupten keine automatische Ausführung. Alle Hintergrundvorschauen verwenden dieselbe 16:9-Bildfläche mit `cover`, auch bei fehlgeschlagenem Bildladen.

Widgets lassen sich hinzufügen, entfernen und vor- oder zurückschieben. Mehr als zwölf Widgets werden auf weitere Desktop-Seiten verteilt. Doppelte Seiten-Aliase werden zusammengeführt. Modul-, Rollen- und Fachberechtigungen begrenzen den Katalog; gesperrte oder unfertige Seiten werden dadurch nicht freigeschaltet.

## Speicherung

Die bestehende lokale Speicherung bleibt bestehen. Widget-Auswahl und aktiver Bereich sind nach Mandant und Person getrennt; die Widget-Auswahl zusätzlich nach Desktop-Bereich. Hintergrund und Navigationszustand behalten ihre bisherigen personengebundenen Schlüssel und gelten bereichsübergreifend auf diesem Gerät.

Eine gemeinsame Warteschlange ordnet Lesen und Schreiben innerhalb des geöffneten Dokuments. Veraltete Lade- oder Speicherantworten überschreiben keinen neueren Zustand. Ausdrücklich leere Auswahlen bleiben leer. Temporär nicht berechtigte Widgets bleiben in den gespeicherten Einstellungen erhalten und werden nur ausgeblendet. Beschädigte Einstellungen lösen einen Ladefehler aus, ohne sie mit Standardwerten zu überschreiben.

Speicherfehler sind sichtbar und können mit der aktuellen Auswahl erneut versucht werden. Das Verlassen über App-, Bereichs- oder Profilnavigation nach einem Speicherfehler erfordert eine bewusste Bestätigung. Bei ausstehender oder fehlgeschlagener Speicherung wird der Browser beim Schließen oder Neuladen um eine Warnung gebeten. Es gibt keine Zusage zur Synchronisierung zwischen Geräten oder parallel geöffneten Tabs.

## Prüfung

Die vorhandene Office-Notes-Releaseprüfung umfasst zusätzlich Katalogrechte, Bild-Zuordnung, Speicherwarteschlange und Screen-Interaktionsfälle mit dem tatsächlichen Center und Preference-Hook. Der Bildtest prüft alle tatsächlichen Katalogrouten, vorhandene PNG-Dateien in drei Größen und Bilder in jeder App-, Widget- und Workflow-Karte. Dazu gehören die bisherigen Desktop-Reiter, das Fehlen der neuen Auswahl in der globalen Kopfzeile, Desktop-Wechsel im Katalog, Erhalt des aktiven Reiters, deaktivierte Bereiche, Suche, Navigation, Widget-Reihenfolge, mehrere Seiten, Hintergründe, Wiederherstellung, Rechtewechsel, Speicherfehler und Tastaturbedienung. Die Host- und Speicherschnittstellen werden isoliert simuliert; produktive Daten werden nicht verändert.

Lokale Modellprüfungen, Syntaxprüfung der vorhandenen Gate-Skripte, Routenprüfung und `git diff --check` wurden ausgeführt. TypeScript, Vitest und Export laufen im vorhandenen Cloud-Build, da im Checkout keine installierten Projektabhängigkeiten vorhanden sind. Der konkrete Build-Status wird im Pull Request festgehalten.

Eine authentifizierte Browserabnahme mit echter Layoutberechnung bei breitem und schmalem Fenster sowie vergrößerter Schrift ist noch offen. DOM-Interaktionstests belegen diese Geometrie nicht. Android, Datenbank und produktive Veröffentlichung sind nicht Teil dieser Änderung.

