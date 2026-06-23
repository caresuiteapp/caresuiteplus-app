# Pflege Dashboard UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Pflege-Index-Dashboard (`/pflege`) — ambulantes Pflege-Cockpit, keine Zentrale/Office/Stationär-Kopie  
**Commit-Message:** `fix(pflege): replace generic dashboard with care workspace`

---

## 1. Problem

Das Pflege-Dashboard (`/pflege`) nutzte `CareLightModuleDashboard` mit generischen Modul-Kacheln, u. a. **Bewohner:innen** (Stationär) und Office-nahen Workflows. Fachlich falsch für **ambulante Pflege**.

## 2. Zielbild

Eigenes Pflege-Cockpit mit 12 KPIs, klinischen Workflow-Sektionen, Pflege-Schnellzugriff und rechter Sidebar — analog Office/Assist Reality Fixes, ohne Zentrale-Modulübersicht.

## 3. Umgesetzte Änderungen

| Bereich | Änderung |
|---------|----------|
| **Header** | Breadcrumb Start › Pflege, Titel „Pflege“, Untertitel „Pflegeplanung, Dokumentation und Maßnahmensteuerung“ |
| **Primär-Aktionen** | `+ Pflegeeinsatz planen`, `+ Pflegedokumentation` |
| **Sekundär-Aktionen** | Pflegepläne öffnen, Vitalwerte erfassen, Übergabe schreiben |
| **KPI „Heute in der Pflege“** | 12 KPIs via `buildPflegeWorkspaceKpis`, klickbar mit Pflege-Routen/Filtern |
| **Sektionen A–J** | Prioritäten, Einsätze, Pläne, Dokumentation, Vitalwerte, Medikation, Wunden, SIS, Berichte/Übergaben, zugeordnete Klient:innen |
| **Schnellzugriff** | Nur Pflege-Routen — kein Bewohner:innen, kein Stationär, keine Office-Aktionen |
| **Sidebar** | 8 Pflege-Schnellaktionen (`PFLEGE_QUICK_ACTIONS`) in Desktop- und Mobile-Context-Panel |
| **Daten** | `PflegeDashboardStats` erweitert; Demo-Aggregation in `carePlanListService`; Live-Modus mit Zero-Defaults |

### Nicht geändert (laut Vorgabe)

- `ModuleOverviewDashboard` / `BusinessDashboardScreen` (Zentrale)
- Office-Dashboard
- Assist-Dashboard
- Stationär-Dashboard
- K.6, Rechnungen, Deploy, Migrationen

### Neue / geänderte Dateien

- `src/lib/pflege/pflegeDashboardWorkspace.ts` (neu)
- `src/components/dashboard/PflegeDashboardView.tsx` (neu)
- `src/screens/pflege/PflegeIndexScreen.tsx`
- `src/lib/pflege/carePlanListService.ts`
- `src/lib/pflege/pflegeDashboardStats.ts`
- `src/types/modules/pflege.ts`
- `src/components/layout/platform/platformContextData.ts`
- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/components/layout/platform/mobileplatformcontextpanel.tsx`
- `src/__tests__/pflege/pflegeDashboard.test.ts` (neu)
- `src/__tests__/design/visualReality.test.ts`
- `src/__tests__/pflege/pflegePremiumHeroesBatch.test.ts`

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-pflege-dashboard-ui-reality-fix.log` | ✅ 9/9 (`pflegeDashboard.test.ts`) |
| `.audit-typecheck-pflege-dashboard-ui-reality-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Pflege-Dateien ohne neue Fehler |

---

## 5. Browser

**Status:** BLOCKED — Dev-Server/Browser in dieser Session nicht erreichbar (kein Tab, Auth erforderlich).

Empfohlene manuelle Checks nach Start (`npm run web` / Port 8082):

1. `/pflege` — „Heute in der Pflege“ + 12 KPIs, kein Bewohner:innen-Tile
2. KPI-Klick → gefilterte Pflege-Route
3. Rechte Sidebar — Pflegeeinsatz planen, SIS starten; kein Klient anlegen / Bewohner:innen
4. Schnellzugriff — nur Pflege-Bereiche

---

## 6. K.6 / Rechnungen

**Nicht betroffen** — keine Abrechnungs- oder Rechnungslinks im Pflege-Dashboard.

---

## 7. Checkliste §27 (21 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Pflege nutzt kein `CareLightModuleDashboard` / `ModuleOverviewDashboard` | ✅ |
| 2 | Zentrale/Business-Dashboard unverändert | ✅ |
| 3 | Office-Dashboard unverändert | ✅ |
| 4 | Assist-Dashboard unverändert | ✅ |
| 5 | Stationär-Dashboard unverändert | ✅ |
| 6 | Breadcrumb Start › Pflege | ✅ |
| 7 | Titel „Pflege“, Untertitel Pflegeplanung/Dokumentation/Maßnahmensteuerung | ✅ |
| 8 | Primär: Pflegeeinsatz planen + Pflegedokumentation | ✅ |
| 9 | Sekundär: Pflegepläne, Vitalwerte, Übergabe | ✅ |
| 10 | 12 KPIs „Heute in der Pflege“ | ✅ |
| 11 | KPI-Klicks → Pflege-Routen mit Filtern | ✅ |
| 12 | Sektion A: Heute pflegerisch wichtig + Prioritäten | ✅ |
| 13 | Sektionen B–I: Einsätze, Pläne, Doku, Vitalwerte, Medikation, Wunden, SIS, Berichte/Übergaben | ✅ |
| 14 | Sektion J: Zugeordnete Klient:innen | ✅ |
| 15 | Schnellzugriff nur Pflege-Routen | ✅ |
| 16 | Sidebar 8 Pflege-Aktionen ohne Office/Stationär | ✅ |
| 17 | Kein Bewohner:innen / Klient anlegen / Rechnung auf Dashboard | ✅ |
| 18 | LLGAN light KPI (`variant="light"`) / lesbarer Kontrast | ✅ |
| 19 | `ModuleDashboardShell` Layout-Kette | ✅ |
| 20 | Tests grün (9/9) | ✅ |
| 21 | Kein `[deploy]`, kein K.6, kein DB-Push | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.
