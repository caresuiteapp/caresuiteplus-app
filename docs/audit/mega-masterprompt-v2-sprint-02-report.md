# MEGA Masterprompt v2 — Sprint 02 Report

**Datum:** 2026-06-13  
**Scope:** CareSuite+ Office Klient:innen (Liste + Suche/Filter + Master-Detail)  
**Verdict:** Sensational demo-quality slice delivered — **NOT production/store ready**

---

## 1. Spec scope read

### Gelesene Spec-Dateien

| Datei | Fokus |
|-------|-------|
| `01_DESIGN_BIBLE.md` | Dark Premium, Orange-Gold CTAs, Glass dezent, responsive Shells |
| `05_SCREEN_BLUEPRINTS.md` | **CareSuite+ Office / Klient:innen** + Klient:innendetail: Liste, Filter, Master-Detail, States |
| `04_FACHMODULE_DETAIL.md` | Kontext Clients-Modul (für spätere Fachmodule-Sprints) |
| Sprint 01 Report | Dashboard als Referenz für Qualität und Patterns |

### Sprint 02 Ziel

CareSuite+ Office Klient:innen als echte Arbeitsfläche — nicht nur bestehende WP-Liste, sondern Premium UX mit Suche, Status/Pflegegrad-Filtern, Sortierung, Master-Detail auf Tablet/Desktop.

---

## 2. Codebase-Gap-Analyse (vor Sprint)

| Bereich | Ist-Zustand | Gap |
|---------|-------------|-----|
| `ClientsListScreen` | Funktionale Liste mit Status/Suche | Kein Hero, keine Pflegegrad-Filter, kein Sprint-01-Premium-Look |
| `ClientsAdaptiveScreen` | Master-Detail mit vollem `ClientDetailScreen` | Zu schwergewichtig für Split-Pane; kein Summary-Panel |
| `useClientList` | Status + Suche + Sort | Pflegegrad-Filter fehlte |
| Services | `fetchClientList` ohne `guardServiceTenant` | Live-Pfad nicht konsistent abgesichert |
| Tests | WP179 Modul-Snapshot | Keine dedizierten Office-Clients-List-Tests |

---

## 3. Implementiert (Sprint 02)

### Screens & Routes

| Route | Änderung |
|-------|----------|
| `/office/clients` (tabs) | `ClientsAdaptiveScreen` → Premium-Liste + Summary Master-Detail |
| `/office/clients/[id]` | Unverändert — volle Akte per Stack-Navigation (Phone) oder CTA aus Summary |

### Neue / überarbeitete Dateien

| Datei | Zweck |
|-------|-------|
| `src/data/demo/clientListStats.ts` | KPI-Builder, Pflegegrad-Filterkonstanten |
| `src/components/office/ClientsListHero.tsx` | Dark-Premium Hero mit Kennzahlen + Create-CTA |
| `src/components/office/ClientsListView.tsx` | Hauptansicht: Suche, Filter, Liste, States |
| `src/components/office/ClientDetailSummaryPanel.tsx` | Leichtes Detail-Panel für Master-Detail |
| `src/screens/office/ClientsListScreen.tsx` | Dünne Shell → delegiert an `ClientsListView` |
| `src/screens/office/ClientsAdaptiveScreen.tsx` | Summary-Panel statt voller Akte im Split-Pane |
| `src/hooks/useClientList.ts` | Pflegegrad-Filter, `allItems` für KPIs |
| `src/components/office/ClientListCard.tsx` | `selected`-Zustand für Master-Detail |
| `src/lib/office/clientListService.ts` | `guardServiceTenant` |
| `src/lib/office/clientDetailService.ts` | `guardServiceTenant` auf allen Mutations |
| `src/components/office/index.ts` | Exporte erweitert |
| `src/__tests__/office/officeClientsList.test.ts` | 10 fokussierte Tests |

### UX-Inhalt (Blueprint-konform)

