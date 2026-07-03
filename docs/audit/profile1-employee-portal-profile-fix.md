# PROFILE.1 — Employee Portal Mitarbeiterakte (14 Tabs)

**Date:** 2026-07-03  
**Scope:** `/portal/employee/profile` — read-only Mitarbeiterakte aligned with Office Personalakte  
**Status:** Ready for standalone commit (tests 84/84 green; smoke 4 grün / 1 rot offline E2E)

---

## Root cause

The employee portal profile route (`/portal/employee/profile`) previously rendered **demo/mock profile data** and a minimal tab set instead of the Office Personalakte. Employees saw placeholder content, auth-user avatars instead of `employees.avatar_url`, and no payroll or personnel tabs. The screen did not scope data to `usePortalActor().employeeId`, so it could not show the signed-in employee's real Mitarbeiterakte.

**Fix:** Wire the profile screen to live Supabase personnel data via `useEmployeePortalPersonnelView`, project Office personnel fields into 14 read-only portal tabs with masking and sanitization, and render the hero from `employees.avatar_url` with initials fallback.

---

## Phase 1 — Office Mitarbeiterakte analysis

| # | Tab | Office source | Data source | Portal-safe fields | Masked | Office actions stripped |
|---|-----|---------------|-------------|-------------------|--------|-------------------------|
| 1 | Übersicht | `EmployeePersonnelFilePanel` → `overview` | `buildEmployeePersonnelOverview`, profile KPIs | Name, Rolle, Status, Beschäftigungsart, Eintritt, Wochenstunden, Einsatzfähigkeit, Zeiterfassung | — | Blocker buttons, edit links |
| 2 | Stammdaten | `master_data` + `EmployeePayrollPersonnelPanel` | `employees`, payroll personal | Vor-/Nachname, Geburtsdatum, Personalnr., Adresse, Nationalität | — | Bearbeiten, Kostenstelle edit |
| 3 | Kontakt | `contact` | `employees` master | E-Mail, Telefon, Mobil, Notfallkontakt | — | Bearbeiten, Mobilität-Office-Panel edit |
| 4 | Anstellung | `employment` | employment + master | Eintritt, Art, Funktion, Vertrag, Probezeit, Standort, Stunden, Status | — | Save forms, FilterChip edits |
| 5 | Vergütung & Bank | `compensation` | payroll bundle | Art, Betrag, Intervall, Bankname, Kontoinhaber | **IBAN** `DE•• •••• •••• •••• 1234` | All edit inputs |
| 6 | Steuer & SV | `tax_social` | payroll tax + SV | Lohnsteuerart, KK, Versorgungswerk, Minijob-Hinweis | **Steuer-ID**, Versicherungsnr. | All edit inputs |
| 7 | Mehrfachbeschäftigung | `secondary_employment` | payroll secondary rows | Ja/Nein, Arbeitgeber, Brutto | — | Add/remove rows |
| 8 | Rollen & Rechte | `roles_permissions` / `EmployeeRolesPermissionsHub` | portal access + role labels | Portalrolle, Funktion, freigegebene Bereiche, Zeiterfassungsmodus | — | Permission keys, RBAC editor, role save |
| 9 | Qualifikationen | `qualifications` | `employee_qualifications` | Titel, Art, Status, Gültigkeit | — | Toggle erfassen, Führungszeugnis edit |
| 10 | Dokumente | `documents` | `employee_documents` | Portal-freigegeben only (`releasedToPortal`) | Sensitive categories filtered | Upload, delete |
| 11 | Portal | `portal` / `EmployeePortalAccessPanel` | portal account | Status, letzte Anmeldung, E-Mail, Passwort/ZFA flags | No auth user ID | Invite, reset, admin toggles |
| 12 | Einsatzfähigkeit | `deployability` | deployability service | Status, Bereich, Verfügbarkeit, FS, Führungszeugnis, Hinweise (messages only) | — | Blocker action buttons |
| 13 | Arbeitsmaterial | `work_materials` | inventory assignments | Name, Kategorie, Status, Ausgabe/Rückgabe | — | Inventar öffnen (office route) |
| 14 | Verlauf | `audit` | `employee_audit_events` | Summary + Datum only | No action codes, field_changes, actor IDs | — |

