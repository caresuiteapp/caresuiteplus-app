# B.1b Abschlussbericht — Permission Runtime-/DB-/Git-Sync-Verifikation

**Datum:** 2026-06-20  
**Branch:** `main`  
**Scope:** Gruppe B.1b — Verifikation der B.1-Lieferung (Git-Tracking, Runtime-Pfad, DB-/Seed-Sync, Bypass-Check). Keine Migrationen, keine Commits, keine B.2-Arbeit.

---

## 1. Executive Summary

B.1 ist **lokal runtime-wirksam**: alle vier P0-Service-Gates und der Relative-Portal-Guard sind im Working Tree implementiert und über den statischen Permission-Pfad (`staticRolePermissions.ts` → `getPermissionsForRole` → `hasPermission` / `enforcePermission`) erreichbar. Typecheck bleibt bei **713 Fehlern** (Δ 0 gegenüber B.1); Permission-Tests **8/8 grün**.

**Kritische Befunde:**

| Befund | Schwere | Auswirkung |
|--------|---------|------------|
| `staticRolePermissions.ts` **untracked**, nicht in `HEAD` | 🔴 Kritisch | Frischer Clone/Deploy ohne Datei → Build bricht; B.1-Matrix geht verloren |
| **Dualer Runtime-Pfad**: Services = statisch, UI (Supabase) = `role_permissions` DB | 🟠 Hoch | UI kann Rechte anders anzeigen als Service-Gates durchsetzen |
| **37 von 39 B.1-Keys fehlen in DB-Migrationen** (nur `messages.broadcast.create` geseedet) | 🟠 Hoch | Supabase-UI/`has_permission()`-RLS nicht synchron mit statischer Matrix |
| Invoice-UI (`InvoicesListView`, `InvoiceCreateScreen`) prüft weiter `office.invoices.view` statt `.create` | 🟡 Mittel | Service-Gate korrekt; UI-Inkonsistenz, kein Service-Bypass |
| Portal-Services (`appointmentService.ts` u.a.) mit altem invertiertem Pattern | 🟡 Mittel | Bekannt (B.3); nicht B.1-Scope |

**B.1b Codeänderungen:** Keine — Runtime-Import-Pfad ist lokal intakt; Fixes wären Git-Commit/Tracking (außerhalb B.1b-Scope) oder B.1c-DB-Sync.

---

## 2. Git-/Tracking-Matrix

**Branch:** `main` (uncommitted Working Tree, sehr großer Diff außerhalb B.1)

### Pflichtdateien (B.1)

| Datei | Git-Status | Im Diff sichtbar? | Tracked? | Risiko |
|-------|------------|-------------------|----------|--------|
| `src/lib/permissions/staticRolePermissions.ts` | `??` untracked | N/A (neu) | ❌ **Nein** — existiert nicht in `HEAD` | 🔴 Deploy/Clone bricht ohne Datei |
| `src/types/permissions/index.ts` | `M` modified | ✅ (+49 Zeilen, A4.3-Keys + `office.invoices.create`) | ✅ | OK |
| `src/lib/clients/clientIntakeService.ts` | `M` modified | ✅ (`enforcePermission` create/edit) | ✅ | OK |
| `src/hooks/useClientIntakeWizard.ts` | `M` modified | ✅ (`actorRoleKey` übergeben) | ✅ | OK |
| `src/lib/portal/clientProfileService.ts` | `M` modified | ✅ (Zweiglogik Portal/Office) | ✅ | OK |
| `src/lib/office/invoiceCreateService.ts` | `M` modified | ✅ (`office.invoices.create`) | ✅ | OK |
| `app/portal/relative/_layout.tsx` | `M` modified | ✅ (`RequireAuth` + `RequireRole`) | ✅ | OK |
| `docs/audit/B1-permission-p0-abschlussbericht.md` | untracked/modified | ✅ vorhanden | ⚠️ prüfen | Dokumentation |

### Weitere Beobachtungen

- **`git show HEAD:src/lib/permissions/staticRolePermissions.ts`** → `fatal: … not in 'HEAD'` — Datei wurde nie committed.
- Migrationsskript `scripts/migrate-demo-constants.mjs` zeigt: Datei stammt aus ehem. `src/data/demo/permissions.ts` (gelöscht, nicht mehr vorhanden).
- **Audit-Logs vorhanden:** `.audit-typecheck-b1b.log`, `.audit-test-b1b-permissions.log` (+ ältere B.1/P0a-Logs im Workspace).
- **Security-relevante Dateien fehlen im Commit:** Gesamte B.1-Matrix (`staticRolePermissions.ts`) + alle P0-Diffs sind uncommitted.

---

## 3. B.1-Ergebnis-Matrix (Bericht vs. Git vs. Runtime)

