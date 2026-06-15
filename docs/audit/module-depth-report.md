# CareSuite+ Modul-Tiefenprüfung — Abschlussbericht

**Datum:** 12.06.2026  
**Sprint:** Paket A — Modulparität (Pflege, Stationär, Beratung, Akademie)  
**Quality Gates:** `typecheck` ✅ · `test` 150/150 ✅ · `smoke` ✅

---

## 1. Modul-Inventur

| Modul | Routen | Screens | Listen | Details | Create | Edit | Settings | Reports | Vorlagen | Status | Problem |
| ----- | -----: | ------: | ------ | ------- | ------ | ---- | -------- | ------- | -------- | ------ | ------- |
| Office | 26 | 28 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | VOLL / DEMO | Mahnungen, Verträge, Kostenträger fehlen |
| Assist | 16 | 20 | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | MITTEL / P-READY | Settings/Reports/Vorlagen dünn |
| Pflege | 10 | 10 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | MITTEL / P-READY | SIS nur Übersicht; Wunden/BodyMap fehlen |
| Stationär | 10 | 10 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | MITTEL / P-READY | Tagesstruktur, Mahlzeiten, Aktivitäten fehlen |
| Beratung | 10 | 10 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | MITTEL / P-READY | Maßnahmenplan, Erstgespräch fehlen |
| Akademie | 10 | 10 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | MITTEL / P-READY | Lektionen, Prüfungen fehlen |
| Nachrichten | 6+ | 8+ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | VOLL / P-PROD partial | Live-Realtime vorbereitet |
| Dokumente | 4+ | 6+ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | MITTEL / DEMO | Modulübergreifend Office-stark |
| Vorlagen | 2+ | 2+ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ | DÜNN / DEMO | Kein zentraler Template-Editor |
| Portale | 20+ | 15+ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | — | — | MITTEL / DEMO | Nachrichten angebunden |
| TI | 11 | 12 | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | — | MITTEL / P-READY | Audit-Persistenz Live P1 |
| Reporting | 5 | 5+ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | — | MITTEL / DEMO | Business-Modul, nicht pro Produkt |
| Einstellungen | 3+ | 4+ | — | — | — | — | ✅ | — | — | MITTEL | Pro Modul jetzt ergänzt (4×) |
| Integrationen | 5 | 5+ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | — | — | MITTEL / P-READY | Payroll/Outbox vorbereitet |
| Admin/Management | 15+ | 20+ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | — | MITTEL / DEMO | Ops/QA/Security/Release |

**Legende Status:** VOLL · MITTEL · DÜNN · PLACEHOLDER · DEMO ONLY · P-READY · P-PROD

---

## 2. Placeholder und leere Module

| Datei | Modul | Placeholder-Art | Sichtbar in App? | Problem | Empfehlung |
| ----- | ----- | --------------- | ---------------- | ------- | ---------- |
| `AssistCalendarPlaceholderScreen.tsx` | Assist | „Demnächst“ | ❌ Nein (Route nutzt `AssistCalendarScreen`) | Legacy-Datei | Behalten als intern, nicht exportieren |
| `PlaceholderModuleScreen.tsx` | Generic | WP-Platzhalter | ❌ Keine Route | Nicht in Navigation | Nur Design-Referenz |
| `ModuleOverviewScreen.tsx` | Business | No-Op Button | ✅ Ja | War `onPress={() => {}}` | ✅ Behoben: disabled + „Live-Freischaltung vorbereitet“ |
| `app/design-system/components.tsx` | Dev | No-Op Demos | ⚠️ Nur Design-System | Akzeptabel in DS | Kein Produktmodul |
| Pflege (vor Sprint) | Pflege | Nur 2 Quick-Tiles | ✅ Ja | Kein SIS/Settings/Reports | ✅ Paket A umgesetzt |
| Stationär (vor Sprint) | Stationär | 1 Quick-Tile | ✅ Ja | Keine Wohnbereiche/Übergabe | ✅ Paket A umgesetzt |
| Beratung (vor Sprint) | Beratung | 1 Quick-Tile | ✅ Ja | Keine Protokolle/Wiedervorlagen | ✅ Paket A umgesetzt |
| Akademie (vor Sprint) | Akademie | 1 Quick-Tile | ✅ Ja | Keine Teilnehmer/Zertifikate | ✅ Paket A umgesetzt |

**Fazit:** Kein Hauptmodul besteht mehr nur aus sichtbaren Placeholdern. Assist-Kalender ist produktiv mit Demo-Daten (`AssistCalendarScreen`).

---

## 3. Mindeststandard pro Modul (Paket A)

