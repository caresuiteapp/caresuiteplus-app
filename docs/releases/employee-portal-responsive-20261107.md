# Mitarbeitendenportal: Tagesfokus Kompakt

Der ausgewählte Entwurf verbindet die Tagesübersicht und die gruppierten
Arbeitsbereiche mit einer linken Symbolnavigation. Die zusätzliche horizontale
Navigation entfällt. Kopfzeile, Profil und Schriftgröße bleiben erreichbar.

Die gemeinsame React-Native-Implementierung versorgt Web und App. Auf breiten
Arbeitsflächen stehen Tagesübersicht und Hinweise nebeneinander; bei wenig Platz
folgen sie in natürlicher Höhe aufeinander. Die linke Leiste ist 72 beziehungsweise
52 Pixel breit. Alle weiteren freigegebenen Bereiche und Abmelden stehen im
scrollbaren Menü. Der Inhalt besitzt einen eigenen vertikalen Scrollbereich;
Schriftvergrößerung verändert auch die Spaltenzahl.

Die bestehende Dashboard-Projektion, Einsatzstatus und Navigation, Offline-Schutz,
Nachrichtenstände, offene Unterschriften, Rollen- und Anmeldeprüfungen sowie GPS-
und Systemleistenabstände werden weiterverwendet. Fehlende Teilabfragen werden
als nicht verfügbar angezeigt. Die Klient:innenoberfläche wird nicht umgestaltet.
Es gibt keine Datenmigration und keine Änderungen an produktiven Datensätzen.

## Prüfung

- Interaktionstests für die tatsächlichen Komponenten und die native Aufgaben-
  übernahme einschließlich Rollensperre, Offline-Ziele und Aktualisierung.
- Vollständige TypeScript-Prüfung, gemeinsamer Native-Abgleich und Prüfung der
  161 3D-Originale. Bestehende Freigaben bleiben bestehen.
- Browserprüfung der echten RN-Web-Komponenten mit isolierten Beispieldaten und
  simulierten Router-/Sitzungsgrenzen: 320 × 700, 390 × 844, 768 × 1024,
  1024 × 768 und 1440 × 900; außerdem 150 Prozent Schrift sowie Menü, Fehler- und
  Offline-Zustände. Kein horizontaler Überlauf der betroffenen Bedienelemente.
- Der unveränderte Desktop-Test `desktopPortalChromeParity` enthält bereits im
  Ausgangsstand eine veraltete Zeichenkettenprüfung auf `router.push('/')`.
  Die Desktop-Kopfzeile verwendet dort die plattformabhängige Desktop-Zielroute.
  Dieser Befund ist unabhängig von den hier geprüften Portaltests.

Die Browserprüfung ersetzt keinen angemeldeten Test gegen produktive Serverdaten.
Die Veröffentlichung erfolgt mit dem bereitgestellten Git-Bash-Paket. Ein
signierter Android-/iOS-Build und eine Store-Veröffentlichung sind nicht enthalten.
