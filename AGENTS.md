# CareSuite: verbindlicher Qualitätsmaßstab für Oberflächen

## Grundsatz
Design, Layout, Texte und Funktionen sind gleichwertige Bestandteile der Umsetzung. Eine Oberfläche wird als zusammenhängendes, vollständiges Ergebnis entwickelt; sichtbare Gestaltungsmängel werden vor der Übergabe eigenständig behoben.

## Umsetzung
- Das bestehende CareSuite-Design mit konsistenten Farben, Typografie, Abständen, Rundungen und klarer visueller Hierarchie verwenden. Neue Elemente müssen zur gesamten Oberfläche passen.
- Breite und schmale Inhaltsbereiche von Beginn an berücksichtigen, einschließlich geöffneter Navigation, Fensterwechsel und vergrößerter Schrift.
- Auf der Desktop-Startseite bleibt die Navigation am linken Fensterrand. Das Widget-Raster wird separat im verbleibenden Arbeitsbereich zentriert; die gesamte Arbeitsfläche wird nicht gemeinsam nach innen gerückt oder zur Anpassung verkleinert.
- Widget-Überschriften stehen gut lesbar oberhalb der Bilder. Große Leerflächen und eine unnötig hohe Hintergrundplatte vermeiden. Logo, Uhr/Wetter und Bedienung stehen in einer gemeinsamen Kopfzeile über die verfügbare Breite. Bei breiten Fenstern liegen sie nebeneinander; bei wenig Platz brechen sie innerhalb derselben Leiste geordnet um.
- Das Desktop-Raster berücksichtigt die tatsächlich verfügbare Breite und Höhe; Bildflächen und Spaltenzahl passen sich an, ohne die gesamte Oberfläche oder ihre Schrift zu skalieren. Bei wenig Platz bleiben alle Inhalte durch erkennbares Scrollen erreichbar.
- Uhrzeit und Standortwetter bleiben auch in schmalen Fenstern sichtbar. Wetter verwendet echte aktuelle Daten oder einen verständlichen Lade-/Fehlerzustand mit erneuter Abfrage; keine fest eingetragenen Beispielwerte.
- Nur beim direkten Aufruf und vollständigen Neuladen von `https://www.caresuiteplus.app/` werden die vorhandenen App-Intro-Videos vor Freigabe der Anmeldung automatisch abgespielt. Alle anderen Web-/Desktop-Adressen, einschließlich Links mit Query oder Hash, starten kein Intro. Seitenwechsel innerhalb desselben Dokuments starten es nicht erneut. Musik wird ohne Startabfrage versucht; sperrt der Browser den Ton, läuft das Video stumm weiter und normale echte Eingaben versuchen den Ton erneut. Browser-Autoplay-Sperren und Medienfehler dürfen den Zugang nicht dauerhaft blockieren.
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

## Desktop-Bereiche ab 13.10.2026
Mein Desktop enthält Office, Assist, Pflege, Stationär, Beratung, Roboter, Premium und Einstellungen. Jeder Bereich speichert seine Widget-Auswahl getrennt nach Mandant und Person. Navigation, Apps, Widgets und Workflow-Vorschläge gehören zum ausgewählten Bereich. Bestehende Freigaben und Schutzsperren bleiben wirksam; Bereichsauswahl aktiviert keine unfertigen Fachmodule.

## E-Rechnungen ab 18.10.2026
Bei der Weiterentwicklung der Office-Rechnungen die Anforderungen in `docs/office-einvoice-requirements.md` berücksichtigen. Eine normale PDF, ein JSON-Entwurf oder eine reine Pflichtfeldprüfung belegt keine gültige E-Rechnung. Empfang, Ausstellung, Formatvalidierung und Aufbewahrung getrennt behandeln. Ausnahmen anhand des tatsächlichen Leistungsempfängers und der steuerlichen Einordnung prüfen; weder Pflegeleistungen noch Krankenkassen als Kostenträger pauschal einordnen. PDF-Ausgaben und XML-Entwürfe dürfen nicht als ausgestellte, normgeprüfte E-Rechnungen bezeichnet werden. Der neue XRechnungsablauf darf nur Originale freigeben, deren erfolgreicher serverseitiger XSD-/Geschäftsregel-Prüfbeleg genau zu Datei-Hash, Rechnungsstand und Rechnungsnummer gehört. Nicht unterstützte Profile und nicht geprüfte PDF/A- oder Signatureigenschaften offen ausweisen; keine pauschale ZUGFeRD- oder Revisionssicherheitszusage. Vor einer produktiven E-Rechnungsfreigabe müssen die dokumentierten Abnahmekriterien erfüllt und die dann geltenden amtlichen Vorgaben erneut geprüft sein. Implementierungsstand, Veröffentlichung und tatsächliche Ende-zu-Ende-Nachweise getrennt belegen.