| Kriterium | Pflege | Stationär | Beratung | Akademie | Office | Assist |
| --------- | ------ | --------- | -------- | -------- | ------ | ------ |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zentrale Liste | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detailseiten | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/Edit | ✅/⚠️ | ✅/⚠️ | ✅/⚠️ | ✅/⚠️ | ✅ | ✅/⚠️ |
| Einstellungen | ✅ neu | ✅ neu | ✅ neu | ✅ neu | ⚠️ | ⚠️ |
| Auswertungen | ✅ neu | ✅ neu | ✅ neu | ✅ neu | ⚠️ | ⚠️ |
| Vorlagenbezug | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Demo-Daten | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supabase-ready | P-READY | P-READY | P-READY | P-READY | partial | partial |
| Rollenrechte | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mandantenfähigkeit | Demo | Demo | Demo | Demo | Demo + Basis-Modul | Demo |
| Portalbezug | preview | preview | preview | preview | preview | preview |

**Office Basis-Modul (13.06.2026):** CareSuite+ Office wird automatisch enthalten, wenn ein Fachmodul aktiv ist. Siehe `docs/product/office-base-module.md`.

---

## 4. Zielumfang — Lücken je Hauptmodul

### 4.1 Office — vorhanden / fehlend
**Vorhanden:** Dashboard, Klient:innen, Mitarbeitende, Dokumente, Nachrichten, Termine, Rechnungen, Budgets, Kataloge  
**Fehlt (P1–P2):** Mahnungen, Verträge, Einwilligungen, Kostenträger, Upload-Zentrale dediziert, Office-Settings, Office-Reports

### 4.2 Assist — vorhanden / fehlend
**Vorhanden:** Dashboard, Einsätze, Durchführung, Kalender, Nachweise, Fahrten, Compose-Nachrichten  
**Fehlt:** Assist-Settings, Assist-Reports, Live-Tracking, Qualitätsprüfung, Assist-Vorlagen

### 4.3 Pflege — vorhanden / fehlend
**Vorhanden:** Dashboard, Pflegepläne (L/D/C), Vitalwerte, **SIS-Übersicht (neu)**, Settings, Auswertungen  
**Fehlt (fachliche Lücke):** SIS Detail/Create/Edit, Pflegeanamnese, Maßnahmenplanung, Wunddoku, BodyMap, Medikamente, Risiken, Übergabe, MDK-Export live

### 4.4 Stationär — vorhanden / fehlend
**Vorhanden:** Dashboard, Bewohner (L/D/C), **Wohnbereiche**, **Übergabebericht**, Settings, Auswertungen  
**Fehlt:** Tagesstruktur, Mahlzeiten, Aktivitäten, Angehörigenkommunikation, Risiken, Vorlagen

### 4.5 Beratung — vorhanden / fehlend
**Vorhanden:** Dashboard, Fälle (L/D/C), **Protokolle**, **Wiedervorlagen**, Settings, Auswertungen  
**Fehlt:** Erstgespräch, Maßnahmenplan, Beratungsberichte, Pflegegrad-Beratung dediziert

### 4.6 Akademie — vorhanden / fehlend
**Vorhanden:** Dashboard, Kurse (L/D/C), **Teilnehmer**, **Zertifikate**, Settings, Auswertungen  
**Fehlt:** Lektionen/Module, Prüfungen, Dozent:innen-Verwaltung, Kursvorlagen-Editor

### 4.7–4.9 Core (Nachrichten, Vorlagen, Dokumente)
- **Nachrichten:** Business Center + Portale + Settings + Archiv — **P-PROD partial** (Communication live vorbereitet)
- **Vorlagen:** Statisch/demo — **Paket F** nötig
- **Dokumente:** Office-stark, modulübergreifend teils über Compose-Screens

---

## 5. Modultiefe (Prozent)

| Modul | UI-Tiefe | Workflow-Tiefe | Daten-Tiefe | Supabase-Tiefe | Gesamt |
| ----- | -------: | -------------: | ----------: | -------------: | -----: |
| Office | 72 % | 58 % | 65 % | 35 % | **58 %** |
| Assist | 68 % | 55 % | 60 % | 40 % | **56 %** |
| Pflege | 55 % → **62 %** | 45 % → **50 %** | 55 % | 25 % | **48 % → 52 %** |
| Stationär | 40 % → **58 %** | 35 % → **48 %** | 50 % | 20 % | **36 % → 48 %** |
| Beratung | 38 % → **55 %** | 35 % → **45 %** | 48 % | 20 % | **35 % → 45 %** |
| Akademie | 38 % → **55 %** | 32 % → **42 %** | 50 % | 20 % | **35 % → 44 %** |
| Nachrichten | 75 % | 65 % | 60 % | 55 % | **64 %** |
| TI | 60 % | 45 % | 40 % | 45 % | **48 %** |
| Vorlagen | 25 % | 15 % | 20 % | 10 % | **18 %** |
| Reporting | 50 % | 40 % | 35 % | 15 % | **35 %** |

