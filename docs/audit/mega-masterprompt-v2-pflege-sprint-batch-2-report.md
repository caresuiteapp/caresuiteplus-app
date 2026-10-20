# MEGA Masterprompt v2 — Pflege Sprint Batch 2 Report

**Stand:** 2026-06-14  
**Scope:** Pflege-Modul Batch 2 — Desktop-Tabellen, Dienstpläne, Pflegedokumentation, Med/Wund-Detail  
**Verdict:** Hochwertiger Demo-Prototyp — **NOT production/store ready**

---

## Executive Summary

Batch 2 schließt die offenen P2/P3-Punkte aus Batch 1: **Desktop Karten/Tabelle-Umschalter** für Vitalwerte und Pflegepläne, **Dienstpläne** und **Pflegedokumentation** als Premium-Listen mit ehrlichen preparedOnly-Badges, sowie **Medikation- und Wund-Detailscreens** mit Hero-KPIs. Pflegedokumentation nutzt wo möglich **Live care_records** über `careRecordSupabaseRepository`.

**Geschätzter Pflege-Fortschritt:** ~38–42% → **~52–58%**  
**Pflege-Tests:** 34 → **46** (+12 in `pflegeBatch2.test.ts`)

---

## Sprints in diesem Batch

| Sprint | Scope | Ergebnis |
|--------|-------|----------|
| 76a | Vitalwerte Desktop-Tabelle | `VitalReadingsListTable`, View-Toggle in Hero + ListView |
| 76b | Pflegepläne Desktop-Tabelle | `CarePlansListTable`, View-Toggle, Live-Sync-Badge |
| 76c | Dienstpläne preparedOnly | Demo-Schichten, Hero, Cards, Route `/pflege/dienstplaene` |
| 76d | Pflegedokumentation Liste | Demo + Live care_records, Hero, Cards, Route `/pflege/dokumentation` |
| 76e | Medikation Detail preparedOnly | Detail-Hero, Service, Route `/pflege/medikation/[id]` |
| 76f | Wunddokumentation Detail preparedOnly | Detail-Hero, BodyMap-Badge, Route `/pflege/wunddokumentation/[id]` |

---

## Geänderte / neue Dateien

### Komponenten (`src/components/pflege/`)

| Datei | Art |
|-------|-----|
| `VitalReadingsListTable.tsx` | **Neu** |
| `CarePlansListTable.tsx` | **Neu** |
| `ShiftScheduleListHero.tsx` | **Neu** |
| `ShiftScheduleListCard.tsx` | **Neu** |
| `CareDocumentationListHero.tsx` | **Neu** |
| `CareDocumentationListCard.tsx` | **Neu** |
| `MedicationDetailHero.tsx` | **Neu** |
| `WoundDocumentationDetailHero.tsx` | **Neu** |
| `VitalReadingsListHero.tsx` | View-Toggle + Live-Badge |
| `CarePlansListHero.tsx` | View-Toggle + Live-Badge |
| `VitalReadingsListView.tsx` | Desktop table layout |
| `CarePlansListView.tsx` | Desktop table layout |

### Services / Stats (`src/lib/pflege/`)

| Datei | Art |
|-------|-----|
| `shiftScheduleDemo.ts` | **Neu** — 5 Demo-Schichten |
| `shiftScheduleListStats.ts` | **Neu** |
| `shiftScheduleService.ts` | **Neu** |
| `careDocumentationTypes.ts` | **Neu** |
| `careDocumentationListStats.ts` | **Neu** |
| `careDocumentationListService.ts` | **Neu** — Demo + Live care_records |
| `medicationDetailStats.ts` | **Neu** |
| `medicationDetailService.ts` | **Neu** |
| `woundDocumentationDetailStats.ts` | **Neu** |
| `woundDocumentationDetailService.ts` | **Neu** |
| `pflegeModuleConfig.ts` | Live-Readiness-Flags erweitert |

### Screens (`src/screens/pflege/`)

| Datei | Art |
|-------|--------|
| `ShiftScheduleListScreen.tsx` | **Neu** |
| `CareDocumentationListScreen.tsx` | **Neu** |
| `CareDocumentationDetailScreen.tsx` | **Neu** |
| `MedicationDetailScreen.tsx` | **Neu** |
| `WoundDocumentationDetailScreen.tsx` | **Neu** |
| `PflegeIndexScreen.tsx` | Schnellzugriff Dokumentation + Dienstpläne |
| `MedicationListScreen.tsx` | Navigation zu Detail |
| `WoundDocumentationListScreen.tsx` | Navigation zu Detail |

### Routen (`app/pflege/`)

| Route | Screen |
|-------|--------|
| `/pflege/dienstplaene` | `ShiftScheduleListScreen` |
| `/pflege/dokumentation` | `CareDocumentationListScreen` |
| `/pflege/dokumentation/[id]` | `CareDocumentationDetailScreen` |
| `/pflege/medikation/[id]` | `MedicationDetailScreen` |
| `/pflege/wunddokumentation/[id]` | `WoundDocumentationDetailScreen` |

### Tests (`src/__tests__/pflege/`)

| Datei | Tests |
|-------|-------|
| `pflegeBatch2.test.ts` | **+12** Regression-Tests |

---

## Pattern-Compliance

| Anforderung | Status |
|-------------|--------|
| Desktop Karten/Tabelle für Vitalwerte | ✅ |
| Desktop Karten/Tabelle für Pflegepläne | ✅ |
| `PremiumListHeroFrame` auf neuen Screens | ✅ |
| `preparedOnly`-Badges wo kein Live-Repo | ✅ |
| `guardServiceTenant` in neuen Services | ✅ |
| Live care_records für Pflegedokumentation-Liste | ✅ (Supabase-Modus) |
| Med/Wund-Detail mit ehrlichen eMP/BodyMap-Badges | ✅ |

---

## Live Supabase

| Feature | Live-Status |
|---------|-------------|
| Pflegepläne List/Detail | ✅ Basis-Repo (unverändert) |
| Pflegedokumentation List | ✅ care_records Liste (Basis-Mapping) |
| Pflegedokumentation Detail | ⚠️ Live-Basis (title-only), Signatur/PDF preparedOnly |
| Vitalwerte | Demo-only |
| Dienstpläne | Demo-only |
| Medikation/Wund Detail | Demo-only |

---

## Verbleibende Pflege-Lücken (ehrlich)

| Priorität | Item |
|-----------|------|
| P1 | Vitalwerte Live-Supabase-Wiring |
| P1 | SIS Live-Repo + Detail/Master-Detail |
| P2 | Dienstpläne Live-Repo + Import |
| P2 | Pflegedokumentation Signatur/PDF (Assist-Pfad) |
| P3 | Medikation eMP + Wund BodyMap/Foto-Upload |
| P3 | Bewohner:innen — liegt in Stationär |

---

## Spec-Fortschritt (Schätzung)

| Bereich | Vorher | Nachher |
|---------|--------|---------|
| **Pflege Modul** | ~38–42% | **~52–58%** |
| Gesamt-Spec | ~49–52% | ~51–54% |

---

## Verdict

CareSuite+ Pflege hat jetzt **Office/Assist-parität bei Desktop-Listen**, zwei neue Fach-Workflows (Dienstpläne, Pflegedokumentation) und **Detailscreens für Medikation/Wund** mit ehrlichen preparedOnly-Badges. Die App bleibt ein **sensationaler Demo-Prototyp** — kein Store-Release-Kandidat.
