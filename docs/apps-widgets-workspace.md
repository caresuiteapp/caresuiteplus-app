# Apps & Widgets: Web-Desktop

## Verhalten

Das Center zeigt Apps, Widgets, Workflows und Hintergründe in einer hellen Oberfläche. Apps und Widgets beginnen mit „Nur [aktueller Bereich]“. Diese Ansicht enthält nur Einträge aus dem ausgewählten Bereich; gemeinsame Office-Einträge werden nicht mehr automatisch beigemischt. „Alle Bereiche“ zeigt sämtliche für die Person freigegebenen Katalogeinträge, ohne den aktiven Desktop zu wechseln. Die Ansicht bleibt beim Wechsel zwischen Apps und Widgets erhalten und beginnt beim erneuten Öffnen oder Desktop-Wechsel wieder im aktuellen Bereich.

Suche und Kategoriefilter wirken gemeinsam innerhalb des Anzeigebereichs. Zähler und Kategorien passen sich diesem Bereich an. „Auf diesem Desktop“ zeigt die gespeicherte Auswahl aus allen Bereichen, damit auch bereichsfremde Widgets entfernt oder umgeordnet werden können. Tabs sind per Tastatur bedienbar, aktive Auswahl und Speicherzustand sind beschriftet.

Auf dem Desktop bleibt die Ansicht mit den Bereichsreitern unter „Mein Desktop“ erhalten. Die globale Kopfzeile enthält keine zusätzliche Desktop-Auswahl. Im Center sind alle neun Desktops als Schaltflächen mit eigenem Motiv sichtbar; der aktive Bereich ist hervorgehoben. Bei höchstens 680 Pixeln Fensterbreite wird diese Auswahl über eine beschriftete Schaltfläche aufgeklappt und nach einem Desktop-Wechsel wieder geschlossen. Nicht freigegebene Bereiche sind gekennzeichnet und nicht auswählbar. Beim Wechsel bleibt das Center mit dem gewählten Reiter geöffnet; Suche und Kategoriefilter werden zurückgesetzt. Ein Wechsel zum bereits aktiven Bereich löst weder einen Neustart noch einen weiteren Speichervorgang aus.

Jede eigenständige Funktion behält ihr zentral zugeordnetes Motiv in Navigation, App-Katalog und Widget. Die 153 vorhandenen 3D-Originale und ihre Größenvarianten werden nicht geändert. Funktionen ohne Original verwenden ihre eigene skalierbare Zeichnung. Apps, Widgets und Workflows haben zentrierte Bildflächen mit `contain`. Google-Widgets behalten auf dem Desktop ihre Live-Inhalte. Workflow-Karten öffnen den Arbeitsbereich; sie behaupten keine automatische Ausführung. Hintergrundvorschauen verwenden dieselbe 16:9-Bildfläche mit `cover`, auch bei fehlgeschlagenem Bildladen.

Jede App- und Widget-Karte hat einen eigenen „i“-Schalter. Er öffnet die vorhandene Funktionsbeschreibung und erläutert den Kartentyp. Er startet keine App und verändert keine Desktop-Auswahl. Der Schalter meldet seinen Zustand mit `aria-expanded` und verweist auf die Erklärung; Escape schließt die Erklärung bei erhaltenem Fokus. Der Bereich steht unter dem Kartennamen. Die langen Beschreibungen werden erst beim Aufklappen eingeblendet.

Widgets aus „Alle Bereiche“ lassen sich auf dem aktuellen Desktop hinzufügen, entfernen und vor- oder zurückschieben. Mehr als zwölf Widgets werden auf weitere Desktop-Seiten verteilt. Doppelte Seiten-Aliase werden zusammengeführt. Modul-, Rollen- und Fachberechtigungen begrenzen jede Katalogansicht; gesperrte oder unfertige Seiten werden dadurch nicht freigeschaltet.

## Speicherung

Die bestehende lokale Speicherung bleibt bestehen. Widget-Auswahl und aktiver Bereich sind nach Mandant und Person getrennt; die Widget-Auswahl zusätzlich nach Desktop-Bereich. Hintergrund und Navigationszustand behalten ihre bisherigen personengebundenen Schlüssel und gelten bereichsübergreifend auf diesem Gerät.

Eine gemeinsame Warteschlange ordnet Lesen und Schreiben innerhalb des geöffneten Dokuments. Veraltete Lade- oder Speicherantworten überschreiben keinen neueren Zustand. Ausdrücklich leere Auswahlen bleiben leer. Temporär nicht berechtigte Widgets bleiben in den gespeicherten Einstellungen erhalten und werden nur ausgeblendet. Beschädigte Einstellungen lösen einen Ladefehler aus, ohne sie mit Standardwerten zu überschreiben.

Speicherfehler sind sichtbar und können mit der aktuellen Auswahl erneut versucht werden. Das Verlassen über App-, Bereichs- oder Profilnavigation nach einem Speicherfehler erfordert eine bewusste Bestätigung. Bei ausstehender oder fehlgeschlagener Speicherung wird der Browser beim Schließen oder Neuladen um eine Warnung gebeten. Es gibt keine Zusage zur Synchronisierung zwischen Geräten oder parallel geöffneten Tabs.

## Prüfung

Die vorhandene Office-Notes-Releaseprüfung umfasst zusätzlich Katalogrechte, Bild-Zuordnung, Speicherwarteschlange und Screen-Interaktionsfälle mit dem tatsächlichen Center und Preference-Hook. Der Bildtest prüft alle tatsächlichen Katalogrouten, vorhandene PNG-Dateien in drei Größen und Bilder in jeder App-, Widget- und Workflow-Karte. Dazu gehören die bisherigen Desktop-Reiter, das Fehlen der neuen Auswahl in der globalen Kopfzeile, Desktop-Wechsel im Katalog, Erhalt des aktiven Reiters, deaktivierte Bereiche, Suche, Navigation, Widget-Reihenfolge, mehrere Seiten, Hintergründe, Wiederherstellung, Rechtewechsel, Speicherfehler und Tastaturbedienung. Die Host- und Speicherschnittstellen werden isoliert simuliert; produktive Daten werden nicht verändert.

Die Ergänzungen vom 06.11.2026 prüfen den aktuellen und den gesamten Anzeigebereich, kombinierte Suche und Kategorien, unabhängige Info-Schalter samt Escape, den kompakten Desktop-Wechsler sowie bereichsfremde Widgets nach Neuladen und zeitweisem Rechteverlust. Die vollständige TypeScript-Prüfung, native Quellengenerierung, Motivprüfung und `git diff --check` gehören zur Übergabe.

Die tatsächliche Center-Komponente wird in einer isolierten Browservorschau mit echten Bildern bei breiter und schmaler Darstellung sowie 150 Prozent Schriftgröße geprüft. Das ersetzt keinen angemeldeten Durchlauf mit produktiven Daten. Web und native App verwenden denselben Katalogfilter und dieselbe generierte Center-Darstellung. Ein signiertes App-Paket oder Datenbankänderungen gehören nicht zu diesem Update. Die Veröffentlichung erfolgt mit dem beigefügten Git-Bash-Paket.

