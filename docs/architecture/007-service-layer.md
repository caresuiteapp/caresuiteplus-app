# CareSuite+ — Service-Schicht (Arbeitspaket 007)

## Architektur

```
Hooks (useClientList, useClientDetail, …)
  → src/lib/office/*Service.ts (Kompatibilitäts-Fassade)
    → clientService
      → demoClientRepository | supabaseClientRepository
```

## Modus-Umschaltung

| Modus | Bedingung | Repository |
|-------|-----------|------------|
| `demo` | `EXPO_PUBLIC_DEMO_MODE=true` oder keine Supabase-URL | `clientRepository.demo.ts` |
| `supabase` | URL + Anon-Key konfiguriert | `clientRepository.supabase.ts` (Stub → WP 010) |

## ClientService-API

| Methode | Beschreibung |
|---------|--------------|
| `list(tenantId)` | Klient:innen-Liste laden |
| `getById(tenantId, id)` | Detail laden |
| `create(tenantId, form)` | Anlegen |
| `update(tenantId, id, input)` | Stammdaten aktualisieren |
| `changeStatus(tenantId, id, status)` | Statuswechsel mit Validierung |
| `archive(tenantId, id)` | Archivieren (`archiviert`) |

## Querschnitt

- `runService()` — try/catch + optionale Latenz
- `assertTenant()` — Mandantenprüfung
- `SERVICE_ERRORS` — deutsche UI-Fehlermeldungen
- `workflow/clientStatus.ts` — erlaubte Übergänge zentral

## Sicherheit

- Kein `service_role`, keine Secrets im Frontend
- Nur `tenant_id`-basierte Mandantenisolation
