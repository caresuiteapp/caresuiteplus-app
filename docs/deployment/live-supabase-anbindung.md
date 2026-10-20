# Live Supabase Anbindung — Deployment

Anleitung für Pilot-Mandanten (3 ambulante NRW). **Nicht ohne Zugangsdaten ausführen.**

## 1. Voraussetzungen

- Supabase-Projekt mit Postgres
- Supabase CLI installiert (`npm i -g supabase` oder npx)
- Keine Secrets in Git — `.env` lokal

## 2. Umgebung

`.env` aus `.env.example` kopieren:

```env
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## 3. Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Migrationen: `0001_core_schema.sql` … `0017_auth_portal_rls_hardening.sql`

## 4. Typen generieren

```bash
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
cp src/lib/supabase/types.ts src/lib/supabase/database.types.ts
```

Alternativ: `npm run fetch-remote-types` (schreibt beide Dateien).

Alternativ lokal gegen Docker-Stack:

```bash
npx supabase start
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

## 5. Mandant & Auth anlegen

Manuell im SQL Editor oder Seed-Skript:

1. Zeile in `tenants`
2. Auth-User via Dashboard
3. `profiles` mit `tenant_id` und `role_key`
4. `tenant_products` für aktive Module

## 6. Quality Gates

```bash
npm run typecheck
npm run test
npm run smoke
```

## 7. Modus-Verhalten

| `EXPO_PUBLIC_DEMO_MODE` | Backend |
|-------------------------|---------|
| `true` (oder URL fehlt) | Demo-Repos, `DEMO_TENANT_ID` |
| `false` + URL + Anon | Supabase-Repos, `profile.tenant_id` Pflicht |

## Sicherheit

- **Niemals** `service_role` in Expo/React-Code
- RLS-Checkliste: `docs/audit/live-supabase-rls-checklist.md`
- Audit-Report: `docs/audit/live-supabase-anbindung-report.md`

**Status:** vorbereitet, nicht remote verifiziert (ohne echtes `db push` + Pilot-Login).
