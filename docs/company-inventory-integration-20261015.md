# Inventar in Unternehmen

Stand: 15. Oktober 2026. Ausgangsbasis: `d6d20d92f4a4c02b0753cf473d589198535bd09e`.

## Umsetzung

Das Web-Inventar gehört jetzt zur Unternehmensakte. Die kanonische Adresse ist `/unternehmen/inventar`; `ansicht` wählt Bestand, Ausgaben/Rückgaben, Lagerorte/Kategorien, Schäden, Personalrückgaben oder Verlauf. Bestehende Inventaradressen werden mit ihrem Kontext weitergeleitet. Widget-IDs, Bilder und gespeicherte Positionen bleiben erhalten. Die bisherigen nativen Ziele und Abläufe bleiben bestehen.

Der neue Bereich verwendet die Gestaltung der Unternehmensakte: gemeinsame Navigation, Kennzahlen, Suche und Filter, ausgerichtete Tabellen und passende Bearbeitungsdialoge. Schmale Inhalte erhalten umbrochene Bedienelemente und scrollbar bleibende Tabellen. Inventar wird unabhängig vom Abruf geschützter Unternehmensstammdaten geladen.

Vorhandene Inventartabellen werden weiterverwendet. Es werden keine Kategorien oder Beispieldaten beim Öffnen erzeugt. Die Personalauswahl lädt echte, auf die notwendigen Felder begrenzte Personalangaben, sofern die Berechtigung vorliegt. Inventar-, Personal-, Ausgabe-, Rücknahme- und Verlaufsrechte werden getrennt geprüft.

Erfasst werden Gegenstände mit Kennung, Seriennummer, Hersteller, Modell, Lagerort, Kaufdatum, Garantie, Zustand und Rückgabevorgaben. Kategorien und Lagerorte lassen sich anlegen und bearbeiten. Ausgaben haben eine reale empfangende Person, Verantwortlichkeit und eine optionale Rückgabefrist. Empfangsbestätigung und Rückgabeanforderung sind ausdrückliche Verwaltungsaktionen; die Rückgabeanforderung versendet keine Nachricht.

Rücknahmen setzen keine Vollständigkeit oder Geräteprüfung voraus. Tatsächliche Rückgabe, Vollständigkeit, Zustand und gegebenenfalls Zubehör-/Geräteprüfungen werden ausdrücklich dokumentiert. Fehlende oder teilweise Rückgaben bleiben offen. Schäden und Verluste können gemeldet und nach dokumentierter Klärung abgeschlossen werden; ein Fallabschluss bestätigt weder Reparatur noch Rückgabe.

## Integrität und verbleibende Grenzen

- Abfragen sind auf den Mandanten begrenzt. Personen werden nicht aus Demodaten ergänzt. Fehlende Datenbankantworten werden als Fehler behandelt.
- Gleichzeitige Änderungen an vorhandenen Datensätzen werden über Versions-/Statusbedingungen erkannt. Die Oberfläche sperrt parallele Schreibaktionen und schützt ungespeicherte Entwürfe. Ein Wechsel des Mandanten oder der Rechte entfernt den bisherigen lokalen Bearbeitungskontext.
- Mehrteilige Datenbankvorgänge sind **nicht atomar**. Nach einem Teilfehler wird kein Erfolg behauptet. Weitere Änderungen bleiben bis zum erfolgreichen Neuladen gesperrt; dabei wird der unsichere Entwurf geschlossen, damit eine Neuanlage nicht blind wiederholt wird. Bereits geschriebene Teildaten müssen gegebenenfalls geprüft und berichtigt werden. Es wurde keine Transaktions-RPC oder Migration ergänzt.
- Der direkte bestehende Web-Austrittscheck nutzt im Live-Modus echte Inventardaten. Der ältere übergreifende Personal-Austrittsaggregator `countOpenInventoryReturnsWithInventoryModule` besitzt weiterhin seine bisherige Demo-Verknüpfung und ist nicht vollständig migriert.
- Lagerorte sind Aufbewahrungsorte mit Gebäude/Raum, keine vollständigen Unternehmensstandorte. Eine zentrale Fahrzeugakte, Standort-/Abteilungsstruktur und Franchiseverwaltung sind weiterhin Ausbaupunkte; siehe `company-organization-gap-review-20261015.md`.
- Rückgabe-PDFs, Barcode-Scanner und MDM-Geräteaktionen werden durch diese Integration nicht neu bereitgestellt. Historische Rücknahmen bleiben in den Details lesbar.
- Es gab keine produktiven Datenänderungen oder Schemaänderungen und keine Veröffentlichung. Die tatsächliche Anwendung der vorhandenen Migrationen und Abläufe gegen Produktionsdaten wurde nicht geprüft.

## Prüfung

- 136 Tests in acht betroffenen Suites bestanden: Services, bestehendes Inventarmodul, Web-/Native-Abgrenzung, Navigation, Unternehmensintegration, Modelle und echte DOM-Interaktionen.
- ESLint über alle 60 geänderten TypeScript-Dateien ohne Warnungen; `git diff --check` sauber.
- Der vorhandene Produktionsbuild einschließlich Release-Gates wird ausgeführt. Das endgültige Build- und Typecheck-Ergebnis steht im Pull Request.

Eine gerenderte Prüfung der neuen Oberfläche in einem breiten und einem schmalen Browserfenster steht aus. DOM-Interaktionstests und CSS-Prüfung belegen keine visuelle Abnahme. Der lokale Vorschauzugriff war in dieser Sitzung durch die Browserrichtlinie gesperrt; dieser Zugriff wurde nicht über einen anderen Weg umgangen.
