# CareSuite+ — Listenansicht (Arbeitspaket 004)

## Hauptliste

**Route:** `/office/clients`  
**Entität:** Klient:innen (`ClientListItem`)

## Funktionen

| Feature | Implementierung |
|---------|-----------------|
| Suche | Name, Ort, PLZ (`PremiumInput`) |
| Filter | Status-Chips (`FilterChipGroup`) |
| Sortierung | Name A–Z/Z–A, Ort A–Z |
| Pagination | 8 Einträge, „Weitere laden" |
| Pull-to-Refresh | `RefreshControl` |
| Zustände | Loading, Empty, Filter-Empty, Error, Success |

## Architektur

```
useClientList()
  → fetchClientList(tenantId)     [Service]
    → demoClients                 [Demo-Fallback]
  → filterBySearch / filterByField / sortItems / paginateItems
  → ClientsListScreen             [UI]
```

## Datenschutz

- `sensitivity`-Badge auf jeder Karte (Pflege/Gesundheit/Hochsensibel)
- `tenant_id` in Service-Prüfung

## Supabase-Vorbereitung

`fetchClientList` wird später ersetzt durch:
```sql
SELECT id, first_name, last_name, status, care_level, city, zip, sensitivity, updated_at
FROM clients
WHERE tenant_id = :tenant_id
-- RLS via profiles.tenant_id
```

## Bekannte Grenzen (nach WP 004)

- Detailansicht nur Platzhalter (→ WP 005)
- Anlegen nur Platzhalter (→ WP 006)
- Mitarbeitende/Rechnungen-Listen folgen später
