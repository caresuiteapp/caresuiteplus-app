# Office Dashboard UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Office-Verwaltungszentrale — kein Zentrale-Modul-Copy, kein K.6, keine finale Rechnung  
**Commit-Message (geplant):** `fix(office): replace central dashboard copy with office workspace`

---

## 1. Problem

Das Office-Dashboard (`/office`) zeigte die Zentrale-Modulübersicht (`ModuleOverviewDashboard` mit Assist/Pflege/Stationär-Spalten) — fachlich falsch. Office soll eine eigene **Verwaltungszentrale** sein.

## 2. Umgesetzte Änderungen

| Bereich | Änderung |
|---------|----------|
| **Header (§5)** | Breadcrumb Start › Office, Titel „Office“, Untertitel „Verwaltung, Organisation und Kommunikation“, Toolbar mit Primär-/Sekundär-/Optional-Aktionen |
| **KPI (§6)** | 8 KPIs unter „Heute im Office“ via `buildOfficeWorkspaceKpis`, klickbar mit Office-Routen |
| **Sektionen (§7–13)** | 7 Bereiche: Betrieb, Klient:innen & MA, Kalender, Kommunikation, Dokumente, Abrechnungsvorbereitung, QM |
| **Sidebar (§14)** | 8 Schnellaktionen inkl. „Abrechnung prüfen“ statt „Rechnung erstellen“ |
| **Live-Snapshot** | `buildLiveOfficeDashboardSnapshot` ohne `moduleOverviewRows` |
| **Visual (§17)** | LLGAN-kompatible KPI-Karten (`variant="light"`), keine Zentrale-Modulkarten |

### Nicht geändert (laut Vorgabe)

- `BusinessDashboardScreen` / `ModuleOverviewDashboard` (Zentrale)
- `AssistIndexScreen`

### Neue / geänderte Dateien

- `src/lib/office/officeDashboardWorkspace.ts` (neu)
- `src/components/dashboard/OfficeDashboardView.tsx`
- `src/screens/office/OfficeIndexScreen.tsx`
- `src/lib/dashboard/liveDashboardSnapshot.ts`
- `src/data/demo/officeDashboard.ts`
- `src/lib/office/officeDashboardMetrics.ts`
- `src/lib/services/repositories/officeDashboardRepository.supabase.ts` (+ `appointmentsToday`)
- `src/components/layout/platform/platformContextData.ts`
- `src/__tests__/office/officeDashboard.test.ts`
- `src/__tests__/office/officeDashboardLive.test.ts`

---

## 3. Tests

| Log | Ergebnis |
|-----|----------|
| `.audit-test-office-dashboard-ui-reality-fix.log` | ✅ 21/21 (officeDashboard, officeDashboardLive, officeDashboardHero) |
| `.audit-typecheck-office-dashboard-ui-reality-fix.log` | ⚠️ Repo-weite vorbestehende TS-Fehler; geänderte Office-Dateien ohne neue Fehler |

---

## 4. Browser (§20)

**Status:** BLOCKED — `localhost:8082/office` nicht erreichbar (kein Dev-Server aktiv) bzw. Auth erforderlich.

Empfohlene manuelle Checks nach Start (`npm run web` / Port 8082):

1. `/office` — kein „Zentrale Dashboard“, stattdessen „Heute im Office“ + 8 KPIs
2. KPI-Klick → gefilterte Office-Route
3. Rechte Sidebar — „Abrechnung prüfen“, kein „Rechnung erstellen“
4. Abrechnungs-Sektion verlinkt `/office/billing-preparation` (keine Rechnungsnummern)

---

## 5. K.6 / Rechnungen

**Nicht freigegeben** — Abrechnungsvorbereitung verlinkt nur auf `/office/billing-preparation`. Keine finale Rechnung, keine Rechnungsnummern.

---

## 6. Checkliste §23 (17 Punkte)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Office nutzt kein `ModuleOverviewDashboard` | ✅ |
| 2 | Zentrale/Business-Dashboard unverändert | ✅ |
| 3 | Assist-Dashboard unverändert | ✅ |
| 4 | Breadcrumb Start › Office | ✅ |
| 5 | Titel „Office“, Untertitel Verwaltung/Organisation/Kommunikation | ✅ |
| 6 | Primär: Klient:in + Mitarbeiter:in anlegen | ✅ |
| 7 | Sekundär: Kalender, Nachrichten, Dokument | ✅ |
| 8 | Optional: Abrechnung prüfen | ✅ |
| 9 | 8 KPIs „Heute im Office“ | ✅ |
| 10 | KPI-Klicks → Office-Routen mit Filtern | ✅ |
| 11 | 7 Hauptsektionen (§7–13) | ✅ |
| 12 | Sidebar 8 Schnellaktionen ohne Rechnung erstellen | ✅ |
| 13 | Calm glass / light KPI auf LLGAN | ✅ |
| 14 | `ModuleDashboardShell` Layout-Kette erhalten | ✅ |
| 15 | Tests grün | ✅ |
| 16 | Browser-Check dokumentiert (Auth-Blocker) | ✅ |
| 17 | Kein `[deploy]`, kein K.6, keine finale Rechnung | ✅ |
