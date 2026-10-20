# B.1d Abschlussbericht — Permission Release-Paket, Git-Tracking, Migration-Deploy-Readiness

**Datum:** 2026-06-20  
**Branch:** `main` (uncommitted Working Tree)  
**Scope:** Gruppe B.1d — Release-Readiness nach B.1/B.1b/B.1c: Git-Tracking-Matrix, Migration-0154-Review, Owner/Admin-Live-Rollen, Runtime-Truth, Deploy-Plan (Dokumentation), Typecheck/Tests. **Kein** git add/commit/push, **kein** `supabase db push`, **kein** B.2.

---

## 1. Executive Summary

B.1d schließt das **Release-Paket** für die B.1-Permission-Lieferung ab: Git-Status, Migration-Deploy-Readiness, Live-Rollen-Lücke und Runtime-Pfade sind verifiziert.

| Befund | Status |
|--------|--------|
| `staticRolePermissions.ts` tracked | 🔴 **Nein** — `??` untracked, nicht in `HEAD` |
| Migration `0154_sync_b1_permission_keys.sql` tracked | 🔴 **Nein** — `??` untracked |
| Migration 0154 syntaktisch / schema-konform | ✅ INSERT-only, `ON CONFLICT DO NOTHING`, kein DROP/TRUNCATE/destructive DELETE |
| Unique B.1-Keys in Migration 0154 | ✅ **37** Keys (Regex-verifiziert), 99 role-permission-Zeilen |
| `office.invoices.create` in Migration | ✅ `business_admin`, `business_manager`, `billing` |
| CareSuite+-Rollen in 0154 | ✅ 8 Rollen (`business_admin` … `employee_portal`) |
| Live-Rollen (`owner`, `admin`, …) in 0154 | 🟡 **Bewusst deferred** — Pattern aus 0096/0121/0083 nicht angewendet |
| Service-Gates (P0) | ✅ statischer Pfad wirksam |
| Typecheck | **713** Fehler (Δ 0 vs. B.1/B.1b/B.1c) |
| Permission-Tests | ✅ **8/8** grün |
| **Commit-ready?** | ❌ **Nein** — P0: untracked Pflichtdateien |

**B.1d Codeänderungen:** Nur dieser Bericht + Audit-Logs (`.audit-typecheck-b1d.log`, `.audit-test-b1d-permissions.log`). Keine Migration-/Code-Fixes (0154 syntaktisch korrekt).

---

## 2. Git-/Tracking-Matrix (Phase 1)

**Branch:** `main` | **Remote-Push in B.1d:** nicht ausgeführt

### Pflichtdateien (B.1 + B.1c + B.1d)

| Datei | Git-Status | `git ls-files` | `check-ignore` | Tracked? | Commit-Ready? | Risiko |
|-------|------------|----------------|----------------|----------|---------------|--------|
| `src/lib/permissions/staticRolePermissions.ts` | `??` | *(leer)* | *(nicht ignoriert)* | ❌ | ❌ **Muss gestaged werden** | 🔴 P0 Deploy-Blocker |
| `supabase/migrations/0154_sync_b1_permission_keys.sql` | `??` | *(leer)* | *(nicht ignoriert)* | ❌ | ❌ **Muss gestaged werden** | 🟠 DB-Sync |
| `src/types/permissions/index.ts` | `M` | ✅ | — | ✅ | ✅ | OK |
| `src/lib/permissions/check.ts` | `M` | ✅ | — | ✅ | ✅ | Import-Pfad |
| `src/lib/permissions/index.ts` | `M` | ✅ | — | ✅ | ✅ | Barrel re-export |
| `src/lib/clients/clientIntakeService.ts` | `M` | ✅ | — | ✅ | ✅ | P0 Gate |
| `src/hooks/useClientIntakeWizard.ts` | `M` | ✅ | — | ✅ | ✅ | `actorRoleKey` |
| `src/lib/portal/clientProfileService.ts` | `M` | ✅ | — | ✅ | ✅ | P0 Gate |
| `src/lib/office/invoiceCreateService.ts` | `M` | ✅ | — | ✅ | ✅ | `office.invoices.create` |
| `app/portal/relative/_layout.tsx` | `M` | ✅ | — | ✅ | ✅ | Portal-Guard |
| `docs/audit/B1-permission-p0-abschlussbericht.md` | `??` | *(leer)* | — | ❌ | ⚠️ optional | Dokumentation |
| `docs/audit/B1b-permission-runtime-sync-abschlussbericht.md` | `??` | *(leer)* | — | ❌ | ⚠️ optional | Dokumentation |
| `docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md` | `??` | *(leer)* | — | ❌ | ⚠️ optional | Dokumentation |
| `docs/audit/B1d-release-readiness-abschlussbericht.md` | `??` (neu) | *(leer)* | — | ❌ | ⚠️ optional | Dieser Bericht |

