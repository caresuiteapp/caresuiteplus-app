# B.1j — Legacy-Rollen-Alignment Abschlussbericht

**Datum:** 2026-06-20  
**Scope:** Workspace-Mapping + Migration 0155 vorbereiten (kein Apply)  
**Project-Ref:** `euagyyztvmemuaiumvxm`  
**Repo-HEAD:** `32d30d82f6cb83b472b6e48393ae30fffa3cb226` (= `origin/main`)  
**Vorgänger:** `docs/audit/B1i-role-key-alignment-analysebericht.md`

---

## 1. Executive Summary

| Punkt | Ergebnis |
|-------|----------|
| Workspace-Mapping `planning` | **Ergänzt** → `dispatch` |
| `mapLegacyRoleKeyToRoleKey` | **Neu** in `workspaceRoles.ts` |
| Migration 0155 erstellt | **Ja** — `0155_sync_legacy_role_permissions.sql` |
| DB verändert | **Nein** |
| 0155 angewendet | **Nein** |
| RLS geändert | **Nein** |
| staticRolePermissions geändert | **Nein** |
| Migration 0154 geändert | **Nein** |

**0155 synchronisiert B.1-PermissionKeys auf Legacy-Rollen:** `owner`, `admin`, `management`, `billing`, `planning`, `office`, `readonly` — idempotent, INSERT-only, tenant-übergreifend per `roles.key`.

**Kritische Lücke geschlossen (nach Apply):** `owner`/`admin` erhalten `office.invoices.create` (6 Live-Profile nutzen `owner`).

**Verbleibendes Risiko:** Static-Gates vs. DB bis **B.1k Apply**; `readonly` ohne CS+-RoleKey-Mapping im Code (nur DB-Seed).

---

## 2. Mapping-Matrix

| Legacy Role | CS+ RoleKey | Mapping vorher | Mapping nachher | Risiko | Status |
|-------------|-------------|----------------|-----------------|--------|--------|
| `owner` | `business_admin` | ✅ | ✅ | niedrig | OK |
| `admin` | `business_admin` | ✅ | ✅ | niedrig | OK |
| `management` | `business_manager` | ✅ | ✅ | niedrig | OK |
| `office` | `business_manager` | ✅ | ✅ | mittel (Static superset) | OK |
| `billing` | `billing` | ✅ | ✅ | niedrig | OK |
| `planning` | `dispatch` | **❌ fehlte** | **✅** | niedrig | **neu** |
| `dispatch` | `dispatch` | ✅ | ✅ (Alias-Label) | niedrig | OK |
| `readonly` | — | ❌ | ❌ (nur 0155-DB) | mittel | dokumentiert |

---

## 3. Remote-Delta-Matrix (Auswahl — vor 0155-Apply)

| Legacy Role | PermissionKey | vorhanden (Pre-0155) | fehlt | Aktion 0155 | Risiko |
|-------------|---------------|----------------------|-------|-------------|--------|
| `owner` | `office.invoices.create` | **Nein** | Ja | INSERT | **hoch** → Apply |
| `admin` | `office.invoices.create` | Nein | Ja | INSERT | hoch |
| `management` | `office.invoices.create` | Nein | Ja | INSERT | mittel |
| `billing` | `office.invoices.create` | **Ja** | — | idempotent | niedrig |
| `planning` | `geo.live_tracking` | Nein | Ja | INSERT | mittel |
| `office` | `office.invoices.create` | Nein | — (bewusst) | — | niedrig |
| `readonly` | B.1-View-Keys | teilweise | Ja | INSERT subset | niedrig |

---

## 4. 0155-Migrationsinhalt

| Legacy-Rolle | Quelle (0154-Block) | PermissionKeys | Zweck |
|--------------|---------------------|----------------|-------|
| `owner` | business_admin | 33 | GF/Admin-Voll-B.1 inkl. Invoice Create |
| `admin` | business_admin | 33 | wie owner |
| `management` | business_manager | 32 | Leitung ohne connect.configure |
| `billing` | billing | 8 | Abrechnung (idempotent) |
| `planning` | dispatch | 15 | Einsatzplanung/Geo |
| `office` | Office-Subset | 8 | Verwaltung ohne Vollrechte |
| `readonly` | View-Subset | 5 | Nur Leserechte |

