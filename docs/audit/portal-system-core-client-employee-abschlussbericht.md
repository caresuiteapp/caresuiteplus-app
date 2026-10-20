# Portal System Core P.0–P.3 — Client & Employee Abschlussbericht

**Datum:** 2026-06-20  
**Supabase Project:** `euagyyztvmemuaiumvxm`  
**Basis-HEAD:** `83b0938` · **Branch:** `main`  
**Scope:** Gemeinsames Portal-System — Klient:innen-Portal, Mitarbeiter:innen-Portal, Office-Steuerung, Assist-Brücke. **Kein** K.5, **kein** Mitarbeiter:innen Core final, **kein** B.2/B.3, **keine** Migration 0160.

---

## 1. Executive Summary

Portal System Core P.0–P.3 vereinheitlicht beide Portale auf einem gemeinsamen Kern: **Portal Shells**, **Sichtbarkeits-/Projektionsservices**, **Office/Akte-Steuerung** und **Sync-Flow-Tests**. Klient:innen-Portal nutzt `canClientPortalSeeFeature` / 0159-Settings; Mitarbeiter:innen-Portal bleibt einsatzbezogen ohne Budget/Rechnungen/volle Akte.

**Ergebnis:** ✅ **SUCCESS**

---

## 2. Ausgangslage

| Vorgänger | Status |
|-----------|--------|
| Assist Phase 4–4.6 (Proof → Portal) | ✅ |
| System Navigation / Modal Stack (`f25c24a`) | ✅ |
| Client Core K.0–K.3 (0159) | ✅ |
| Client Core K.4 (`83b0938`) | ✅ |
| Portale vorher unvollständig | → P.0–P.3 geschlossen |

---

## 3. Git / Abort-Gates (Phase 1)

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `83b0938` | ✅ |
| Staged at start | ✅ leer |
| Behind/diverged | ✅ 0/0 |
| 0154–0159 / staticRolePermissions | ✅ nicht geändert |
| 0159 remote applied | ✅ (Precheck-Log) |

Log: `.audit-migration-list-portal-system-core-precheck.log`

---

## 4. Portal-Inventar (Auszug)

| Portal | Bereich | Route/Service | Projection | Status |
|--------|---------|---------------|------------|--------|
| Client | Übersicht | `app/portal/client/(tabs)/index` | `getClientPortalDashboardProjection` | ✅ |
| Client | Termine/Einsätze | `appointments` | gated `appointments` | ✅ |
| Client | Nachweise | Assist section + `portalAssistVisitProofService` | released only | ✅ |
| Client | Budget | `app/portal/client/budget` | `getClientPortalBudgetProjection` | ✅ neu |
| Client | Hilfe | `app/portal/client/help` | — | ✅ neu |
| Employee | Übersicht | `app/portal/employee/(tabs)/index` | `getEmployeePortalDashboardProjection` | ✅ |
| Employee | Einsätze | `assignments` | `getEmployeeAssignedVisitsProjection` | ✅ |
| Employee | Durchführung | `execution` + `assignments/[id]/execute` | execution service | ✅ |
| Employee | Aufgaben/Zeiten/Hilfe | `tasks`, `times`, `help` | empty/hub states | ✅ neu |
| Office | Portal-Tab | `ClientPortalCorePanel` | visibility + sync | ✅ erweitert |

---

## 5. Klient:innen-Portal

- **Layout:** `ClientPortalShell` → `PortalShellLayout` (Aurora/Glass)
- **Navigation:** dynamisch via `buildPortalNavigation` + `PortalSectionGate`
- **Sichtbarkeit:** `canClientPortalSeeFeature`, `client_portal_settings` / 0159
- **Blockiert:** GPS, Fahrtenbuch, interne Notizen, nicht freigegebene Nachweise

---

## 6. Mitarbeiter:innen-Portal

- **Layout:** `EmployeePortalShell` → `ShellLayout area="portal_employee"`
- **Navigation:** erweiterte `PORTAL_EMPLOYEE_TABS` (Durchführung, Zeiten)
- **Einsatzsicht:** nur zugewiesene Einsätze, begrenzte Klient:innenfelder
- **Blockiert:** Budget, Rechnungen, volle Akte, Portal-Freigabeeinstellungen

---

## 7. Portal-Projektionen

| Service | Funktionen |
|---------|------------|
| `portalVisibilityService.ts` | Matrix, Sanitizer, Sync-State, Employee-Impact |
| `clientPortalProjectionService.ts` | Dashboard, Budget, Visits, Proofs |
| `employeePortalProjectionService.ts` | Assigned visits, Dashboard, Field guards |
| `portalSystem.ts` | Shared types |

---

## 8. Office/Akte Portal-Steuerung

- **Klient:innen-Portal Karte:** bestehend K.4 + Sichtbarkeit
- **Mitarbeiter:innen-Portal-Auswirkung:** `EmployeePortalImpactPanel` (neu)
- **Portal-Sync-Kette:** `PortalSyncChainPanel` (neu)

---

## 9. Portal-Sync-Matrix (Kurz)

| Fachbereich | Office | Employee Portal | Client Portal | Freigabe |
|-------------|--------|-----------------|---------------|----------|
| Einsatzstatus | ✅ | ✅ zugewiesen | ✅ appointments | Settings |
| Leistungsnachweis | ✅ prüfen | ✅ erzeugen | ✅ released only | Office release |
| PDF | ✅ | — | ✅ wenn released | Office |
| Budget | ✅ | ❌ blockiert | ✅ show_budget | Settings |
| GPS/Tracking | read-only | ✅ einsatz+consent | ❌ blockiert | hard block |

---

## 10. Optional 0160

| | |
|---|---|
| Erstellt | ❌ Nein |
| Angewendet | ❌ Nein |
| Begründung | `employee_portal_accounts` / 0132 + Assist 0156 reichen |

---

## 11. Tests / Typecheck

| Suite | Ergebnis | Log |
|-------|----------|-----|
| `portalSyncFlow.test.ts` | ✅ 6/6 | `.audit-test-portal-system-core-precommit.log` |
| `portalProjectionServices.test.ts` | ✅ 6/6 | (同上) |
| `assistPortalShellLayout.test.ts` | ✅ 7/7 | Regression |
| `assistProofToPortalFlow.test.ts` | ✅ 10/10 | Regression |

Typecheck: Repo-Baseline weiterhin rot; **keine neuen Fehler in geänderten Portal-Dateien** — `.audit-typecheck-portal-system-core-precommit.log`

---

## 12. Bestandsschutz

- Keine Mandanten/Klient:innen/Mitarbeitende gelöscht
- Keine Portalzugänge/Budgets/Nachweise überschrieben
- 0154–0159 und `staticRolePermissions` unverändert

---

## 13. Nicht ausgeführt

K.5 Abrechnung · Mitarbeiter:innen Core final · B.2/B.3 · Permission-Änderungen · Migration 0160

---

## 14. Nächste Empfehlung

**Option C zuerst:** Manuelle Portal-Live-Abnahme (Client + Employee + Office-Freigabe-Kette), danach **K.5 Budgetverbrauch/Abrechnungsübergabe**.
