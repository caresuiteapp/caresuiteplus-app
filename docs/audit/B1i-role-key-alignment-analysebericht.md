# B.1i — Rollen-Key-Alignment Remote ↔ CareSuite+ Analysebericht

**Datum:** 2026-06-20  
**Scope:** Read-only Analyse (keine DB-/Code-Änderungen)  
**Project-Ref:** `euagyyztvmemuaiumvxm`  
**Repo-HEAD:** `32d30d82f6cb83b472b6e48393ae30fffa3cb226` (= `origin/main`)  
**Vorgänger:** `docs/audit/B1h-migration-0154-apply-abschlussbericht.md`

---

## 1. Executive Summary

### Kernbefund

CareSuite+ betreibt **drei parallele Rollen-Vokabulare**, die nicht vollständig synchronisiert sind:

| Ebene | Vokabular | Beispiele |
|-------|-----------|-----------|
| **Code / Static** | `RoleKey` (CS+) | `business_admin`, `nurse`, `dispatch`, `billing` |
| **Workspace-Mapping** | `CanonicalWorkspaceRoleKey` → `RoleKey` | `owner`→`business_admin`, `admin`→`business_admin`, `dispatch`→`dispatch` |
| **Remote DB** | Tenant-scoped `roles.key` (Legacy/Live) | `owner`, `admin`, `billing`, `planning`, `office`, `management`, `readonly` |
| **Access-UI** | `InternalRoleKey` | `owner`, `dispatcher`, `pdl`, `team_lead`, … |

**Remote enthält 0 CS+-RoleKeys** (`business_admin`, `nurse`, …). Migration **0154** adressierte CS+-Keys → **7/8 INSERT-Blöcke No-Op**. Nur **`billing`** (Key-Kollision) erhielt B.1-PermissionKeys inkl. `office.invoices.create`.

**Service-Security:** weiterhin **abgesichert** über `staticRolePermissions` + `enforcePermission` in Services (static-first).

**DB/RLS-Security:** **teilweise drift** — `has_permission()` liest `profiles.role_id` → `role_permissions`; Live-Nutzer haben Legacy-Rollen (`owner`: 6 Profile). Owner/Admin erhalten Admin-Bypass über `is_tenant_admin()`, **nicht** automatisch alle B.1-Dot-Keys (z. B. `office.invoices.create` nur bei `billing`).

**DB/Static-Drift:** **kritisch für Admin-UI und RLS**, **nicht kritisch für static-gated Services** solange `RoleKey` im App-Layer korrekt gemappt wird.

### Empfehlung Kurz

| Frage | Antwort |
|-------|---------|
| **B.1j nötig?** | **Ja** — als **Mapping-/Seed-Migration-Plan** (nicht Umbenennung) |
| **Vor Assist Phase 3?** | **Parallel möglich** — Assist-P0-Schema (Signatur/Nachweis/Tracking) ist tenant-neutral; **B.1j sollte vor produktiver DB-Permission-UI und vor RLS-abhängigen Office-Flows** nachgezogen werden |
| **Bevorzugte Strategie** | **Option C + A:** Legacy-Rollen remote führend lassen; **0155-Seed mit Legacy-Keys** + **`workspaceRoles`-Mapping** als Single Source für Code↔DB |

---

## 2. Git-/Kontext-Status

| Punkt | Ergebnis |
|-------|----------|
| Branch | `main` (= `origin/main`) |
| HEAD | `32d30d8` |
| Staged | 0 |
| WT dirty | Ja (~982 Out-of-Scope) |
| Migration 0154 modified | **Nein** |
| Permission-Dateien modified | **Nein** |
| B.1h-/Assist-Berichte | Uncommitted |

---

## 3. 0154-Wirkungsmatrix (Rollen-Blöcke)

Migration 0154 definiert **8 Zielrollen** (CS+ `roles.key`), **37 unique PermissionKeys**, **99 INSERT-Zeilen** (idempotent).

