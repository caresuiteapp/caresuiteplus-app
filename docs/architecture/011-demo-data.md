# CareSuite+ — Demo-Daten (Arbeitspaket 011)

## Ziel

Realistische Demo-Daten für alle relevanten Rollen und Workflow-Status — testbar ohne Live-Supabase.

## Demo-Mandant

| Feld | Wert |
|------|------|
| App-ID | `tenant-demo-001` |
| Supabase-UUID | `a0000000-0000-4000-8000-000000000001` |
| Name | CareSuite+ Demo |

## Rollen-Abdeckung (11 Demo-Profile)

Jede `RoleKey` hat ein eigenes Demo-Profil in `src/data/demo/profiles.ts`:

- Geschäftsführung, Bereichsleitung, Abrechnung, Einsatzplanung
- Pflegefachkraft, Alltagsbegleiter:in, Beratungskraft, Akademie-Admin
- Mitarbeiter-, Klient:innen- und Angehörigenportal

Login-Gruppen in `DEMO_LOGIN_ROLES` (navigation.ts).

## Status-Abdeckung

| Entität | Anzahl | Status |
|---------|--------|--------|
| Klient:innen | 12 | alle 7 Workflow-Status |
| Mitarbeitende | 6 | entwurf, aktiv, in_bearbeitung, gesperrt |
| Termine | 4 | entwurf, aktiv, in_bearbeitung, abgeschlossen |
| Rechnungen | 6 | entwurf, aktiv, in_bearbeitung, abgeschlossen, archiviert, fehlerhaft |

## Dateien

```
src/data/demo/
  profiles.ts      — 11 Rollen-Profile
  clients.ts       — 12 Klient:innen
  employees.ts     — 6 Mitarbeitende
  appointments.ts  — 4 Termine
  invoices.ts      — 6 Rechnungen
  seedCatalog.ts   — getDemoSeedSummary()
  uuidMap.ts       — Supabase-UUID-Mapping

supabase/migrations/0004_demo_seed.sql
```

## Supabase-Seed

Nach `supabase db push` enthält die Datenbank den Demo-Mandanten und 12 Klient:innen.
Profile erfordern `auth.users` — in der App weiterhin Demo-Login.

## API

```typescript
import { getDemoSeedSummary, getDemoProfileForRole } from '@/data/demo';
```
