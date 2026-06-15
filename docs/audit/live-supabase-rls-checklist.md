# Live Supabase RLS Checklist

Checkliste vor Remote-Pilot (manuell, nicht automatisiert verifiziert).

## Mandantenisolation

- [ ] Jede Tabelle mit `tenant_id UUID NOT NULL REFERENCES tenants(id)`
- [ ] RLS aktiviert (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Policies nutzen `public.current_tenant_id()` — kein `USING (true)`
- [ ] Kein `service_role` Key im Frontend (nur `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

## Auth & Profile

- [ ] `profiles.tenant_id` für jeden Pilot-User gesetzt
- [ ] Live-App: `EXPO_PUBLIC_DEMO_MODE=false`
- [ ] Login liefert Profil mit Mandant — `useServiceTenantId()` nicht null

## Storage

- [ ] Communication-Attachments: Bucket `communication-attachments`, Policies aus 0012
- [ ] Office-Dokuments: Bucket `office-documents`, Policies aus 0012
- [ ] Pfade enthalten `tenant/<tenant_id>/...`

## P0-Tabellen (Migrationen 0001–0014)

| Domain | Tabellen | Migration |
|--------|----------|-----------|
| Core | tenants, profiles, tenant_products | 0001, 0013 |
| Clients | clients, client_* extended | 0003, 0010 |
| Employees | employees | 0005 |
| Appointments/Invoices | appointments, invoices | 0006 |
| Assist | assignments, executions, … | 0007 |
| Communication | communication_* | 0011, 0012 |
| TI | ti_*, kim_*, ti_audit_events, ti_consents | 0009 |
| Templates/Catalogs | templates, catalog_entries, … | 0014 |

## Verboten in Migrationen

- Kein `DROP TABLE`, `TRUNCATE`, `DELETE FROM` auf Produktionsdaten
- `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` nur zur Policy-Aktualisierung (erlaubt)

## App-Verhalten Live

- [ ] `getServiceMode() === 'supabase'` → Supabase-Repos, kein Demo-Store
- [ ] Fehlender Mandant → deutsche Fehlermeldung, kein `DEMO_TENANT_ID`-Fallback
- [ ] TI ohne Provider → `provider_required`-Fehler, kein MockKIMProvider
- [ ] Upload/PDF/QR → echter Fehler bei Fehlschlag, kein Fake-Success

## Verifikation (Remote)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npm run typecheck && npm run test && npm run smoke
```

**Verdict ohne Remote-Test:** vorbereitet, nicht remote verifiziert.
