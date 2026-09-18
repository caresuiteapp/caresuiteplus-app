# CareSuite: mobiles Portal, Chat und Startintro

Stand: 18.09.2026. Ausgangspunkt: `4c940ee` (`origin/main`).
Arbeitszweig: `fix/mobile-layout-intro-20260918`.

## Ergebnis und Abgrenzung

Die sieben hochgeladenen Screenshots wurden mit dem aktuellen Quellcode abgeglichen.
Die gemeinsame Oberfläche des Mitarbeiter- und Klientenportals im mobilen Browser
ist korrigiert. Die Korrektur des Arbeitsstarts liegt als separat geprüfter SQL-Patch vor.
Die Änderungen sind **noch nicht produktiv veröffentlicht**; die Datenbank wurde nur gelesen.
Es wurden keine echten Arbeitszeitbuchungen, Nachrichten oder Uploads zu Testzwecken angelegt.
Die native Intro-Implementierung wurde geprüft, aber nicht geändert oder neu veröffentlicht.

## Befunde und Änderungen

| Bereich | Nachgewiesener Befund | Änderung |
| --- | --- | --- |
| Chat mit Tastatur (IMG_4233) | Die Shell übernahm nur die maximale Höhe des Visual Viewports. Safari kann den sichtbaren Bereich zusätzlich nach oben/unten verschieben. Der bereits vorhandene Offset wurde nicht verwendet. | Die Web-Shell folgt Höhe, Breite und Ursprung des sichtbaren Bereichs. Tastaturschließen blendet die Fußnavigation erst nach Rückkehr der nutzbaren Höhe ein. Pinch-Zoom bleibt unbeeinflusst. |
| Chat ohne Tastatur (IMG_4234) | Die Eingabe reservierte auch auf schmalen Displays die größere Desktop-Höhe; Safe-Area-Abstand wurde zusätzlich zum bereits im Layout vorhandenen Footer reserviert. | Kompaktere Eingabe, keine doppelte Web-Tastaturverkleinerung und kein doppelter Footer-Abstand. Entwurf und Nachrichtenlogik bleiben bestehen. |
| Offene Einsätze und Uploads (IMG_4229/IMG_4232) | Eine globale `!important`-Regel färbte die gesamte HealthOS-Arbeitsfläche dunkel. Die vorhandenen Portal-Ausnahmen behandelten Karten, aber nicht die Arbeitsfläche selbst. | Helle, opake Arbeitsfläche für Mitarbeiter- und Klientenportale in beiden CSS-Varianten, einschließlich der tatsächlich verwendeten `.web.ts`-Datei. Dunkle Schrift und Formularfelder bleiben lesbar. |
| Navigation (IMG_4228) | „Fahrtenbuch“ wurde in der schmalen Navigation mitten im Wort umgebrochen. | Sichtbare Kurzbezeichnung „Fahrten“, vollständiger zugänglicher Name weiterhin „Fahrtenbuch“. Einzeilige Darstellung der Hauptnavigation. |
| Fahrtenbuch-Hinweis | Drei doppelt deklarierte Zeilenhöhen überschrieben die skalierbare Schrift und verursachten zusätzlich TypeScript-Fehler. | Doppelte Werte entfernt, Titel und Zeilenhöhen skalierbar, Aktionsfläche mindestens 44 px hoch. |
| Arbeitsstart (IMG_4230/IMG_4231) | Die produktive Funktion `wfm_apply_clock_action` nutzt `workforce_current_employee_id()`, das ausschließlich über Office-Profile auflöst. Die Portal-Zuordnung wird ausgelassen. | Separater Patch verwendet den vorhandenen Resolver und prüft aktives Portal, eigenen Mitarbeiter, Mandant, Anmeldung und erlaubte Quelle. Office-Aktionsrechte bleiben erhalten; NULL-Autorisierung wird abgewiesen. |
| Intro mit Musik | Alle sechs MP4s enthalten acht Sekunden H.264 und AAC-Stereo mit 48 kHz. Das öffentliche Intro wurde aufgerufen; die konkrete Nichtwiedergabe auf dem Nutzergerät wurde nicht reproduziert. Bisher verschwanden Fehler unmittelbar; ein später Tonstart lief nur im Rest des Videos und unter dem ursprünglichen Timeout. | „Mit Musik neu starten“ startet synchron aus dem Antippen bei Sekunde 0 mit voller Wiedergabezeit. Pausierte/gesperrte Wiedergabe erhält eine Startaktion; Medienfehler erhalten „Erneut abspielen“ und einen direkten Zugang zur Anmeldung. Ohne erfolgreiche Wiedergabe bleibt der Zugang zeitlich begrenzt blockiert. |

