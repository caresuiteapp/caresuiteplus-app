# CareSuite+ — Fundament-Abschluss (Arbeitspaket 020)

## Status

Die Arbeitspakete **001–020** bilden das technische und UX-Fundament der CareSuite+ Greenfield-App. Nach WP 020 ist die Basis testbar im Demo-Modus, dokumentiert und per Smoke-Check absicherbar.

## Übersicht WP 001–020

| WP | Thema | Ergebnis |
|----|-------|----------|
| 001 | Architektur & Datenmodell | Schichtenmodell, Types, Theme, Demo-Fixtures, `docs/architecture/001-fundament.md` |
| 002 | Navigation | Expo Router, Auth-Guards, Login-Routen, Redirects |
| 003 | Dashboard | Rollenbasierte KPIs, Hero, Timeline, `useDashboard` |
| 004 | Listenansicht | Office-Klient:innen-Liste, Filter, Suche, Pagination |
| 005 | Detailansicht | Client-Detail mit Tabs, Kontextkarten, Status |
| 006 | Create-Wizard | Mehrstufiger Anlege-Flow, Validierung |
| 007 | Service-Schicht | `ServiceResult`, Demo/Supabase-Repositories, Mode-Switch |
| 008 | Hooks & State | `useAsyncQuery`, `useMutation`, `useListState` |
| 009 | Rollen & Rechte | Permission-Keys, `usePermissions`, UI-Gates |
| 010 | Supabase & RLS | Migrationen 0001–0003, RLS-Policies, Mapper |
| 011 | Demo-Daten | 11 Rollen-Profile, 12 Klient:innen, Seed-SQL |
| 012 | Portal-Sicht | Mitarbeiter-/Klient:innenportal mit Tabs, Sichtbarkeitsfilter |
| 013 | Kommunikation | Nachrichten-Typen, Demo-Daten, `useMessages` |
| 014 | Dokumente | Portal-Dokumente mit Sichtbarkeits-Scopes |
| 015 | Workflow | `workflowEngine` — `validateTransition`, `getNextActions` |
| 016 | Abrechnung | Rechnungsliste `/office/invoices`, Demo-Budgets |
| 017 | AI/OCR | `providerRegistry` mit `secret_reference` — keine Secrets im Frontend |
| 018 | Barrierefreiheit | `accessibility.ts`, `useAccessibility`, Button-Touch-Targets |
| 019 | Tests | `npm run smoke`, Datei- + Typecheck-Validierung |
| 020 | Dokumentation | README, Fundament-Abschluss (dieses Dokument) |

## Demo-Modus

- `EXPO_PUBLIC_DEMO_MODE=true` (Standard in `.env.example`)
- Session lokal via `AuthProvider` — kein Live-Supabase nötig
- 11 Rollen mit realistischen Demo-Daten (→ `docs/architecture/011-demo-data.md`)

## Architektur-Dokumentation

Alle WP-Dokumente unter `docs/architecture/`:

- Querschnitt: `data-model.md`, `module-boundaries.md`, `roles-and-portals.md`
- Sequenziell: `001-fundament.md` … `020-fundament-abschluss.md`

## Bekannte Grenzen (Stand WP 001–061)

- Produktive Supabase-Auth erfordert manuelles `supabase db push` + Auth-User-Anlage
- Produktmodule (Assist, Pflege, Stationär, …) sind bewusst Platzhalter bis WP 062+
- Keine E2E-Test-Suite — Smoke-Check (39 Kern-Dateien) + Typecheck
- Screenreader-Labels und vollständiges A11y-Audit folgen in UX-Phase 2

## Ergänzungen bis WP 061 (Vollständigkeit)

- `/office/employees` — Mitarbeitendenliste mit Suche, Filter, Berechtigung `office.employees.view`
- `/office/clients/[id]/edit` — Stammdaten-Bearbeitungs-Wizard
- Portal-Deep-Links: `/portal/employee/{assignments,documents,messages}`, `/portal/client/{appointments,documents,messages}`
- Breadcrumbs in `ScreenShell` via `getBreadcrumbs()`

## Nächste Schritte (nach Fundament)

- Live-Supabase-Anbindung für Office-Klient:innen
- Portal-Realtime (Nachrichten, Einsätze)
- Reporting & Operations-Module
