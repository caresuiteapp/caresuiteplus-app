# CareSuite+ — Hauptscreen / Dashboard (Arbeitspaket 003)

## Überblick

Das Dashboard ist der zentrale Einstieg nach der Anmeldung. Es zeigt rollenabhängige KPIs, Statuskarten, Schnellaktionen und eine Aktivitäts-Timeline.

## Routen

| Route | Scope | Rollen |
|-------|-------|--------|
| `/business` | `business` | Admin, Manager, Billing, Dispatch, … |
| `/portal/employee` | `portal_employee` | Mitarbeiterportal, Pflege, Begleitung |
| `/portal/client` | `portal_client` | Klient:innen-, Angehörigenportal |

## Architektur

```
useDashboard(scope)
  → dashboardService.fetchDashboardSnapshot()
    → buildDemoDashboard(roleKey, scope)
      → DashboardView (UI)
```

## UI-Bereiche

1. **DashboardHero** — Begrüßung, Mandant, Rolle, primäre CTA
2. **KPIs** — 4 Kennzahlen (2×2 Grid, mobile-first)
3. **Statuskarten** — fachliche Vorgänge mit Workflow-Status
4. **Schnellaktionen** — rollenabhängige Buttons
5. **Timeline** — letzte Aktivitäten
6. **Module** (nur Business) — Modul-Kacheln

## Zustände

- `LoadingState` beim ersten Laden
- `ErrorState` mit „Erneut versuchen"
- `EmptyState` wenn keine Daten
- `SuccessState` nach manuellem Refresh

## Datenschutz

- Statuskarten mit `sensitivity` zeigen Badges (Pflege/Gesundheit)
- Portal-Dashboards zeigen nur eigene/freigegebene Informationen

## Supabase-Anbindung (vorbereitet)

`fetchDashboardSnapshot` wird später durch Supabase-Queries ersetzt:
- KPIs aus aggregierten Views
- Aktivitäten aus Audit/Events-Tabelle
- RLS über `tenant_id` + Rollen

## Bekannte Grenzen (nach WP 003)

- Keine echten Live-Daten (Demo-Fixtures)
- Modul-Unterscreens noch Platzhalter (→ WP 004+)
- Keine Push-Benachrichtigungen auf Aktivitäten
