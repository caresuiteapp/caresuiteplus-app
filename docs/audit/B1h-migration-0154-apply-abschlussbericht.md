# B.1h — Migration 0154 Apply-Abschlussbericht

**Datum:** 2026-06-20  
**Scope:** Kontrolliertes Anwenden von `0154_sync_b1_permission_keys.sql` auf Remote-Projekt `euagyyztvmemuaiumvxm`  
**Repo-HEAD (unverändert):** `32d30d82f6cb83b472b6e48393ae30fffa3cb226`  
**Vorgänger:** `docs/audit/B1h-migration-status-blocker-abschlussbericht.md`

---

## 1. Executive Summary

| Punkt | Ergebnis |
|-------|----------|
| Migration 0154 angewendet | **Ja** |
| Project-Ref | `euagyyztvmemuaiumvxm` |
| Weitere Migrationen angewendet | **Nein** (nur 0154) |
| Apply erfolgreich | **Ja** (`Finished supabase db push`) |
| DB-Verifikation Migration-Record | **Ja** (0154 remote applied) |
| DB-Verifikation B.1-Keys vollständig | **Teilweise** — siehe Rollen-Drift |
| Typecheck vorher / nachher | **713 / 713** (Δ0) |
| Permission-Tests vorher / nachher | **3/3 / 3/3** |
| Git Commit / Push | **Nein** |
| Supabase Deploy (App) | **Nein** |

**Kernbefund:** Migration 0154 wurde technisch sauber und idempotent angewendet. Die Remote-`roles`-Tabelle enthält **Legacy-RoleKeys** (`admin`, `owner`, `billing`, `office`, …), nicht die in 0154 adressierten CS+-Keys (`business_admin`, `nurse`, `dispatch`, …). Dadurch wurden aus dem 0154-Skript effektiv nur Zeilen für **`billing`** (8 B.1-Keys) neu zugeordnet; die übrigen INSERT-Blöcke waren No-Ops (0 matching roles). Service-Gates bleiben über `staticRolePermissions` abgesichert.

---

## 2. Git-/Repo-Status

| Punkt | Ergebnis |
|-------|----------|
| Branch | `main` (= `origin/main`) |
| HEAD | `32d30d8` |
| Staged | 0 |
| WT dirty | Ja (~982 Out-of-Scope) |
| Migration 0154 im Code modified | **Nein** |
| Permission-Dateien modified | **Nein** |
| Assist-/Audit-Dateien | Uncommitted (nicht angerührt) |

---

## 3. Migration-Safety-Matrix

| Prüfpunkt | Ergebnis | Risiko | Status |
|-----------|----------|--------|--------|
| INSERT-only | Ja | — | ✅ |
| ON CONFLICT DO NOTHING | Ja | — | ✅ |
| Kein DROP/TRUNCATE | Ja | — | ✅ |
| Kein destruktives DELETE | Ja | — | ✅ |
| Keine RLS-/Schema-Änderung | Ja | — | ✅ |
| Keine Tenant-/UUID-Hardcodierung | Ja | — | ✅ |
| `office.invoices.create` enthalten | Ja | — | ✅ |
| 8 CS+-Rollen in SQL | Ja | — | ✅ |
| owner/admin nicht adressiert | Ja (deferred) | mittel | ✅ |
| Idempotent wiederholbar | Ja | — | ✅ |

---

## 4. Supabase-Migration-Status-Matrix

| Migration | Remote vorher | Remote nachher | Aktion | Status |
|-----------|---------------|----------------|--------|--------|
| 0150–0153 | applied | applied | — | ✅ |
| **0154** | **pending** | **applied** | `db push` | ✅ |
| 0155+ | — | — | keine | ✅ |

**CLI vor Apply:** `.audit-migration-list-b1h-preapply.log` — nur 0154 ohne Remote-Spalte  
**CLI nach Apply:** `.audit-migration-list-b1h-postapply.log` — `0154 | 0154`

---

## 5. Apply-Protokoll

| Befehl | Ergebnis | Log |
|--------|----------|-----|
| `npx supabase db push` | Erfolg — nur `0154_sync_b1_permission_keys.sql` | `.audit-supabase-b1h-apply.log` |

