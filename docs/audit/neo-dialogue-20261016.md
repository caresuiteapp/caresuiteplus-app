# Neo: Sprachdialoge und CareSuite-Hilfe

Stand: 16.10.2026. Basis: `755432731d8a8965fd1ab63026c11bb0185dc452`.

## Verhalten

Neo führt auf dem Web-Desktop ein Gespräch über mehrere Antworten. Nach einer Antwort startet die Erkennung wieder; während der Sprachausgabe ist sie angehalten. Mehrere endgültige Erkennungsfragmente werden zusammengeführt, vorläufige Erkennungsergebnisse sichtbar angezeigt. Browserseitige Erkennungsabbrüche werden begrenzt wiederaufgenommen. Nach 35 Sekunden ohne abgeschlossene Eingabe pausiert die Sitzung. Der Dialogkontext bleibt für bis zu fünf Minuten erhalten.

Stopp, Schließen, Escape, Sichtbarkeitswechsel, pagehide und Unmount beenden die Aufnahme. Der Wechsel zur Texteingabe schaltet das Mikrofon aus. Abgebrochene Such- und Sprachergebnisse dürfen weder navigieren noch die Aufnahme wieder starten. Suchanfragen haben ein Zeitlimit, auch wenn der zugrunde liegende Dienst keine Abbruchfunktion besitzt. Berechtigungen werden nach der Suche und unmittelbar vor der Navigation erneut geprüft.

Das neue Gesprächsfenster zeigt Verlauf, Mikrofonstatus, vorläufig erkannten Text und passende Antwortvorschläge. Es erlaubt Texteingaben, einen Neustart des Gesprächs und das Ausschalten der Stimme. Lange Antworten werden für die vorhandene lokale Stimme in Abschnitte mit höchstens 340 Zeichen geteilt. Bei Audiofehlern bleiben Textantwort, Folgeeingabe und erlaubte Navigation nutzbar.

Die Spracherkennung versteht zusätzliche natürliche Navigationseinleitungen, Synonyme, Personensuchen und Auswahlantworten nach Nummer, Name oder Ort. Die vorhandenen 63 Hilfeartikel liefern Anleitungen, Schritte, Beispiele und Fehlerhilfen. Folgeeingaben umfassen unter anderem Weiter, Ja, Gerne, Nein, Noch einmal, Wie bitte, Beispiel, Zurück und Anleitung öffnen. Negierte, mehrdeutige oder zusammengesetzte Navigationsbefehle führen zu keiner stillschweigenden Aktion.

## Erweiterung: ganze Sätze und kurze Angaben

Die Ergänzung `neoUnderstanding.web.ts` ordnet Thema und gewünschte Tätigkeit getrennt zu. Beide Angaben können in einem natürlichen Satz oder in aufeinanderfolgenden Antworten kommen. Allgemeine Themen wie „Rechnungen“, „Personal“, „Kalender“, „Urlaub“ oder „Unterschrift“ lösen eine passende Rückfrage aus. Ausdrückliche Öffnungsaufträge führen weiterhin direkt zur freigegebenen Seite. Bei mehreren genannten Themen fragt Neo, womit begonnen werden soll.

Beispiele aus den Dialogprüfungen:

- „Ich habe gerade einen neuen Mitarbeiter eingestellt und möchte wissen, wie ich ihn bei uns eintragen kann.“ → Anleitung zur Personalaufnahme.
- „Könntest du mich zu der Seite bringen, auf der ich die Rechnungen sehen kann?“ → Rechnungsübersicht.
- „Eine Rechnung“ → Rückfrage zu Übersicht, Vorbereitung oder Erklärung; „Ich möchte eine neue erstellen“ → Anleitung zur Abrechnungsvorbereitung.
- „Urlaub“ → Rückfrage zu Personal oder Kalender; „Im Kalender“ → Anleitung zur Verfügbarkeit.
- „Ich möchte etwas anlegen“ → Rückfrage zum Gegenstand; „Klient“ → Anleitung zur Klientenaufnahme.
- „Klient“ → „Eine Akte suchen“ → Namensfrage; „Die Klientin heißt Anna Müller“ → Suche nach dem Namen. Die Testperson ist erfunden.