**Idempotenz:** `ON CONFLICT (role_id, permission_key) DO NOTHING`  
**No-Op-Sicherheit:** Rolle fehlt → 0 Zeilen betroffen

---

## 5. Migration-Safety-Matrix

| Prüfpunkt | Ergebnis | Risiko | Status |
|-----------|----------|--------|--------|
| INSERT-only | Ja | — | ✅ |
| ON CONFLICT DO NOTHING | Ja | — | ✅ |
| Kein DELETE/DROP/TRUNCATE | Ja | — | ✅ |
| Keine CS+-Rollen erzwungen | Ja | — | ✅ |
| Keine RLS-Änderung | Ja | — | ✅ |
| Keine User/Profile-Änderung | Ja | — | ✅ |
| Keine Tenant-ID-Hardcodierung | Ja | — | ✅ |
| 0154 unverändert | Ja | — | ✅ |
| owner/admin invoice.create | Ja | — | ✅ |
| planning berücksichtigt | Ja | — | ✅ |
| office ohne Vollrechte | Ja | — | ✅ |

---

## 6. Typecheck/Test-Ergebnis

| Befehl | Ergebnis | Log | Neue Fehler in B.1j? |
|--------|----------|-----|----------------------|
| `npm run typecheck` | 713 Fehler (Baseline) | `.audit-typecheck-b1j.log` | **0** |
| `tenantBootstrap.test.ts` | 16/16 | `.audit-test-b1j-role-alignment.log` | — |
| `permissions.test.ts` | 3/3 | (selbe Log) | — |
| **Gesamt** | **19/19** | | ✅ |

---

## 7. Geänderte Dateien

| Datei | Änderung | Grund | Risiko |
|-------|----------|-------|--------|
| `src/types/permissions/workspace.ts` | +`planning` in CanonicalWorkspaceRoleKey | B.1i Gap | niedrig |
| `src/lib/permissions/workspaceRoles.ts` | +planning mapping, +`mapLegacyRoleKeyToRoleKey` | DB→Code | niedrig |
| `src/lib/permissions/index.ts` | Export | API | niedrig |
| `supabase/migrations/0155_sync_legacy_role_permissions.sql` | **neu** | Legacy B.1-Seed | mittel (bis Apply) |
| `src/__tests__/auth/tenantBootstrap.test.ts` | +2 Mapping-Assertions | Regression | niedrig |

---

## 8. Nicht ausgeführte Aktionen

- Keine DB-Daten geändert  
- **0155 nicht angewendet** / kein `supabase db push`  
- Keine RLS-Änderung  
- Keine Rollen umbenannt  
- Keine User/Profile/Tenant-Members geändert  
- `staticRolePermissions.ts` nicht geändert  
- Migration 0154 nicht geändert  
- Kein Commit / kein Push  
- Kein B.2 / keine Assist Phase 3  

---

## 9. Verbleibende Risiken

| Risiko | Status |
|--------|--------|
| 0155 noch nicht angewendet | **Offen** → B.1k |
| DB/Static-Drift bis Apply | **Offen** |
| owner invoice.create erst nach Apply | **Offen** |
| `readonly` ohne Code-RoleKey | **Dokumentiert** |
| Assist P0 Schema | Unverändert |
| Typecheck 713 Baseline | Unverändert |
| WT dirty / Berichte uncommitted | Operativ |

---

## 10. Nächster sinnvoller Schritt (nur Vorschlag)

1. **B.1k** — `0155_sync_legacy_role_permissions.sql` anwenden und verifizieren (owner/admin invoice.create, planning geo keys)  
2. **Audit-Commit** — B.1h/B.1i/B.1j Berichte + 0155  
3. **Assist Phase 3** — Schema-Gaps (parallel möglich, RLS separat)  
4. **Optional:** `readonly` → dedizierter RoleKey oder `parseRoleKey`-Fallback härten  

---

*Erstellt im Rahmen B.1j — Vorbereitung only, kein Remote-Apply.*
