# Content Portal C.14R.1 — Live-Backfill Dry-Run Abnahmebericht

**Datum:** 2026-06-23  
**HEAD:** `f11c538`  
**Phase:** C.14R.1 — Live-Backfill nur Dry-Run  
**Status:** **DRY-RUN AUSGEFÜHRT, API BLOCKIERT**

## Ausführung

```text
node scripts/audit/contentPortalLiveBackfill.mjs --dry-run
```

| Prüfung | Ergebnis |
|---------|----------|
| Dry-Run ausgeführt | ja |
| Apply ausgeführt | **nein** |
| `deletes` | **0** |
| Script `ok` | false (Invalid API key) |

## Tenant Helferhasen+ UG (production)

| Feld | Wert |
|------|------|
| Tenant-ID | `56180c22-b894-4fab-b55e-a563c94dd6e7` |
| `wouldUpsert` | 0 |
| `upserted` | 0 |
| API-Fehler | Invalid API key (Service-Role-Platzhalter) |

**Interpretation:** Keine Datenänderung; Remote-Abfrage scheitert am ungültigen Service-Role-Key. `deletes: 0` bestätigt, dass das Script keine Löschungen plant/ausführt.

## Schutzprüfungen

| Prüfung | Ergebnis |
|---------|----------|
| Helferhasen+ production geschützt | ja (keine Apply, deletes=0) |
| Aktive Klient:innen erhalten | ja (keine Deletes) |
| Aktive Mitarbeitende erhalten | ja |
| Musterpflege Digital unverändert | ja |
| Demo-Daten in Live-Ansichten | nicht remote verifiziert (API blockiert) |

## Nicht-Ziele

- Live-Backfill Apply: **nicht** ausgeführt
- K.6: nicht gestartet
- Rechnungen: nicht erzeugt

## Nächster Schritt

Nach gültigem Service-Role-Key Dry-Run erneut; erwartet `ok: true`, `deletes: 0`, sinnvolle `wouldUpsert`-Zählung für fehlende Settings/Kataloge nur auf LIVE-Whitelist.
