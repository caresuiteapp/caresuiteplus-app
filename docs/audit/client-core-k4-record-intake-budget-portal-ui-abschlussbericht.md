# Client Core K.4 — Record, Intake, Budget, Portal UI Abschlussbericht

**Datum:** 2026-06-20  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Basis-HEAD:** `f988760` · **Branch:** `main`  
**Scope:** Klient:innen Core K.4 — Akte als zentrale Wahrheit, Edit-Modal, Intake-Sync, Mandanten-UI. **Kein** Mitarbeiter:innen Core, **kein** K.5, **kein** B.2/B.3, **keine** neue Migration (0159 reicht).

---

## 1. Executive Summary

K.4 verbindet die K.0–K.3-Services mit der Office-Akte: **ClientEditModal** (kein separates Edit-Page-Build), **Leistungsbereiche/Budget/Portal** mit echten Service-Daten und ModalStack-Aktionen, **Intake** synchronisiert Profiles/Budget/Portal beim Speichern, **Mandanten-Stubs** zu list/edit UI erweitert, **Portal-Guards** (`canClientPortalSeeFeature`, released proofs only).

**Ergebnis:** ✅ **SUCCESS**

---

## 2. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `f988760` | ✅ (`f988760`) |
| Staged at start | ✅ leer |
| 0154–0159 / staticRolePermissions | ✅ nicht geändert |
| 0159 remote applied | ✅ |
| Kein separates Edit-Page-Build | ✅ `ClientEditScreen` → redirect `?edit=1` → `ClientEditModal` |

Log: `.audit-migration-list-client-core-k4-precheck.log`

---

## 3. UI Inventory (Phase 3)

| Bereich | Route / Komponente | K.4 Status |
|---------|-------------------|------------|
| Akte Übersicht | `ClientRecordScreen` + `ClientRecordOverviewPanel` | ✅ Tabs + KPIs |
| Leistungsbereiche | `ClientServiceProfilesPanel` | ✅ Liste, add/end/primary, ModalStack |
| Stammdaten | Tab + `ClientEditModal` | ✅ Modal unification |
| Budget | `ClientBudgetCorePanel` | ✅ Settings, Warnungen, Bewegungen |
| Portal | `ClientPortalCorePanel` | ✅ Sichtbarkeit, Anfragen approve/reject |
| Dokumente/Verträge | Bestehende Panels | ✅ unverändert angebunden |
| Einsätze | `ClientRecordShiftsPanel` | ✅ Assist assignments |
| Intake | `ClientIntakeModal` + Wizard | ✅ DB-Sections, core sync on save |
| Mandanten | `/settings/tenant/client-service-types`, `client-budget` | ✅ List/edit aus DB |

---

## 4. Service Integration (Phase 4)

| Service | Neu/Erweitert |
|---------|---------------|
| `clientServiceTypeService` | `endClientServiceProfile`, `addClientServiceProfile`, `setPrimaryClientServiceProfile`, `updateTenantClientServiceType`, `getServiceIntakeSections`; **sync endet Profile statt delete** |
| `clientCoreIntakeSyncService` | `syncClientCoreAfterIntake` — profiles + budget init + portal defaults |
| `clientPortalSettingsService` | `canClientPortalSeeFeature`, `canClientPortalSeeServiceFeature`, `reviewClientPortalAccessRequest` |
| `clientIntakeService` | `getRequiredFieldsForServiceTypes`, sync nach create/update |
| `portalServiceProofService` | Guard: proofs nur wenn `canClientPortalSeeFeature(..., 'proofs')` |

---

## 5. Akte Tabs (Phase 5–12)

1. **Übersicht** — Stammdaten, Pflegegrad, Leistungsarten, Schnellzugriff  
2. **Leistungsbereiche** — `client_service_profiles`, ModalStack add/end/primary  
3. **Stammdaten** — Edit öffnet `ClientEditModal`  
4. **Versorgung** — dynamisch je care_context (bestehende Regeln)  
5. **Budget & Abrechnung** — `client_budget_settings`, Bewegungen, Warnungen bei 0 Rest  
6. **Portal** — resolved settings, Zugang, Anfragen  
7. **Dokumente & Verträge** — bestehende Panels  
8. **Einsätze & Nachweise** — Shifts-Panel; Portal nur released proofs  
9. **Kommunikation/Kontakte/Verlauf** — bestehende Tabs + Empty States  

**Edit Modal:** `ClientEditModal` + ModalStack `prep.client.edit` — Multi-Select Leistungsarten, `clientRecordMappingService` Completeness.

**Intake:** `useClientIntakeWizard` lädt `getServiceIntakeSections`; Save ruft `syncClientCoreAfterIntake`.

---

## 6. Modal Stack

| modalKey | Komponente |
|----------|------------|
| `prep.client.record` | `ClientRecordModalPrepScreen` |
| `prep.client.edit` | `ClientEditModalScreen` |
| `client.serviceProfile.add` | `ClientServiceProfileAddModalScreen` |

Hooks: `useOpenClientRecordModal`, `useOpenClientEditModal`

---

## 7. Tests (Phase 13)

| Suite | Ergebnis | Log |
|-------|----------|-----|
| `clientRecordUi.test.ts` | ✅ 6/6 | `.audit-test-client-core-k4-precommit.log` |
| `clientEditModal.test.ts` | ✅ 5/5 | (同上) |
| `clientCoreK4Intake.test.ts` | ✅ 4/4 | (同上) |
| `clientCoreK03.test.ts` | ✅ 9/9 | Regression |
| `modalStack.test.ts` | ✅ 5/5 | Regression |
| `assistProofToPortalFlow.test.ts` | ✅ 10/10 | Regression |

K.4 Typecheck-Scope: ✅ keine neuen Fehler — `.audit-typecheck-client-core-k4-precommit.log`

---

## 8. Harte Grenzen

| Grenze | eingehalten |
|--------|-------------|
| Kein delete clients/profiles/budgets | ✅ `endClientServiceProfile` |
| Portal nicht alles sichtbar | ✅ konservative Defaults |
| Kein GPS im Klientenportal | ✅ `visit_tracking` always false |
| Kein staticRolePermissions / B.2 / B.3 | ✅ |
| Kein Budget-Hardcode in React | ✅ DB reads |
| Keine Migration 0160 | ✅ |

---

## 9. Commits

Message: `feat(client-core): unify client record intake budget portal ui`

---

## 10. Offene Punkte (K.5+)

- Vollständige Versorgungs-Module je Leistungsart (ambulant/stationär)
- Budget-Bewegungen manuell buchen UI
- Dedizierte Mandanten-Route Portal-Defaults (derzeit über `tenant_client_portal_defaults` + Service)