| Bereich | Datei | Änderung laut B.1-Bericht | Im Git-Diff? | Tracked? | Runtime bestätigt? | Risiko | Status |
|---------|-------|---------------------------|--------------|----------|-------------------|--------|--------|
| ROLE_PERMISSIONS (39 Keys) | `staticRolePermissions.ts` | 38 A4.3 + `office.invoices.create` | Datei neu/untracked | ❌ | ✅ lokal via `getPermissionsForRole` | 🔴 untracked | ⚠️ Runtime OK, Git/Deploy offen |
| PermissionKey-Typ | `src/types/permissions/index.ts` | +A4.3-Keys, +`office.invoices.create` | ✅ | ✅ | ✅ TypeScript-Union | — | ✅ |
| Client Intake Create | `clientIntakeService.ts` | `enforcePermission(…, 'office.clients.create')` | ✅ | ✅ | ✅ vor Persist | — | ✅ |
| Client Intake Update | `clientIntakeService.ts` | `enforcePermission(…, 'office.clients.edit')` | ✅ | ✅ | ✅ | — | ✅ |
| Intake Caller | `useClientIntakeWizard.ts` | `actorRoleKey` aus Auth | ✅ | ✅ | ✅ | — | ✅ |
| Portal Profil | `clientProfileService.ts` | Portal→`portal.client.profile.view`, Office→`office.clients.view` | ✅ | ✅ | ✅ deny by default | — | ✅ |
| Portal Careplan | `clientProfileService.ts` | Portal→`portal.client.careplan.view`, Office→`office.clients.view` | ✅ | ✅ | ✅ | — | ✅ |
| Invoice Create | `invoiceCreateService.ts` | `office.invoices.create` (kein `as never`) | ✅ | ✅ | ✅ Service-Gate | 🟡 UI noch `.view` | ✅ Service / ⚠️ UI |
| Relative Portal | `app/portal/relative/_layout.tsx` | `RequireAuth` + `RequireRole` | ✅ | ✅ | ✅ `family_portal` in routes | — | ✅ |
| business/office vs office | — | nur dokumentiert | — | — | — | 🟡 B.2 | 📄 dokumentiert |

---

## 4. Permission-Quellen-Matrix

| Quelle | Statisch/Dynamisch | Runtimewirksam? | Enthält B.1-Keys? | Used by hasPermission/enforcePermission/guards? | Risiko | Empfehlung |
|--------|-------------------|-----------------|-------------------|------------------------------------------------|--------|------------|
| `staticRolePermissions.ts` → `ROLE_PERMISSIONS` | Statisch | ✅ **Ja** (Service-Layer, Demo-UI) | ✅ alle 39 | `check.ts`, `enforce.ts`, `index.ts`, Geo-Services, Tests | 🔴 untracked | **Commit/Track vor Deploy** |
| `permissionRepository.ts` → `fetchRuntimePermissions` | Dynamisch (Supabase `role_permissions` + `role_permission_sets`, Fallback static) | ✅ UI in Supabase-Mode | ❌ ~37 Keys fehlen in DB | `usePermissions`, `AuthProvider` prefetch | 🟠 UI/RLS-Drift | **B.1c**: Migration/Seed |
| `0001_core_schema.sql` + Folge-Migrationen | DB-Seed | ✅ RLS `has_permission()` | Teilweise (Core Office, broadcast) | Postgres RLS | 🟠 unvollständig | B.1c |
| `roleMatrixService.ts` / `roleMatrixStore` | Demo-Tenant-Matrix | ⚠️ separater Pfad | Matrix-Areas, nicht PermissionKey-Union | Admin-Rollenmatrix-UI | 🟡 Parallel-System | B.2/B.3 klären |
| `permissionService.ts` (auth) | Statisch via `getPermissionsForRole` | ✅ Access-Dashboard-Helfer | ✅ indirekt | Interne Rollen-Mapping | — | OK |
| `scripts/migrate-demo-constants.mjs` | Build/Migration-Hilfe | — | Generiert static aus altem demo | — | — | Nach Commit obsolet prüfen |

### Critical: Mehr als eine ROLE_PERMISSIONS-Wahrheit?

**Nein** — es gibt **genau eine** `ROLE_PERMISSIONS`-Definition (`staticRolePermissions.ts:561`).

**Aber:** zwei **Runtime-Auflösungspfade**:

1. **Service-Gates** (`enforcePermission` → `hasPermission` → `getPermissionsForRole`) → **immer statisch**
2. **UI-Gates** (`usePermissions` → `fetchRuntimePermissions`) → **Supabase: DB-first**, Demo: statisch

→ Kein doppeltes ROLE_PERMISSIONS-Objekt, aber **potenzielle UI/Service-Divergenz** in Supabase-Mode.

