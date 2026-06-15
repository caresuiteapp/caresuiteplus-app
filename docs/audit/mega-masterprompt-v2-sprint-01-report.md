# MEGA Masterprompt v2 — Sprint 01 Report

**Datum:** 2026-06-13  
**Scope:** CareSuite+ Office Dashboard (P0)  
**Verdict:** Sensational demo-quality slice delivered — **NOT production/store ready**

---

## 1. Spec scope read

### Gelesene Spec-Dateien (strategisch)

| Datei | Fokus |
|-------|-------|
| `README.md` / `METADATA.json` | 11 Module, 2000 WPs, 1150 Szenarien |
| `00_MEGA_MASTERPROMPT_V2_KOMPLETT.md` | Phasen, P0-Logik, CareSuite+ Office als zentrale Plattform, Schutzregeln |
| `01_DESIGN_BIBLE.md` | Dark Premium, Orange-Gold/Cyan, responsive Shells, keine WP-Kacheln |
| `02_ARCHITEKTUR_OFFICE.md` | CareSuite+ Office-Hauptbereiche, Service-Modus, Modulzuordnung |
| `05_SCREEN_BLUEPRINTS.md` | **CareSuite+ Office / Dashboard** (P0): KPIs, Listen, States, Responsive |
| `04_FACHMODULE_DETAIL.md` | Kontext für spätere Sprints (Assist, Pflege, …) |
| `workpackages_index.csv` | WP1 = CareSuite+ Office Dashboard Screen |

### MEGA-Phasen (Kurz)

1. **Fundament** — Auth, Mandant, Demo/Live-Trennung
2. **CareSuite+ Office** — Zentrale Stammdaten, Dokumente, Rechnungen, Module
3. **Fachmodule** — Assist, Pflege, Beratung, Stationär, Akademie
4. **KI-Layer** — VoiceFlow, PlanPilot, SmartReview
5. **Platform/Store** — Mobile, Tablet, Desktop, EAS, QA

### P0-Prioritäten (diese Session)

- CareSuite+ Office Dashboard als **echte Arbeitsfläche** (nicht Kachel-Katalog)
- Design Bible: Premium Dark, Orange-Gold-Aktionen, dezentes Glass
- Responsive: Phone einspaltig, Tablet 2-Spalten, Desktop 3-Spalten
- Service-Hook mit Demo/Live-Guard, keine Fake-Buttons

---

## 2. Codebase-Gap-Analyse (vor Sprint)

| Bereich | Ist-Zustand | Gap |
|---------|-------------|-----|
| `/office` Index | `ModuleTile`-Raster + Demo-Seed-Karte | Kein echtes Dashboard |
| `officeDashboardService` | Minimaler Snapshot (WP-Nummer, 3 Highlights) | Keine KPIs/Aktivitäten |
| Design | PremiumCard/Button vorhanden | Dashboard nicht an Blueprint angepasst |
| Responsive | ShellLayout/Tablet/Desktop vorhanden | Office-Index nutzte nur einspaltiges Raster |

**Entscheidung:** CareSuite+ Office Dashboard Redesign — höchster user-visible Impact, WP1-aligned.

---

## 3. Implementiert (Sprint 01)

### Screens & Routes

| Route | Änderung |
|-------|----------|
| `/office` (tabs index) | `OfficeIndexScreen` → vollwertiges CareSuite+ Office-Dashboard |

### Neue / überarbeitete Dateien

| Datei | Zweck |
|-------|-------|
| `src/data/demo/officeDashboard.ts` | Demo-KPIs, Status, Aktivitäten, Arbeitsbereiche aus echten Seed-Daten |
| `src/lib/office/officeDashboardService.ts` | Service mit Permission + Live-Guard |
| `src/hooks/useOfficeDashboard.ts` | React-Hook für Screen |
| `src/components/dashboard/OfficeDashboardView.tsx` | Responsive Dashboard (phone/tablet/desktop) |
| `src/screens/office/OfficeIndexScreen.tsx` | Screen-Shell + Hook + View |
| `src/components/dashboard/DashboardHero.tsx` | ModuleLabel, bedingtes Demo-Badge |
| `src/types/dashboard/index.ts` | Scope `office`, optionales `moduleLabel` |
| `src/__tests__/office/officeDashboard.test.ts` | 7 fokussierte Tests |

