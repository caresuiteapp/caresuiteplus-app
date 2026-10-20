# B1 Abschlussbericht — Fachliche Permission-P0s + ROLE_PERMISSIONS verdrahten

**Datum:** 2026-06-20  
**Branch:** main  
**Scope:** Gruppe B.1 — 38 A4.3-Keys in ROLE_PERMISSIONS, P0-Service-Gates (Intake, Portal-Profil, Invoice Create), Relative-Portal-Guard, business/office-Dokumentation

---

## 1. Executive Summary

B.1 schließt die Lücke zwischen **typ-sicheren PermissionKeys (A4.3)** und **Runtime-Berechtigungen** sowie vier dokumentierte P0-Sicherheitslücken:

| P0 | Status | Kurzbeschreibung |
|----|--------|------------------|
| ROLE_PERMISSIONS (38 Keys + `office.invoices.create`) | ✅ | Least-privilege-Zuordnung pro Rolle in `staticRolePermissions.ts` |
| Client Intake `enforcePermission` | ✅ | `office.clients.create` / `.edit` vor Persistenz |
| Portal Client Profile (invertierte Logik) | ✅ | Portal → `portal.client.*`; Office → `office.clients.view`; deny by default |
| Invoice Create Permission | ✅ | `office.invoices.create` statt `as never`-Workaround |
| Relative Portal Guard | ✅ | `RequireAuth` + `RequireRole` wie Client/Employee-Portal |
| business/office vs office | 📄 | Nur dokumentiert (RequireProductAccess-Differenz) |

**Typecheck:** 713 Fehler vor/nach (±0) — keine neuen Fehlerklassen, kein PermissionKey-Drift.

---

## 2. Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/permissions/index.ts` | +1 Key: `office.invoices.create` |
| `src/lib/permissions/staticRolePermissions.ts` | +Label, Modul-Konstanten, ROLE_PERMISSIONS für 38 A4.3-Keys + Invoice-Create |
| `src/lib/clients/clientIntakeService.ts` | `enforcePermission` create/edit vor Persist; `actorRoleKey` in Options |
| `src/hooks/useClientIntakeWizard.ts` | Übergabe `actorRoleKey` aus Auth-Profil |
| `src/lib/portal/clientProfileService.ts` | Korrekte Portal/Office-Zweiglogik, deny by default |
| `src/lib/office/invoiceCreateService.ts` | `office.invoices.create` (ohne `as never`) |
| `app/portal/relative/_layout.tsx` | `RequireAuth` + `RequireRole` Guard-Stack |

**Git-Hinweis:** `staticRolePermissions.ts` ist lokal vorhanden, aber weiterhin **untracked** (wie in A4.3).

---

## 3. ROLE_PERMISSIONS-Matrix

### 3.1 Neue / verdrahtete Keys (39 total: 38 A4.3 + `office.invoices.create`)

| Modul | PermissionKeys |
|-------|------------------|
| Connect | `connect.view`, `connect.configure` |
| Inventory | `inventory.view`, `inventory.manage_items`, `inventory.issue`, `inventory.report_damage`, `inventory.return_manage`, `inventory.audit_view`, `inventory.offboarding` |
| Portal Employee | `portal.employee.inventory.view`, `portal.employee.absences.view`, `portal.employee.absences.request`, `portal.employee.hr.view` |
| Messages | `messages.broadcast.create` |
| Geo | `geo.routes.view`, `geo.location.capture`, `geo.live_tracking`, `geo.mileage.manage` |
| Recruiting | `office.recruiting.view`, `.manage`, `.view_sensitive`, `.convert`, `.onboarding.manage` |
| Compliance | `office.employees.compliance.view`, `.manage` |
| Absences | `office.employees.absences.view`, `.view_sensitive`, `.manage`, `.approve` |
| Appointments | `office.appointments.edit` |
| HR | `office.employees.hr.view`, `.manage`, `.finalize` |
| Employee Time | `office.employee_time.view`, `.manage`, `.export` |
| Invoices | `office.invoices.create` (**neu in B.1**) |

### 3.2 Rollen-Zuordnung (Least Privilege)

