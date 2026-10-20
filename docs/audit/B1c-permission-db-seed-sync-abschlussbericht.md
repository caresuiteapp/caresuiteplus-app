# B.1c Abschlussbericht — Permission DB-/Seed-Sync + Commit-Readiness

**Datum:** 2026-06-20  
**Branch:** `main` (uncommitted Working Tree)  
**Scope:** Gruppe B.1c — DB-Sync der 39 B.1-PermissionKeys, Commit-Readiness nach B.1/B.1b, Typecheck/Tests. Kein Commit, kein git add, kein remote push.

---

## 1. Executive Summary

B.1c schließt die **DB-Runtime-Lücke** zwischen statischer `ROLE_PERMISSIONS`-Matrix und Supabase `role_permissions`:

| Befund | Status |
|--------|--------|
| `staticRolePermissions.ts` untracked | 🔴 **P0 Release-Blocker** — nicht in `HEAD`, frischer Clone bricht |
| 39 B.1-Keys in statischer Matrix | ✅ lokal vollständig |
| DB-Migrationen vor B.1c | ⚠️ nur `messages.broadcast.create` (0094/0096) |
| Neue Migration `0154_sync_b1_permission_keys.sql` | ✅ erstellt — 38 fehlende Keys + Broadcast idempotent |
| Typecheck | **713** Fehler (Δ 0 vs. B.1/B.1b) |
| Permission-Tests | ✅ **8/8** grün |
| Service-Gates (P0) | ✅ unverändert wirksam via statischem Pfad |
| UI/DB-Divergenz nach Migration-Apply | 🟡 reduziert für CareSuite+-Rollen; Live-Rollen (owner/admin/…) offen (B.1d) |

**B.1c Codeänderungen:** 1 Migration + dieser Bericht. Kein Commit ausgeführt.

---

## 2. Git-/Commit-Readiness-Matrix

**Branch:** `main` | **HEAD enthält `staticRolePermissions.ts`:** ❌ (`fatal: … not in 'HEAD'`)

### Pflichtdateien (B.1 + B.1c)

| Datei | Git-Status | Tracked? | Im Diff? | Commit-Ready? | Risiko |
|-------|------------|----------|----------|---------------|--------|
| `src/lib/permissions/staticRolePermissions.ts` | `??` untracked | ❌ | N/A (neu) | ❌ **Muss gestaged werden** | 🔴 P0 Deploy-Blocker |
| `src/types/permissions/index.ts` | `M` modified | ✅ | ✅ (+49 Zeilen) | ✅ | OK |
| `src/lib/clients/clientIntakeService.ts` | `M` modified | ✅ | ✅ (+104 Zeilen net) | ✅ | OK |
| `src/hooks/useClientIntakeWizard.ts` | `M` modified | ✅ | ✅ (actorRoleKey + Edit-Mode) | ✅ | OK |
| `src/lib/portal/clientProfileService.ts` | `M` modified | ✅ | ✅ (+35 Zeilen) | ✅ | OK |
| `src/lib/office/invoiceCreateService.ts` | `M` modified | ✅ | ✅ (`office.invoices.create`) | ✅ | OK |
| `app/portal/relative/_layout.tsx` | `M` modified | ✅ | ✅ (RequireAuth+RequireRole) | ✅ | OK |
| `supabase/migrations/0154_sync_b1_permission_keys.sql` | `??` untracked | ❌ | N/A (neu) | ❌ **Muss gestaged werden** | 🟠 DB-Sync |
| `docs/audit/B1-permission-p0-abschlussbericht.md` | `??` untracked | ❌ | — | ⚠️ optional | Dokumentation |
| `docs/audit/B1b-permission-runtime-sync-abschlussbericht.md` | `??` untracked | ❌ | — | ⚠️ optional | Dokumentation |
| `docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md` | `??` untracked | ❌ | — | ⚠️ optional | Dokumentation |

### Begleitende Diff-Statistik (B.1-Pfad)

```
 app/portal/relative/_layout.tsx        |  19 +++---
 src/lib/clients/clientIntakeService.ts | 104 +++++++++++++++++++++++++++++----
 src/lib/office/invoiceCreateService.ts |   2 +-
 src/lib/permissions/check.ts           |   2 +-
 src/lib/permissions/index.ts           |   6 ++
 src/lib/portal/clientProfileService.ts |  35 ++++++++---
 src/types/permissions/index.ts         |  49 +++++++++++++++-
 7 files changed, 189 insertions(+), 28 deletions(-)
```