### Verifikationsbefehle (ausgeführt, kein Stage/Commit)

```text
git status --short          → sehr großer WT; B.1-Pflichtdateien s. Tabelle
git ls-files staticRolePermissions.ts → (leer) = nicht tracked
git ls-files 0154…sql       → (leer) = nicht tracked
git show HEAD:…staticRolePermissions.ts → fatal: not in 'HEAD'
git check-ignore -v …       → (leer) = Dateien nicht in .gitignore
```

### B.1-Pfad Diff-Statistik (tracked modified only)

```text
 app/portal/relative/_layout.tsx        |  19 +++---
 src/hooks/useClientIntakeWizard.ts     | 122 +++++++++++++++++++++++++++++----
 src/lib/clients/clientIntakeService.ts | 104 +++++++++++++++++++++++++---
 src/lib/office/invoiceCreateService.ts |   2 +-
 src/lib/permissions/check.ts           |   2 +-
 src/lib/permissions/index.ts           |   6 ++
 src/lib/portal/clientProfileService.ts |  35 ++++++++--
 src/types/permissions/index.ts         |  49 ++++++++++++-
 8 files changed, 299 insertions(+), 40 deletions(-)
```

`staticRolePermissions.ts` und `0154…sql` erscheinen **nicht** im Diff (untracked).

---

## 3. Migration 0154 — Prüfmatrix (20 Checkpoints, Phase 2)

**Pfad:** `supabase/migrations/0154_sync_b1_permission_keys.sql`  
**Vergleich:** `0094_office_broadcast_notifications.sql`, `0096_broadcast_rls_live_roles.sql`, `0121_csv_import_export.sql`, `0083_owner_clients_permissions_live.sql`

| # | Prüfpunkt | Ergebnis | Anmerkung |
|---|-----------|----------|-----------|
| 1 | Kein `DROP` | ✅ | — |
| 2 | Kein `TRUNCATE` | ✅ | — |
| 3 | Kein destructives `DELETE FROM` | ✅ | Nur Kommentar „Keine DELETE…“ |
| 4 | `INSERT … ON CONFLICT (role_id, permission_key) DO NOTHING` | ✅ | Wie 0094/0096/0121 |
| 5 | Idempotent bei Re-Apply | ✅ | ON CONFLICT DO NOTHING |
| 6 | Tenant-neutral (kein `tenant_id` in INSERT) | ✅ | Globale `role_permissions` |
| 7 | Schema-Ziel `public.role_permissions` | ✅ | Konsistent mit 0001 |
| 8 | Join `roles.key` via `WHERE r.key = …` | ✅ | CareSuite+-Pattern |
| 9 | `CROSS JOIN (VALUES …)` Pattern | ✅ | Wie 0094/0121 |
| 10 | `office.invoices.create` enthalten | ✅ | admin, manager, billing |
| 11 | `messages.broadcast.create` idempotent | ✅ | In allen relevanten CS+-Rollen |
| 12 | Unique PermissionKeys (B.1-Set) | ✅ | **37** Keys (Regex B.1d) |
| 13 | Role-Permission-Zeilen gesamt | ✅ | **99** INSERT-Versuche |
| 14 | `business_admin` volle B.1-Matrix | ✅ | 33 Keys inkl. `connect.configure` |
| 15 | `business_manager` ohne `connect.configure` | ✅ | 32 Keys |
| 16 | Least-Privilege-Subset-Rollen | ✅ | billing, dispatch, nurse, caregiver, counselor |
| 17 | `employee_portal` Portal-Keys | ✅ | 4 Keys |
| 18 | Live-Rollen (`owner`, `admin`, …) | 🟡 **Nicht enthalten** | Bewusst deferred (s. §4) |
| 19 | RLS-/Schema-Änderungen | ✅ Keine | Scope-konform |
| 20 | SQL-Syntax | ✅ | Kein Fix nötig |

### Unique Keys in 0154 (37)

`connect.view`, `connect.configure`, `inventory.*` (7), `messages.broadcast.create`, `geo.*` (4), `office.recruiting.*` (5), `office.employees.compliance.*` (2), `office.employees.absences.*` (4), `office.appointments.edit`, `office.employees.hr.*` (3), `office.employee_time.*` (3), `office.invoices.create`, `portal.employee.*` (4).

