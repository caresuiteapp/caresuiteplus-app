# CareSuite+ — Rollen & Rechte (Arbeitspaket 009)

## Berechtigungsmodell

| Permission Key | Beschreibung |
|----------------|--------------|
| `office.clients.view` | Liste und Detail lesen |
| `office.clients.create` | Anlegen via Wizard |
| `office.clients.edit` | Stammdaten bearbeiten |
| `office.clients.status_change` | Workflow-Status ändern |
| `office.clients.archive` | Archivieren |
| `office.clients.view_sensitive` | Gesundheits-/Schutzdaten sehen |
| `office.clients.manage_consents` | Portal-Freigaben verwalten |

## Rollenmatrix (Office / Klient:innen)

| Rolle | Lesen | Anlegen | Bearbeiten | Status | Sensibel |
|-------|-------|---------|------------|--------|----------|
| Geschäftsführung / Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bereichsleitung | ✓ | ✓ | ✓ | ✓ | ✓ |
| Abrechnung | ✓ | — | — | — | ✓ |
| Einsatzplanung | ✓ | — | — | — | ✓ |
| Pflegefachkraft | ✓ | — | — | — | ✓ |
| Alltagsbegleiter:in | ✓ | — | — | — | — |
| Beratungskraft | ✓ | — | — | — | ✓ |
| Portale | — | — | — | — | — |

## Implementierung

```
usePermissions() → can('office.clients.create')
PermissionGate / RequirePermission / LockedActionBanner
enforcePermission() in Office-Services
checkRoleAccess() + Prefix-Match für /office/*
```

## UI-Verhalten

- **Lesemodus:** Banner + „nur Lesen" im Untertitel
- **Gesperrte Aktionen:** `LockedActionBanner` mit deutscher Begründung
- **Create-Route:** `RequirePermission` auf `/office/clients/create`
- **Tabs:** Freigaben/Aktionen nur bei passender Berechtigung sichtbar