---

## 5. Runtime-Pfad-Matrix (P0-Pfade)

| Schritt | Datei | Import/Export | Status |
|---------|-------|---------------|--------|
| Definition | `staticRolePermissions.ts` | `export const ROLE_PERMISSIONS`, `getPermissionsForRole` | ✅ lokal |
| Barrel | `permissions/index.ts` | re-export `ROLE_PERMISSIONS`, `getPermissionsForRole` | ✅ |
| Check | `permissions/check.ts` | `import { getPermissionsForRole } from './staticRolePermissions'` | ✅ |
| Enforce | `permissions/enforce.ts` | `import { permissionError } from './check'` | ✅ |
| **P0: Intake** | `clientIntakeService.ts` | `import { enforcePermission } from '@/lib/permissions'` | ✅ |
| **P0: Portal Profil** | `clientProfileService.ts` | `import { enforcePermission } from '@/lib/permissions'` | ✅ |
| **P0: Invoice Create** | `invoiceCreateService.ts` | `import { enforcePermission } from '@/lib/permissions'` | ✅ |
| **P0: Relative Guard** | `app/portal/relative/_layout.tsx` | `import { RequireAuth, RequireRole } from '@/lib/auth'` | ✅ |
| UI Permission Hook | `usePermissions.ts` | `getPermissionsForRole` (initial) + `fetchRuntimePermissions` (Supabase) | ⚠️ dual path |
| RequirePermission | `RequirePermission.tsx` | `usePermissions().can/check` | ⚠️ DB in Supabase |

**Runtime-Pfad bestätigt:** ✅ für Service-Layer und Demo-Mode. Supabase-UI-Pfad separat (s. §4).

---

## 6. DB-/Seed-Sync-Matrix

| Permission-Gruppe | In `staticRolePermissions` | In DB-Migrationen (`INSERT role_permissions`) | Sync nötig? |
|-------------------|---------------------------|-----------------------------------------------|-------------|
| Core Office (`office.clients.*`, `office.access`) | ✅ | ✅ `0001_core_schema.sql` + Ergänzungen | Teilweise |
| `messages.broadcast.create` | ✅ | ✅ `0094`, `0096` | ✅ |
| `connect.view/configure` | ✅ | ❌ | **B.1c** |
| `inventory.*` (7 Keys) | ✅ | ❌ | **B.1c** |
| `geo.*` (4 Keys) | ✅ | ❌ | **B.1c** |
| `office.recruiting.*` (5) | ✅ | ❌ | **B.1c** |
| `office.employees.compliance.*` | ✅ | ❌ | **B.1c** |
| `office.employees.absences.*` | ✅ | ❌ | **B.1c** |
| `portal.employee.absences.*` | ✅ | ❌ | **B.1c** |
| `office.appointments.edit` | ✅ | ❌ | **B.1c** |
| `office.employees.hr.*` | ✅ | ❌ | **B.1c** |
| `portal.employee.hr.view` | ✅ | ❌ | **B.1c** |
| `office.employee_time.*` | ✅ | ❌ | **B.1c** |
| `portal.employee.inventory.view` | ✅ | ❌ | **B.1c** |
| **`office.invoices.create`** | ✅ | ❌ (kein `office.invoices.*` in Migrationen) | **B.1c** |
| `tenant.settings.csv.*` | ✅ | ✅ `0121_csv_import_export.sql` | Teilweise |

**Supabase Seeds:** keine `supabase/seed*` Dateien gefunden.

**Empfehlung:** B.1c — gezielte Migration, die fehlende Keys aus statischer Matrix in `role_permissions` spiegelt; `RolePermission.permissionKey` typisieren (separater Schritt).

---

## 7. Bypass-Matrix (4 P0-Bereiche)

### A) Client Intake

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Alternative Create-Pfade ohne `enforcePermission`? | ❌ Keiner — `createClientFromIntake` nur aus `submitClientIntake` nach Gate |
| Direct Repository-Aufruf von außen? | ❌ Keine externen Caller |
| `actorRoleKey` wird übergeben? | ✅ `useClientIntakeWizard` → `profile?.roleKey ?? user?.roleKey` |
| Gate umgangen wenn `actorRoleKey` null? | ⚠️ `enforcePermission(null, …)` → deny (korrekt) |

**Status:** ✅ Kein Service-Bypass

### B) Portal Profile

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Invertierte Logik behoben? | ✅ `enforceClientPortalProfileAccess` / `enforceClientCarePlanAccess` |
| Office ohne `office.clients.view` durch? | ❌ Blockiert |
| Portal ohne `portal.client.*` durch? | ❌ Blockiert |
| Fremdprofil-Zugriff (Office cross-client)? | ⚠️ Kein clientId-Ownership-Check in Service (RLS/Live-Layer) — außerhalb B.1 |
| Live-Layer eigene Permission? | ⚠️ `clientProfileLiveService` verlässt sich auf vorgelagertes Gate | ✅ |