### UX-Inhalt (Blueprint-konform)

- **Kopfbereich:** CareSuite+ Office-Hero mit Rolle, Mandant, Primäraktion „Klient:in anlegen“
- **Kennzahlen:** 4 KPIs (Klient:innen, Mitarbeitende, Rechnungen, Termine)
- **Aufmerksamkeit:** Status-Karten (Entwürfe, Aufnahme, Module)
- **Schnellaktionen:** Echte Routen zu Create/Liste
- **Arbeitsbereiche:** 8 Navigationszeilen (PremiumListRow, keine WP-Kacheln)
- **Aktivitäten:** Timeline mit Refresh
- **States:** Loading, Error (Retry), Empty

### Responsive Layout

- **Phone:** Vertikaler Stack
- **Tablet:** 2-Spalten (KPIs/Aktionen | Status/Aktivitäten) + Bereiche unten
- **Desktop:** 3-Spalten (Bereiche | KPIs/Status | Aktivitäten)

---

## 4. Design-Entscheidungen

1. **Kein ModuleTile-Raster** — Spec verbietet Demo-Katalog-Optik; stattdessen KPI + ListRow-Navigation
2. **Orange-Gold Primäraktion** — „Klient:in anlegen“ als Hero-CTA
3. **Cyan Sekundär** — KPI Klient:innen, technische Badges
4. **Glass dezent** — Bestehende Hero-Gradient/Sheen aus DashboardHero
5. **Demo-Badge nur bei Demo-Modus** — `isDemoMode()` in Hero
6. **Keine „Aktiv“-Badges** auf Bereichszeilen — nur sinnvolle Counts

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ Pass |
| `npm run test` | ✅ **326** Tests (7 neu) |
| `npm run smoke` | ✅ Pass (252 Kern-Dateien, 246 Routen) |

---

## 6. Deferred to Sprint 02

| Priorität | Item | Spec-Referenz |
|-----------|------|---------------|
| P0 | CareSuite+ Office Klient:innen-Liste Redesign (Suche, Filter, Master-Detail) | Blueprint Klient:innen |
| P0 | CareSuite+ Office Mitarbeitende-Liste | Blueprint Mitarbeitende |
| P0 | CareSuite+ Office Dokumente + Upload-Flow | Blueprint Dokumente |
| P1 | CareSuite+ Office Rechnungen (Filter nach Modul/Status) | 02_ARCHITEKTUR Rechnungen |
| P1 | Module & Zuordnung Screens | /business/office/modules/* |
| P1 | Pflege-Modul Pilot (Dashboard + Planliste) | 04_FACHMODULE Pflege |
| P2 | Design-Token-Vollimplementierung in theme/ | 01_DESIGN_BIBLE |
| P2 | KI-Layer Stubs (VoiceFlow, PlanPilot) | 03_KI_VOICEFLOW |
| P2 | Live-Supabase Office-Dashboard Repository | Service-Modus supabase |

---

## 7. Ehrliches Verdict

**Was gut ist:**
- CareSuite+ Office fühlt sich jetzt wie Premium-Verwaltungssoftware an, nicht wie ein WP-Katalog
- Alle sichtbaren Buttons haben echte Handler und Routen
- Demo/Live-Guard verhindert stillen Demo-Fallback im Live-Modus
- Responsive Layout nutzt bestehende Platform-Shells

**Was fehlt für Production:**
- Kein Supabase-Repository für Office-Dashboard (nur Demo-Builder)
- Keine echten Create/Edit-Persistenz-Flows auf allen Quick Actions
- Keine Offline-Zustände
- Store/EAS/Privacy/Secrets-Audit noch offen
- Fachmodule, KI, Portale, QM-Detailscreens größtenteils unberührt

**Fazit:** Sprint 01 liefert einen **sensationalen, fokussierten CareSuite+ Office-Dashboard-Slice** im Demo-Modus. Die App ist weiterhin ein **hochwertiger Prototyp**, nicht store-ready.