**Hinweis:** `check.ts` / `index.ts` — minimale Import-/Export-Anpassungen für `staticRolePermissions`-Barrel; abhängig von untracked Datei.

### Invoice-Dateien (B.1 P0)

| Datei | B.1-Änderung | Git-Diff |
|-------|--------------|----------|
| `src/lib/office/invoiceCreateService.ts` | `'office.invoices.view' as never` → `'office.invoices.create'` | ✅ |
| `src/components/office/InvoicesListView.tsx` | UI prüft weiter `office.invoices.view` für Create-Button | ❌ nicht geändert (B.1b dokumentiert) |
| `src/screens/office/InvoiceCreateScreen.tsx` | UI-Gate auf `office.invoices.view` | ❌ nicht geändert |

---

## 3. Master-Permission-Key-Matrix (39 B.1-Keys)

| # | PermissionKey | Static (ROLE_PERMISSIONS) | DB vor B.1c | Seed-Datei | Migration 0154 | Drift nach Apply |
|---|---------------|---------------------------|-------------|------------|----------------|------------------|
| 1 | `connect.view` | admin, manager, billing, dispatch | ❌ | — | ✅ | ✅ |
| 2 | `connect.configure` | admin only | ❌ | — | ✅ | ✅ |
| 3 | `inventory.view` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 4 | `inventory.manage_items` | admin, manager | ❌ | — | ✅ | ✅ |
| 5 | `inventory.issue` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 6 | `inventory.return_manage` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 7 | `inventory.audit_view` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 8 | `inventory.report_damage` | admin, manager | ❌ | — | ✅ | ✅ |
| 9 | `inventory.offboarding` | admin, manager | ❌ | — | ✅ | ✅ |
| 10 | `portal.employee.inventory.view` | employee_portal | ❌ | — | ✅ | ✅ |
| 11 | `messages.broadcast.create` | admin, manager, billing, dispatch | ✅ 0094/0096 | — | ✅ (idempotent) | ✅ |
| 12 | `geo.routes.view` | admin, manager, dispatch, nurse, caregiver | ❌ | — | ✅ | ✅ |
| 13 | `geo.location.capture` | admin, manager, dispatch, nurse, caregiver | ❌ | — | ✅ | ✅ |
| 14 | `geo.live_tracking` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 15 | `geo.mileage.manage` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 16 | `office.recruiting.view` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 17 | `office.recruiting.manage` | admin, manager | ❌ | — | ✅ | ✅ |
| 18 | `office.recruiting.view_sensitive` | admin, manager | ❌ | — | ✅ | ✅ |
| 19 | `office.recruiting.convert` | admin, manager | ❌ | — | ✅ | ✅ |
| 20 | `office.recruiting.onboarding.manage` | admin, manager | ❌ | — | ✅ | ✅ |
| 21 | `office.employees.compliance.view` | admin, manager, billing, nurse | ❌ | — | ✅ | ✅ |
| 22 | `office.employees.compliance.manage` | admin, manager | ❌ | — | ✅ | ✅ |
| 23 | `office.employees.absences.view` | admin, manager, billing, dispatch, nurse, counselor | ❌ | — | ✅ | ✅ |
| 24 | `office.employees.absences.view_sensitive` | admin, manager | ❌ | — | ✅ | ✅ |
| 25 | `office.employees.absences.manage` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 26 | `office.employees.absences.approve` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 27 | `portal.employee.absences.view` | employee_portal | ❌ | — | ✅ | ✅ |
| 28 | `portal.employee.absences.request` | employee_portal | ❌ | — | ✅ | ✅ |
| 29 | `office.appointments.edit` | admin, manager, dispatch | ❌ | — | ✅ | ✅ |
| 30 | `office.employees.hr.view` | admin, manager, billing | ❌ | — | ✅ | ✅ |
| 31 | `office.employees.hr.manage` | admin, manager | ❌ | — | ✅ | ✅ |
| 32 | `office.employees.hr.finalize` | admin, manager | ❌ | — | ✅ | ✅ |
| 33 | `portal.employee.hr.view` | employee_portal | ❌ | — | ✅ | ✅ |
| 34 | `office.employee_time.view` | admin, manager, billing | ❌ | — | ✅ | ✅ |
| 35 | `office.employee_time.manage` | admin, manager | ❌ | — | ✅ | ✅ |
| 36 | `office.employee_time.export` | admin, manager, billing | ❌ | — | ✅ | ✅ |
| 37 | `office.invoices.create` | admin, manager (OFFICE_FULL), billing | ❌ | — | ✅ | ✅ |
| 38–39 | *(38 A4.3 + 1 B.1 neu = 39 total)* | siehe oben | 1/39 in DB | keine `supabase/seed*` | 38 neu + 1 idempotent | **39/39 für CS+-Rollen** |