**Hinweis Zählung:** B.1/B.1c dokumentieren teils „39 Keys“; operative Unique-Key-Anzahl in Migration und Regex-Prüfung ist **37** (konsistent mit B.1c-Detailtabelle Zeilen 1–37). Kein syntaktischer Mangel.

### Rollen-Zuordnung in 0154

| DB `roles.key` | Static `ROLE_PERMISSIONS` | Keys in 0154 |
|----------------|---------------------------|--------------|
| `business_admin` | `business_admin` | 33 |
| `business_manager` | `business_manager` | 32 |
| `billing` | `billing` | 8 |
| `dispatch` | `dispatch` | 15 |
| `nurse` | `nurse` | 4 |
| `caregiver` | `caregiver` | 2 |
| `counselor` | `counselor` | 1 |
| `employee_portal` | `employee_portal` | 4 |

---

## 4. Owner/Admin — Rollen-Sync-Matrix (Phase 3)

### TypeScript `RoleKey` (`src/types/core/auth.ts`)

Nur **11 CareSuite+-Keys:** `business_admin`, `business_manager`, `billing`, `dispatch`, `nurse`, `caregiver`, `counselor`, `akademie_admin`, `employee_portal`, `client_portal`, `family_portal`.

**Nicht** im TS-Union: `owner`, `admin`, `management`, `office`, `planning`, `geschaeftsfuehrung`, `tenant_owner`, `super_admin`.

### Canonical → Runtime-Mapping (`workspaceRoles.ts` + `tenantService.parseRoleKey`)

| Live-/Canonical DB `roles.key` | `mapsToRoleKey` (App-Runtime) | In `ROLE_PERMISSIONS` | In Migration 0154 | In Live-Migrationen (Beispiel) |
|--------------------------------|-------------------------------|---------------------|-------------------|--------------------------------|
| `owner` | `business_admin` | ✅ (via Mapping) | ❌ | ✅ 0083, 0096, 0121 (subset) |
| `admin` | `business_admin` | ✅ (via Mapping) | ❌ | ✅ 0083, 0096, 0121 |
| `management` | `business_manager` | ✅ (via Mapping) | ❌ | ✅ 0083, 0096, 0121 |
| `geschaeftsfuehrung` | — (nicht in workspaceRoles) | ⚠️ Fallback `business_admin` | ❌ | ✅ 0083, 0121 |
| `office` | `business_manager` | ✅ (via Mapping) | ❌ | ✅ 0121 (CSV subset) |
| `planning` | — | ⚠️ | ❌ | ✅ 0096 (broadcast only), 0121 (CSV subset) |
| `business_admin` | `business_admin` | ✅ | ✅ 0154 | ✅ |
| `business_manager` | `business_manager` | ✅ | ✅ 0154 | ✅ |

### Drei Ebenen der Wahrheit für Live-Nutzer (z. B. `owner`)

| Ebene | Mechanismus | B.1-Keys nach 0154-Apply |
|-------|-------------|--------------------------|
| **Service** `enforcePermission` | `getPermissionsForRole(mapped RoleKey)` — Profil mappt `owner`→`business_admin` | ✅ statisch |
| **UI** `usePermissions` | `fetchRuntimePermissions('business_admin', …)` — mapped Key | ✅ DB für `business_admin`-Zeile |
| **RLS** `has_permission()` | `profiles.role_id` → **tatsächliche** DB-Rolle `owner` | ❌ **Lücke** — `owner` hat nur Legacy-Seeds (0083, 0096 broadcast, …), nicht B.1-Vollmatrix |

**B.1d-Entscheidung:** Migration 0154 ist **deploy-ready für CareSuite+-Canonical-Rollen**. Live-Rollen-Mapping (0155 o. ä., Pattern 0096/0121) ist **bewusst out of scope** — dokumentiert, kein Blocker für ersten Commit, aber **Blocker für vollständige Prod-RLS-Parität** für `owner`/`admin`.

---

## 5. Runtime-Truth-Matrix (Phase 4)

