# Portal System Abnahme-Checklist — Status

**Stand:** 2026-06-22 · **Scope:** Portal System Core P.0–P.5.1 + R.1 compact shell

| # | Kriterium | Status | Nachweis |
|---|-----------|--------|----------|
| P.0.1 | Git-Gates (main, HEAD, staged, 0154–0159) | ✅ | `.audit-migration-list-portal-p5-precheck.log` |
| P.0.2 | Keine Permission-Änderung | ✅ | staticRolePermissions clean |
| P.1.1 | Portal Shell Client + Employee | ✅ | ClientPortalShell, EmployeePortalShell; R.1 compact drawer + bottom nav <1024px |
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
| P.4.4 | Live HTTP-Smoke Client + Employee routes | ✅ | P.4 + P.5 Abnahmebericht §5–6 |
| P.4.5 | Budget/Hilfe Nav → dedizierte Routen | ✅ | buildPortalNavigation fix |
| P.4.6 | Office Sync-Kette Code-Pfade | ✅ | ClientPortalCorePanel, PortalSyncChainPanel |
| P.5.1 | Real-access route smoke (18 routes) | ✅ | P.5 §5–6 HTTP 200 on :8082 |
| P.5.2 | Test context documented (no secrets) | ✅ | P.5 §4 |
| P.5.3 | Authenticated E2E browser login | ⚠️ partial | Edge E2E ✅ (P.5.1); Browser-MCP UI ⚠️ |
| P.5.1a | Scoped test access (Test Pflege GmbH) | ✅ | P.5.1 §5 — no secrets in report |
| P.5.1b | Edge login Client + Employee | ✅ | `client-portal-login` + `employee-portal-login` |
| P.5.1c | HTTP smoke 18 routes (:8083) | ✅ | `.audit-portal-p51-http-smoke.log` |
| P.5.1d | Portal/auth regression 50/50 | ✅ | `.audit-test-portal-p51-precommit.log` |
| P.5.4 | Core regression 60/60 + proof flow 10/10 | ✅ | `.audit-test-portal-p5-precommit.log` |
| P.5.5 | Office Client portal card | ✅ | ClientPortalCorePanel |
| P.5.6 | Employee impact card | ✅ | EmployeePortalImpactPanel |
| P.5.7 | Portal sync chain UI | ✅ | PortalSyncChainPanel |
| P.6.1 | portalSyncFlow tests | ✅ | 6/6 green |
| P.6.2 | Projection smoke tests | ✅ | 6/6 green |
| P.6.3 | assistProofToPortalFlow regression | ✅ | 10/10 green |
| P.6.4 | modalStack regression | ✅ | 5/5 green |
| — | Migration 0160 (Portal scope) | ❌ nicht nötig | Portal P.0–P.5 |
| — | K.5 billing non-disclosure verified | ✅ | clientCoreK5BillingHandoff + portalProjectionServices |
| — | Mitarbeiter Core / B.2 / B.3 | ❌ nicht gestartet | Scope |

**Gesamt:** 37/38 ✅ · 1 ⚠️ partial (P.5.3 Browser UI E2E)
