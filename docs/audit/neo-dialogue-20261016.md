# Neo: natürliche Dialoge mit reiner Sprachbedienung

## Auftrag und Korrektur

Neo soll vollständige natürliche Sätze verstehen, bei kurzen Angaben nachfragen und anschließend wieder zuhören. Nach der ersten Veröffentlichung (PR #102, `9734330`) hat der Nutzer das zusätzliche Chatfenster ausdrücklich abgelehnt: Neo soll sprechen. Diese Korrektur ersetzt die Chatoberfläche vollständig.

## Bedienung

- Ein Klick auf Neo spielt seine vorhandene, mitgelieferte Begrüßung ab. Dafür muss das Sprachmodell nicht erst geladen werden. Währenddessen wird die lokale Synthese für weitere Antworten vorbereitet.
- Anschließend hört Neo zu. Antworten, Rückfragen, Anleitungen und Suchfehler werden gesprochen. Nach dem Ende der Ausgabe startet die Erkennung wieder nach 300 Millisekunden.
- Es gibt kein Chatfenster, keinen Verlauf, kein Eingabefeld und keine Antwortknöpfe. Ein kleiner Hinweis bei Neo zeigt nur den aktuellen Zustand oder ein technisches Problem. Nutzereingaben und Antworten werden nicht als Text im DOM abgelegt.
- Ein weiterer Klick pausiert Sprache und Mikrofon; ein erneuter Klick setzt das Gespräch mit seinem Zusammenhang fort. Escape setzt zusätzlich den Zusammenhang zurück. „Stopp“ während der Zuhörphase beendet das Gespräch.
- Beim Seitenwechsel, Verlassen des Tabs oder Entfernen von Neo stoppen Aufnahme und Wiedergabe. Nach 35 Sekunden ohne Äußerung pausiert die Aufnahme; der Zusammenhang verfällt nach fünf Minuten.
- Lange Antworten werden vollständig in Abschnitten innerhalb der vorhandenen Grenze des Sprachmodells ausgegeben. Der bisherige Verweis auf einen restlichen Text im Gespräch entfällt.
- Scheitert die Sprachausgabe, stoppt das Mikrofon mit einem kurzen Hinweis. Neo wartet nicht auf eine Antwort zu einer unhörbaren Frage und führt danach keine Navigation aus.

## Sprachverständnis

Die lokale Dialoglogik bleibt erhalten: 63 Hilfetexte, 20 Navigationsziele, Klientensuche, Rückfragen und schrittweise Anleitungen. Beispiele:

- „Könntest du mir bitte den Kalender öffnen?“ öffnet den freigegebenen Kalender.
- „Eine Rechnung“ führt zu einer gesprochenen Rückfrage. „Ich möchte eine neue erstellen“ beginnt die Anleitung zur Abrechnungsvorbereitung.
- „Urlaub“ führt zur Rückfrage nach Personal oder Kalender. „Im Kalender“ beginnt die passende Anleitung.
- „Ich möchte etwas anlegen“ führt zur Rückfrage nach dem Gegenstand. „Klient“ beginnt die Klientenaufnahme.
- „Suche eine Akte“ führt zur Namensfrage. „Die Klientin heißt Anna Müller“ wird als Antwort zugeordnet; diese Beispielperson ist erfunden.
- „Das habe ich gemacht“, „Wie geht es weiter?“ und „Kannst du mir dazu ein Beispiel geben?“ führen eine laufende Anleitung fort.

Ein unbestimmtes „Ja“ wählt bei mehreren Möglichkeiten nichts aus. Neue Aufträge und Negationen übernehmen keine alte Öffnungsabsicht. Vor der Navigation werden Freigaben erneut geprüft; eine inzwischen entzogene Berechtigung wird ausgesprochen.

## Grenzen

Kein neues Sprachmodell oder externer Dienst. Die Erkennung verwendet den vorhandenen Sprachdienst des Browsers, die Ausgabe die lokale Neo-Stimme. Die Themen- und Aufgabenlogik ermöglicht keine beliebige Unterhaltung außerhalb der unterstützten CareSuite-Themen. Neo erklärt Abläufe und öffnet freigegebene Seiten und Akten; er speichert, versendet oder bezahlt nichts. Der Gesprächszusammenhang bleibt ausschließlich im Sitzungsspeicher. Neo bleibt auf `/Desktop` beschränkt. Android wurde nicht verändert.

## Verifikation der Korrektur

- 135 Dialogtests bestanden: 50 Gesprächslogik, 59 natürliche Formulierungen und 26 Interaktionen. Die Interaktionen prüfen die hörbare Begrüßung ohne Chat, Rückfragen mit erneutem Zuhören, vollständige Ausgabe längerer Texte, Abbruch, Zeitlimits, verspätete Antworten und Freigabewechsel.
- 50 bestehende Navigations-, Startup-, Sprachtests und drei Headerprüfungen bestanden. Ein zusätzlicher Test lädt die echte mitgelieferte Begrüßungsdatei ohne Worker.
- Strikte TypeScript-Prüfung der betroffenen Produktionsmodule bestanden. Browser-Bündelung mit esbuild (rund 220 KiB unminifiziert) und `git diff --check` bestanden.
- Keine produktiven Klientendaten für Tests verwendet. Die Interaktionstests simulieren Mikrofon- und Audioereignisse; sie belegen keinen Endgerätetest mit hörbarer Stimme.

## Offene Nachweise

Der Cloud-Browser erreicht die lokale Vorschau nicht. Eine isolierte Vorschau als Daten-URL wurde durch die URL-Richtlinie des Browsers blockiert; die Sperre wurde nicht umgangen. Eine visuelle Abnahme in breiter und schmaler Darstellung und ein Test mit echtem Mikrofon bleiben offen.

Den vollständigen Produktionsbuild prüft die bestehende GitHub-/Vercel-Pipeline. Die zuvor lokal wegen `SIGKILL` abgebrochene projektweite TypeScript-Prüfung wird nicht als erfolgreicher Build ausgewiesen; die Release-Prüfungen werden nicht umgangen.
