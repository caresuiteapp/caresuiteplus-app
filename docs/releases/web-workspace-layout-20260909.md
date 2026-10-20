# Web-Arbeitsflächen und Verwaltung – 9. September 2026

## Anlass

Unabhängige Flex-Spalten ließen Tabellenkopf und Datensätze gegeneinander verrutschen. Kleine eingebettete Arbeitsflächen wurden anhand der Bildschirmbreite behandelt. Listen reservierten ohne Auswahl eine leere Detailhälfte. Unterschiedliche Kopfbereiche, kleine Beschriftungen und verschachtelte Zeilenaktionen erschwerten die Bedienung.

## Änderungen

- Gemeinsame Web-Datentabelle mit identischen Spaltenbreiten für Kopf und Datensätze. Bei unzureichender Inhaltsbreite werden alle Felder als beschriftete Karten dargestellt; Sortierung bleibt verfügbar.
- Markierungen ändern die Spaltenposition nicht. Zeilen lassen sich per Tastatur öffnen. Aktionen, Eingabefelder und Textauswahl lösen nicht zusätzlich die Zeilennavigation aus.
- Personal-, Rechnungs- und Einsatztabellen verwenden lesbare, mit der Schriftgrößeneinstellung skalierende Beschriftungen. Namen und Kontaktdaten dürfen umbrechen. Rechnungsbeträge sind rechts ausgerichtet.
- Listen nutzen ohne Detailauswahl die volle Breite. Bei Auswahl richten sich die beiden Bereiche nach ihrer verfügbaren Breite aus; beide bleiben innerhalb dieser Komponente beim Wechsel zwischen nebeneinander und untereinander montiert.
- Gemeinsame Seitenüberschrift auch für Kontextfenster, einschließlich Zurück-Aktion. Aktionen dürfen in schmalen Arbeitsflächen in eine weitere Zeile wechseln.
- Inhalt innerhalb einer scrollenden Seite erhält natürliche Höhe statt einer zusätzlich gestreckten Inhaltszone. Abschnitte haben einheitliche Überschriften, Abstände und explizite helle oder dunkle Oberflächen.
- Listenaktionen stehen neben dem eigentlichen Öffnen-Bereich und können auf eine neue Zeile wechseln. Reiter sind mit Pfeiltasten, Pos1 und Ende fokussierbar; Enter/Leertaste aktiviert. Die aktive Auswahl wird horizontal sichtbar gehalten.
- Neue Regeln sind auf Web-Komponenten begrenzt; vorhandene native Implementierungen bleiben unverändert.

## Veröffentlichung und Abnahme

Vorgesehen: Expo Web-Export über die vorhandene Umgebung, Push auf main und den Arbeitsbranch, Veröffentlichung über das bestehende Vercel-Projekt.

Auf ausdrücklichen Wunsch keine Tests, kein Lint, kein Typecheck und keine Browser-/Sichtprüfung. Der Web-Build ist die technische Erstellung des Releases. Manuelle Funktions- und Designabnahme erfolgt durch Kevin nach der Veröffentlichung; daraus folgt keine Aussage über vollständige Fehlerfreiheit aller Seiten.

Keine Datenbankmigration, keine Änderung produktiver Pflege-, Zeit-, Unterschrifts- oder GPS-Datensätze. Keine Änderungen am nativen Android-Code.
