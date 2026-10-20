# Content Portal Live Rebuild — Abnahmebericht (C.10)

**Datum:** 2026-06-23  
**Scope:** C.1–C.10 Content, Portal & Live-Data Rebuild

## Checkliste (Auszug Spec §20)

| # | Punkt | Status |
|---|--------|--------|
| 1 | Git/DB Safety Precheck dokumentiert | ✅ C.1 |
| 2 | Dateninventur + LIVE-Whitelist | ✅ C.2 (Helferhasen+ bestätigt) |
| 3 | Migration 0056/0162 Environment Repair | ✅ Remote + Migration-Datei |
| 4 | Demo-Leak Guards (`guardServiceTenant`) | ✅ |
| 5 | LIVE Bestand 0 Deletes | ✅ C.4 |
| 6 | E2E-Mandant isoliert (`internal_test`) | ✅ |
| 7 | E2E Seed Runner | ✅ `contentPortalE2eSeed.mjs` |
| 8 | Auth Bootstrap Runner | ✅ `contentPortalAuthBootstrap.mjs` |
| 9 | ModalStack Freigabe / MA-Akte | ✅ Registry erweitert |
| 10 | Client Portal Toggle-UI | ✅ `ClientPortalCorePanel` |
| 11 | Office Freigaben Inbox | ✅ `OfficePortalApprovalsInbox` |
| 12 | Portal Sync Chain | ✅ `PortalSyncChainPanel` + Service |
| 13 | Employee Portal Tab | ✅ `EmployeeDetailScreen` |
| 14 | Budget Edit UI | ✅ `client-budget.tsx` |
| 15 | Service Catalog Services | ✅ `tenantServiceCatalogService` |
| 16 | Unit Tests contentPortal | ✅ 3 Testdateien |
| 17 | portalSyncFlow erweitert | prüfen bei CI |
| 18 | Typecheck scoped | siehe Log |
| 19 | Browser Abnahme E2E only | Helper + manuell |
| 20 | Kein Deploy / kein blind db push | ✅ |
| 21 | Kein K.6 / Rechnungsnummern | ✅ |
| 22 | `tenant_environment_settings` DB | ✅ Hydration |
| 23 | Demo UUID block production | ✅ |
| 24 | Pilot tenants `pilot` mode | ✅ DB seed |
| 25 | Musterpflege unbestätigt | ⚠️ Nutzer-Freigabe offen |
| 26 | Audit-Berichte | ✅ docs/audit |
| 27 | Selektive Commits | ✅ 5 Commits |
| 28 | Push | nur nach Nutzerfreigabe |
| 29 | Screenshots ohne LIVE PII | Policy dokumentiert |
| 30 | Empty States statt Fake KPIs | ✅ Dashboard guards |

## Tests

```bash
npm test -- src/__tests__/contentPortal
```

## Logs (nicht committed)

- `.audit-typecheck-content-portal-live-data-rebuild.log`
- `.audit-test-content-portal-live-data-rebuild.log`

## Offene Punkte

- **LIVE-Whitelist erweitern:** weitere echte Mandanten vom Nutzer benennen (z. B. Musterpflege Digital)
- **Browser E2E:** gültige `.env` Credentials für vollständige Playwright-Abnahme
- **Auth Bootstrap:** bei `invalid_credentials` Credentials erneuern