**Status:** ✅ B.1-P0 behoben; Ownership = separates Thema

### C) Invoice Create

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Service nutzt `office.invoices.create`? | ✅ `invoiceCreateService.ts:20` |
| Service nutzt noch `view`? | ❌ Nein |
| UI `InvoiceCreateScreen` | ⚠️ Gate auf `office.invoices.view` (Zeile 36) |
| UI `InvoicesListView.canCreate` | ⚠️ `can('office.invoices.view')` (Zeile 51) — nicht `.create` |
| API-Bypass (direct `createInvoice`)? | Service-Gate greift; UI zeigt Button ggf. falsch |

**Status:** ✅ Service-Gate korrekt; 🟡 UI-Inkonsistenz (kein B.1b-Fix — out of scope)

### D) portal/relative

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Guard rendert? | ✅ `RequireAuth` → `RequireRole` → `Stack` |
| Parallel-Routen ohne Guard? | ❌ — `routes.ts` definiert `/portal/relative` + children mit `allowedRoles: ['family_portal']` |
| Vergleich Client-Portal | ✅ identisches Muster (`app/portal/client/_layout.tsx`) |
| `checkRoleAccess` für family_portal | ✅ in `routes.ts:318` |

**Status:** ✅ Kein Bypass

---

## 8. Typecheck-/Test-Ergebnis

### Typecheck

| Metrik | B.1 (Baseline) | B.1b (`.audit-typecheck-b1b.log`) | Δ |
|--------|----------------|-----------------------------------|---|
| Gesamt `error TS*` | 713 | **713** | **0** |
| Exit-Code | 2 | 2 | — |

Keine neuen PermissionKey-Drift-Fehler.

### Tests (optional, ausgeführt)

| Testdatei | Ergebnis |
|-----------|----------|
| `core/permissions.test.ts` | ✅ 3/3 |
| `portal/clientPortalProfileLive.test.ts` | ✅ 5/5 |

Log: `.audit-test-b1b-permissions.log`

---

## 9. Geänderte Dateien in B.1b

**Keine Codeänderungen.**

Verifikation-only; Runtime-Import-Pfad war lokal vollständig — keine der 8 Fix-Bedingungen erfüllt (fehlender Export/Import würde B.1 lokal unwirksam machen; ist nicht der Fall solange untracked Datei existiert).

---

## 10. Nicht angerührte Bereiche

- B.2 (`RequireProductAccess` auf `business/office`)
- Supabase-Migrationen / RLS / Schema-Änderungen
- `RolePermission.permissionKey: string` DB-Typisierung
- Massen-TS-Fixes (713 Fehler)
- Portal-Service-Konsolidierung (B.3: `appointmentService.ts` invertiertes Pattern)
- Workflow, Calendar/Messages-Vereinheitlichung, Design
- Commits, Deploy, Git-Staging

---

## 11. Nächster sinnvoller Schritt

| Priorität | Schritt | Begründung |
|-----------|---------|------------|
| **P0** | Git: `staticRolePermissions.ts` + B.1-P0-Diffs committen | Datei nicht in `HEAD`; Deploy/Clone-Risiko |
| **P1** | **B.1c** — DB-Sync-Migration für 37 fehlende Keys + `office.invoices.create` | UI/RLS-Drift in Supabase-Mode |
| **P2** | Invoice-UI auf `office.invoices.create` umstellen | UI/Service-Konsistenz |
| **P3** | **B.2** — `RequireProductAccess` auf `business/office` | dokumentiertes Risiko |
| **P4** | **B.3** — invertierte Portal-Patterns (`appointmentService` etc.) | gleiche Bug-Klasse wie B.1 Profil-Fix |

---

## Anhang: Kurzantworten (Return-Checklist)

| Frage | Antwort |
|-------|---------|
| Git-Tracking `staticRolePermissions`? | ❌ **Untracked**, nicht in `HEAD` |
| Runtime-Pfad bestätigt? | ✅ Service/Demo: `staticRolePermissions` → `enforcePermission` |
| DB-Sync-Gap? | ✅ **Ja** — ~37/39 B.1-Keys fehlen in `role_permissions`-Seeds |
| Bypass-Funde? | Service-P0s OK; UI Invoice `.view`; dual UI/DB-Pfad |
| Typecheck? | **713** (Δ 0) |
| Report-Pfad? | `docs/audit/B1b-permission-runtime-sync-abschlussbericht.md` |
| B.1b Code-Änderungen? | **Keine** |