```
┌──────────────────────────────────────────────────────────────────┐
│ enforcePermission / hasPermission (Service-Layer)                │
│ check.ts → getPermissionsForRole(staticRolePermissions)          │
│ IMMER statisch; actorRoleKey meist mapped RoleKey aus Profil     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ usePermissions / RequirePermission (UI)                          │
│ Demo: getPermissionsForRole(static)                              │
│ Supabase: fetchRuntimePermissions → role_permissions DB          │
│           (+ role_permission_sets Tenant-Override)               │
│           Fallback static wenn DB leer                           │
│ Profil-RoleKey bereits gemappt (owner→business_admin)            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Postgres RLS has_permission(p_key)                               │
│ profiles.role_id → role_permissions der ECHTEN DB-Rolle          │
│ Kein Canonical-Mapping in SQL                                    │
└──────────────────────────────────────────────────────────────────┘
```

| Komponente | Datei | Pfad | B.1-Keys |
|------------|-------|------|----------|
| Definition | `staticRolePermissions.ts` | Statisch | ✅ 37 unique B.1-Keys in Matrix |
| Check | `check.ts` | → `getPermissionsForRole` | ✅ |
| Enforce | `enforce.ts` | → `permissionError` → `check` | ✅ P0 Services |
| Barrel | `permissions/index.ts` | re-export | ✅ |
| UI Hook | `usePermissions.ts` | Demo static / Supabase DB | ⚠️ DB nach 0154 für CS+-Keys |
| Repository | `permissionRepository.ts` | `fetchRuntimePermissions` | ⚠️ DB-first, static fallback |
| Profil-Mapping | `tenantService.parseRoleKey` | Live→Canonical | ✅ owner→business_admin |
| RLS | `0076` `has_permission()` | DB role_id | ⚠️ Live-Rollen ohne 0154 |

**Kein doppeltes `ROLE_PERMISSIONS`-Objekt** — eine Definition, drei Auflösungspfade (Service/UI/RLS).

---

## 6. Deploy-Plan (Phase 5 — Dokumentation only, NICHT ausgeführt)

### Preconditions

- [ ] Git-Commit mit `staticRolePermissions.ts` + `0154…sql` + B.1-P0-Diffs (s. §8)
- [ ] Review-Freigabe durch Release Owner
- [ ] Backup/Snapshot der Ziel-DB (Standard-Prozedur)
- [ ] Kein paralleles B.2/B.3-Deploy

### Lokale Verifikation (vor Remote)

```bash
npm run typecheck                    # Baseline 713 — kein Δ erwartet
npm test -- src/__tests__/core/permissions.test.ts \
           src/__tests__/portal/clientPortalProfileLive.test.ts   # 8/8
# Optional: supabase db reset + migration apply lokal (nicht in B.1d ausgeführt)
```

### Remote nach Freigabe (manuell)

1. `supabase db push` **oder** SQL Editor: nur `0154_sync_b1_permission_keys.sql`
2. **Nicht** automatisch in CI ohne explizite Freigabe

### Verifikations-Queries (Post-Apply)

```sql
-- Anzahl neuer B.1-Keys für business_admin (erwartet: 33 Zeilen für B.1-Subset)
SELECT COUNT(DISTINCT rp.permission_key)
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE r.key = 'business_admin'
  AND rp.permission_key LIKE 'office.invoices.%';

-- office.invoices.create für billing
SELECT r.key, rp.permission_key
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE rp.permission_key = 'office.invoices.create';

-- Live-Rolle owner: B.1-Lücke sichtbar (erwartet: KEIN connect.view o. ä.)
SELECT COUNT(*) FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE r.key = 'owner' AND rp.permission_key = 'office.invoices.create';
```

### Rollback / Recovery

- Migration ist **INSERT-only** mit `ON CONFLICT DO NOTHING`
- **Kein** automatischer Rollback-Script in 0154
- Recovery: gezieltes `DELETE` nur mit separatem Change-Ticket (out of scope; nicht empfohlen ohne Audit)
- Re-Apply sicher (idempotent)

### Bewusst nach Deploy offen

- Live-Rollen B.1-Key-Sync (`owner`, `admin`, `management`, `office`, `planning`, `geschaeftsfuehrung`)
- Invoice-UI: `InvoicesListView` / `InvoiceCreateScreen` prüfen noch `office.invoices.view`
- B.2 `RequireProductAccess` auf `business/office`

---

## 7. Typecheck-/Test-Ergebnis (Phase 6)

### Typecheck (`.audit-typecheck-b1d.log`)

| Metrik | B.1c | B.1d | Δ |
|--------|------|------|---|
| Gesamt `error TS*` | 713 | **713** | **0** |
| Exit-Code | 2 | 2 | — |

### Tests (`.audit-test-b1d-permissions.log`)

```bash
npm test -- src/__tests__/core/permissions.test.ts \
           src/__tests__/portal/clientPortalProfileLive.test.ts
```