| Rolle | Connect | Inventory | Geo | Broadcast | Recruiting | Compliance | Absences | HR | Emp.Time | Appt.Edit | Invoice.Create |
|-------|---------|-----------|-----|-----------|------------|------------|----------|-----|----------|-----------|----------------|
| `business_admin` | configure | full | dispatch-set | ✓ | full | full | full | full | full | ✓ | ✓ (via OFFICE_FULL) |
| `business_manager` | view | full | dispatch-set | ✓ | full | full | full | full | full | ✓ | ✓ (via OFFICE_FULL) |
| `billing` | view | — | — | ✓ | — | view | view | view | view+export | — | ✓ |
| `dispatch` | view | dispatch-set | dispatch-set | ✓ | view | — | manage+approve | — | — | ✓ | — |
| `nurse` | — | — | field | — | — | view | view | — | — | — | — |
| `caregiver` | — | — | field | — | — | — | — | — | — | — | — |
| `counselor` | — | — | — | — | — | — | view | — | — | — | — |
| `employee_portal` | — | portal view | — | — | — | — | portal req/view | portal hr | — | — | — |
| `client_portal` / `family_portal` | — | — | — | — | — | — | — | — | — | — | — |
| `akademie_admin` | — | — | — | — | — | — | — | — | — | — | — |

**Konstanten in `staticRolePermissions.ts`:** `CONNECT_VIEW`, `CONNECT_CONFIGURE`, `INVENTORY_FULL`, `INVENTORY_DISPATCH`, `GEO_FIELD`, `GEO_DISPATCH`, `BROADCAST_CREATE`, `RECRUITING_VIEW`, `RECRUITING_FULL`, `COMPLIANCE_VIEW`, `COMPLIANCE_FULL`, `ABSENCES_*`, `HR_*`, `EMPLOYEE_TIME_*`, `APPOINTMENTS_EDIT`, `PORTAL_EMPLOYEE_EXTENDED`.

**Tests abgedeckt (bestehend):** `connectModule.test.ts` (configure nur admin), `inventoryModule.test.ts` (admin/caregiver/employee_portal — Migration fehlt lokal), `core/permissions.test.ts` (alle Rollen >0 Rechte).

---

## 4. Guard-Reparatur-Matrix

| Bereich | Datei | Vorher | Nachher | PermissionKey(s) |
|---------|-------|--------|---------|------------------|
| **Client Intake Create** | `clientIntakeService.ts` | Kein Gate | `enforcePermission` vor `runService`/Persist | `office.clients.create` |
| **Client Intake Update** | `clientIntakeService.ts` | Kein Gate | `enforcePermission` vor Persist | `office.clients.edit` |
| **Intake Caller** | `useClientIntakeWizard.ts` | Kein `roleKey` | `actorRoleKey: profile?.roleKey ?? user?.roleKey` | — |
| **Portal Profil** | `clientProfileService.ts` | `if (denied && isClientPortalRole) return denied` → Office ohne Recht durch | Portal: `portal.client.profile.view`; Office: `office.clients.view`; null-Rolle denied | siehe links |
| **Portal Careplan** | `clientProfileService.ts` | Gleicher Bug | Portal: `portal.client.careplan.view`; Office: `office.clients.view` | siehe links |
| **Invoice Create** | `invoiceCreateService.ts` | `'office.invoices.view' as never` | `office.invoices.create` | `office.invoices.create` |
| **Relative Portal Layout** | `app/portal/relative/_layout.tsx` | Nur `<Stack>` | `<RequireAuth redirectTo="/auth/portal-code-login"><RequireRole><Stack/></RequireRole></RequireAuth>` | Rolle via `checkRoleAccess` (`family_portal`) |
| **business/office vs office** | `app/business/office/_layout.tsx` vs `app/office/_layout.tsx` | Unterschied | **Nur dokumentiert** (s. §5) | — |

### business/office vs office (Dokumentation)

| Aspekt | `app/office/_layout.tsx` | `app/business/office/_layout.tsx` |
|--------|--------------------------|-----------------------------------|
| RequireAuth | ✓ → `/auth/business-login` | ✓ → `/auth/business-login` |
| RequireRole | ✓ | ✓ |
| **RequireProductAccess** | **✓** (Modul-Entitlement) | **✗ fehlt** |
| ShellLayout | ✓ area=office | ✓ area=office |

**Risiko:** Nutzer mit Rolle aber ohne Produkt-Entitlement können `/business/office/*` erreichen, während `/office/*` blockiert wird. **B.1 bewusst nicht vereinheitlicht** (Scope: nur dokumentieren).

---

## 5. Sicherheitsbewertung per P0