**Rollen-Legende:** admin=`business_admin`, manager=`business_manager`

**Bewusst ohne B.1-Keys:** `client_portal`, `family_portal`, `akademie_admin`, `caregiver` (nur Geo), `counselor` (nur absences.view)

---

## 4. DB-Permission-Struktur-Matrix

| Element | Ort | Schema / Verhalten |
|---------|-----|-------------------|
| **Rollen-Stamm** | `0001_core_schema.sql` | `roles(key UNIQUE)` — 11 CareSuite+-RoleKeys |
| **Globale Rechte** | `0001_core_schema.sql` | `role_permissions(role_id, permission_key)` UNIQUE(role_id, permission_key) |
| **Tenant-Overrides** | `0016_auth_access_portals…` | `role_permission_sets(tenant_id, role_key, permission_key)` — ersetzt globale Liste wenn befüllt |
| **Area-Matrix (parallel)** | `0130_roles_permissions_matrix.sql` | `tenant_role_area_permissions` — UI-Matrix, nicht 1:1 PermissionKey |
| **RLS-Helfer** | `0096`, `0076`, `0087` … | `has_permission(p_permission_key TEXT)` — exact match + legacy can_* fallback |
| **Runtime-Client** | `permissionRepository.ts` | Supabase-Mode: DB-first → Fallback static; Demo: static only |
| **Seeds** | — | **Keine** `supabase/seed*` Dateien gefunden |
| **Scripts** | — | Keine `role_permissions`-Inserts in `scripts/` |
| **ON CONFLICT** | Alle Permission-Migrationen | `ON CONFLICT (role_id, permission_key) DO NOTHING` |
| **Insert-Pattern** | 0094, 0121, 0154 | `INSERT … SELECT r.id, p.key FROM roles r CROSS JOIN (VALUES …) WHERE r.key IN (…)` |

### Bestehende Permission-Seeds (Auswahl)

| Migration | Keys |
|-----------|------|
| `0001_core_schema.sql` | Core Office: clients.*, dashboard, office.access, business.modules.manage |
| `0005_employees_and_profiles.sql` | office.employees.* Basis |
| `0094` + `0096` | `messages.broadcast.create` (+ Live-Rollen owner/admin/…) |
| `0121_csv_import_export.sql` | `tenant.settings.csv.*` |
| `0100`, `0083`, `0087` … | office.access, clients.delete, documents.upload |

**Kein** `office.invoices.*`, `connect.*`, `inventory.*`, `geo.*`, `recruiting.*`, `compliance.*`, `absences.*`, `hr.*`, `employee_time.*` in vorherigen Migrationen.

---

## 5. Entscheidung: Static vs DB vs Hybrid

### Aktuelles Modell

```
┌─────────────────────────────────────────────────────────────┐
│  enforcePermission / hasPermission (Service-Layer)          │
│  → IMMER staticRolePermissions.ts (ROLE_PERMISSIONS)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  usePermissions / RequirePermission (UI-Layer)              │
│  Demo-Mode  → static                                        │
│  Supabase   → fetchRuntimePermissions (DB role_permissions  │
│               + tenant role_permission_sets override)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Postgres RLS has_permission()                              │
│  → role_permissions (+ legacy can_* area keys)              │
└─────────────────────────────────────────────────────────────┘
```

### Kurzfristige Release-Empfehlung (Hybrid beibehalten)