Browser dürfen hörbaren Autostart verhindern. Der Ton kann dann erst nach einer
Nutzeraktion beginnen. Dies wird durch die sichtbare Wiedergabeaktion unterstützt,
nicht als garantierter hörbarer Autostart ausgegeben.
Referenz: https://webkit.org/blog/6784/new-video-policies-for-ios/

## Verifikation

- 51 Tests in sechs gezielten Vitest-Suiten bestanden: Web-/Native-Intro,
  Visual-Viewport-Ereignisse, CSS-Kaskade, neuer Chat und WFM-Integrität.
- 6 isolierte PostgreSQL-Tests bestanden. Start, Pause, Fortsetzen, Wechsel und
  Abschluss speichern korrekt; Doppelstart, fremde Mitarbeiter, falscher Mandant,
  deaktiviertes Konto, Klientenrolle, fehlende Anmeldung und unzulässige Quelle
  werden abgewiesen. Office-Aktionsrechte und anonyme Ausführung wurden geprüft.
- ESLint für alle geänderten Produktionskomponenten: keine Fehler oder Warnungen.
- Produktions-Webexport mit `EXPO_PUBLIC_DEMO_MODE=false` erfolgreich.
- Vorhandener Exportaudit bestätigt identische initiale React-Wurzeln auf drei
  Einstiegsrouten; Intro vor Anmeldung bleibt erhalten.
- Tatsächlich referenziertes Export-Bundle enthält Viewport- und Musikänderungen;
  das exportierte HTML enthält die neue Portal-CSS-Regel. Alle sechs ausgegebenen
  MP4s stimmen per SHA-256 mit den Quelldateien überein.
- Audioanalyse des Smartphone-Hochformats: Stereo vorhanden, Mittelwert -21,9 dB,
  Spitze -10,0 dB. Kein stummes Audiomaterial.
- TypeScript-Gesamtprüfung bleibt rot: 36 Fehler im geänderten Arbeitsstand.
  Keine dieser Fehlermeldungen ist neu gegenüber dem separat geprüften Ausgangsstand.
  Details: `mobile-portal-intro-20260918-typecheck.json`.
- `employeePortalResponsiveVisualGate.test.ts`: 17 bestanden, zwei fehlgeschlagen.
  Beide Fehler wurden unverändert im Ausgangsstand reproduziert: veraltete
  Timeout-Erwartung (25 s gegenüber bestehenden 90 s) und ein veralteter
  Quelltextmarker in der Kartenprüfung. Diese Prüfungen wurden nicht auf Grün umgeschrieben.

Reproduzierbare Befehle:

```sh
npx vitest run src/__tests__/design/portalSurfaceCascade.test.ts src/__tests__/platform/webVisualViewport.test.tsx src/__tests__/platform/appStartIntroWeb.test.tsx src/__tests__/platform/appStartIntro.test.tsx src/__tests__/portal/portalNewChatInteraction.test.tsx src/__tests__/wfm/wfmWorktimeIntegrityR1.test.ts
node --test supabase/tests/wfm_portal_clock_authorization.test.mjs
EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform web
node scripts/audit-web-navigation-export.mjs dist
npx tsc --noEmit
```

## Offene Nachweise und Veröffentlichung

Der verfügbare Browser lehnt die lokale Vorschau mit `ERR_BLOCKED_BY_CLIENT` ab.
Daher wurde die korrigierte Oberfläche nicht mit einem echten Layout-Renderer auf
iPhone/Safari abgenommen. Die Ereignis- und CSS-Tests belegen keine visuelle
Fehlerfreiheit. Ausstehend sind insbesondere Chat/Tastatur auf einem realen iPhone,
Hoch-/Querformat, vergrößerte Schrift sowie die tatsächliche Tonwiedergabe des Geräts.
Eine vollständige Funktionsfreigabe aller CareSuite-Seiten wird nicht behauptet.

Der SQL-Patch liegt in `supabase/fixes/wfm_portal_clock_authorization.sql` und ersetzt
nur die bestehende Stempelfunktion. Er wurde lokal angewendet und geprüft; es gibt
noch keinen produktiven Migrationseintrag. Er muss beim freigegebenen Datenbankrelease
über den regulären Migrationsweg übernommen werden. Ein reines Web-Deployment
beseitigt den produktiven Berechtigungsfehler nicht.

Die Projektvorgabe in `AGENTS.md` erteilt für Prüfungen und lokale Korrekturen keine
Veröffentlichungsfreigabe. Dieser Stand wird deshalb als überprüfbarer Entwurf
bereitgestellt; Produktions-Merge, Web-Release und Datenbankrelease sind nicht erfolgt.