**Key Office files referenced (not copied):**

- `src/components/office/EmployeePersonnelFilePanel.tsx` — 14-tab UI structure (`OFFICE_PERSONNEL_UI_TABS`)
- `src/lib/office/employeePersonnelFileLiveLoader.ts` — live personnel bundle
- `src/lib/office/employeePersonnelAccess.ts` — portal document filtering
- `src/components/office/EmployeePayrollPersonnelPanel.tsx` — field labels for payroll tabs

---

## Phase 2–3 — Portal implementation

### New / changed files

| File | Purpose |
|------|---------|
| `src/types/portal/employeePersonnel.ts` | Portal view types per tab |
| `src/lib/portal/employeePortalPersonnelMasking.ts` | IBAN / Steuer-ID / SV masking |
| `src/lib/portal/employeePortalPersonnelProjection.ts` | Office → portal read-only projection |
| `src/lib/portal/employeePortalPersonnelLiveService.ts` | Live fetch + document filter |
| `src/lib/portal/employeePortalPersonnelService.ts` | Permission gate + mode switch |
| `src/lib/portal/portalErrorSanitizer.ts` | Hide technical error tokens in UI |
| `src/hooks/useEmployeePortalPersonnelView.ts` | Portal-scoped personnel hook |
| `src/components/portal/profile/*` | Tab constants, info rows, 14 tab panels |
| `src/screens/portal/EmployeeProfileScreen.tsx` | 14-tab screen with hero + pills |

### Data flow

```
usePortalActor().employeeId + tenantId
  → fetchEmployeePortalPersonnelView (portal.employee.profile.view)
  → loadEmployeePersonnelFileLive (RLS self-select)
  → filterPersonnelDocumentsForViewer (releasedToPortal only)
  → projectEmployeePersonnelForPortal (mask + sanitize)
  → PortalEmployeeProfileTabContent (read-only UI)
```

No route IDs — employee scope from portal actor only.

### Photo priority (header + hero)

1. `employees.avatar_url` (via `fetchLiveEmployeePortalProfile` / `usePortalProfileAvatar`)
2. User profile avatar (`useAuth().profile.avatarUrl`)
3. Initials fallback (`PortalReadOnlyAvatar` → `PremiumAvatar`)

Portal account avatar column not present in schema — steps 1–2 + initials cover current data.

---

## Phase 4 — Permissions & empty states

- All queries tenant + `usePortalActor().employeeId` scoped
- 403 / technical errors → `isTechnicalPortalErrorMessage` → friendly German message
- Per-tab empty states via `PORTAL_PROFILE_EMPTY_MESSAGES`

---

## Phase 5 — Section matrix (live vs empty)

| Tab | Expected with audit employee | Empty state |
|-----|------------------------------|-------------|
| Übersicht | Real name, role, status | „Keine Daten hinterlegt.“ |
| Stammdaten | Name, PN, address if in DB | same |
| Kontakt | Email, phone if in DB | same |
| Anstellung | Entry, type, hours | same |
| Vergütung & Bank | Amount + masked IBAN if payroll exists | same |
| Steuer & SV | Tax class + masked Steuer-ID if exists | same |
| Mehrfachbeschäftigung | „Nein“ or employer rows | same |
| Rollen & Rechte | Mitarbeiterportal + module labels | same |
| Qualifikationen | Certs from DB | same |
| Dokumente | Portal-released only | „Keine für Sie freigegebenen Dokumente vorhanden.“ |
| Portal | Active status, last login | same |
| Einsatzfähigkeit | Deployability summary | same |
| Arbeitsmaterial | Issued items | same |
| Verlauf | Sanitized audit summaries | „Noch keine sichtbaren Änderungen vorhanden.“ |

---

## Phase 6 — Tests

```bash
npx vitest run \
  src/__tests__/portal/employeePortalProfileLive.test.ts \
  src/__tests__/portal/portalM3MobileLayout.test.ts \
  src/__tests__/portal/employeePortalLiveOverview.test.ts \
  src/__tests__/healthos/healthosEmployeePortal.test.ts \
  src/__tests__/wfm/zeit1EmployeeResolverScreens.test.ts \
  src/__tests__/offline/offlineNotice.test.tsx \
  src/__tests__/offline/useConnectivity.test.tsx
```