Ein unbestimmtes „Ja“, ungültige Nummern und „Noch nicht sicher“ wählen keine von mehreren Möglichkeiten aus. Neue Aufträge, Korrekturen und Negationen übernehmen keine vorherige Öffnungsabsicht. „Das habe ich gemacht“, „Wie geht es weiter“ und „Kannst du mir dazu ein Beispiel geben?“ führen eine laufende Anleitung fort. „Das funktioniert nicht“ behält den Bezug zur Anleitung.

Die Erweiterung fügt weder ein externes Sprachmodell noch einen neuen Dienst hinzu. Die Erkennung arbeitet weiterhin innerhalb der unterstützten CareSuite-Themen; beliebige Alltagssprache zu beliebigen Themen ist damit nicht zugesichert.

## Umfang und Grenzen

Die Dialoglogik verwendet einen lokalen Intent-Parser und die vorhandenen Hilfeinhalte. Sie ist kein generatives Sprachmodell für beliebige Themen. Sie öffnet freigegebene Seiten und Akten und erklärt Abläufe; Schreiboperationen, Versand und Freigaben führt sie nicht aus. Gesprächsverlauf und Personenauswahl bleiben im Speicher der geöffneten Sitzung. Die bestehende Browser-Spracherkennung und lokale Sprachsynthese werden weiterverwendet. Die Android-Komponenten werden nicht geändert. Neo bleibt auf `/Desktop` beschränkt; eine Navigation beendet daher die sichtbare Sitzung.

## Verifikation

- 132 Dialogtests in `neoConversation.test.ts`, `neoNaturalDialogue.test.ts` und `neoDialogueInteraction.test.ts`: Satzvarianten, alle Hilfetitel, mehrteilige Spracheingaben, kurze Angaben, gezielte Rückfragen, Folgefragen, Kontextwechsel, Personenauswahl, Zugriffswechsel, Textmodus, Abbruch, verspätete Ergebnisse, stumme/fehlerhafte Sprachausgabe, Zeitlimits und Aufräumen. Zwei zusätzliche Interaktionstests prüfen ausdrücklich die Mikrofonfortsetzung über die neue Rückfrage und den ausgeschalteten Mikrofonzustand beim entsprechenden Textdialog.
- 50 bestehende Tests in `robotNavigation.test.ts`, `neoExtras.test.ts`, `neoSpeechWorker.test.ts` und `neoStartup.test.tsx` bestanden.
- Drei vorhandene Prüfungen in `scripts/neo-header-dock.test.mjs` bestanden.
- Strikte TypeScript-Prüfung der fünf betroffenen Produktionsmodule mit ihren Importen bestanden.
- Browser-Bündelung des echten DOM-Einstiegspunkts mit dem vorhandenen esbuild bestanden (rund 223 KiB, unminifiziert).
- `git diff --check` bestanden.

## Offene Nachweise

Der vollständige Produktionsbuild wurde begonnen. Die bestehende Pflichtprüfung `verify:client-intake:release` scheiterte am systemseitig beendeten projektweiten TypeScript-Prozess (`SIGKILL`, Heap-Obergrenze 7168 MiB). Das ist kein erfolgreicher Produktionsbuild; die Prüfung wurde nicht umgangen.

Die lokale Vorschau konnte vom verfügbaren Cloud-Browser nicht erreicht werden (`ERR_CONNECTION_REFUSED`). Eine visuelle Abnahme in breiter und schmaler Ansicht ist daher offen. Die Dialogtests verwenden simulierte Erkennungs- und Audioereignisse; ein Endgerätetest mit echtem Mikrofon, Browser-Sprachdienst und der hörbaren Neo-Stimme ist ebenfalls offen. Keine produktiven Klientendaten wurden für die Prüfungen verwendet.
