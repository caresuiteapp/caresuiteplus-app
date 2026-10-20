# Supabase Deployment — CareSuite+ Live-Pilot

Runbook für **Production-Supabase** (`caresuiteplus-production`, Region `eu-central-1`) und Pilotstart mit 3 ambulanten Mandanten (NRW).

Siehe auch: [live-pilot.md](./live-pilot.md), [081-100-supabase-core.md](./081-100-supabase-core.md)

## Umgebungsvariablen (Expo / EAS)

| Variable | Pflicht (Live) | Beschreibung |
|----------|----------------|--------------|
| `EXPO_PUBLIC_SUPABASE_URL` | ja | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ja | Publishable/Anon Key — **niemals** `service_role` |
| `EXPO_PUBLIC_DEMO_MODE` | nein | `false` für Live; `true` oder leer = Demo |

**Modus-Logik** (`src/lib/supabase/config.ts`, `src/lib/services/mode.ts`):

- `demo` wenn `EXPO_PUBLIC_DEMO_MODE !== 'false'` **oder** URL/Key fehlen
- `supabase` wenn `EXPO_PUBLIC_DEMO_MODE=false` **und** URL + Anon-Key gesetzt

Erweiterte Klient:innen-Services (`src/lib/clients/*`) nutzen `getServiceMode()` und schalten auf `clientExtendedRepository.supabase.ts` um.

## Migrationen (lokal → Remote)

Reihenfolge in `supabase/migrations/` (strikt numerisch):

| Datei | Inhalt |
|-------|--------|
| `0001_core_schema.sql` | Mandanten, Produkte, Profile, RLS-Basis |
| `0002_rls_refinements.sql` | Berechtigungsfunktionen |
| `0003_office_clients.sql` | Klient:innen-Stamm, Kontakte, Consents |
| `0004_demo_seed.sql` | Demo-Mandant + Beispiel-Klient:innen (optional für Pilot) |
| `0005_employees_and_profiles.sql` | Mitarbeitende, Profil-Erweiterungen |
| `0006_appointments_invoices.sql` | Termine, Rechnungen |
| `0007_assist_platform.sql` | Assist/Einsätze |
| `0008_ops_modules.sql` | Ops-Module (Release, QA, Security, …) |
| `0009_ti_module.sql` | TI-Infrastruktur (KIM, Provider, Audit) |
| `0010_client_extended.sql` | Erweiterte Klient:innen-Akte (Budgets, Tasks, Timeline, …) |

**Remote-Stand (Stand Setup):** Production-Projekt enthält derzeit nur Auth-Trigger-Migrationen. Lokale Migrationen **0001–0010** müssen noch deployed werden.

### Deployment-Befehle

```bash
# 1. CLI installieren & anmelden (einmalig)
npm install -g supabase
supabase login

# 2. Projekt verknüpfen (im Repo-Root CareSuite+)
cd "C:/Users/Kevin Reinhardt/Documents/CareSuite+"
supabase link --project-ref euagyyztvmemuaiumvxm

# 3. Schema deployen (alle ausstehenden Migrationen)
supabase db push

# 4. Optional: lokalen Stand prüfen
supabase migration list
supabase migration list --linked

# 5. Nach Push: RLS/Security prüfen (Dashboard oder MCP get_advisors)
```

**Seed:** `0004_demo_seed.sql` legt Demo-Mandant `CareSuite+ Demo` an. Für NRW-Pilot-Mandanten (Köln, Düsseldorf, Bonn) Mandanten **manuell** im Dashboard oder per SQL anlegen — siehe `src/lib/pilot/pilotConfig.ts`.

**Kein automatisches Seed** für Pilot-Klient:innen: Import über Office-UI oder SQL nach Mandanten-Anlage.

## Edge Functions (TI, optional)

```bash
supabase functions deploy ti-provider-proxy
```

TI-Provider-Credentials gehören in **Supabase Vault / Edge Secrets** — nicht in `.env` der App.

## Pilot-Mandanten (3× ambulant NRW)

| Mandant | Go-Live (Plan) |
|---------|----------------|
| SonnenPflege Ambulant Köln | 01.06.2026 |
| Herzlich Zuhause Pflege Düsseldorf | 15.06.2026 |
| PflegeEngel Bonn | 01.07.2026 |

Pro Mandant manuell:

1. Zeile in `public.tenants` anlegen
2. Auth-User + `public.profiles` mit `tenant_id` und Rolle (PDL/Admin)
3. Berechtigungen `office.clients.*` für Rollen prüfen
4. Klient:innen-Stamm (>10 Datensätze laut Pilot-Checkliste)
5. `.env` / EAS Secrets mit Live-Keys; `EXPO_PUBLIC_DEMO_MODE=false`

## Qualitätsgates vor Go-Live

```bash
npm run typecheck
npm run test
npm run smoke
```

## Manuelle Schritte (nicht automatisiert)

- Supabase Dashboard: Auth-Provider, E-Mail-Templates, ggf. MFA
- Mandanten + Benutzer für 3 Pilot-Standorte
- TI-Provider-Zugangsdaten in Vault (Edge Function `ti-provider-proxy`)
- EAS/Store Build mit Production-`.env`
- Pilot-Readiness-Checkliste (`/business/ops/pilot-readiness`)

## Rollback

1. App: `EXPO_PUBLIC_DEMO_MODE=true` oder Feature-Flag `pilot_tenant` deaktivieren
2. DB: **kein** automatisches Downgrade — Schema-Rollback nur mit Supabase-Support oder manuellem SQL
3. Siehe [live-pilot.md](./live-pilot.md) Abschnitt Rollback
