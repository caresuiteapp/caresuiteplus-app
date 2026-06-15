# CareSuite+

Modulare, mandantenfähige SaaS-Mobile-App für Pflege- und Betreuungsunternehmen — Premium Dark UI, Demo-Modus ohne Live-Backend, Supabase-ready.

## Module

| Modul | Pfad | Beschreibung |
|-------|------|--------------|
| Office | `/office` | Verwaltung, Klient:innen, Rechnungen |
| Assist | `/assist` | Alltagsbegleitung |
| Pflege | `/pflege` | Pflegeplanung |
| Stationär | `/stationaer` | Stationäre Versorgung |
| Beratung | `/beratung` | Beratungsfälle |
| Akademie | `/akademie` | Weiterbildung |

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Optional Web: `npm run web` · Android/iOS: `npm run android` / `npm run ios`

### Umgebungsvariablen (`.env`)

| Variable | Beschreibung |
|----------|--------------|
| `EXPO_PUBLIC_DEMO_MODE` | `true` = Demo ohne Live-Supabase (Standard) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (niemals `service_role` im Frontend) |

## Demo-Login

Startseite `/` → Login-Bereich wählen → Rolle antippen (kein Passwort).

| Bereich | Route | Rollen |
|---------|-------|--------|
| Business | `/auth/business-login` | Geschäftsführung, Bereichsleitung, Abrechnung, Einsatzplanung, Beratung, Akademie |
| Mitarbeiterportal | `/auth/employee-login` | Mitarbeiterportal, Alltagsbegleiter:in, Pflegefachkraft |
| Klient:innenportal | `/auth/client-login` | Klient:innenportal, Angehörigenportal |

Nach Login: Redirect gemäß Rolle (Business → `/business`, Portale → `/portal/…`).

## Scripts

| Befehl | Zweck |
|--------|-------|
| `npm start` | Expo Dev Server |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run smoke` | Kern-Dateien + Typecheck |
| `npm run lint` | ESLint |

## Architektur

Dokumentation in [`docs/architecture/`](docs/architecture/):

| WP | Dokument |
|----|----------|
| 001 | [Fundament](docs/architecture/001-fundament.md) |
| 002 | [Navigation](docs/architecture/002-navigation.md) |
| 003 | [Dashboard](docs/architecture/003-dashboard.md) |
| 004 | [Listenansicht](docs/architecture/004-list-view.md) |
| 005 | [Detailansicht](docs/architecture/005-detail-view.md) |
| 006 | [Create-Wizard](docs/architecture/006-create-wizard.md) |
| 007 | [Service-Schicht](docs/architecture/007-service-layer.md) |
| 008 | [Hooks & State](docs/architecture/008-hooks-state.md) |
| 009 | [Rollen & Rechte](docs/architecture/009-roles-permissions.md) |
| 010 | [Supabase & RLS](docs/architecture/010-supabase-rls.md) |
| 011 | [Demo-Daten](docs/architecture/011-demo-data.md) |
| 018 | [Barrierefreiheit](docs/architecture/018-accessibility.md) |
| 019 | [Tests](docs/architecture/019-testing.md) |
| 020 | [Fundament-Abschluss](docs/architecture/020-fundament-abschluss.md) |

Querschnitt: [`data-model.md`](docs/architecture/data-model.md), [`module-boundaries.md`](docs/architecture/module-boundaries.md), [`roles-and-portals.md`](docs/architecture/roles-and-portals.md)

Technisches Fundament in der App: Route `/fundament`

## Bekannte Grenzen

- Demo-Modus simuliert Auth lokal — produktive Supabase-Sessions erfordern konfigurierte Auth-User
- SQL-Migrationen manuell via `supabase db push`
- Alle Produktmodule (Office, Assist, Pflege, …) haben funktionale Demo-Screens
- Abschnitte 441–600 (AI, Integrationen, Reporting, Release) folgen als Nächstes
- Smoke-Check prüft 39 Kern-Dateien + Typecheck — keine E2E-Tests
- Screenreader-Labels noch nicht flächendeckend (→ WP 018 Basis)

## Stack

Expo 52 · React Native · Expo Router · TypeScript · Supabase (optional)
