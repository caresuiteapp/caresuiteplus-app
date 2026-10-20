# Rollen & Rechte RBAC — Abnahmebericht

**Datum:** 2026-06-25  
**Scope:** Phase A–E der RBAC-Erweiterung (Migration 0173/0174, Service-Layer, Personalakte-UI, Backend-Enforcement, Tests)

## Kurzfassung

Die dynamische RBAC-Schicht wurde als Erweiterung des bestehenden `staticRolePermissions`-Modells implementiert. Migrationen **0173** und **0174** sind live angewendet; **0177** betrifft Billing-Lifecycle und war für RBAC nicht erforderlich. Die Personalakte zeigt unter **Rollen & Rechte** den `EmployeeRolesPermissionsHub` mit editierbarer Modul-Matrix, Sonderrechte-CRUD, Mandanten-Rollenvorlagen und effektivem Backend-Enforcement über `getActorEffectivePermissions` / `enforceWithActor`.

## Geänderte / neue Dateien

### Datenbank
- `supabase/migrations/0173_rbac_dynamic_model.sql`
- `supabase/migrations/0174_rbac_seed_catalog_and_templates.sql`

### Types
- `src/types/permissions/rbac.ts`

### Services
- `src/lib/permissions/permissionCatalogSeedData.ts`
- `src/lib/permissions/permissionCatalogService.ts`
- `src/lib/permissions/rbacService.ts` — Overrides, Scopes, Audit, role-base resolver
- `src/lib/permissions/roleTemplateService.ts` — Tenant CRUD + Permissions
- `src/lib/permissions/permissionMatrixBuilder.ts`
- `src/lib/permissions/permissionChangeHelpers.ts` — Override-Diff, Critical-Reason
- `src/lib/permissions/actorPermissions.ts` — `getActorEffectivePermissions`, `enforceWithActor`
- `src/lib/permissions/enforce.ts` (optional `effectivePermissions` Kontext)
- `src/lib/office/employeeRbacSaveService.ts`
- `src/lib/office/employeeHomeOfficeService.ts`
- `src/lib/office/employeePersonnelUpdateService.ts`
- `src/lib/assist/assignmentListService.ts` — effective enforcement
- `src/lib/office/employeeListService.ts` — effective enforcement
- `src/lib/clients/clientBillingService.ts` — billing_profile permissions
- `src/lib/assistCatalog/assistCatalogService.ts` — office.catalogs enforcement

### UI
- `src/components/office/EmployeeRolesPermissionsHub.tsx`
- `src/components/office/rbac/RbacModulePermissionEditor.tsx`
- `src/components/office/rbac/RbacSpecialPermissionsPanel.tsx`
- `src/components/office/rbac/RbacTenantRolesPanel.tsx`
- `src/components/office/EmployeePersonnelFilePanel.tsx`

### Tests
- `src/__tests__/permissions/rbacEffectivePermissions.test.ts` (15 Szenarien)

## Funktionsumfang (Phase E)

| Bereich | Status |
|---------|--------|
| Modul-Tabs: editierbare Matrix (Lesen/Erstellen/Bearbeiten/Löschen/Freigeben/Export) | ✅ |
| Suche + Risiko-Filter pro Tab | ✅ |
| Kritische Änderungen: Pflicht-Begründung vor Speichern | ✅ |
| Sonderrechte: Override-Liste, Add/Remove, Gültigkeit, Scope-UI | ✅ |
| Mandanten-Rollenvorlagen: Duplizieren, CRUD, Rechte übernehmen | ✅ |
| `getActorEffectivePermissions(profile, tenantId)` | ✅ |
| `enforceWithActor` in Key-Services (assignments, employees, billing, catalogs) | ✅ |
| `permission_audit_log` bei Rollen/Overrides/Scopes/Templates | ✅ |
| Fallback `staticRolePermissions` ohne employeeId | ✅ |

## Tests

`src/__tests__/permissions/rbacEffectivePermissions.test.ts` — **15 Szenarien**:

1. Caregiver Assist-Rechte  
2. Admin Tenant-Verwaltung  
3. Multi-Role Union caregiver + dispatch  
4. Override grant  
5. Override deny  
6. Katalog-Vollständigkeit  
7. Keine Roh-Keys in Labels  
8. Preview-Matrix Lesen-Spalte  
9. Billing ohne Mandanten-Admin  
10. Zeiterfassungsmodus office  
11. Nurse Pflege ohne Modul-Admin  
12. Employee Portal ohne Office-Vollzugriff  
13. `enforceWithActor` blockiert ohne effektives Recht  
14. Kritische Änderung erfordert Begründung  
15. Override grant via `saveEmployeePermissionOverrides`  

Ausführung: `npx vitest run src/__tests__/permissions/rbacEffectivePermissions.test.ts`

## Migration angewendet?

| Migration | Remote |
|-----------|--------|
| 0173_rbac_dynamic_model | ✅ angewendet |
| 0174_rbac_seed_catalog_and_templates | ✅ angewendet |
| 0177_client_billing_transaction_lifecycle | N/A für RBAC |

## Verifikation in der App

1. Office → Mitarbeitende → Personalakte → Tab **Rollen & Rechte**
2. Modul-Tab (z. B. Assist): Matrix toggeln, Risiko filtern, speichern
3. Kritisches Recht ändern → Begründungsfeld erscheint, Speichern ohne Text blockiert
4. Tab **Sonderrechte**: Override hinzufügen/entfernen, Daten-Scope setzen
5. Tab **Systemrolle**: Mandanten-Rolle duplizieren (als Tenant-Admin)
6. Tab **Rechte-Vorschau**: Union Rollen + Overrides sichtbar
7. Audit: `permission_audit_log` + Personalakte-Verlauf nach Speichern

## Offene Punkte / Rest-Gaps

| Bereich | Status |
|---------|--------|
| `employee_data_scopes` Runtime-Filter in List-Services | UI ✅, Query-Enforcement noch minimal |
| Flächendeckende `enforceWithActor` in allen ~150 Services | Key-Services ✅, Rest nutzt Fallback |
| IP-Adresse in Audit aus Request-Context | Feld ✅, automatische Erfassung offen |
| PDL als eigene Rolle-Label | Nutzt `nurse` / Pflegefachkraft |

## Production-Ready Einschätzung

**Produktionsnah für Personalakte-RBAC und Pilot:**

- ✅ Schema, RLS, Remote-Migration 0173/0174  
- ✅ Effektiver Rechte-Resolver + Override/Scope-Persistenz  
- ✅ Editierbare Hub-UI inkl. Sonderrechte + Mandantenrollen  
- ✅ Backend-Enforcement in Kern-Services mit Fallback  
- ⚠️ Scope-basierte Datenfilterung in allen Modulen noch ausbaufähig  
- ⚠️ Vollständige Service-Verdrahtung schrittweise nachziehen  

**Empfehlung:** Freigabe für interne Pilotnutzung Personalakte; vor Breitrollout Scope-Enforcement in Listen/Queries ergänzen.
