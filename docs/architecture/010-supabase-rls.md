# CareSuite+ — Supabase & RLS (Arbeitspaket 010)

## Tabellenübersicht

### Plattform (0001)

| Tabelle | Mandant | Beschreibung |
|---------|---------|--------------|
| `tenants` | — | Pflegedienst / Unternehmen |
| `tenant_addresses` | `tenant_id` | Adresse |
| `tenant_contacts` | `tenant_id` | Ansprechpartner |
| `profiles` | `tenant_id` | Nutzerprofil ↔ `auth.users` |
| `roles` | global | Rollendefinitionen |
| `role_permissions` | global | Rechte je Rolle |
| `products` | global | Modul-Stammdaten |
| `tenant_products` | `tenant_id` | Aktive Module |
| `tenant_subscriptions` | `tenant_id` | Abo-Status |

### Office Klient:innen (0003)

| Tabelle | Mandant | RLS-Regel |
|---------|---------|-----------|
| `clients` | `tenant_id` | SELECT/INSERT/UPDATE mit `has_permission()` |
| `client_contacts` | `tenant_id` | view / edit getrennt |
| `client_consents` | `tenant_id` | `manage_consents` für Schreiben |
| `client_audit_entries` | `tenant_id` | SELECT view, INSERT offen im Mandant |
| `client_history_entries` | `tenant_id` | SELECT view, INSERT offen im Mandant |

## RLS-Muster

```sql
-- Mandanten-Isolation
tenant_id = public.current_tenant_id()

-- Berechtigung (synchron mit src/data/demo/permissions.ts)
AND public.has_permission('office.clients.view')
```

## RPCs

| Funktion | Zweck |
|----------|-------|
| `change_client_status(p_client_id, p_new_status)` | Status + Audit + Verlauf |
| `list_clients_for_tenant()` | Sichere Listenabfrage |

## Indizes (Performance)

- `idx_clients_tenant`, `idx_clients_status`, `idx_clients_name`
- `idx_clients_sensitivity`
- Kind-Tabellen: `idx_*_client` auf `client_id`

## App-Anbindung

```
EXPO_PUBLIC_DEMO_MODE=false + URL + Anon-Key
  → getServiceMode() = 'supabase'
  → supabaseClientRepository (src/lib/services/clients/)
  → mapClientListItem / mapClientDetail
```

Typen: `src/lib/supabase/types.ts` (manuell, später `supabase gen types`).

## Nächste Schritte (WP 011+)

- Seed-Daten für Supabase-Demo-Mandant
- Storage-Buckets mit RLS
- Weitere Modul-Tabellen (Assist, Pflege, …)
