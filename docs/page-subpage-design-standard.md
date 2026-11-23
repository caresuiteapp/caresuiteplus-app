# Verbindlicher Grundstandard für Seiten und Unterseiten

Freigabe durch Kevin Reinhardt am 21.11.2026. Dieser Standard gilt modulübergreifend für jede künftig neu erstellte oder gestalterisch überarbeitete Seite und Unterseite. Die Freigabe umfasst den Weiß-Blau-Entwurf mit großen Originalmotiven, der animierten 3D-Akte und den zusätzlichen Bewegungen. Die zuletzt korrigierte Rundung des Inhaltsfensters gehört zur Freigabe.

## Bestehender CareSuite-Rahmen

Globale Kopfzeile einschließlich Logo, Neo, Uhr, Wetter, Bedienung und Profil, die linke Navigation sowie Desktop, Widgets, Widget-Motive und persönliche Widget-Auswahlen bleiben im vorhandenen Design erhalten. Die neue Gestaltung liegt innerhalb der geöffneten Seitenflächen. Das Schließen einer Seite führt zum bestehenden Desktop beziehungsweise zum vorherigen Arbeitsbereich.

Die äußere Navigation und die interne Bereichsnavigation einer Unterseite erfüllen unterschiedliche Aufgaben. Interne Akten- oder Fachbereiche ergänzen die globale Navigation, ohne sie zu ersetzen.

## Zwei gemeinsame Grundvorlagen

| Bestandteil | Seite / Übersicht | Unterseite / Detailansicht |
| --- | --- | --- |
| Kopf | Navigationspfad, fachlicher Titel, kurze Orientierung | Navigationspfad, Zurück-Funktion, Datensatz- oder Vorgangstitel |
| Aktionen | Passende Hauptaktion; weitere Aktionen geordnet daneben oder darunter | Datensatzbezogene Hauptaktion; weitere Aktionen an derselben Stelle |
| Große Illustration | Originalmotiv der jeweiligen Widget-Funktion | Fachlich passende Illustration der Unterfunktion, gegebenenfalls eine Akte mit Bezug zum Datensatz |
| Inhalt | Zum Zweck passende Übersicht, Liste, Karten, Kalender oder Arbeitsfläche | Passende Details, Formulare, Verlauf, Dokumente oder Fachansichten |
| Navigation und Werkzeuge | Tabs, Suche, Filter und Sortierung nach tatsächlichem Bedarf | Interne Bereichsnavigation und kontextbezogene Werkzeuge |
| Zustände | Verständliche Lade-, Leer-, Fehler- und Erfolgszustände | Dieselben Zustandsmuster mit Bezug zum Datensatz und zur Aktion |

Kennzahlen, Suchfelder, Tabellen oder Aktenbereiche nur einsetzen, wenn sie für die konkrete Aufgabe sinnvoll sind. Gemeinsamer Aufbau bedeutet keine Kopie von Beispieltexten, Musterkennzahlen oder fachfremden Feldern.

## Individuelle Motive und Icons

Jede Seite und Unterseite erhält eine bewusste fachliche Gestaltung. Klient:innen, Personal, Unternehmen, Notizen, Dokumente, Dokumentation und andere Funktionen verwenden ihre jeweils passenden Originalmotive. Die Auswahl folgt der fachlichen Funktion und Zielroute. Verschiedene Personen oder Datensätze derselben Funktion benötigen kein neues Widget-Original; Kontext und gegebenenfalls Monogramm werden datenbezogen angepasst.

- Große Widget-Motive aus der bestehenden zentralen Zuordnung verwenden, insbesondere über `DesktopCatalogArtwork` und das Rastermanifest. Die Regeln in [widget-artwork-system.md](widget-artwork-system.md) gelten weiter.
- Die vorhandenen Originaldateien unverändert erhalten und die passende Auflösung verwenden. Illustrationen auf weißem Hintergrund mit erhaltener Transparenz, korrekten Proportionen und vollständigen Schatten zeigen.
- Die freigegebene 3D-Aktengeometrie aus `src/components/office/ClientRecordHero.web.tsx` kann für die Klient:innenakte weiterverwendet werden. Ihr Seitenkopf erhält den gemeinsamen weißen Stil. Diese ergänzende Aktenillustration ersetzt keine vorgeschriebenen 3D-PNG-Originale für Widget-Funktionen.
- Große Motive im Seitenkopf bei Desktopbreite etwa 200–240 px groß darstellen und bei wenig Platz sinnvoll anordnen. Titel und Hauptaktion bleiben gut sichtbar und erreichbar.
- Ergänzende Icons und bewegte Objekte fachlich wählen: beispielsweise Akte, Papierblätter oder Dokument für Akten- und Dokumentfunktionen, Kalender für Termine. Kleine Bedienicons verwenden einen einheitlichen Linienstil.
- Zusätzliche Animationen ergänzen die Originalmotive. Sie sind kein Anlass, bestehende Desktop-Widgets oder ihre Zuordnung zu verändern.

## Farben, Formen und Abstände

Diese Referenzwerte über gemeinsame Gestaltungstokens und wiederverwendbare Komponenten führen. Ihre Anwendung berücksichtigt Plattform, verfügbare Breite und Schriftvergrößerung.

