# CareSuite: verbindlicher Qualitätsmaßstab für Oberflächen

## Grundsatz
Design, Layout, Texte und Funktionen sind gleichwertige Bestandteile der Umsetzung. Eine Oberfläche wird als zusammenhängendes, vollständiges Ergebnis entwickelt; sichtbare Gestaltungsmängel werden vor der Übergabe eigenständig behoben.

## Umsetzung
- Das bestehende CareSuite-Design mit konsistenten Farben, Typografie, Abständen, Rundungen und klarer visueller Hierarchie verwenden. Neue Elemente müssen zur gesamten Oberfläche passen.
- Breite und schmale Inhaltsbereiche von Beginn an berücksichtigen, einschließlich geöffneter Navigation, Fensterwechsel und vergrößerter Schrift.
- Auf der Desktop-Startseite bleibt die Navigation am linken Fensterrand. Das Widget-Raster wird separat im verbleibenden Arbeitsbereich zentriert; die gesamte Arbeitsfläche wird nicht gemeinsam nach innen gerückt oder zur Anpassung verkleinert.
- Widget-Überschriften stehen gut lesbar oberhalb der Bilder. Große Leerflächen und eine unnötig hohe Hintergrundplatte vermeiden. Rechts oben liegt die Bedienleiste bei breiten Fenstern auf Höhe der linken Informationsleiste unterhalb des Logos.
- Beim Start und vollständigen Neuladen von Web/Desktop werden die vorhandenen App-Intro-Videos vor Freigabe der Anmeldung abgespielt. Seitenwechsel innerhalb desselben Dokuments starten das Intro nicht erneut; Browser-Autoplay-Sperren und Medienfehler dürfen den Zugang nicht dauerhaft blockieren.
- Tabellenkopf und Datenzeilen verwenden dasselbe Spaltenraster. Unterschiedliche Textlängen dürfen die Spalten nicht gegeneinander verschieben.
- Karten, Formulare, Filter und Aktionen geordnet ausrichten. Wichtige Angaben und Aktionen müssen bei wenig Platz erreichbar bleiben.
- Beschriftungen und Eingaben müssen kontrastreich lesbar sein; unbeabsichtigte Überlagerungen, abgeschnittene Inhalte, große Leerflächen und ungünstige Wortumbrüche beheben.
- Texte vollständig, verständlich und zur jeweiligen Rolle passend formulieren. Überholte Begriffe und vom Nutzer abgelehnte Modulhinweise aus den betroffenen sichtbaren Abläufen entfernen.
- Gestaltung und Bedienung gemeinsam behandeln: sinnvolle Lade-, Leer-, Fehler- und Erfolgszustände für betroffene Abläufe, eindeutige Aktionen und verständliche Rückmeldungen.

## Prüfung und Übergabe
- Betroffene Oberflächen eigenständig in breiter und schmaler Darstellung prüfen; unterschiedliche Textlängen und Zustände berücksichtigen, soweit sie die Änderung betreffen.
- Funktionsprüfungen und visuelle Prüfung getrennt belegen. Ein DOM-Modell ohne Layoutberechnung belegt keine optische Fehlerfreiheit.
- Bei fehlender Möglichkeit zur visuellen Prüfung die verbleibende Lücke präzise benennen. Keine umfassende Designfreigabe oder vollständige Fertigstellung behaupten, die nicht belegt ist.
- Umfang und Tiefe der Verifikation am konkreten Risiko ausrichten. Vorhandene passende Prüfungen nutzen; reine Text- oder Stiländerungen erfordern keine zusätzlichen Tests, die nur die Implementierung wiederholen.
- Offensichtliche Gestaltungsmängel nicht an den Nutzer zur Entdeckung auslagern. Rückmeldungen auf ihre gemeinsame Ursache prüfen und innerhalb des beauftragten Umfangs konsistent beheben.

## Aktueller Arbeitsumfang
Die laufende Überarbeitung betrifft Desktop und Web. Die fertiggestellte Android-App wird dabei nicht verändert. Firmenregistrierung kostenlos und ohne Modulauswahl; keine Modulwerbung im Registrierungsablauf. Spätere ausdrückliche Nutzeraufträge bestimmen den jeweiligen weiteren Umfang.


## Bestehende Arbeitsumgebung verwenden
Der Nutzer möchte für diesen Auftrag keine zusätzliche Software oder neue Testinfrastruktur. Die Einrichtung über Docker wird nicht weiterverfolgt. Mit dem vorhandenen Projekt, vorhandenen Verbindungen und bestehenden Prüfwerkzeugen arbeiten; keine weiteren Installations- oder Infrastrukturaufgaben an den Nutzer auslagern. Fehlende Ende-zu-Ende-Nachweise präzise offenhalten. Diese Einschränkung ist keine Freigabe für Teständerungen an produktiven Daten oder für eine Veröffentlichung.