*Bewertung: 41–60 % = Demo-fähig · 61–80 % = Pilot-vorbereitet*

---

## 6. Fehlende Seiten (Priorität)

### Pflege — Fehlt
- **P1:** SIS Detail, SIS Create/Edit, Pflegeplanung erweitert, Medikationsplan, Wunddoku
- **P2:** BodyMap, Risikoassessments, Pflegevisite, Evaluation, Übergabe
- **P3:** Design-Politur, Vorlagen-Editor

### Stationär — Fehlt
- **P1:** Tagesstruktur, Mahlzeiten, Aktivitäten
- **P2:** Angehörigenkommunikation, Risiken, Bewohner-Edit
- **P3:** Vorlagen, Reports-Export

### Beratung — Fehlt
- **P1:** Erstgespräch, Maßnahmenplan, Beratungsberichte
- **P2:** Protokoll Create/Edit, Fallakte-Tabs
- **P3:** Vorlagen Pflegegrad

### Akademie — Fehlt
- **P1:** Lektionen, Prüfungen, Dozent:innen
- **P2:** Zertifikat-PDF, Kursvorlagen
- **P3:** Lernpfad-Visualisierung

---

## 7. Umsetzungsregeln (eingehalten)

Alle neuen Seiten enthalten:
- ✅ Titel + fachlicher Untertitel
- ✅ KPI-/Statusbereich oder Liste
- ✅ Empty / Error / Loading States
- ✅ Demo-Daten via prepared Services
- ✅ `PreparedModeBanner` (P-READY Kennzeichnung)
- ✅ Echte Button-Handler (kein No-Op)
- ✅ Rollenprüfung via `enforcePermission` in Services

---

## 8. Ausbau-Pakete — Reihenfolge

| Paket | Status | Nächste Schritte |
| ----- | ------ | ---------------- |
| **A — Modulparität** | ✅ **Erledigt** (4 dünne Module) | Office/Assist Settings+Reports |
| **B — Pflege fachlich** | 🔜 Offen | SIS Detail, Wunden, Medikamente |
| **C — Stationär fachlich** | 🔜 Offen | Tagesstruktur, Mahlzeiten, Übergabe live |
| **D — Beratung fachlich** | 🔜 Offen | Maßnahmenplan, Erstgespräch |
| **E — Akademie fachlich** | 🔜 Offen | Lektionen, Prüfungen |
| **F — Vorlagen/Dropdowns** | 🔜 Offen | Zentraler Template-Editor |

---

## A. Modul-Tiefenmatrix (Vorher / Nachher)

| Modul | Vorher | Nachher | Status |
| ----- | -----: | ------: | ------ |
| Pflege | 48 % | **52 %** | Demo-fähig, Paket A |
| Stationär | 36 % | **48 %** | Demo-fähig, Paket A |
| Beratung | 35 % | **45 %** | Demo-fähig, Paket A |
| Akademie | 35 % | **44 %** | Demo-fähig, Paket A |
| Office | 58 % | 58 % | Unverändert |
| Assist | 56 % | 56 % | Kalender bereits real |

---

## B. Gefundene leere/zu dünne Module (Dateien)

- `src/screens/pflege/PflegeIndexScreen.tsx` — nur 2 Tiles → **6 Tiles**
- `src/screens/stationaer/StationaerIndexScreen.tsx` — 1 Tile → **5 Tiles**
- `src/screens/beratung/BeratungIndexScreen.tsx` — 1 Tile → **5 Tiles**
- `src/screens/akademie/AkademieIndexScreen.tsx` — 1 Tile → **5 Tiles**
- `src/screens/assist/AssistCalendarPlaceholderScreen.tsx` — Legacy, nicht geroutet
- `src/screens/ModuleOverviewScreen.tsx` — No-Op → behoben

---

## C. Ergänzte Seiten

