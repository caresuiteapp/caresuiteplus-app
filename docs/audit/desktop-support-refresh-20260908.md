# Desktop/Web: Support-Aktualisierungen – 08.09.2026

## Anlass und Änderung
Verspätete Antworten aus Abonnements konnten nach einem Filterwechsel die vorherige Ticketliste wiederherstellen. Eine verspätete Fehlermeldung zu einem verlassenen Ticket konnte außerdem dessen inzwischen geöffneten Nachfolger ausblenden. Überlappende Aktualisierungen desselben Tickets konnten einen neueren Nachrichtenstand überschreiben.

Polling, Abonnements und manuelle Aktualisierung verwenden jetzt je Ticket beziehungsweise Listenabfrage dieselbe Antwortsteuerung. Nur die jüngste noch gültige Abfrage darf Daten oder Fehler anzeigen. Beim Ansichtswechsel und Aushängen werden vorherige Abfragen verworfen. Laufende Serveranfragen werden dabei nicht abgebrochen; ihre veralteten Ergebnisse bleiben wirkungslos.

Listen- und Ticketfehler sind getrennt vom Fehler einer Schreibaktion. Fehlerzustände zeigen eine Wiederholungsmöglichkeit statt einer unbegrenzt erscheinenden Ladeanzeige. Während Schreibaktionen sind Filter, Seitennavigation und Freigabeauswahl gesperrt. Das Zugriffsformular ist zusätzlich an die Ticket-ID gebunden.

## Nachweise auf ChristianLaptop
- Ausgangsstand: `1c8cc407`, Branch `feature/desktop-platform-support-20260907`; Arbeitsverzeichnis vor Anwendung sauber.
- `supportWorkspaceInteraction.test.tsx`: **7 Tests bestanden**, darunter die drei oben genannten verzögerten Antwortfolgen sowie die vier vorhandenen Prüfungen zu Entwürfen, Sendefehlern und Anhängen.
- `node --test scripts/verify-support-read-scope.mjs`: **6 Tests bestanden**, einschließlich Fehlerbehandlung, Wechsel der Abfrage, bereits geschlossener Ansicht und erneuter Effektaktivierung nach Cleanup.
- Vollständige TypeScript-Prüfung: **Exit-Code 0**.
- Vorhandene Unternehmens-Web-Vorschau neu gebaut: **1.386.583 Byte** JavaScript.
- Vier DOM-Startprüfungen sowie schmale Menübedienung, Öffnen der passenden Unternehmensakte und Wechsel zwischen Karten und Tabelle: **erfolgreich, Exit-Code 0**.
- `git diff --check`: **erfolgreich**.

## Grenzen
Die DOM-Prüfungen belegen Verhalten und Inhalt, keine optische Layoutberechnung. Das zuvor bestätigte Layout wurde nicht geändert. Vollständige angemeldete Backend-Endabläufe mit den neuen Serverfunktionen bleiben weiterhin offen. Keine produktiven Daten, Serverfunktionen oder Migrationen wurden in diesem Schritt geändert oder ausgeführt.

Die angepassten Support-Komponenten werden nur aus Web-Einstiegspunkten eingebunden. Android-Dateien, Abhängigkeiten und Paketversionen wurden nicht geändert. Es wurde keine zusätzliche Software installiert und keine neue Testinfrastruktur eingerichtet. Die Einschränkung auf vorhandene Werkzeuge ist nun auch in der AGENTS.md auf dem Laptop festgehalten. Änderungen werden ausschließlich lokal gesichert; kein Push oder Deployment.