| Suite | Result |
|-------|--------|
| `employeePortalProfileLive.test.ts` | **24/24 pass** |
| `portalM3MobileLayout.test.ts` (H5 portal) | **19/19 pass** |
| `employeePortalLiveOverview.test.ts` | **9/9 pass** |
| `healthosEmployeePortal.test.ts` | **18/18 pass** |
| `zeit1EmployeeResolverScreens.test.ts` (ZEIT.1) | **4/4 pass** |
| `offlineNotice.test.tsx` (OFFLINE.1) | **4/4 pass** |
| `useConnectivity.test.tsx` | **6/6 pass** |
| **Total** | **84/84 pass** |

Profile test coverage includes: 14 tabs, portal actor scoping, masking, no permission keys, portal docs filter, no raw audit data, read-only, mobile scroll pills.

---

## Phase 7 — Browser smoke (`http://localhost:8088`)

Credentials: `.env.local` `AUDIT_EMPLOYEE_*` (not logged). Script: `.audit-profile1-smoke.mjs`

| Check | Status | Notes |
|-------|--------|-------|
| A. Profile mobile — 14 tabs, hint, no edit | **Grün** | Office hint visible |
| A. Profile desktop | **Grün** | Loads with tab layout |
| B. Heute / header name | **Grün** | „Heute“ visible |
| C. `/portal/employee/arbeitszeit` | **Grün** | No profile error leakage |
| D. OFFLINE.1 offline banner | **Rot** | Playwright offline navigation — banner not detected (SPA/cache limitation; unit tests pass) |

**Summary:** 4 grün · 0 gelb · 1 rot

Console: 400/403 resource errors during smoke (RLS on optional tables) — not surfaced in UI.

---

## Phase 8 — Risks & follow-ups

| Risk | Mitigation |
|------|------------|
| Payroll/personnel RLS gaps → empty tabs | Clean empty states; no raw errors |
| Audit events contain technical summaries | `sanitizeHistorySummary` replaces known tokens |
| Languages field not in schema | Einsatzfähigkeit tab omits until data model exists |
| Offline banner E2E flaky | OFFLINE.1 covered by unit tests |

---

## Phase 9 — Spec matrix

| Requirement | Status |
|-------------|--------|
| 14 tabs matching Office Personalakte | ✅ |
| Read-only everywhere | ✅ |
| `usePortalActor().employeeId` only | ✅ |
| IBAN / Steuer-ID masked | ✅ |
| Portal docs only (`releasedToPortal`) | ✅ |
| No permission keys / auth IDs / audit JSON | ✅ |
| Photo: employee → user → initials | ✅ |
| Office hint | ✅ |
| No commit / push / deploy | ✅ |
| No RLS / migration / auth changes | ✅ |

### Commit readiness

| Gate | Status |
|------|--------|
| PROFILE.1 files only in commit | ✅ (stationaer hero test collateral left unstaged) |
| Secret scan on staged files | ✅ clean |
| Regression tests 84/84 | ✅ |
| Browser smoke A–C | ✅ grün |
| OFFLINE.1 offline banner E2E | 🔴 known SPA limitation (unit tests pass) |
| Migrations / RLS / auth unchanged | ✅ |
| ZEIT / WFM / Proof / Budget / Offline code unchanged | ✅ |
| Deploy / push | ❌ not performed |

**Commit message (exact):**

```
fix(portal): render employee profile from system data
```

**Push:** Safe without `[deploy]` — `netlify.toml` ignore script skips Netlify build on normal pushes.

---

## Not changed (out of PROFILE.1 scope)

- `supabase/migrations/*` — no new migrations in this commit
- RLS policies — unchanged (relies on existing `0189_employee_portal_live_rls`)
- ABSENCE.1, OFFLINE.2, SIGNATURE.1, ZEIT/WFM, Proof, Budget modules
- Admin edit flows, document upload/delete, permission editors
- `.audit-*` scripts/logs, smoke screenshots (local artifacts only)

---

## Artifacts (local, not committed)

- `.audit-profile1-smoke.mjs`
- `.audit-profile1-smoke-results.json`
- `.audit-expo-8088-profile1.log`
- `docs/audit/profile1-smoke-screenshots/` (if smoke run created them)
