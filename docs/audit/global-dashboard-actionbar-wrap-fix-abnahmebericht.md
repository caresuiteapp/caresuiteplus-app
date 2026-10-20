# Global Dashboard Action Bar Wrap Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Gemeinsame `ActionToolbar` für Modul-Dashboards (Assist, Office, Pflege, Stationär, Beratung, Akademie)  
**Commit-Message:** `fix(shell): wrap dashboard action bars consistently`

---

## 1. Problem

Modul-Dashboard-Header renderten alle Aktionen in einer horizontalen Zeile (`flexDirection: 'row'`, `justifyContent: 'flex-end'`). Bei Beratung mit 6 Aktionen (Fall anlegen, Erstgespräch, Wiedervorlagen, Protokoll, Kontakt, Aktualisieren) lief die Leiste über den sichtbaren Bereich hinaus — Buttons wurden abgeschnitten.

## 2. Root Cause

`ActionToolbar` (`src/components/layout/platform/actiontoolbar.tsx`) mappte das flache `actions`-Array in **eine einzige** `flexWrap`-Zeile ohne Positions-Split. Obwohl Module bereits `primary`/`secondary`-Varianten übergaben, gab es keine strukturelle Trennung in Primär- und Sekundärzeilen; bei vielen Aktionen wirkte Wrap visuell wie eine lange Einzelzeile und überlief auf schmalen Viewports.

## 3. Umsetzung

| Bereich | Änderung |
|---------|----------|
| **Split at render** | `actions.slice(0, 2)` → Primärzeile; `actions.slice(2)` → Sekundärzeile(n) |
| **Outer container** | `flexDirection: 'column'`, `gap: 12`, `width/maxWidth: 100%`, `minWidth: 0` |
| **Primärzeile** | Max. 2 Aktionen, `flexWrap`, `gap: 12`, Akzent-/Primary-Styling |
| **Sekundärzeile** | Restliche Aktionen, Glass-Styling; `ghost` für z. B. „Aktualisieren“ |
| **Buttons** | `maxWidth: 100%`, `minWidth: 0`, `flexShrink: 1` — kein erzwungenes Nowrap auf der Bar |
| **Module** | Keine IndexScreen-Änderungen — flache Arrays bleiben unverändert |

### Geänderte Dateien

- `src/components/layout/platform/actiontoolbar.tsx`
- `src/__tests__/layout/dashboardActionBarWrap.test.ts` (neu)
- `docs/audit/global-dashboard-actionbar-wrap-fix-abnahmebericht.md`
- `docs/audit/dashboard-actionbar-wrap-screenshots/README.md`

### Nicht geändert (Out of Scope)

- Dashboard-Fachinhalt pro Modul
- K.6, Rechnungen, Deploy, DB-Push, Migrationen, Prod-Daten
- `.env`, breites Git-Staging
- Keine Buttons entfernt

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-global-dashboard-actionbar-wrap-fix.log` | ✅ 24/24 (`dashboardActionBarWrap.test.ts`) |
| `.audit-typecheck-global-dashboard-actionbar-wrap-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte ActionToolbar-Datei ohne neue Fehler |

---

## 5. Browser (§14)

**Status:** BLOCKED — `localhost:8082` in dieser Session nicht erreichbar (Timeout).

Empfohlene Checks nach Dev-Server-Start: `/beratung`, `/assist`, `/office`, `/pflege`, `/stationaer`, `/akademie` bei 1440, 1280, 1024, 900, 768, 430, 390 px — Zeile 1 mit max. 2 primären Buttons, restliche Aktionen darunter mit Wrap.

---

## 6. Checkliste (17 Punkte — §14)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Zentraler Fix in `ActionToolbar`, nicht pro Modul-Screen | ✅ |
| 2 | Flaches `actions`-Array wird per `slice(0,2)` / `slice(2)` geteilt | ✅ |
| 3 | Primärzeile: max. 2 Aktionen, prominent/colored Styling | ✅ |
| 4 | Sekundärzeile: Index 3+, Glass-/Secondary-Styling | ✅ |
| 5 | Sekundärzeile `flexWrap` — automatisch Zeile 3+ bei Bedarf | ✅ |
| 6 | Outer: flex column, gap 12, width 100%, minWidth 0 | ✅ |
| 7 | Buttons: maxWidth 100%, minWidth 0, flexShrink 1 | ✅ |
| 8 | Kein fester Breiten-Overflow auf der Action-Bar | ✅ |
| 9 | Beratung (6 Aktionen) — Regression abgedeckt | ✅ |
| 10 | Pflege Index nutzt unverändert `ActionToolbar` | ✅ |
| 11 | Stationär Index nutzt unverändert `ActionToolbar` | ✅ |
| 12 | Akademie Index nutzt unverändert `ActionToolbar` | ✅ |
| 13 | Office Index nutzt unverändert `ActionToolbar` | ✅ |
| 14 | Assist Index nutzt unverändert `ActionToolbar` (+ optional `leftSlot`) | ✅ |
| 15 | Keine Dashboard-Fachlogik / KPI-Inhalte geändert | ✅ |
| 16 | Tests 24/24 grün, kein Button entfernt | ✅ |
| 17 | Kein `[deploy]`, kein K.6, kein DB-Push | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.