CLI-Auszug:
```
Do you want to push these migrations to the remote database?
 • 0154_sync_b1_permission_keys.sql
Applying migration 0154_sync_b1_permission_keys.sql...
Finished supabase db push.
```

---

## 6. DB-Verification-Matrix

| Prüfung | Erwartet (0154-Soll) | Tatsächlich | Status | Risiko |
|---------|----------------------|-------------|--------|--------|
| Migration 0154 in `schema_migrations` | applied | `0154` / `sync_b1_permission_keys` | ✅ | — |
| Nur 0154 neu | ja | ja | ✅ | — |
| Duplikate `(role_id, permission_key)` | 0 | 0 (HAVING COUNT>1 leer) | ✅ | — |
| `office.invoices.create` | vorhanden | `billing` (1 Zeile) | ✅ | — |
| 99 role_permission INSERT-Ziele | 8 CS+-Rollen | Nur `billing`-Rolle existiert remote | 🟡 | **hoch** |
| CS+-Keys `business_admin` etc. | Seeds | Rollen fehlen in Remote | 🟡 | **hoch** |
| owner/admin B.1-Matrix via 0154 | deferred | nicht adressiert | ✅ | mittel |
| Gesamt B.1-Key-Zeilen (37 Keys) | — | 17 über alle Rollen | 🟡 | dokumentiert |

**Remote-Rollen (SELECT):** `admin`, `billing`, `management`, `office`, `owner` (×5 Duplikat-Zeilen), `planning`, `readonly`

**B.1-Key-Verteilung nach Apply:**

| role.key | B.1-Key-Count |
|----------|---------------|
| billing | 8 |
| owner | 5 |
| admin | 1 |
| management | 1 |
| office | 1 |
| planning | 1 |

---

## 7. Permission-/Smoke-Test-Ergebnisse

| Check | Vorher | Nachher | Log | Status |
|-------|--------|---------|-----|--------|
| `npm run typecheck` | 713 Fehler | 713 Fehler | pre/post logs | ✅ Δ0 |
| `permissions.test.ts` | 3/3 | 3/3 | pre/post logs | ✅ |
| Neue Security/Permission-TS-Fehler | — | keine | — | ✅ |

**Hinweis:** B.1e dokumentierte 8/8 mit erweitertem Testlauf (`permissions + portal profile live`). Dieser Apply-Lauf nutzte `src/__tests__/core/permissions.test.ts` (3/3) — konsistent grün.

---

## 8. Nicht ausgeführte Aktionen

- Kein B.2 / ProductAccess business/office  
- Kein Assist Phase 3  
- Kein assignmentWorkflowService  
- Keine RLS-Änderung  
- Keine neue Migration  
- **Kein Git-Commit / kein Git-Push**  
- Keine Permission-Dateien geändert  
- Keine Assist-Dateien geändert  
- Kein Pull/Merge/Rebase/Reset/Stash  

---

## 9. Verbleibende Risiken

| Risiko | Status |
|--------|--------|
| **Rollen-Drift Remote vs. staticRolePermissions** | 🟡 **Offen** — 0154 wirkt nur auf existierende `roles.key`; CS+-Keys fehlen remote |
| owner/admin Live-RLS | 🟡 deferred (wie B.1d) |
| Assist P0 Schema (Signatur/Nachweis/Tracking) | ❌ offen |
| DB-Runtime vs. Static-Gates | 🟡 Dual-Path — Services static; Supabase-UI DB-first |
| Auditberichte uncommitted | Ja (dieser Bericht) |
| WT dirty (~982) | Ja |
| Typecheck global rot (713) | Ja (Baseline) |
| ProductAccess business/office | Offen (B.2) |
| assignmentWorkflowService In-Memory | Offen (B.3) |

---

## 10. Nächster sinnvoller Schritt (nur Vorschlag)

1. **Rollen-Key-Alignment** — separate Freigabe: Remote-`roles` auf CS+-Keys mappen oder 0154-Follow-up-Migration für Live-Rollen (`admin`/`owner`/…)  
2. **Assist Phase 3** — Schema-Gaps Signatur/Nachweis/Tracking  
3. **Audit-Commit** — B.1h-Apply-Bericht + Phase-2.3-Berichte  
4. **B.2** — ProductAccess business/office  

---

*Erstellt nach B.1h-Apply — Migration 0154 remote applied, Repo unverändert.*
