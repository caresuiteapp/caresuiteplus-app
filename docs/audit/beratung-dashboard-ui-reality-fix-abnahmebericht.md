# Beratung Dashboard UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Beratungs-Index-Dashboard (`/beratung`) — Fall- und Wiedervorlagen-Cockpit, keine Office-Kopie  
**Commit-Message:** `fix(beratung): replace generic dashboard with case management workspace`

---

## 1. Problem

Das Beratungs-Dashboard (`/beratung`) nutzte `CareLightModuleDashboard` mit generischen KPIs (Offen/Termine/Abgeschlossen), Office-nahen Schnellaktionen und fehlendem Fall-Management-Cockpit (Wiedervorlagen, Erstgespräche, Protokolle, Kontaktverlauf, Angehörige, Fristen).

## 2. Zielbild

Eigenes Beratungs-Cockpit mit 12 KPIs, sechs Workflow-Sektionen, Beratungs-Schnellzugriff und rechter Sidebar — analog Pflege/Stationär Reality Fixes, ohne Zentrale-Modulübersicht.

## 3. Umgesetzte Änderungen

| Bereich | Änderung |
|---------|----------|
| **Header** | Breadcrumb Start › Beratung, Titel „Beratung“, Untertitel „Fälle, Protokolle und Wiedervorlagen im Überblick“ |
| **Primär-Aktionen** | `+ Fall anlegen`, `+ Erstgespräch dokumentieren` |
| **Sekundär-Aktionen** | Wiedervorlagen öffnen, Protokoll schreiben, Kontakt erfassen |
| **KPI „Beratungsstatus heute“** | 12 KPIs via `buildBeratungWorkspaceKpis`, klickbar mit Beratungs-Routen/Filtern |
| **Sektionen A–F** | Aktuelle Fälle, Termine & Erstgespräche, Protokolle, Wiedervorlagen, Kontakt & Angehörige, Auswertungen & Berichte |
| **Schnellzugriff** | 11 Beratungs-Routen — kein Office/Pflege/Assist/Stationär |
| **Sidebar** | 8 Beratungs-Schnellaktionen; Heute: Termine, Wiedervorlagen, Protokolle, Rückrufe, neue Fälle, Fristen |
| **Daten** | `BeratungDashboardStats` erweitert; Demo-Aggregation aus Fällen, Protokollen, Wiedervorlagen; Live-Modus mit Zero-Defaults für Erweiterungsfelder |

### Nicht geändert (laut Vorgabe)

- Zentrale, Office, Assist, Pflege, Stationär dashboards
- K.6, Rechnungen, Deploy, Migrationen, Prod-Daten

### Neue / geänderte Dateien

- `src/lib/beratung/beratungDashboardWorkspace.ts` (neu)
- `src/components/dashboard/BeratungDashboardView.tsx` (neu)
- `src/screens/beratung/BeratungIndexScreen.tsx`
- `src/lib/beratung/caseListService.ts`
- `src/types/modules/beratung.ts`
- `src/components/layout/platform/platformContextData.ts`
- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/components/layout/platform/mobileplatformcontextpanel.tsx`
- `src/__tests__/beratung/beratungDashboard.test.ts` (neu)
- `src/__tests__/beratung/beratungDashboardHero.test.ts`

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-beratung-dashboard-ui-reality-fix.log` | siehe Testlauf |
| `.audit-typecheck-beratung-dashboard-ui-reality-fix.log` | siehe Typecheck-Lauf |

---

## 5. Browser

**Status:** BLOCKED — Dev-Server/Browser in dieser Session nicht erreichbar (kein Tab, Auth erforderlich).

Empfohlene manuelle Checks nach Start (`npm run web` / Port 8082):

1. `/beratung` — „Beratungsstatus heute“ + 12 KPIs, kein Klient-anlegen-Tile
2. KPI-Klick → gefilterte Beratungs-Route
3. Rechte Sidebar — Fall anlegen, Protokoll schreiben; kein Klient anlegen / Mitarbeiter anlegen
4. Schnellzugriff — nur Beratungs-Bereiche

---

## 6. K.6 / Rechnungen

**Nicht betroffen** — keine Abrechnungs- oder Rechnungslinks im Beratungs-Dashboard.

---

## 7. Checkliste (18 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Beratung nutzt kein `CareLightModuleDashboard` / `ModuleOverviewDashboard` | ✅ |
| 2 | Zentrale/Business-Dashboard unverändert | ✅ |
| 3 | Office-Dashboard unverändert | ✅ |
| 4 | Assist-Dashboard unverändert | ✅ |
| 5 | Pflege-Dashboard unverändert | ✅ |
| 6 | Stationär-Dashboard unverändert | ✅ |
| 7 | Breadcrumb Start › Beratung | ✅ |
| 8 | Titel „Beratung“, Untertitel Fälle/Protokolle/Wiedervorlagen | ✅ |
| 9 | Primär: Fall anlegen + Erstgespräch dokumentieren | ✅ |
| 10 | Sekundär: Wiedervorlagen, Protokoll, Kontakt | ✅ |
| 11 | 12 KPIs „Beratungsstatus heute“ | ✅ |
| 12 | KPI-Klicks → Beratungs-Routen mit Filtern | ✅ |
| 13 | Prioritäten „Heute in der Beratung wichtig“ | ✅ |
| 14 | Sektionen A–F: Fälle, Termine, Protokolle, Wiedervorlagen, Kontakt, Berichte | ✅ |
| 15 | Schnellzugriff nur Beratung-Routen (11 Items) | ✅ |
| 16 | Sidebar 8 Beratungs-Aktionen + 6 Heute-Tasks ohne Office/Pflege/Stationär | ✅ |
| 17 | Kein Klient anlegen / Mitarbeiter anlegen / Rechnung auf Dashboard | ✅ |
| 18 | LLGAN light KPI / violetter Beratungs-Akzent, Tests grün, kein `[deploy]` | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.