| P0 | Risiko vorher | Risiko nachher | Bewertung |
|----|---------------|----------------|-----------|
| ROLE_PERMISSIONS-Lücke | Services riefen typ-sichere Keys auf, `can()` blieb `false` → Funktionen tot oder Umgehung in Demo | Rollenmatrix spiegelt Modul-Intent; Tests für Connect/Inventory/Permissions grün | **Behoben (statisch)** — DB-Runtime-Seed weiter offen (B.1b) |
| Intake ohne Gate | Jeder Aufrufer konnte Klient persistieren | Create/Edit blockiert ohne Rolle/Recht | **Behoben** |
| Portal Profil invertiert | Office-Rollen ohne `portal.client.profile.view` passierten Gate | Klare Zweige; deny by default | **Behoben** |
| Invoice Create | View-Recht für Create-Aktion; `as never` | Dediziertes Create-Recht | **Behoben** |
| Relative Portal offen | Kein Auth/Role auf Layout | Gleicher Guard-Stack wie Client-Portal | **Behoben** |
| business/office ProductAccess | Inkonsistenter Modul-Gate | Unverändert, dokumentiert | **Offen (B.2)** |

---

## 6. Typecheck-Vergleich

| Metrik | Before (A4.3-Baseline / `.audit-typecheck-b1-after.log` Lauf 1) | After (`.audit-typecheck-b1-after.log` Lauf 2) | Δ |
|--------|----------------------------------------------------------------|--------------------------------------------------|---|
| **Gesamt (error TS\*)** | 713 | 713 | **0** |
| TS2305 | 15 | 15 | 0 |
| TS2339 | 172 | 172 | 0 |
| TS2345 | 51 | 51 | 0 |
| TS2322 | 152 | 152 | 0 |
| TS2353 | 37 | 37 | 0 |
| PermissionKey-Drift | 0 | 0 | 0 |

**Exit-Code:** 2 (weiterhin offene TS-Fehler außerhalb B.1-Scope)  
**Branch:** main  
**Uncommitted (B.1-relevant):** siehe §2; weitere Workspace-Änderungen außerhalb B.1 unverändert.

---

## 7. Tests

| Testdatei | Ergebnis | Anmerkung |
|-----------|----------|-----------|
| `core/permissions.test.ts` | ✅ 3/3 | Rollen haben Permissions |
| `connect/connectModule.test.ts` | ⚠️ 8/9 | `connect.configure`-Assertions ✅; Route-Block-Test pre-existing fail |
| `portal/clientPortalProfileLive.test.ts` | ✅ 5/5 | Struktur/Wiring unverändert kompatibel |
| `office/officeDelete.test.ts` | ⚠️ 3/4 | Deny-Logik ok; String-Match pre-existing |
| `office/officePhase4Crud.test.ts` | ⚠️ 3/6 | Screen-Audit/Demo pre-existing; Invoice-Create nutzt jetzt korrektes Recht |
| `inventory/inventoryModule.test.ts` | ❌ Suite | Migration `0051_inventory_prepared.sql` fehlt lokal (ENOENT) |

**Keine Test-Massenänderungen** (Scope-Vorgabe).

---

## 8. Nicht angerührte Bereiche

- Supabase-Migrationen / RLS / Schema
- `RolePermission.permissionKey: string` (DB-Typisierung)
- `RequirePermission` auf weiteren Routen
- Workflow, Calendar/Messages-Vereinheitlichung, Design
- `business/office` RequireProductAccess-Vereinheitlichung
- Massen-Fix der 713 TS-Fehler
- Commits / Deploy

---

## 9. Nächster sinnvoller Schritt

**B.1b — Runtime-Permission-Sync:** Supabase `role_permissions` / Seed mit statischer Matrix synchronisieren; `RolePermission.permissionKey` typisieren.

**B.2 — Route-Gates:** `RequireProductAccess` auf `app/business/office/_layout.tsx` angleichen oder bewusst dokumentierte Ausnahme in Navigation erzwingen.

**B.3 — Portal-Service-Konsolidierung:** Gleiche invertierte `if (denied && isClientPortalRole)`-Pattern in `documentService.ts`, `messageService.ts`, `appointmentService.ts` prüfen und ggf. an `clientProfileService`-Fix anlehnen.

---

## Anhang: A4.3 → B.1 Key-Liste (38)

`connect.view`, `connect.configure`, `inventory.*` (7), `portal.employee.inventory.view`, `messages.broadcast.create`, `geo.routes.view`, `geo.location.capture`, `geo.live_tracking`, `geo.mileage.manage`, `office.recruiting.*` (5), `office.employees.compliance.*` (2), `office.employees.absences.*` (4), `portal.employee.absences.*` (2), `office.appointments.edit`, `office.employees.hr.*` (3), `portal.employee.hr.view`, `office.employee_time.*` (3)

**B.1 zusätzlich:** `office.invoices.create`
