# CareSuite+ HealthOS — Zielstruktur & Umsetzungsplan H1–H7 (H0)

**Stand:** 2026-07-02  
**Kein Code in H0** — nur Planung. P0/P0.1 geschützt.

---

## Zielstruktur CareSuite+ HealthOS

```
CareSuite+ HealthOS
├── Office HealthOS (Command Center / Unternehmenssteuerung)
│   1. Command Center
│   2. Klient:innen
│   3. Mitarbeitende
│   4. Einsätze
│   5. Nachweise
│   6. Dokumente
│   7. Budgets
│   8. Zeitkonto / WFM
│   9. Abrechnung
│  10. Kommunikation
│  11. Blocker / Qualität
│  12. Einstellungen
├── Assist HealthOS (operatives Fachmodul)
│   1. Assist Dashboard
│   2. Einsatzplanung
│   3. Live-Einsätze
│   4. Nachweise
│   5. Budgets
│   6. Leistungsarten
│   7. Qualität / Blocker
│   8. Kommunikation
│   9. Einstellungen
├── Mitarbeitendenportal HealthOS (Ausführungsebene)
│   1. Heute
│   2. Meine Einsätze
│   3. Aktueller Einsatz
│   4. Nachrichten
│   5. Meine Zeiten
│   6. Urlaub / Abwesenheit
│   7. Dokumente / Schulungen
│   8. Profil
└── Klient:innenportal HealthOS (Transparenz)
    1. Übersicht
    2. Termine
    3. Nachweise
    4. Dokumente
    5. Budget
    6. Nachrichten
    7. Stammdaten
    8. Hilfe / Kontakt
```

---

## Zielnavigation & Rollenlogik

| Bereich | Route-Basis | Rollen (via `APP_ROUTES` + `RequireRole`) | Desktop | Mobile |
|---------|-------------|-------------------------------------------|---------|--------|
| Office | `/office`, `/business/office` (Alias konsolidieren) | admin, dispatch, billing, hr | Sidebar + Module Rail | Context-Panel, kein Sidebar |
| Assist | `/assist` | dispatch, caregiver (read), admin | Sidebar + Tabs | Bottom context |
| Employee Portal | `/portal/employee` | employee, caregiver | Drawer + optional sidebar | 5-Tab Bottom-Nav |
| Client Portal | `/portal/client` | client, family | Drawer | 5-Tab Bottom-Nav |

**Mobile-Struktur Portal:** Tabs aus `portalMobileTabs.ts` erweitern um Arbeitszeit + Budget (Deep-Links → primäre Nav).

**Office/Assist Mobile:** `PlatformShell` Phone-Modus — HealthOSMobileBottomNav nur wo sinnvoll (Portal-first).

---

## HealthOS Design-System — 23 Komponenten

| # | Komponente | Zweck | Varianten | Ziel-Einsatz | Ersetzt | Swap-Risiko | Prio |
|---|------------|-------|-----------|--------------|---------|-------------|------|
| 1 | HealthOSPage | Page wrapper + scroll | default, portal, modal | alle Screens | ModuleDashboardShell, PortalTabScreen | grün | H1 |
| 2 | HealthOSSection | Content block | titled, plain | Formulare, Detail | SectionPanel | grün | H1 |
| 3 | HealthOSCard | Surface | elevated, glass, outline | überall | PremiumCard, GlassCard | grün | H1 |
| 4 | HealthOSMetricCard | KPI | 1–4 col | Dashboards | PremiumKpiCard | grün | H1 |
| 5 | HealthOSStatusBadge | Status chip | semantic | Listen, Detail | PremiumBadge | gelb | H1 |
| 6 | HealthOSActionButton | Actions | primary, ghost, danger | CTAs | PremiumButton | grün | H1 |
| 7 | HealthOSTimeline | History | vertical | Visit detail | Timeline | grün | H4 |
| 8 | HealthOSDataTable | Lists | compact, mobile-card | Office | PremiumDataTable | gelb | H2 |
| 9 | HealthOSDetailPanel | Side detail | drawer, inline | Akte, Messages | modals | grün | H2 |
| 10 | HealthOSFormField | Inputs | text, select, date | Settings, Forms | PremiumInput | grün | H1 |
| 11 | HealthOSModal | Overlays | glass, fullscreen | Office messages | PlatformModal | grün | H2 |
| 12 | HealthOSDrawer | Mobile nav | left, bottom | Portal | PortalNavigationDrawer | grün | H2 |
| 13 | HealthOSAlert | Feedback | info, warning, error | Execute, Finalize | scattered | grün | H1 |
| 14 | HealthOSBlockerCard | Blocker row | compact, expanded | Inbox, Command Center | InboxPanel rows | gelb | H3/H4 |
| 15 | HealthOSBudgetBar | Budget visual | account, line | Akte, Assignment | Budget grid bars | gelb | H3 |
| 16 | HealthOSTimeAccountCard | WFM summary | day, session | Office WFM, Portal | WFM cards | gelb | H3/H5 |
| 17 | HealthOSProofCard | Proof preview | list, detail | Nachweise | VisitProofPreviewPanel | gelb | H4 |
| 18 | HealthOSDocumentCard | Document row | list, hero | Office, Portal docs | PortalDocumentDetailHero | gelb | H6 |
| 19 | HealthOSVisitCard | Assignment | list, compact | Assist, Portal | AssignmentCompactCard | gelb | H4/H5 |
| 20 | HealthOSPortalHeader | Portal top | client, employee | Portale | PortalTopBar | grün | H2 |
| 21 | HealthOSCommandCenter | Office dashboard layout | default | `/office` | OfficeIndexScreen layout | grün | H3 |
| 22 | HealthOSMobileBottomNav | Bottom tabs | portal, module | Portale | PortalMobileNav | gelb | H2 |
| 23 | HealthOSDesktopSidebar | Module nav | grouped | Office, Assist | ModuleNavSidebar | grün | H2 |

