# Global Screensaver S.1 — Abnahmebericht

Datum: 2026-06-23

## 1. Ausgangsbefund

- Kein systemweiter Bildschirmschoner vorhanden.
- Time-Tracking-Inaktivität existiert separat (Arbeitszeit-Domain).
- Keine Seite „Darstellung & Oberfläche“.
- G.1 Background Engine aktiv — Hintergrund bleibt unter Overlay sichtbar.

## 2. Neue Komponenten

| Datei | Rolle |
|-------|-------|
| `src/lib/screensaver/*` | Typen, Format, AsyncStorage-Service, Route |
| `src/components/screensaver/*` | Provider, GlobalScreensaver, Overlay, Modi, Logo |
| `src/hooks/useInactivityTimer.ts` | Timeout-Logik |
| `src/hooks/useScreensaverActivityEvents.ts` | Globale Activity-Events (throttled) |
| `src/components/settings/ScreensaverSettingsSection.tsx` | Settings-UI |
| `src/screens/settings/AppearanceSettingsScreen.tsx` | Seite Darstellung & Oberfläche |
| `app/settings/appearance.tsx` | Route `/settings/appearance` |

## 3. Inaktivitätslogik

- Ein `setTimeout` pro Timer-Zyklus, Reset bei Activity.
- Events: Maus, Tastatur, Scroll, Touch, Pointer, Focus, Visibility.
- `mousemove`/`pointermove` throttled (250 ms).
- Overlay-Dismiss via `Pressable.onPress` — kein Durchklick auf UI darunter.

## 4. Unterstützte Geräte

- **Desktop/Tablet** (`width >= 768`): aktiv wenn Settings `enabled` und Modus ≠ `off`.
- **Phone** (`width < 768`): deaktiviert; Hinweis in Settings.

## 5. Modi

| Modus | Status |
|-------|--------|
| Aus (`off`) | Ja |
| Logo statisch | Ja |
| Logo Ping-Pong (rAF) | Ja |
| Uhrzeit HH:MM:SS | Ja |
| Uhrzeit + Datum + Wochentag (deutsch) | Ja |

## 6. Einstellungen

- Route: `/settings/appearance`
- Link von Profil & Konto
- Felder: Aktivieren, Timeout (1–60 min, Default 10), Modus, Logo-Größe, Bewegung, Sekunden, 24h, Datum/Wochentag
- **Bildschirmschoner testen** — Vorschau mit Draft-Settings ohne Speichern

## 7. Persistenz

- **MVP AsyncStorage** (kein `db push`):
  - `caresuite:screensaver:user:{tenantId}:{userId}`
  - `caresuite:screensaver:tenant-default:{tenantId}` (Service vorbereitet)
- Migration `tenant_ui_settings` / `user_ui_preferences`: **nicht angewendet** (dokumentiert für später)

## 8. Datenschutz

- Overlay: `backdrop-filter: blur(12px)` + transluzenter Layer
- Angezeigt: Logo, CareSuite+, Mandantenname, Uhrzeit, Datum — keine Klienten-/Rechnungsdaten
- zIndex 2500 über Modals — Modale bleiben im Stack, werden nicht geschlossen

## 9. Browser-Abnahme

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Mount in `_layout.tsx` | Ja (Code + Tests) |
| Live Browser (Playwright) | **Auth blockiert** — `AUDIT_BUSINESS_*` und `TEST_BUSINESS_*` in `.env` liefern „E-Mail oder Passwort ist falsch“ gegen Live-Supabase |
| Screenshots | `debug-after-login.png` (Login-Fehlerzustand); funktionale Screenshots nach erfolgreichem Login ausstehend |
| Viewport-Matrix (Code) | Desktop/Tablet: `!isPhone`; Mobile: deaktiviert + Hinweis in Settings |

**Empfehlung:** Mit gültigen Business-Credentials erneut `node .audit-screensaver-s1-browser.mjs` ausführen (Skript nicht committed). Erwartung: Appearance-Seite, Preview-Overlay, Dismiss per Klick.

## 10. Tests / Typecheck

- **Vitest:** 21/21 bestanden (`src/__tests__/screensaver/globalScreensaver.test.ts`)
- **Typecheck:** Projektweite `tsc` meldet vorbestehende RN-Web-Style-Typfehler; S.1-spezifische Import-/Overlay-Fehler behoben
- Logs: `.audit-test-global-screensaver-s1.log`, `.audit-typecheck-global-screensaver-s1.log` (nicht committed)

## 11. Nicht ausgeführt

- Keine Dashboard-Fachänderungen
- Kein K.6
- Keine Rechnungen / Rechnungsnummern
- Kein Deploy
- Keine Migration angewendet
- Keine produktiven Daten
- Kein Push