| Rolle laut 0154 | PermissionKeys (Anzahl) | Remote Rolle vorhanden? | Wirksam? | No-Op? | Risiko |
|-----------------|-------------------------|-------------------------|----------|--------|--------|
| `business_admin` | 33 | **Nein** (0 Zeilen) | Nein | **Ja** | hoch — Admin-Matrix fehlt in DB |
| `business_manager` | 32 | **Nein** | Nein | **Ja** | hoch |
| `billing` | 8 | **Ja** (tenant-scoped) | **Ja** | Nein | niedrig — einziger Treffer |
| `dispatch` | 15 | **Nein** (`planning` statt `dispatch`) | Nein | **Ja** | hoch |
| `nurse` | 4 | **Nein** | Nein | **Ja** | mittel |
| `caregiver` | 2 | **Nein** | Nein | **Ja** | mittel |
| `counselor` | 1 | **Nein** | Nein | **Ja** | mittel |
| `employee_portal` | 4 | **Nein** | Nein | **Ja** | mittel |

**owner/admin:** bewusst **nicht** in 0154 (B.1d deferred) — RLS nutzt `is_tenant_admin()` mit Legacy-Keys.

### B.1-Keys nach Apply (Remote, aggregiert)

| PermissionKey (Auswahl) | In DB für Rolle |
|-------------------------|-----------------|
| `office.invoices.create` | **billing** only |
| `connect.view` | billing (+ area-legacy keys) |
| `geo.live_tracking` | **nicht** in Dot-Keys remote (dispatch-Block No-Op) |
| `portal.employee.hr.view` | **nicht** geseedet (employee_portal No-Op) |

**Duplikate:** `(role_id, permission_key)` — **0** Duplikate (UNIQUE OK).

---

## 4. Code-Rollen-Matrix

### 4.1 `RoleKey` (Union) — `src/types/core/auth.ts`

| Rollen-Key | staticRolePermissions | Typische Verwendung |
|------------|----------------------|---------------------|
| `business_admin` | ✅ Vollmatrix | UI-Fallback, Services, Tests |
| `business_manager` | ✅ | Services |
| `billing` | ✅ | Services, Abrechnung |
| `dispatch` | ✅ | Einsatzplanung |
| `nurse` | ✅ | Feld/Assist |
| `caregiver` | ✅ | Feld/Assist |
| `counselor` | ✅ | Beratung |
| `akademie_admin` | ✅ | Akademie |
| `employee_portal` | ✅ | MA-Portal |
| `client_portal` | ✅ | Klientenportal |
| `family_portal` | ✅ | Angehörigenportal |

**Guards:** `src/lib/permissions/check.ts` → **nur static** (`getPermissionsForRole`).

**Runtime-UI:** `fetchRuntimePermissions` (`permissionRepository.ts`) — DB-Lookup per `roles.key = roleKey` **ohne tenant_id** → bei Multi-Tenant-Legacy-Rollen **unzuverlässig**; Fallback static.

### 4.2 Workspace-Mapping — `src/lib/permissions/workspaceRoles.ts`

| Canonical (DB-nah) | mapsToRoleKey (CS+) |
|--------------------|---------------------|
| `owner` | `business_admin` |
| `admin` | `business_admin` |
| `management` | `business_manager` |
| `office` | `business_manager` |
| `dispatch` | `dispatch` |
| `billing` | `billing` |
| `planning` | **❌ fehlt** (Remote hat `planning`) |
| `employee` | `employee_portal` |
| `nurse` / `caregiver` / `consultant` | CS+ Keys |

### 4.3 InternalRoleKey — `src/lib/auth/auth.types.ts`

Separate UI-Liste: `owner`, `management`, `pdl`, `dispatcher`, `billing`, `readonly`, … — **nicht 1:1** mit DB `roles.key` (`admin`, `planning`).

---

## 5. Remote-Rollen-Matrix

**Struktur:** `roles` ist **tenant-scoped** (`tenant_id` NOT NULL in Live), nicht global wie in `0001_core_schema.sql` ursprünglich.

### 5.1 Distinct Remote-Rollen (11 Zeilen, 7 Keys)

