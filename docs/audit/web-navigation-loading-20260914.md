# Web-Navigation und Ladeverhalten – 14.09.2026

Ausgangsstand: `a17fcc8833f543873a6da15b60f8b46a8cc6fe07` (`main`).
Arbeitsbranch: `fix/web-navigation-loading-20260914`.

## Befunde und Korrekturen

| Befund | Korrektur |
| --- | --- |
| Die Web-Anmeldung meldete `authReady`, obwohl `restoreSupabaseSession` noch lief. | Die erste Sitzungswiederherstellung wird vor Freigabe der Oberfläche abgewartet. |
| Explizite Wiederherstellung, `INITIAL_SESSION` und nachträgliche Reconciliation konnten denselben Bootstrap mehrfach auslösen. | Web verwendet die explizite Wiederherstellung; normale spätere Anmelde-/Abmeldeereignisse bleiben aktiv. |
| Anmeldung, Navigation, Suche und Rücksprungaktionen enthielten unterschiedliche Startziele (`/`, `/business`, `/office`). | Ein gemeinsames Web-Startziel `/`; native Ziele bleiben plattformspezifisch erhalten. |
| `/business` baute noch das frühere Dashboard mit eigener Datenabfrage auf. | Alte Startpfade werden vor dem Aufbau der alten Oberfläche abgefangen. Bestehende Business-Unterseiten bleiben erreichbar. Vercel-Weiterleitungen sind vorbereitet. |
| Auf der bisherigen Live-Seite wurde bei `/business` React-Fehler 418 beobachtet. | Web-Navigation erhält einen identischen ersten HTML-Baum für alle URLs und wird nach Hydration direkt am angeforderten Ziel aufgebaut. Ein Regressionstest verwendet bewusst unterschiedliche Server- und Client-Ziele. |
| Web-Seitenübergänge und nachträglich gesetzte Designattribute konnten vorherige Ansichten sichtbar lassen. | Web-Stack-Übergänge ohne Seitenanimation; Designattribute vor dem Zeichnen aktualisieren. |
| Vollbild-Ladefallback und Video-Vorbereitung verwendeten dunkle Flächen. | Explizite helle Web-Ladefläche, helle Browser-Themefarbe und helle Video-Vorbereitung bis zum tatsächlichen Abspielen. |

Das bestehende Intro bleibt beim vollständigen Neuladen erhalten. Die eigentlichen Videobilder werden unverändert abgespielt; ein normaler interner Seitenwechsel startet das Intro nicht erneut.

React beschreibt Fehler 418 als Abweichung zwischen Server-HTML und Client-Baum mit anschließendem Neuaufbau: [React-Dokumentation](https://react.dev/errors/418). Die Beobachtung betrifft den bisherigen Live-Stand, keine vollständige Ursachenmessung aller Seiten.

## Verifikation

- 58 Tests in 9 Testdateien bestanden: Sitzungswiederherstellung, verzögerte Antworten, doppelte Erstereignisse, An-/Abmeldung, Portalziele, alte Einstiegspfade, Hydration und Intro.
- Bestehendes `navigation-duplicate-audit.mjs` bestanden: keine Segmentkonflikte; enthaltene Neu-/Bearbeiten-Routen gültig.
- Vollständiger Web-Export mit `EXPO_PUBLIC_DEMO_MODE=false` erfolgreich (`dist-navigation-final`).
- Vollständiger TypeScript-Check gegen unverändertes `a17fcc88` verglichen: vorher 42, nachher dieselben 42 Diagnosen; keine zusätzlichen Diagnosen nach Normalisierung der Zeilennummern. Der projektweite Typcheck ist damit weiterhin nicht grün.
- `git diff --check` bestanden.
- Vorhandene Projektabhängigkeiten und Prüfwerkzeuge verwendet.

## Grenzen und Veröffentlichungsstand

Die Korrekturen sind auf einem separaten Branch vorbereitet. Eine Veröffentlichung auf `main` ist durch diesen Bericht nicht belegt.
Der öffentliche Live-Einstieg und die bisherige Weiterleitung wurden im Browser überprüft. Eine vollständige angemeldete Ende-zu-Ende-Prüfung aller Fachseiten sowie eine visuelle Freigabe der neuen Version in breiten und schmalen Fenstern stehen noch aus. Die DOM-Tests ersetzen keine visuelle Prüfung.
Es wird keine gemessene prozentuale Ladezeitverbesserung behauptet. Die Tests belegen den Wegfall redundanter Erstabfragen und das unterbundene Rendern alter Einstiegsseiten; reale Antwortzeiten der Fachseiten müssen mit einer angemeldeten Sitzung gemessen werden.
