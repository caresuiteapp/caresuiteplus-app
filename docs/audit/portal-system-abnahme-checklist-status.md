# Portal System Abnahme-Checklist — Status

**Stand:** 2026-06-20 · **Scope:** Portal System Core P.0–P.3

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| P.0.1 | Git-Gates (main, HEAD, staged, 0154–0159) | ✅ | precheck log |
| P.0.2 | Keine Permission-Änderung | ✅ | staticRolePermissions clean |
| P.1.1 | Portal Shell Client + Employee | ✅ | ClientPortalShell, EmployeePortalShell |
| P.1.2 | PortalNavigation / EmptyState / SectionGate | ✅ | components/portal |
| P.1.3 | Aurora/Glass, kein CareLight-Weiß | ✅ | GlassCard / auroraGlass |
| P.2.1 | Client Portal settings-gated | ✅ | canClientPortalSeeFeature |
| P.2.2 | Kein GPS im Klientenportal | ✅ | visit_tracking always false |
| P.2.3 | Released proofs only | ✅ | portalAssistVisitProofService |
| P.2.4 | Budget route gated show_budget | ✅ | app/portal/client/budget |
| P.3.1 | Employee assigned visits only | ✅ | employeePortalProjectionService |
| P.3.2 | Kein Budget/Rechnung in Employee Portal | ✅ | sanitizers + impact panel |
| P.3.3 | Execution hub + execute route | ✅ | execution + assignments/execute |
| P.4.1 | portalVisibilityService | ✅ | src/lib/portal |
| P.4.2 | clientPortalProjectionService | ✅ | projections + types |
| P.4.3 | employeePortalProjectionService | ✅ | projections + types |
| P.5.1 | Office Client portal card | ✅ | ClientPortalCorePanel |
| P.5.2 | Employee impact card | ✅ | EmployeePortalImpactPanel |
| P.5.3 | Portal sync chain UI | ✅ | PortalSyncChainPanel |
| P.6.1 | portalSyncFlow tests | ✅ | 6/6 green |
| P.6.2 | Projection smoke tests | ✅ | 6/6 green |
| P.6.3 | assistProofToPortalFlow regression | ✅ | 10/10 green |
| — | Migration 0160 | ❌ nicht nötig | bestehende Tabellen |
| — | K.5 / Mitarbeiter Core / B.2 / B.3 | ❌ nicht gestartet | Scope |

**Gesamt:** 22/22 ✅
