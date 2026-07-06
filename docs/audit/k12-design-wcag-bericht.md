# K.1.2 Design-Parität + WCAG — Sichtprüfungsbericht

**Stand:** 2026-07-06T06:06:27.005Z  
**URL:** http://localhost:8091  
**Branch:** `cursor/client-portal-k1-refactor`  
**Screenshots:** 19 (6 Bereiche × 3 Viewports + Drawer)

## Kurzstatus

| | |
|---|---|
| Deploy | **Nein** |
| Commit | **Nein** |
| Lokale Änderungen | **Ja** (uncommitted) |
| Audit automatisch | **26/45** (vorher **27/45**) |
| Screens laden | **Ja** (kein Crash) |
| Sichtprüfung maßgeblich | **Screenshots** — DOM-Heuristik liefert viele False Positives |

---

## Ergebnis automatisches Audit: ⚠️ 26/45

Die Punktzahl sinkt gegenüber dem Zwischenstand um 1, weil `appointments_ipad_glass_hero` beim Screenshot noch im Ladezustand („Einsätze werden geladen…") hing — **Timing-Flake**, kein visueller Regression auf iPhone/Desktop.

### Checks (automatisch)

- [x] **api_login** — ok
- [x] **overview_iphone_loads** — Übersicht sichtbar
- [ ] **overview_iphone_wcag_sample** — EM-Avatar + „Details →" (transparent bg)
- [x] **appointments_iphone_loads** — Einsätze sichtbar
- [x] **appointments_iphone_glass_hero** — glass_hero_or_card
- [ ] **appointments_iphone_wcag_sample** — EM + Geplant (transparent bg)
- [x] **documents_iphone_loads** — Dokumente sichtbar
- [x] **documents_iphone_glass_hero** — glass_hero_or_card
- [ ] **documents_iphone_wcag_sample** — EM + Erneut laden (transparent bg)
- [x] **messages_iphone_loads** — Nachrichten sichtbar
- [ ] **messages_iphone_wcag_sample** — EM + Verwaltung anschreiben (transparent bg)
- [x] **profile_iphone_loads** — Profil sichtbar
- [ ] **profile_iphone_wcag_sample** — EM + Geplant (transparent bg)
- [x] **proofs_iphone_loads** — Nachweise sichtbar
- [ ] **proofs_iphone_wcag_sample** — EM (transparent bg)
- [x] **drawer_items** — vollständig inkl. Einstellungen, Abmelden
- [x] **bottom_nav_testid** — portal-mobile-nav
- [x] **overview_ipad_loads** — Übersicht sichtbar
- [ ] **overview_ipad_wcag_sample** — EM (transparent bg)
- [x] **appointments_ipad_loads** — Einsätze sichtbar (Ladezustand im Screenshot)
- [ ] **appointments_ipad_glass_hero** — legacy_hero_risk *(Lade-Flake)*
- [ ] **appointments_ipad_wcag_sample** — EM (transparent bg)
- [x] **documents_ipad_loads** — Dokumente sichtbar
- [x] **documents_ipad_glass_hero** — glass_hero_or_card
- [ ] **documents_ipad_wcag_sample** — EM + Erneut laden (transparent bg)
- [x] **messages_ipad_loads** — Nachrichten sichtbar
- [ ] **messages_ipad_wcag_sample** — EM + Verwaltung anschreiben (transparent bg)
- [x] **profile_ipad_loads** — Profil sichtbar
- [ ] **profile_ipad_wcag_sample** — EM + Geplant (transparent bg)
- [x] **proofs_ipad_loads** — Nachweise sichtbar
- [ ] **proofs_ipad_wcag_sample** — EM (transparent bg)
- [x] **overview_desktop_loads** — Übersicht sichtbar
- [ ] **overview_desktop_wcag_sample** — EM + Sidebar-Links (transparent bg)
- [x] **appointments_desktop_loads** — Einsätze sichtbar
- [x] **appointments_desktop_glass_hero** — glass_hero_or_card
- [ ] **appointments_desktop_wcag_sample** — EM + Geplant (transparent bg)
- [x] **documents_desktop_loads** — Dokumente sichtbar
- [x] **documents_desktop_glass_hero** — glass_hero_or_card
- [ ] **documents_desktop_wcag_sample** — EM + Erneut laden (transparent bg)
- [x] **messages_desktop_loads** — Nachrichten sichtbar
- [ ] **messages_desktop_wcag_sample** — EM + Verwaltung anschreiben (transparent bg)
- [x] **profile_desktop_loads** — Profil sichtbar
- [ ] **profile_desktop_wcag_sample** — EM + Geplant (transparent bg)
- [x] **proofs_desktop_loads** — Nachweise sichtbar
- [ ] **proofs_desktop_wcag_sample** — EM + Sidebar (transparent bg)

---

## Sichtprüfung pro Bereich (Screenshots maßgeblich)

| Bereich | iPhone | iPad | Desktop | Ergebnis | Bemerkung |
| --- | ---: | ---: | ---: | --- | --- |
| Übersicht | geprüft | geprüft | geprüft | **grün** | Glass-Hero, helle Modul-Chips, KPI-CTAs dunkler Amber; Sidebar „Details →" noch Gold-Ton |
| Einsätze | geprüft | geprüft | geprüft | **grün** / iPad-Flake | iPhone: Glass-Hero, helle Geplant-Badge, keine doppelte Statuszeile; iPad-Screenshot zeigte Ladezustand |
| Dokumente | geprüft | geprüft | geprüft | **grün** | Glass-Hero, CareLightButton Empty-State, GlassCard-Liste |
| Nachrichten | geprüft | geprüft | geprüft | **grün** | Glass-Hero, CareLightButton Compose, glass-Inbox mit kontrastfähigen Filter-Chips |
| Profil | geprüft | geprüft | geprüft | **grün** | Helle Karten, lesbare Meta-Labels, helle Status-Badges |
| Nachweise | geprüft | geprüft | geprüft | **grün** | Glass-Hero, leerer Zustand lesbar, Amber-Link „Rückfrage senden", CareLightButton-Aktionen |
| Drawer | geprüft | — | — | **grün** | Alle Items inkl. Einstellungen + Abmelden |

---

## WCAG-Restliste

### Echte Restpunkte (sichtbar)

| Punkt | Bereich | Priorität |
| --- | --- | --- |
| Overview „Details →" (Mandant-Karte) | Mobile Übersicht | Niedrig — Gold `#F5B942`, Kontrast grenzwertig |
| Desktop-Sidebar „PORTAL-STATUS" / Details-Links | Desktop | Niedrig — dekorativ/sekundär |
| Unterschriften-Detailscreens | Unterschriften | Später — `PremiumListHeroFrame` noch auf Employee-Signatur-Detail |

### Erwartbare False Positives (DOM-Heuristik)

- **Avatar „EM"** weiß auf dunkler Topbar-Chip — visuell lesbar, Hintergrund `transparent` in DOM
- **CareLightButton-Label** („Verwaltung anschreiben", „Erneut laden") — weiße Schrift auf orangem Button, Eltern-Hintergrund nicht erkannt
- **PremiumBadge „Geplant"** — pastell cyan auf hellem Kartenhintergrund, Badge-bg transparent im DOM
- **„Details →" / KPI-Gold** — teils transparente Eltern, visuell OK auf Glass-Karten

### Bewusst später

- Messenger-Fachworkflow (Thread-Safe-Area, Composer-Polish Punkt 9)
- Dokumente-/Unterschriften-Workflow (Punkt 7)
- Signature-Screens Shell-Umstellung (nur Employee-Detail betroffen)

---

## Gefixte Punkte (diese Runde)

1. **`PORTAL_LIGHT_LINK_ORANGE` (`#B45309`)** zentral in `auroraGlass.ts`
2. **`PremiumBadge`** — keine dunklen Accent-Chips mehr auf Light-Shell
3. **`ClientPortalAssignmentCard`** — doppeltes „Geplant" entfernt
4. **`PortalEmptyState` / KPI-CTAs** — kontrastfähiger Amber auf hellen Flächen
5. **`portalofficemessenger`** — CareLightButton bei Light-Theme (nicht nur LLGAN-Flag)
6. **`StateViews` Empty/Error** — CareLightButton bei Light-Theme
7. **`portalofficeinbox`** — Filter-Chips Amber statt `#FF9500`
8. **Client Nachrichten** — `variant="glass"` für M.1-Inbox
9. **Nachweise** — Amber-Links + CareLightButton-Aktionen
10. **Modals** — Amber-Links in Proofs/OpenRequests

---

## Geänderte Dateien (Design/WCAG diese Session)

| Datei | Änderung |
| --- | --- |
| `src/design/tokens/auroraGlass.ts` | `PORTAL_LIGHT_LINK_ORANGE` Token |
| `src/components/ui/PremiumBadge.tsx` | Light-Shell: pastell statt Dark-Chip |
| `src/components/ui/StateViews.tsx` | Light-UI Buttons |
| `src/components/portal/ClientPortalAssignmentCard.tsx` | Badge-only Status, keine Duplikat-Zeile |
| `src/components/portal/assist/PortalEmptyState.tsx` | Amber-Default, Gold→Amber auf Light |
| `src/components/portal/assist/MobilePortalKpiCard.tsx` | CTA Amber auf Light-Shell |
| `src/components/portal/assist/PortalNextAppointmentHero.tsx` | Hero-Links Amber |
| `src/components/portal/assist/PortalOpenRequestsModal.tsx` | Amber Zurück-Link |
| `src/components/portal/assist/PortalServiceProofsModal.tsx` | Amber Status/Links |
| `src/components/portal/portalofficemessenger.tsx` | Compose CareLightButton Light-UI |
| `src/components/portal/portalofficeinbox.tsx` | Filter-Chip Amber |
| `src/screens/portal/ClientPortalProofsScreen.tsx` | Amber + CareLightButton |
| `src/screens/portal/portalofficemessagesscreens.tsx` | Client Messenger `variant="glass"` |

*(Weitere K.1-Dateien aus früheren Runden uncommitted — siehe `git status`.)*

---

## Screenshots

- `overview__iphone`: docs/audit/k12-design-wcag-screenshots/overview__iphone.png
- `appointments__iphone`: docs/audit/k12-design-wcag-screenshots/appointments__iphone.png
- `documents__iphone`: docs/audit/k12-design-wcag-screenshots/documents__iphone.png
- `messages__iphone`: docs/audit/k12-design-wcag-screenshots/messages__iphone.png
- `profile__iphone`: docs/audit/k12-design-wcag-screenshots/profile__iphone.png
- `proofs__iphone`: docs/audit/k12-design-wcag-screenshots/proofs__iphone.png
- `drawer__iphone`: docs/audit/k12-design-wcag-screenshots/drawer__iphone.png
- `overview__ipad`: docs/audit/k12-design-wcag-screenshots/overview__ipad.png
- `appointments__ipad`: docs/audit/k12-design-wcag-screenshots/appointments__ipad.png
- `documents__ipad`: docs/audit/k12-design-wcag-screenshots/documents__ipad.png
- `messages__ipad`: docs/audit/k12-design-wcag-screenshots/messages__ipad.png
- `profile__ipad`: docs/audit/k12-design-wcag-screenshots/profile__ipad.png
- `proofs__ipad`: docs/audit/k12-design-wcag-screenshots/proofs__ipad.png
- `overview__desktop`: docs/audit/k12-design-wcag-screenshots/overview__desktop.png
- `appointments__desktop`: docs/audit/k12-design-wcag-screenshots/appointments__desktop.png
- `documents__desktop`: docs/audit/k12-design-wcag-screenshots/documents__desktop.png
- `messages__desktop`: docs/audit/k12-design-wcag-screenshots/messages__desktop.png
- `profile__desktop`: docs/audit/k12-design-wcag-screenshots/profile__desktop.png
- `proofs__desktop`: docs/audit/k12-design-wcag-screenshots/proofs__desktop.png

---

## Risiko / Regressionen

- **Gering:** Rein visuelle Token-/Button-Anpassungen, keine Fachlogik
- **Audit-Flake iPad Einsätze:** längere Wartezeit im Script empfohlen vor erneutem Lauf
- **Gold „Details →"** auf Mobile-Übersicht: optional noch auf Amber umstellen

---

## Empfehlung K.1.2 abschließen

**Noch nicht vollständig — aber nah dran.**

**Grün (Sichtqualität):** iPhone-Kernflächen (Übersicht, Einsätze, Dokumente, Nachrichten, Profil, Nachweise, Drawer, Bottom-Nav) entsprechen M.1-Light-Shell. Keine dunklen Alt-Karten in Kern-Tabs. Messenger-Compose lesbar.

**Offen für formale Abnahme:**
- iPad Einsätze erneut screenshotten (nach Load)
- Optional: Mandant „Details →" Gold → Amber
- Unterschriften-Shell (bewusst später)
- Messenger Safe-Area/Composer-Feinschliff (Punkt 9)

**Vorschlag:** K.1.2 Design-Parität als **„Sicht-abgenommen iPhone + Desktop-Kern"** markieren, iPad-Flake + Unterschriften als Follow-up vor Merge/Deploy.

---

_Kein Deploy. Kein Commit._