---

## Phasen H1–H7

### H1 — Design System Foundation

| Feld | Inhalt |
|------|--------|
| **Ziel** | Tokens + 23 HealthOS-Komponenten als Wrapper über Premium/Aurora |
| **Dateien** | `src/design/tokens/*`, `src/components/healthos/*` (neu), `app/design-system/components.tsx` |
| **Risiko** | grün |
| **Tests** | design-system route, Vitest render smoke |
| **Abnahme** | Alle 23 rendern; **keine** Imports aus `assistWorkflow`, `clientBudgetTransactionService`, `wfmClockService` |
| **Deploy** | Push ohne `[deploy]` |

### H2 — Shell & Navigation

| Feld | Inhalt |
|------|--------|
| **Ziel** | `HealthOSShell` schrittweise für PlatformShell + PortalShellLayout |
| **Dateien** | `platformshell.tsx`, `PortalShellLayout.tsx`, `shellConfig.ts`, `officeNav.ts`, `assistNav.ts`, `portalMobileTabs.ts` |
| **Risiko** | grün (Layout only) |
| **Tests** | shell-preview routes, Nav-Link-Parity |
| **Abnahme** | Alle Nav-Links erreichbar; **keine Route-Änderung** |
| **Deploy** | optional smoke |

### H3 — Office Command Center

| Feld | Inhalt |
|------|--------|
| **Ziel** | Dashboard, Listen, Messages, WFM-Einstieg, Blocker-Kachel |
| **Dateien** | `OfficeIndexScreen`, `OfficeDashboardView`, `ClientsListScreen`, `OfficeMessengerScreen`, `officeNavigation.ts` |
| **Risiko** | gelb |
| **Tests** | Office E2E checklist, messaging smoke |
| **Abnahme** | Schnellzugriff = Sidebar 1:1; Budget/WFM nur Anzeige |
| **Deploy** | nach QA |

### H4 — Assist Operations

| Feld | Inhalt |
|------|--------|
| **Ziel** | Dashboard, Assignment list/detail chrome, Live-Status, Inbox |
| **Dateien** | `AssistIndexScreen`, `AssignmentDetailTabsPanel`, `AssistLiveStatusScreen`, `AssistExecutionProblemInboxPanel` |
| **Risiko** | gelb/rot an Detail-Tabs |
| **Tests** | assist-workflow Abnahme replay |
| **Abnahme** | Keine RPC-Signature-Änderung |
| **Deploy** | nach Assist smoke |

### H5 — Mitarbeitendenportal

| Feld | Inhalt |
|------|--------|
| **Ziel** | Dashboard hero, Execute shell, Arbeitszeit in Nav |
| **Dateien** | `EmployeePortalDashboardScreen`, `EmployeePortalVisitExecutionScreen`, `portalMobileTabs.ts` |
| **Risiko** | **rot** an Execute |
| **Tests** | `resolveVisitExecutionUiState`, portal live E2E |
| **Abnahme** | Execute persistence byte-identisch |
| **Deploy** | nur nach vollem Execute smoke |

### H6 — Klient:innenportal

| Feld | Inhalt |
|------|--------|
| **Ziel** | Overview, Budget sichtbar, Termin+Live polish |
| **Dateien** | `AdaptivePortalOverview`, Client budget route, `PortalClientAppointmentDetailScreen` |
| **Risiko** | gelb |
| **Tests** | portal-m3 checklist, client live tracking |
| **Abnahme** | RLS document visibility unchanged |
| **Deploy** | nach portal QA |

### H7 — Cross-Portal QA

| Feld | Inhalt |
|------|--------|
| **Ziel** | Status-Sprache vereinheitlicht, 8 rote Smoke-Tests, P0 Regression |
| **Dateien** | status maps, alle Portal/Assist/Office kritischen Screens |
| **Risiko** | rot (Testphase) |
| **Tests** | P0 E2E checklist, Dual-Scoring |
| **Abnahme** | P0/P0.1 grün |
| **Deploy** | `[deploy]` nur auf explizite Anfrage |

---

## Empfohlene Reihenfolge

**H1 → H2 → H3 → H4 → H5 → H6 → H7**

Parallele Arbeit möglich ab H2: H3/H4 (Office/Assist) getrennt von H5/H6 (Portale), sofern HealthOS-Tokens in H1 stehen.

---

## Go/No-Go H1

| Kriterium | Status |
|-----------|--------|
| P0/P0.1 abgeschlossen | **GO** |
| Kein Touch an Workflow/Persistence | **GO** (H1-Scope) |
| Design-Fragmentierung dokumentiert | **GO** |
| Team-Freigabe für Token-Naming | empfohlen |

**Empfehlung: GO für H1** — rein visuelle Token + Wrapper-Komponenten unter `src/components/healthos/`, explizit ohne Imports aus geschützten P0-Pfaden.

---

## Deploy-Hinweis

- H0–H2: Push ohne `[deploy]` (Netlify canceled — erwartet)
- H3–H6: Deploy optional nach modularem QA
- H7 / Production: `[deploy]` nur explizit
- Code-Härtung P0.1 (`a1046c09`): optional separater Deploy für Observability — **nicht** Teil von H0/H1
