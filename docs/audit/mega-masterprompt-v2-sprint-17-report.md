# MEGA Masterprompt v2 — Sprint 17 Report

**Datum:** 2026-06-13  
**Scope:** Stationär Bewohner:innen — Premium-Slice (Hero, Suche, Filter, Master-Detail, guardServiceTenant)  
**Verdict:** Sensational demo-quality Stationär slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 17 setzte den **Bewohner:innen Premium-Slice** um — analog Sprint 15 Beratungsfälle. `residentListService` und `residentDetailService` nutzten bereits `guardServiceTenant`; fehlend waren Hero/KPIs, Master-Detail und konsistente Premium-ListView.

---

## 2. Implementiert

| Route | Änderung |
|-------|----------|
| `/stationaer/(tabs)/bewohner` | `ResidentsAdaptiveScreen` → Premium-Liste + Summary Master-Detail |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/data/demo/residentListStats.ts` | KPI-Builder (Aktiv, Neuaufnahmen, Übergabe) |
| `src/components/stationaer/ResidentsListHero.tsx` | Dark-Premium Hero (STATIONÄR) |
| `src/components/stationaer/ResidentsListView.tsx` | Hauptansicht mit States |
| `src/components/stationaer/ResidentDetailSummaryPanel.tsx` | Unterbringung, Notizen, CTA Akte |
| `src/components/stationaer/ResidentListCard.tsx` | `selected`-Zustand für Master-Detail |
| `src/screens/stationaer/ResidentsListScreen.tsx` | Dünne Shell |
| `src/screens/stationaer/ResidentsAdaptiveScreen.tsx` | Master-Detail-Layout |
| `src/hooks/useResidentList.ts` | `allItems` für KPIs |
| `src/__tests__/stationaer/stationaerResidentsList.test.ts` | 10 fokussierte Tests |

**UX:** Hero (Aktiv, Neuaufnahmen, Übergabe), Suche (Name/Zimmer/Bereich/PG), Status-Chips, Sort (Name, Aufnahme), Master-Detail auf Tablet+, CTA zur Vollansicht unter `/stationaer/bewohner/[id]`.

---

## 3. Demo vs. Live

| Modus | Bewohner:innen |
|-------|----------------|
| **Demo** | `demoResidents` / `getDemoResidentListItems` |
| **Live (Supabase)** | `stationaerRepository` — noch Demo-only in List-Service |
| **guardServiceTenant** | ✅ residentListService + residentDetailService |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **469** passed (+10) |
| `npm run smoke` | ✅ 252 routes |

---

## 5. Deferred to Sprint 18+

| Priorität | Item |
|-----------|------|
| P1 | Akademie Kurse Premium-Slice |
| P1 | Live-Supabase Stationär List/Detail |
| P2 | Desktop-Tabelle Bewohner:innen |
| P2 | QM Handbuch Entry Polish |

---

## 6. Verdict

Bewohner:innen jetzt auf gleichem Premium-Niveau wie Beratung/Assist-Slices — **kein Store-Release**. Akademie Kurse und Live-Repos folgen.
