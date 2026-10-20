# Akademie Dashboard UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Akademie-Index-Dashboard (`/akademie`) — Lern- und Zertifizierungs-Cockpit, keine Office-Kopie  
**Commit-Message:** `fix(akademie): replace generic dashboard with learning workspace`

---

## 1. Problem

Das Akademie-Dashboard (`/akademie`) nutzte `CareLightModuleDashboard` mit nur 3 generischen KPIs (Aktive Kurse, Pflicht, Teilnahmen), Office-nahen Schnellaktionen und fehlendem LMS-Cockpit (Pflichtschulungen, Fortschritt, Prüfungen, Zertifikate, Mediathek, Schulungsplan).

## 2. Zielbild

Eigenes Lern- und Zertifizierungs-Cockpit mit 14 KPIs, sieben Workflow-Sektionen, Akademie-Schnellzugriff und rechter Sidebar — analog Beratung/Pflege/Stationär Reality Fixes, ohne Zentrale-Modulübersicht.

## 3. Umgesetzte Änderungen

| Bereich | Änderung |
|---------|----------|
| **Header** | Breadcrumb Start › Akademie, Titel „Akademie“, Untertitel „Kurse, Pflichtschulungen und Zertifikate im Überblick“ |
| **Primär-Aktionen** | `+ Kurs anlegen`, `+ Pflichtschulung planen` |
| **Sekundär-Aktionen** | Teilnehmer:innen öffnen, Zertifikate prüfen, Prüfung anlegen, Mediathek öffnen |
| **KPI „Akademiestatus heute“** | 14 KPIs via `buildAkademieWorkspaceKpis`, klickbar mit Akademie-Routen/Filtern |
| **Sektionen A–G** | Kurse & Schulungen, Pflichtschulungen, Teilnehmer:innen & Fortschritt, Prüfungen, Zertifikate, Mediathek & Lernmaterial, Planung & Auswertung |
| **Schnellzugriff** | 10 Akademie-Routen — kein Office/Pflege/Assist/Stationär/Beratung |
| **Sidebar** | 8 Akademie-Schnellaktionen; Heute: Kurse, Pflichtschulungen, Einschreibungen, Prüfungen, Zertifikate, Medien |
| **Daten** | `AkademieDashboardStats` erweitert; Demo-Aggregation aus Kursen, Einschreibungen, Prüfungen, Zertifikaten; Live-Modus mit Zero-Defaults für Erweiterungsfelder |

### Nicht geändert (laut Vorgabe)

- Zentrale, Office, Assist, Pflege, Stationär, Beratung dashboards
- K.6, Rechnungen, Deploy, Migrationen, Prod-Daten

### Neue / geänderte Dateien

- `src/lib/akademie/akademieDashboardWorkspace.ts` (neu)
- `src/components/dashboard/AkademieDashboardView.tsx` (neu)
- `src/screens/akademie/AkademieIndexScreen.tsx`
- `src/lib/akademie/courseListService.ts`
- `src/types/modules/akademie.ts`
- `src/components/layout/platform/platformContextData.ts`
- `src/components/layout/platform/rightcontextpanel.tsx`
- `src/components/layout/platform/mobileplatformcontextpanel.tsx`
- `src/__tests__/akademie/akademieDashboard.test.ts` (neu)
- `src/__tests__/akademie/akademieDashboardHero.test.ts`

---

## 4. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-akademie-dashboard-ui-reality-fix.log` | ✅ 16/16 (`akademieDashboard.test.ts` 11 + `akademieDashboardHero.test.ts` 5) |
| `.audit-typecheck-akademie-dashboard-ui-reality-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Akademie-Dateien ohne neue endsAt-Fehler |

---

## 5. Browser

**Status:** BLOCKED — Dev-Server/Browser in dieser Session nicht erreichbar (kein Tab, Auth erforderlich).

Empfohlene manuelle Checks nach Start (`npm run web` / Port 8082):

1. `/akademie` — „Akademiestatus heute“ + 14 KPIs, kein Klient-anlegen-Tile
2. KPI-Klick → gefilterte Akademie-Route
3. Rechte Sidebar — Kurs anlegen, Pflichtschulung planen; kein Klient anlegen / Mitarbeiter anlegen
4. Schnellzugriff — nur Akademie-Bereiche

---

## 6. K.6 / Rechnungen

**Nicht betroffen** — keine Abrechnungs- oder Rechnungslinks im Akademie-Dashboard.

---

## 7. Checkliste §24 (19 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Akademie nutzt kein `CareLightModuleDashboard` / `ModuleOverviewDashboard` | ✅ |
| 2 | Zentrale/Business-Dashboard unverändert | ✅ |
| 3 | Office-Dashboard unverändert | ✅ |
| 4 | Assist-Dashboard unverändert | ✅ |
| 5 | Pflege-Dashboard unverändert | ✅ |
| 6 | Stationär-Dashboard unverändert | ✅ |
| 7 | Beratung-Dashboard unverändert | ✅ |
| 8 | Breadcrumb Start › Akademie | ✅ |
| 9 | Titel „Akademie“, Untertitel Kurse/Pflichtschulungen/Zertifikate | ✅ |
| 10 | Primär: Kurs anlegen + Pflichtschulung planen | ✅ |
| 11 | Sekundär: Teilnehmer:innen, Zertifikate, Prüfung, Mediathek | ✅ |
| 12 | 14 KPIs „Akademiestatus heute“ | ✅ |
| 13 | KPI-Klicks → Akademie-Routen mit Filtern | ✅ |
| 14 | Prioritäten „Heute in der Akademie wichtig“ | ✅ |
| 15 | Sektionen A–G: Kurse, Pflicht, Teilnehmer, Prüfungen, Zertifikate, Mediathek, Planung | ✅ |
| 16 | Schnellzugriff nur Akademie-Routen (10 Items) | ✅ |
| 17 | Sidebar 8 Akademie-Aktionen + 7 Heute-Tasks ohne Office/Pflege/Stationär | ✅ |
| 18 | Kein Klient anlegen / Mitarbeiter anlegen / Rechnung auf Dashboard | ✅ |
| 19 | Gelber Akademie-Akzent, LLGAN light KPI, Tests grün, kein `[deploy]` | ✅ |

**Gesamt:** ✅ Code-Abnahme — Browser manuell nach Dev-Server-Start empfohlen.