| Remote-Key | Tenants | Profile (aktiv) | perm_count (Beispiel) | Legacy? | CS+? | Aktiv |
|------------|---------|-----------------|----------------------|---------|------|-------|
| `owner` | 5 | **6** (4 invited, 2 active) | 22–35 | ✅ | ❌ | **Ja** |
| `admin` | 1 | 0 | 35 | ✅ | ❌ | Seed |
| `billing` | 1 | 0 | 22 | ✅ | Key-Kollision | Seed |
| `management` | 1 | 0 | 35 | ✅ | ❌ | Seed |
| `office` | 1 | 0 | 23 | ✅ | ❌ | Seed |
| `planning` | 1 | 0 | 20 | ✅ | ❌ (≈ dispatch) | Seed |
| `readonly` | 1 | 0 | 13 | ✅ | ❌ | Seed |

**Pilot-Tenant** `a0805c4a-…` enthält vollständiges Legacy-Rollen-Set (admin, billing, management, office, owner, planning, readonly).

**CS+-Keys remote:** **0** (`business_admin`, `nurse`, … existieren nicht).

### 5.2 Nutzer-Realität

| Metrik | Wert |
|--------|------|
| Profile mit Rolle | 6 |
| Alle auf | `owner` |
| `role_permission_sets` (Tenant-Override) | **0 Zeilen** |

---

## 6. RLS-Rollen-Matrix

| Policy/Funktion | Rollenbezug | Legacy/CS+ | Risiko bei Mapping |
|-----------------|-------------|------------|-------------------|
| `has_permission(key)` | `profiles` → `role_permissions` | Dot-Keys + Area-Fallback | Umbenennung bricht Zuordnung |
| `is_tenant_admin()` | `r.key IN ('owner','admin','management','geschaeftsfuehrung')` OR `is_admin_role` | **Legacy** | CS+-Rename bricht Admin-Bypass |
| `has_permission('business.tenant.manage')` | OR-Shortcut → `is_tenant_admin()` | Legacy-Admin | OK für owner |
| Broadcast/CSV/Access RLS | Hardcoded `'owner','admin'` in Migrationen | Legacy | 0154 CS+-Seeds irrelevant |
| 0079/0080 Soft-Delete | `business_admin` **und** `owner,admin,management` | **Gemischt** | Zeigt historische Dualität |

**Fazit RLS:** **Legacy-first**. Umbenennung von `owner`/`admin` → `business_admin` würde **RLS brechen**, solange Policies nicht migriert werden.

---

## 7. Master-Rollen-Abgleichsmatrix

| Fachrolle | Code RoleKey | staticRole | DB Remote-Key | Workspace Canonical | RLS | 0154 | Status |
|-----------|--------------|------------|---------------|---------------------|-----|------|--------|
| Inhaber/GF | `business_admin` | ✅ | `owner` | `owner`→`business_admin` | `owner`+admin bypass | No-Op | **legacy-only (DB)** |
| Administrator | `business_admin` | ✅ | `admin` | `admin`→`business_admin` | Legacy | No-Op | **legacy-only** |
| Management | `business_manager` | ✅ | `management` | `management`→`business_manager` | Legacy admin | No-Op | **legacy-only** |
| Office/Verwaltung | `business_manager` | ✅ | `office` | `office`→`business_manager` | — | No-Op | **legacy-only** |
| Abrechnung | `billing` | ✅ | `billing` | `billing`→`billing` | — | **✅ wirksam** | **synchron (Key)** |
| Disposition | `dispatch` | ✅ | `planning`* | `dispatch`→`dispatch` | — | No-Op | **drift** (*planning unmapped) |
| Pflegefachkraft | `nurse` | ✅ | — | `nurse` | — | No-Op | **static-only** |
| Alltagsbegleitung | `caregiver` | ✅ | — | `caregiver` | — | No-Op | **static-only** |
| Beratung | `counselor` | ✅ | — | `consultant` | — | No-Op | **static-only** |
| MA-Portal | `employee_portal` | ✅ | — | `employee` | — | No-Op | **static-only** |
| Klient:innenportal | `client_portal` | ✅ | — | `client` | — | — | **static-only** |