| Testdatei | Ergebnis |
|-----------|----------|
| `core/permissions.test.ts` | ✅ 3/3 |
| `portal/clientPortalProfileLive.test.ts` | ✅ 5/5 |
| **Gesamt** | ✅ **8/8** |

---

## 8. Commit-Paket (Phase 7 — Vorschlag only, NICHT ausgeführt)

### `git add` (Beispiele)

```bash
git add src/lib/permissions/staticRolePermissions.ts
git add supabase/migrations/0154_sync_b1_permission_keys.sql
git add src/types/permissions/index.ts
git add src/lib/permissions/check.ts
git add src/lib/permissions/index.ts
git add src/lib/clients/clientIntakeService.ts
git add src/hooks/useClientIntakeWizard.ts
git add src/lib/portal/clientProfileService.ts
git add src/lib/office/invoiceCreateService.ts
git add app/portal/relative/_layout.tsx
git add docs/audit/B1-permission-p0-abschlussbericht.md
git add docs/audit/B1b-permission-runtime-sync-abschlussbericht.md
git add docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md
git add docs/audit/B1d-release-readiness-abschlussbericht.md
```

**Nicht stagen:** `.audit-*.log`, `.expo-resolve-test/`, übrige WT-Artefakte.

### Commit-Message (Vorschlag)

```text
security(permission): sync B1 permission gates and DB keys
```

---

## 9. Geänderte Dateien in B.1d

| Datei | Änderung |
|-------|----------|
| `docs/audit/B1d-release-readiness-abschlussbericht.md` | **NEU** — dieser Bericht |
| `.audit-typecheck-b1d.log` | Typecheck-Log |
| `.audit-test-b1d-permissions.log` | Test-Log |

**Keine** Code-, Migrations- oder Test-Änderungen.

---

## 10. Commit-Checkliste

### Vor Commit (P0)

- [ ] `git add src/lib/permissions/staticRolePermissions.ts` — **Release-Blocker**
- [ ] `git add supabase/migrations/0154_sync_b1_permission_keys.sql`
- [ ] Alle B.1-P0-Diffs stagen (§8)
- [ ] Audit-Berichte B.1–B.1d optional stagen
- [ ] **Nicht** stagen: `.audit-*.log`, Build-Artefakte

### Nach Commit (vor DB-Deploy)

- [ ] Migration 0154 manuell auf Ziel-DB anwenden
- [ ] Smoke: `office.invoices.create` für `billing` / `business_admin` in DB
- [ ] Smoke: P0 Service-Gates (Intake, Portal, Invoice)
- [ ] Prod-Owner (`owner`-Rolle): RLS-Smoke — erwartete Lücke bis Live-Rollen-Migration

### Bewusst offen

- [ ] Live-Rollen B.1-Key-Migration (Nachfolger zu 0154)
- [ ] B.2 — `RequireProductAccess`
- [ ] Invoice-UI `.create`-Gate
- [ ] 713 TS-Fehler (außerhalb Scope)

---

## 11. Return-Checklist / Anhang

| Frage | Antwort |
|-------|---------|
| **Commit-ready?** | ❌ **Nein** — Blocker: `staticRolePermissions.ts` + `0154…sql` untracked |
| **staticRolePermissions tracked?** | ❌ Untracked, `fatal: … not in 'HEAD'` |
| **Migration 0154 deploy-ready?** | ✅ **Ja** (syntax, idempotent, CS+-Rollen) — Apply manuell nach Commit |
| **Owner/Admin-Status** | 🟡 App mappt `owner`/`admin`→`business_admin`; **RLS** nutzt echte DB-Rolle ohne B.1-Keys in 0154 |
| **Typecheck** | **713** (Δ 0) |
| **Tests** | **8/8** grün |
| **Report-Pfad** | `docs/audit/B1d-release-readiness-abschlussbericht.md` |
| **B.1d Dateiänderungen** | Bericht + Audit-Logs only |

### Blocker-Zusammenfassung

1. **P0 Git:** `staticRolePermissions.ts` nicht in `HEAD` — Clone/CI bricht ohne Datei.
2. **P0 Git:** Migration `0154` untracked — DB-Sync nicht versioniert.
3. **P1 Prod-RLS:** Live-Rollen (`owner`, `admin`, …) ohne B.1-Keys in DB — separater Migrationsschritt nach 0154.

**Nächster Schritt:** Commit der Pflichtdateien (§8) → manuelles Apply von 0154 → Planung Live-Rollen-Migration.