- **Hero:** CareSuite+ Office-Kontext, Rolle, Demo-Badge, 3 KPIs (Gesamt, Aufnahme, Entwürfe), Orange-Gold „Klient:in anlegen“
- **Suche:** Name, Ort (firstName, lastName, city, zip)
- **Filter:** Status (8 Chips), Pflegegrad (PG 1–5 + Ohne PG), Sortierung (Name A–Z/Z–A, Ort)
- **Liste:** `ClientListCard` mit Status, PG, Sensitivität; Auswahl-Highlight im Master-Pane
- **Master-Detail (Tablet+):** Liste links, `ClientDetailSummaryPanel` rechts (Kontakt, Verknüpfungen, CTAs)
- **Phone:** Stack-Navigation zur vollen Akte (unverändert)
- **States:** Loading, Error (Retry), Empty, Filter-Empty (Reset), Refresh-Success

### Responsive Layout

- **Phone:** Einspaltige Liste mit Hero + Stack-Navigation zu Detail
- **Tablet/Desktop:** `MasterDetailLayout` Split-Pane; kompakter Embedded-Header im Master-Pane
- **Desktop:** Kompakter Hero (ohne große KPI-Kacheln im Split-Modus)

---

## 4. Design-Entscheidungen

1. **Sprint-01-Pattern übernommen** — `ClientsListHero` analog `DashboardHero` (Gradient, Sheen, Orange-Gold CTA)
2. **Summary statt Full-Detail im Split-Pane** — volle 12-Tab-Akte wäre UX-Overkill; CTA „Vollständige Akte öffnen“ führt zur bestehenden Route
3. **Pflegegrad als eigener Filter** — vor `useListState` vorgefiltert, Pagination bleibt korrekt
4. **Selected-State auf Karten** — Orange-Border + dezenter Hintergrund
5. **Keine Fake-Buttons** — Create, Edit, Akte öffnen haben echte Routen

---

## 5. Demo vs. Live

| Modus | Verhalten |
|-------|-----------|
| **Demo** | `clientService` → `demoClientRepository`; 12 Demo-Klient:innen, KPIs aus echten Seed-Daten |
| **Live (Supabase)** | `clientService` → `supabaseClientRepository.list/getById`; `guardServiceTenant` prüft Mandant |
| **Live ohne Supabase-Client** | Repository gibt `supabaseUnavailable` zurück — ehrlicher Fehler, kein Demo-Fallback |

---

## 6. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ Pass |
| `npm run test` | ✅ **336** Tests (10 neu) |
| `npm run smoke` | ✅ Pass (252 Kern-Dateien, 246 Routen) |

---

## 7. Deferred to Sprint 03

| Priorität | Item | Spec-Referenz |
|-----------|------|---------------|
| P0 | CareSuite+ Office Mitarbeitende-Liste (gleiches Pattern) | Blueprint Mitarbeitende |
| P0 | CareSuite+ Office Dokumente + Upload-Flow | Blueprint Dokumente |
| P1 | Desktop-Tabellenansicht für Klient:innen | Blueprint Desktop: Tabelle + Detail |
| P1 | Bulk-Aktionen / Mehrfachauswahl | CareSuite+ Office Erweiterung |
| P1 | CareSuite+ Office Rechnungen Filter | 02_ARCHITEKTUR |
| P2 | Live-Supabase Office-Dashboard Repository | Sprint 01 deferred |
| P2 | Offline-Zustände Klient:innen-Liste | Platform |

---

## 8. Ehrliches Verdict

**Was gut ist:**
- Klient:innen-Liste fühlt sich wie Premium-Verwaltungssoftware an (Hero, KPIs, Filter, Master-Detail)
- Alle sichtbaren Buttons haben echte Handler und Routen
- Demo/Live-Trennung über `guardServiceTenant` + bestehendes Repository-Switching
- Navigation vom Office-Dashboard (`/office/clients`, `/office/clients/create`) funktioniert
- Responsive: Phone Stack, Tablet+ Split-Pane mit Summary

**Was fehlt für Production:**
- Keine Desktop-Tabellenansicht (nur Kartenliste)
- Create/Edit-Persistenz im Live-Modus abhängig von Supabase-Konfiguration
- Keine Offline-Sync
- Summary-Panel zeigt nicht alle Full-Detail-Tabs (bewusst leichtgewichtig)
- Store/EAS-Audit weiterhin offen

**Fazit:** Sprint 02 liefert einen **sensationalen, fokussierten CareSuite+ Office-Klient:innen-Slice** im Demo-Modus. Die App bleibt ein **hochwertiger Prototyp**, nicht store-ready.
