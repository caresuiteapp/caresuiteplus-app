# CareSuite+ — Supabase Migrationen (Arbeitspaket 010)

## Reihenfolge

| Datei | Inhalt |
|-------|--------|
| `0001_core_schema.sql` | Mandanten, Profile, Rollen, Rechte, Produkte, Basis-RLS |
| `0002_rls_refinements.sql` | INSERT-Policies, Hilfsfunktionen, GRANTs |
| `0003_office_clients.sql` | Klient:innen-Tabellen, RLS, RPCs, Indizes |
| `0004_demo_seed.sql` | Demo-Mandant, 12 Klient:innen, Beispiel-Kontakte (WP 011) |

## Ausführung

```bash
supabase start
supabase db push
```

Oder manuell im Supabase Dashboard → SQL Editor (in Reihenfolge).

## Hilfsfunktionen

- `current_tenant_id()` — Mandant des eingeloggten Nutzers
- `current_role_key()` — Rolle aus `profiles`
- `has_permission(key)` — Prüft `role_permissions`
- `change_client_status(uuid, text)` — Statuswechsel mit Audit
- `list_clients_for_tenant()` — Mandantenfilter + Berechtigung

## Sicherheit

- RLS auf **allen** Tabellen aktiviert
- Kein `service_role` im Frontend
- Policies nutzen `auth.uid()` und `tenant_id`
- Feingranulare Rechte über `role_permissions` (synchron mit App WP 009)

## Hinweis

Keine destruktiven Befehle (`DROP TABLE`, `TRUNCATE`, `DELETE`) in diesen Migrationen.
