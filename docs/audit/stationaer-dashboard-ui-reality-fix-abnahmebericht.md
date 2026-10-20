# Stationär Dashboard UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Stationär-Index-Dashboard (`/stationaer`) — Einrichtungs- und Bewohner:innen-Arbeitszentrale  
**Commit-Message:** `fix(stationaer): replace generic dashboard with resident operations workspace`

---

## 1. Problem

Das Stationär-Dashboard (`/stationaer`) nutzte `CareLightModuleDashboard` mit generischen Modul-Kacheln und Office-nahen Workflows. Fachlich falsch für **stationäre Einrichtungssteuerung** (Belegung, Wohnbereiche, Tagesstruktur, Mahlzeiten, Übergaben).

## 2. Zielbild

Eigenes Einrichtungs-Cockpit mit 12 KPIs, fünf Workflow-Sektionen, Stationär-Schnellzugriff und rechter Sidebar — analog Pflege/Office/Assist Reality Fixes, ohne Zentrale-Modulübersicht.

## 3. Umgesetzte Änderungen

| Bereich | Änderung |
|---------|----------|
| **Header** | Breadcrumb Start › Stationär, Titel „Stationär“, Untertitel „Bewohner:innen, Belegung und Einrichtungsalltag im Überblick“ |
| **Primär-Aktionen** | `+ Bewohner:in anlegen`, `+ Aufnahme starten` |
| **Sekundär-Aktionen** | Belegung öffnen, Übergabe schreiben, Zimmerübersicht, Tagesstruktur öffnen |
| **KPI „Einrichtungsstatus heute“** | 12 KPIs via `buildStationaerWorkspaceKpis`, klickbar mit Stationär-Routen/Filtern |
| **Sektionen A–E** | Bewohner:innen & Belegung, Wohnbereiche & Zimmer, Alltag & Versorgung, Übergabe & Berichte, Auswertungen |
| **Schnellzugriff** | 11 Stationär-Routen — kein Klient anlegen, kein Office/Pflege/Assist |
| **Sidebar** | 8 Stationär-Schnellaktionen + 6 Heute-Aufgaben in Desktop- und Mobile-Context-Panel |
| **Daten** | `StationaerDashboardStats` erweitert; Demo-Aggregation in `residentListService`; Live-Modus mit Zero-Defaults |
| **Akzent** | Rot `#EF4444` (`moduleColor('stationaer')`), LLGAN light KPI (`variant="light"`) |

### Nicht geändert (laut Vorgabe)

- Zentrale/Business-Dashboard
- Office-Dashboard
- Assist-Dashboard
- Pflege-Dashboard
- K.6, Rechnungen, Deploy, Migrationen

### Neue / geänderte Dateien

- `src/lib/stationaer/stationaerDashboardWorkspace.ts` (neu)
- `src/components/dashboard/StationaerDashboardView.tsx` (neu)
- `src/screens/stationaer/StationaerIndexScreen.tsx`
- `src/types/modules/stationaer.ts`
- `src/lib/stationaer/residentListService.ts`
- `src/components/layout/platform/platformContextData.ts`
- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/components/layout/platform/mobileplatformcontextpanel.tsx`
- `src/__tests__/stationaer/stationaerDashboard.test.ts` (neu)
- `src/__tests__/stationaer/stationaerDashboardHero.test.ts`

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-stationaer-dashboard-ui-reality-fix.log` | ✅ 11/11 (`stationaerDashboard.test.ts`) |
| `.audit-typecheck-stationaer-dashboard-ui-reality-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Stationär-Dateien ohne neue Fehler in Workspace/View |

---

## 5. Browser

**Status:** BLOCKED — Dev-Server (`localhost:8082`) in dieser Session nicht erreichbar (kein Browser-Tab, Auth erforderlich).

Empfohlene manuelle Checks nach Start (`npm run web` / Port 8082):

1. `/stationaer` — „Einrichtungsstatus heute“ + 12 KPIs, kein Klient-anlegen-Tile
2. KPI-Klick → gefilterte Stationär-Route
3. Rechte Sidebar — Bewohner:in anlegen, Aufnahme starten; kein Klient anlegen / Mitarbeiter anlegen
4. Schnellzugriff — nur Stationär-Bereiche

---

## 6. K.6 / Rechnungen

**Nicht betroffen** — keine Abrechnungs- oder Rechnungslinks im Stationär-Dashboard.

---

## 7. Checkliste (17 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Stationär nutzt kein `CareLightModuleDashboard` / `ModuleOverviewDashboard` | ✅ |
| 2 | Zentrale/Business-Dashboard unverändert | ✅ |
| 3 | Office-Dashboard unverändert | ✅ |
| 4 | Assist-Dashboard unverändert | ✅ |
| 5 | Pflege-Dashboard unverändert | ✅ |
| 6 | Breadcrumb Start › Stationär | ✅ |
| 7 | Titel „Stationär“, Untertitel Bewohner:innen/Belegung/Einrichtungsalltag | ✅ |
| 8 | Primär: Bewohner:in anlegen + Aufnahme starten | ✅ |
| 9 | Sekundär: Belegung, Übergabe, Zimmer, Tagesstruktur | ✅ |
| 10 | 12 KPIs „Einrichtungsstatus heute“ | ✅ |
| 11 | KPI-Klicks → Stationär-Routen mit Filtern | ✅ |
| 12 | Sektionen A–E: Bewohner/Belegung, Wohnbereiche/Zimmer, Alltag, Übergabe, Auswertungen | ✅ |
| 13 | Schnellzugriff nur Stationär-Routen (11 Einträge) | ✅ |
| 14 | Sidebar 8 Stationär-Aktionen ohne Office/Pflege | ✅ |
| 15 | Heute-Panel: Neuaufnahmen, Entlassungen, Übergaben, freie Plätze, Planung, Konflikte | ✅ |
| 16 | LLGAN light KPI / lesbarer Kontrast, rotes Modul-Akzent | ✅ |
| 17 | Tests grün (11/11), kein `[deploy]`, kein K.6, kein DB-Push | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.