1. **Commit + Track** `staticRolePermissions.ts` — P0, Service-Gates hängen davon ab.
2. **Migration 0154 anwenden** (`supabase db push` / SQL Editor) — schließt UI/RLS-Drift für CareSuite+-Rollen.
3. **Kein Redesign** — Area-Matrix (`tenant_role_area_permissions`) und PermissionKey-Union bleiben parallel; B.2/B.3 klären Konsolidierung.
4. **B.1d** — Live-Produktionsrollen (`owner`, `admin`, `management`, `office`, `planning`) separat mappen (Pattern aus 0096/0121).

---

## 6. Missing-Keys-Kategorisierung (A–E)

| Kat. | Bedeutung | Keys / Bereich | Aktion B.1c |
|------|-----------|----------------|-------------|
| **A** | Bereits in DB vor B.1c | `messages.broadcast.create` (0094/0096) | Idempotent in 0154 |
| **B** | Fehlend → in 0154 gesynct | 38 Keys (Connect, Inventory, Geo, Recruiting, Compliance, Absences, HR, EmpTime, Portal-Employee, Invoice-Create, Appointments-Edit) | ✅ Migration erstellt |
| **C** | Statisch-only by Design | Keine B.1-Keys für `client_portal`, `family_portal`, `akademie_admin` | Keine DB-Zuweisung (korrekt) |
| **D** | Deferred B.1d | Live-Rollen-Mapping (`owner`, `admin`, `management`, `office`, `planning`, `geschaeftsfuehrung`) | Nicht in 0154 — außerhalb static ROLE_PERMISSIONS |
| **E** | Strukturell offen | `RolePermission.permissionKey: string`; `tenant_role_area_permissions` vs PermissionKey; Invoice-UI `.view` statt `.create` | Dokumentiert, nicht B.1c-Scope |

---

## 7. Migration 0154 — Details

**Pfad:** `supabase/migrations/0154_sync_b1_permission_keys.sql`  
**Vorgänger:** höchste Nummer war `0153_reporting_pdl_cockpit.sql`  
**Typ:** INSERT-only, `ON CONFLICT (role_id, permission_key) DO NOTHING`  
**Keine:** DELETE, DROP, TRUNCATE, RLS-, Schema-Änderungen

### Sync-Statistik

| Metrik | Wert |
|--------|------|
| Unique B.1 PermissionKeys in Migration | **39** |
| Keys neu gegenüber DB (excl. broadcast) | **38** |
| Role-Permission-Zeilen (INSERT-Versuche) | **99** |
| Betroffene Rollen | 8 (`business_admin`, `business_manager`, `billing`, `dispatch`, `nurse`, `caregiver`, `counselor`, `employee_portal`) |

### Rollen-Zuordnung (1:1 aus staticRolePermissions)

- **business_admin:** alle 39 Keys (inkl. connect.configure, INVENTORY_FULL, GEO_DISPATCH, RECRUITING_FULL, …)
- **business_manager:** wie admin, ohne `connect.configure`
- **billing:** connect.view, broadcast, compliance.view, absences.view, hr.view, employee_time view+export, invoices.create
- **dispatch:** connect.view, INVENTORY_DISPATCH (4), GEO_DISPATCH (4), broadcast, absences view/manage/approve, appointments.edit, recruiting.view
- **nurse:** GEO_FIELD (2), compliance.view, absences.view
- **caregiver:** GEO_FIELD (2)
- **counselor:** absences.view
- **employee_portal:** portal.employee.inventory/absences/hr (4 Keys)

**Remote-Apply:** Manuell via `supabase db push` oder SQL Editor — **nicht** in B.1c ausgeführt.

---

## 8. staticRolePermissions Deploy-Safety

### Import-Kette (verifiziert)

| Schritt | Datei | Status |
|---------|-------|--------|
| Definition | `staticRolePermissions.ts` | ✅ lokal, ❌ untracked |
| Barrel | `permissions/index.ts` | ✅ re-export ROLE_PERMISSIONS, getPermissionsForRole |
| Check | `permissions/check.ts` | ✅ import getPermissionsForRole |
| Enforce | `permissions/enforce.ts` | ✅ via permissionError → check |
| Runtime-Repo | `permissionRepository.ts` | ✅ Fallback getPermissionsForRole |
| P0 Services | intake, profile, invoice | ✅ enforcePermission |

### P0 Release-Blocker

