# CareSuite+ — Phase 2 / 2.1 / 2.2 Smoke: Dokumente & Unterschriften

Stand: 2026-07-06 (Phase 2.2 — Portal-RBAC + Verify)

## Scope

End-to-End-Flow: Office → Send-Wizard → Portal → Signatur → Erledigt

**Nicht in Phase 2.2:** Einsatzstart-Blockade, PDF-Archiv.

## Phase 2.2 Abschluss

| Check | Befehl / Artefakt | Ergebnis 2026-07-06 |
|-------|-------------------|----------------------|
| Migration 0234 | `supabase/migrations/0234_cs_document_portal_permissions.sql` | **Remote angewendet** (inkl. Portal-Rollen-Bootstrap) |
| Portal-RBAC Verify | `node scripts/audit/verify-cs-document-portal-permissions.mjs` | **Exit 0** |
| Code-Fix | `usePermissions` → `resolveEffectiveRoleKey` | **Committed** (Dual-Role Audit-MA) |
| Vorlagen Verify | `node scripts/audit/verify-cs-vorlagen-db.mjs` | **Exit 0** |
| Unit-Tests | `npm test -- src/__tests__/documents/csTemplateDatabase.test.ts` | **19/19 grün** |
| MA-Portal RBAC | `/portal/employee/documents/signatures` | **Pass** — kein „Kein Zugriff“ |
| Send→Sign→Erledigt E2E | `.audit-cs-documents-phase2-send-sign-smoke.mjs` | **Offen** — Wizard-Vorschau/Overlay blockiert Automatisierung |
| Push / Deploy | Commit mit `[deploy]` | **Ja** (Nutzer explizit) |

### RBAC Root Cause (Phase 2.2)

1. **DB:** `portal.employee.documents.view` / `.download` fehlten in `permission_catalog` + `role_permissions` für `employee_portal` (Live-DB hatte teils keine Portal-Rollen-Keys).
2. **Runtime:** Dual-Role Audit-MA (`business_admin` + Mitarbeiterportal) — `usePermissions` nutzte `profile.roleKey` statt `portalSession.roleKey`.

**Fix:** Migration **0234** (idempotent, keine User-ID-Bypasses) + `resolveEffectiveRoleKey` in `usePermissions` (wie `RequireRole`).

### MA-Portal Smoke (2026-07-06)

Route: `/portal/employee/documents/signatures`

| Schritt | Ergebnis |
|---------|----------|
| Route lädt | Pass |
| Kein „Kein Zugriff“ | Pass |
| Navigation sichtbar | Pass |
| Leerzustand / Dokumentliste | Pass (leer oder offene Docs) |

## Phase 2.1 Abschluss (Referenz)

| Check | Ergebnis 2026-07-05 |
|-------|----------------------|
| Feature-Commit | `a075fc8d` |
| Migration 0233 remote | **Angewendet** |
| Verify Vorlagen | **Exit 0** |
| Unit-Tests | **19/19 grün** |
| E2E Basis-Smoke | **Exit 0** (Office + Wizard) |

## Automatisierte Checks

| Check | Befehl |
|-------|--------|
| Portal-RBAC | `node scripts/audit/verify-cs-document-portal-permissions.mjs` |
| Vorlagen + Seed | `node scripts/audit/verify-cs-vorlagen-db.mjs` |
| Unit-Tests | `npm test -- src/__tests__/documents/csTemplateDatabase.test.ts` |
| E2E (untracked) | `node .audit-cs-documents-phase2-send-sign-smoke.mjs` |

## Bekannte Grenzen

| Thema | Status |
|-------|--------|
| Migration 0233 | **Erledigt** |
| Migration 0234 (Portal-Dokumentrechte) | **Erledigt** (remote + verify Exit 0) |
| MA-Portal `portal.employee.documents.view` | **Erledigt** |
| E2E Send→Sign→Erledigt (automatisiert) | **Offen** — Playwright-Overlay bei Empfängerwahl / Vorschau-Ladebutton |
| PDF-Export | Phase 4 |
| Einsatz-Blockade | Phase 3 — **nicht** aktiv |

## Empfehlung

| Kriterium | Bereit? |
|-----------|---------|
| Phase 2 RBAC (MA-Portal Dokumente) | **Ja** |
| Phase 2 E2E Send→Sign (automatisiert) | **Nein** — manuell oder Script-Fix |
| Phase 3 (Einsatz-Blockade) | **Nein** |