| Zweck | Referenz |
| --- | --- |
| Inhaltsflächen und Karten | Weiß, `#FFFFFF` |
| Primäre Aktionen und aktive Elemente | Blau, `#1760E8` |
| Primäres Hover | `#124DBB` |
| Haupttext | `#132E50` |
| Sekundärtext | `#62748D` |
| Trennlinien und Kartenrahmen | `#E3EAF3` |
| Dezente blaue Auswahlflächen | `#F1F6FF` |
| Äußerer Inhaltsrahmen | Rundung etwa 29 px |
| Karten | Rundungen etwa 14–16 px |
| Eingaben und Schaltflächen | Rundungen etwa 9–10 px |
| Inhaltliche Grundabstände | Gemeinsames Raster mit 8, 16, 24 und 32 px |

Blaue Akzente markieren Aktionen, Auswahl und Orientierung. Große dunkle oder andersfarbige Inhaltsbanner werden durch den freigegebenen weißen Seitenkopf ersetzt. Texte, Status und Icons bleiben kontrastreich. Überschriften und Navigation erhalten keine Silbentrennung; lange Texte und große Schrift werden im Layout berücksichtigt.

### Runde Fenster und Scrollen

Der runde Außenrahmen begrenzt seine gesamte Darstellung mit `overflow: hidden`. Ein separater innerer Bereich übernimmt das Scrollen. Als Referenz bleiben oben und unten etwa 14 px sowie rechts etwa 6 px Platz für die Scrollleiste. Rahmen, Inhalt und Scrollleiste bleiben auch an beiden Scrollenden innerhalb der Rundungen.

Hilfe und Schließen bleiben im Außenrahmen erreichbar. Beim Wechsel des Inhalts wird der richtige innere Scrollbereich zurückgesetzt. Die Korrektur gilt für beide Grundvorlagen.

## Bewegung als Bestandteil des Standards

Die zusätzlichen Animationen der Freigabe gehören zur Gestaltung:

- Sanfte Übergänge beim Öffnen und beim Wechsel von Seiten und Unterbereichen.
- Schwebende große Motive mit geringer Auslenkung, zum Beispiel etwa 6–9 px in 4,5–6 Sekunden.
- Fachlich passende Objektbewegung, etwa anhebende Aktenblätter, ein leicht öffnender Deckel oder ein bewegtes Dokument.
- Gestaffeltes Erscheinen von Karten und Listenzeilen sowie sichtbare Reaktionen von Icons und Schaltflächen auf Hover und Betätigung.

Kurze Rückmeldungen bewegen sich ungefähr im Bereich von 200–500 ms. Animationen verändern keine Datenwerte oder fachlichen Zustände. Sie verdecken keine Inhalte, verschieben keine aktiven Eingaben und blockieren keine Aktionen. Dauerbewegung lässt sich pausieren; `prefers-reduced-motion` wird berücksichtigt. Die unbewegte Darstellung bleibt vollständig verständlich.

## Umsetzung und Abnahme

Die freigegebene Vorschau zeigt den bestehenden Desktop als Bildkulisse. In der produktiven Anwendung werden die vorhandene echte Desktop-Shell und responsive Layoutkomponenten verwendet. Daten, Wetter, Uhrzeit, Rechte, Navigation und Freigaben stammen weiter aus den bestehenden Diensten. Die Vorschau ist keine Daten- oder Implementierungsvorlage.

Bei jeder betroffenen Seite und Unterseite prüfen:

- Ist die richtige Grundvorlage mit weißer Inhaltsfläche und gemeinsamen Gestaltungstokens verwendet?
- Passen Inhalt, Hauptaktion, großes Originalmotiv und ergänzende Icons zur konkreten Funktion?
- Bleiben Kopfzeile, Navigation, Desktop, Widgets und Auswahlzustände erhalten?
- Sitzen Inhalt und Scrollleiste vollständig innerhalb der Rundungen, auch an den Scrollenden?
- Funktionieren breite und schmale Arbeitsbereiche, geöffnete Navigation, große Schrift und lange Texte?
- Sind Übergänge, Hover, Objektbewegung, Pause und reduzierte Bewegung sinnvoll umgesetzt?
- Sind Funktionen, Daten, Rechte sowie Lade-, Leer-, Fehler- und Erfolgszustände korrekt?

Vorhandene visuelle und funktionale Prüfungen nach dem Änderungsrisiko verwenden; bei einer Webveröffentlichung bleiben die vorhandenen Releaseprüfungen einschließlich `npm run verify:widget-artwork:release` verbindlich. Gemeinsame Web-/App-Quellen und die bestehenden Regeln für generierte native Dateien beachten.

Die Festschreibung dieses Standards ist keine Behauptung, dass bereits alle bestehenden Seiten umgestellt wurden. Änderungen und tatsächliche Umstellung werden pro betroffenem Bereich nachvollziehbar geführt.


## Freigegebenes Klientenportal ab 23.11.2026

Kevin Reinhardt hat die Web- und Mobilvorschau des Klientenportals im Stil des Mitarbeitendenportals freigegeben. Innerhalb von `/portal/client` gelten dunkle Blauflächen, helle Schrift, transparente Karten und die vorhandenen funktionsbezogenen Originalmotive. Die gemeinsamen ClientPortalFrame-, ClientPortalPageFrame- und ClientPortalPageHero-Komponenten sowie die zentralen Client-Night-Tokens führen diese Gestaltung auf Web und App. Auf dem Smartphone stehen Übersicht, Einsätze, Postfach und Mehr unten; alle weiteren freigegebenen Bereiche bleiben über Mehr erreichbar. Die bestehenden Freigaben, Angehörigenrechte und Datenverträge gelten weiterhin. Diese Freigabe ersetzt den Weiß-Blau-Standard nur für das Klientenportal.