---

## 8. Strategie-Matrix

| Option | Aufwand | Risiko | RLS-Risiko | Datenrisiko | Kurzfristig | Langfristig | Empfehlung |
|--------|---------|--------|------------|-------------|-------------|-------------|------------|
| **A — Legacy führend** | niedrig | mittel | **niedrig** | niedrig | ✅ | 🟡 | **Teil von B.1j** |
| **B — CS+ zusätzlich anlegen** | hoch | hoch | hoch | mittel | 🟡 | ✅ | Nur mit Migrationsplan |
| **C — Alias/Mapping-Tabelle** | mittel | **niedrig** | **niedrig** | niedrig | ✅ | ✅ | **Bevorzugt** |
| **D — Static führend, DB UI-only** | niedrig | mittel (UI falsch) | niedrig | niedrig | ✅ (Status quo) | ❌ | Übergang only |

### Empfohlene B.1j-Richtung (Plan only)

1. **Keine Rollen-Umbenennung** in Remote.
2. **Neue Migration 0155** (später, separate Freigabe): INSERT B.1-Keys für **Legacy-Keys** pro Tenant:
   - `owner`, `admin`, `management` → Admin-Subset aus static
   - `planning` → Dispatch-Subset (oder Alias `planning`→`dispatch` in Code)
   - `office`, `readonly` → dokumentierte Teilmengen
3. **Code:** `mapDbRoleKeyToRoleKey(dbKey)` zentral (erweitert `workspaceRoles` um `planning`, `readonly`, `admin`).
4. **`fetchRuntimePermissions`:** tenant-scoped role lookup (`tenant_id` + key oder role_id from profile).
5. **owner/admin:** eigener Block in 0155 oder bewusst weiter deferred mit RLS-Bypass-Dokumentation.

---

## 9. Empfehlung nächster Schritt

### B.1j — **Ja**, als **Rollen-Alignment-Migrationsplan** (noch nicht ausführen)

| Aspekt | Inhalt |
|--------|--------|
| **Vor Assist Phase 3?** | **Parallel OK** für reine Schema-Tabellen (Signatur/Nachweis/Tracking); **B.1j vor** produktiver Permission-Admin-UI und vor RLS-lastigen Office-Erweiterungen |
| **Betroffene Tabellen** | `roles`, `role_permissions`, optional neue `role_key_aliases`, `profiles` (read-only Analyse) |
| **Mapping-Pflicht** | `owner`/`admin`/`management`/`office`/`planning`/`billing`/`readonly` ↔ CS+ `RoleKey` |
| **Tests** | Permission-Tests + RLS-Smoke (owner invoice create, employee create, broadcast) |
| **Risiken bleiben** | owner ohne `office.invoices.create` in DB; Geo-Keys nicht geseedet; 6 Owner-Profile |

### Assist Phase 3

**Freigabe weiterhin möglich** für Schema-Gaps **ohne** Rollen-RLS-Umbau, solange neue Tabellen tenant-isoliert und RLS in separater Phase kommen.

---

## 10. Nicht ausgeführte Aktionen

- Keine DB-Daten geändert (nur SELECT)
- Keine Migration erstellt/geändert
- Keine RLS geändert
- Keine Rollen geändert
- Keine Permission-Dateien geändert
- Kein Commit / kein Push
- Kein B.2 / kein Assist Phase 3 Implement

---

## 11. Verbleibende Risiken

| Risiko | Schwere |
|--------|---------|
| DB/Static-Drift (0154 No-Ops) | **Hoch** (Admin-UI, RLS) |
| Service-Security static-first | **Niedrig** (weiterhin OK) |
| owner/admin deferred | **Mittel** |
| `planning` ohne Workspace-Mapping | **Mittel** |
| `fetchRuntimePermissions` ohne tenant filter | **Mittel** |
| Assist P0 Schema offen | Unverändert |
| WT dirty / uncommitted Berichte | Operativ |
| Typecheck 713 Baseline | Unverändert |

---

*Erstellt im Rahmen B.1i — reine Analyse, keine Reparatur.*
