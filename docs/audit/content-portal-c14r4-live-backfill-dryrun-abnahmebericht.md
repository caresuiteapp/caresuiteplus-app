# Content Portal C.14R.4 — Live-Backfill Dry-Run Abnahmebericht

**Datum:** 2026-06-23  
**Phase:** C.14R.4 — Live-Backfill nur Dry-Run nach 0163  
**Status:** **GRÜN (Dry-Run only)**

## Ausführung

```text
node scripts/audit/contentPortalLiveBackfill.mjs --dry-run
```

| Feld | Wert |
|------|------|
| `ok` | **true** |
| `dryRun` | true |
| `deletes` | **0** |
| Apply ausgeführt | **nein** |

## Tenant Helferhasen+ UG (production)

| Feld | Wert |
|------|------|
| Tenant-ID | `56180c22-b894-4fab-b55e-a563c94dd6e7` |
| `clientsBefore` | 19 |
| `activeClients` | 12 |
| `wouldUpsert` | 12 (Portal-Settings-Grundlagen, Dry-Run) |
| `upserted` | 0 |

**Interpretation:** Nach 0163 kann `service_role` `clients` lesen. Dry-Run würde fehlende Portal-Settings ergänzen, ohne Deletes.

## Schutzprüfungen

| Prüfung | Ergebnis |
|---------|----------|
| Deletes = 0 | ja |
| Helferhasen+ production | geschützt (kein Apply) |
| Aktive Klient:innen erhalten | ja |
| Aktive Mitarbeitende erhalten | ja |
| Musterpflege Digital | nicht verändert |
| Demo-Daten in Live-Ansichten | nicht eingefügt (kein Apply) |

## Apply

Live-Backfill Apply bleibt für separaten Folgeprompt gesperrt.