**`staticRolePermissions.ts` ist untracked und nicht in `HEAD`.**  
Frischer Clone / CI ohne diese Datei → Build bricht (`ROLE_PERMISSIONS` import fails).

### Konkrete `git add`-Liste (NICHT ausgeführt)

```bash
git add src/lib/permissions/staticRolePermissions.ts
git add src/types/permissions/index.ts
git add src/lib/permissions/check.ts
git add src/lib/permissions/index.ts
git add src/lib/clients/clientIntakeService.ts
git add src/hooks/useClientIntakeWizard.ts
git add src/lib/portal/clientProfileService.ts
git add src/lib/office/invoiceCreateService.ts
git add app/portal/relative/_layout.tsx
git add supabase/migrations/0154_sync_b1_permission_keys.sql
git add docs/audit/B1-permission-p0-abschlussbericht.md
git add docs/audit/B1b-permission-runtime-sync-abschlussbericht.md
git add docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md
```

---

## 9. Typecheck-/Test-Ergebnis

### Typecheck (`.audit-typecheck-b1c.log`)

| Metrik | B.1/B.1b Baseline | B.1c | Δ |
|--------|-------------------|------|---|
| Gesamt `error TS*` | 713 | **713** | **0** |
| Exit-Code | 2 | 2 | — |

Keine neuen PermissionKey-Drift-Fehler durch B.1c (nur Migration + Report).

### Tests (`.audit-test-b1c-permissions.log`)

| Testdatei | Ergebnis |
|-----------|----------|
| `core/permissions.test.ts` | ✅ 3/3 |
| `portal/clientPortalProfileLive.test.ts` | ✅ 5/5 |
| **Gesamt** | ✅ **8/8** |

---

## 10. Geänderte Dateien in B.1c

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/0154_sync_b1_permission_keys.sql` | **NEU** — idempotenter DB-Sync 39 B.1-Keys |
| `docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md` | **NEU** — dieser Bericht |
| `.audit-typecheck-b1c.log` | Typecheck-Log |
| `.audit-test-b1c-permissions.log` | Test-Log |

**Keine** weiteren Code-/RLS-/Test-Änderungen.

---

## 11. Commit-Checkliste

### Vor Commit (P0)

- [ ] `git add src/lib/permissions/staticRolePermissions.ts` — **Release-Blocker**
- [ ] Alle B.1-P0-Diffs stagen (siehe §8 git-add-Liste)
- [ ] `supabase/migrations/0154_sync_b1_permission_keys.sql` stagen
- [ ] Audit-Berichte B.1 / B.1b / B.1c optional stagen
- [ ] **Nicht** stagen: `.audit-*.log`, `.expo-resolve-test/`, untracked Build-Artefakte

### Nach Commit (vor Deploy)

- [ ] Migration 0154 auf Ziel-DB anwenden (manuell, kein auto-push)
- [ ] Smoke: `has_permission('office.invoices.create')` für billing-Rolle
- [ ] Smoke: Service-Gates Intake/Portal/Invoice in Demo + Supabase-Mode
- [ ] Invoice-UI auf `office.invoices.create` umstellen (separater PR, nicht B.1c)

### Bewusst offen (nicht B.1c)

- [ ] B.2 — `RequireProductAccess` auf `business/office`
- [ ] B.1d — Live-Rollen (owner/admin/…) B.1-Key-Mapping
- [ ] B.3 — invertierte Portal-Patterns (`appointmentService` etc.)
- [ ] `RolePermission.permissionKey: string` typisieren
- [ ] 713 TS-Fehler (außerhalb Scope)

---

## Anhang: Return-Checklist

| Frage | Antwort |
|-------|---------|
| `staticRolePermissions` Tracking? | ❌ **Untracked**, nicht in `HEAD` |
| Migration erstellt? | ✅ `supabase/migrations/0154_sync_b1_permission_keys.sql` |
| Keys gesynct? | **39** Keys / **99** role-permission rows (38 neu + 1 idempotent) |
| Typecheck? | **713** (Δ 0) |
| Tests? | **8/8** grün |
| Report-Pfad? | `docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md` |
| B.1c Dateiänderungen? | Migration + Report + Audit-Logs |

**Nächster Schritt:** Commit der Pflichtdateien (insb. `staticRolePermissions.ts`) + manuelles Apply von Migration 0154.