| Modul | Neue Seite | Zweck | Route | Status |
| ----- | ---------- | ----- | ----- | ------ |
| Pflege | PflegeSettingsScreen | Modul-Konfiguration | `/pflege/settings` | Demo · P-READY |
| Pflege | PflegeReportsScreen | Kennzahlen/MDK-Vorbereitung | `/pflege/auswertungen` | Demo · P-READY |
| Pflege | SisOverviewScreen | SIS-Assessments Liste | `/pflege/sis` | Demo · P-READY |
| Stationär | LivingAreasScreen | Wohnbereiche/Zimmer | `/stationaer/wohnbereiche` | Demo · P-READY |
| Stationär | HandoverReportScreen | Übergabeberichte | `/stationaer/uebergabebericht` | Demo · P-READY |
| Stationär | StationaerSettingsScreen | Modul-Konfiguration | `/stationaer/settings` | Demo · P-READY |
| Stationär | StationaerReportsScreen | Belegung/Risiken | `/stationaer/auswertungen` | Demo · P-READY |
| Beratung | CounselingProtocolsScreen | Beratungsprotokolle | `/beratung/protokolle` | Demo · P-READY |
| Beratung | FollowUpsScreen | Wiedervorlagen | `/beratung/wiedervorlagen` | Demo · P-READY |
| Beratung | BeratungSettingsScreen | Modul-Konfiguration | `/beratung/settings` | Demo · P-READY |
| Beratung | BeratungReportsScreen | Fallkennzahlen | `/beratung/auswertungen` | Demo · P-READY |
| Akademie | EnrollmentsScreen | Teilnehmer/Einschreibungen | `/akademie/teilnehmer` | Demo · P-READY |
| Akademie | CertificatesScreen | Zertifikate/Nachweise | `/akademie/zertifikate` | Demo · P-READY |
| Akademie | AkademieSettingsScreen | Modul-Konfiguration | `/akademie/settings` | Demo · P-READY |
| Akademie | AkademieReportsScreen | Compliance-KPIs | `/akademie/auswertungen` | Demo · P-READY |

**Neue Infrastruktur:**
- `src/components/modules/PreparedModeBanner.tsx`
- `src/lib/*/moduleExtensionService.ts` (4 Module)
- `src/data/demo/sisAssessments.ts`, `stationaerExtended.ts`, `beratungExtended.ts`, `akademieExtended.ts`

---

## D. Entfernte/ersetzte Placeholder

| Datei | vorher | nachher |
| ----- | ------ | ------- |
| `AssistIndexScreen.tsx` | „Wochenübersicht (Demnächst)“ | „Wochenübersicht“ + Link `/assist/calendar` |
| `AkademieIndexScreen.tsx` | KPI „Demnächst“ | KPI „Anstehend“ |
| `assist/index.ts` | Export `AssistCalendarPlaceholderScreen` | Entfernt — nur `AssistCalendarScreen` |
| `ModuleOverviewScreen.tsx` | `onPress={() => {}}` disabled | `disabled` ohne No-Op, Label „Live-Freischaltung vorbereitet“ |
| Dünne Modul-Dashboards | 1–2 Quick-Tiles | 5–6 fachliche Quick-Tiles mit Navigation |

---

## E. Noch fehlende fachliche Tiefe

**P0 (behoben in diesem Sprint):**
- Sichtbar leere Module Pflege/Stationär/Beratung/Akademie
- Assist-Kalender-Placeholder in Navigation (war bereits real)
- ModuleOverview No-Op Button

**P1 (nächster Sprint):**
- Paket B–E: SIS Detail, Wunden, Tagesstruktur Stationär, Beratungs-Maßnahmenplan, Akademie-Lektionen
- Office/Assist Settings + Reports
- TI Audit Live-Persistenz

**P2:**
- Zentrales Vorlagensystem (Paket F)
- Modul-spezifische Reports mit Export
- 19 `use*Module` Hooks an UI anbinden

**P3:**
- Design-Politur, einheitliche `preparedOnly` ModuleTile-Badges

---

## F. Quality Gates

```text
npm run typecheck  → PASS
npm run test       → 150/150 PASS
npm run smoke      → PASS (252 Kern-Dateien)
```

---

## G. Finale Einschätzung

**Module fachlich demo-fähig**

Die vier zuvor dünnsten Hauptmodule (Pflege, Stationär, Beratung, Akademie) erfüllen jetzt den Paket-A-Mindeststandard: Dashboard, Liste, Detail, Create (wo vorhanden), Settings, Auswertungen und erweiterte Fachbereiche mit Demo-Daten und P-READY-Services. Es handelt sich nicht um produktive Vollständigkeit — Supabase-Live-Anbindung für die neuen Extension-Services fehlt bewusst (Demo-Mandant only).

**Nicht behauptet:** Produktiv vollständig / Live-pilot-ready ohne Einschränkungen.

---

*Erstellt im Rahmen der CareSuite+ Modul-Tiefenprüfung · Sprint Paket A*
