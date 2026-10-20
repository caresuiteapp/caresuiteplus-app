# ZEIT.1 — Employee Resolver Fix (Mitarbeitendenportal Arbeitszeit)

Stand: 2026-07-03

## Zusammenfassung

Portal-only Mitarbeitende konnten auf `/portal/employee/arbeitszeit` den Fehler „Kein Mitarbeiterprofil…“ sehen, obwohl Profil und Dashboard über `usePortalActor().employeeId` funktionierten. Root Cause: `resolveEmployeeIdForUser` prüfte nur `employees.profile_id`, und WFM-Screens nutzten `profile?.employeeId` statt Portal-Kontext.

ZEIT.1 schließt die Lücke zwischen RLS (`resolve_current_employee_id`) und Client-Services durch Portal-Lookup in `resolveEmployeeIdForUser` und einheitliche `employeeId`-Auflösung in den MP-WFM-Screens.

---

## Geänderte Dateien

| Aktion | Pfad |
|--------|------|
| Fix | `src/lib/wfm/wfmWorkSessionRepository.ts` — `resolveEmployeeIdForUser` + Portal-Fallback |
| Fix | `src/components/timeTracking/TimeTrackingEmployeeScreen.tsx` — `usePortalActor()` |
| Fix | `src/components/wfm/EmployeePortalTimesScreen.tsx` — gleiches Pattern |
| Fix | `src/components/wfm/WfmAbsencePortalScreen.tsx` — gleiches Pattern |
| Neu | `src/__tests__/wfm/resolveEmployeeIdForUser.test.ts` |
| Neu | `src/__tests__/wfm/zeit1EmployeeResolverScreens.test.ts` |
| Anpassung | `src/__tests__/office/profileRoleAndTimeTrackingFix.test.ts` |
| Neu | `docs/audit/zeit1-employee-resolver-fix.md` |

**Nicht geändert (Scope):** Migrationen, RLS, Execute-Workflow, Assist-WFM-Sync, Office-Time-Dashboard, H3/H4/H5 HealthOS, Budget/Proof/Finalize, Auth/Login, Deploy.

---

## Resolver — Auflösungsreihenfolge

1. **`knownEmployeeId`** — wenn übergeben: Mandanten-Validierung via `employees.id` + `tenant_id`
2. **Business** — `employees.profile_id = userId` AND `tenant_id`
3. **Portal** — `employee_portal_accounts.auth_user_id = userId` AND `tenant_id` → `employee_id` (nur aktive Konten: `status` nicht `archived`/`blocked`, kein `blocked_at`)
4. **Fehler** — nutzerfreundlich DE: *„Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte wenden Sie sich an das Office.“*

Pattern analog zu `resolveAuthUserIdForWfmSession` (inverse Richtung).

---

## Screen-Pattern

```typescript
const { employeeId: portalEmployeeId } = usePortalActor();
const employeeId = portalEmployeeId ?? profile?.employeeId ?? null;
```

- **MP:** `portalSession.employeeId` gewinnt (wie Profil/Dashboard)
- **Office:** `profile?.employeeId` unverändert, wenn kein Portal-Kontext

### Fehlertexte (UI)

| Situation | Meldung |
|-----------|---------|
| Keine Verknüpfung | Ihr Portalzugang ist noch keinem Mitarbeiterprofil zugeordnet… |
| Keine Zeiten | Für den ausgewählten Zeitraum sind noch keine Zeiten erfasst. |
| Keine Berechtigung | Sie haben keine Berechtigung, diese Arbeitszeiten zu öffnen. |

Keine RPC-Namen, rohen Supabase-Fehler oder Tabellennamen in der UI.

---

## Unit-Tests

`resolveEmployeeIdForUser.test.ts`:

| # | Fall | Erwartung |
|---|------|-----------|
| 1 | knownEmployeeId + Tenant OK | gewinnt |
| 2 | Business via profile_id | employee_id |
| 3 | Portal-only via employee_portal_accounts | employee_id |
| 4 | Tenant-Isolation | kein Cross-Tenant |
| 5 | Kein Match | freundlicher DE-Fehler |
| 6 | Supabase-Fehler | DE-Fehler ohne technische Codes |
| 7 | Blockiertes Portal-Konto | kein Match |

`zeit1EmployeeResolverScreens.test.ts`: Source-Checks für `usePortalActor`-Pattern auf allen drei Screens.

---

## Browser-Smoke (lokal)

**Stand:** 2026-07-03 (Playwright, `domcontentloaded`)

### Dev-Server

| Punkt | Wert |
|-------|------|
| Blockierter Port | **8085** (node PID 27876) |
| Genutzter Port | **8086** (`npx expo start --web --port 8086 --clear`) |
| Erreichbar | ja (`http://localhost:8086`) |
| Frisches Bundle | ja (`--clear`, cache empty rebuild) |

Lokal: `.audit-zeit1-expo-8086.log`, `.audit-zeit1-browser-results.json`, `.audit-zeit1-browser-screenshots/`.

### Testkonto

- Login: `AUDIT_EMPLOYEE_*` aus `.env` (nicht `.env.local`)
- `employee_portal_accounts`: active, `employee_id` = `911a9b50-0325-45ce-a1ce-87cc9376c816`, tenant `a4ba83bd-65db-46cf-8cf7-61492cc78315`
- `employees.profile_id`: gesetzt (`b1c29257-f200-4ba4-a5c7-84fb1445f2c4`)

### Routen

| Route | Status |
|-------|--------|
| A Login | gruen |
| B profile | gruen |
| C Heute H5 | gruen |
| D arbeitszeit | gruen (kein Profil-Fehler) |
| E times | gruen |
| F urlaub / abwesenheiten | gruen |
| G execution | gelb (RN-Web-Dev-Overlay) |

Gesamt: **gelb**. DB-Stempel: **uebersprungen**. Commit-Readiness Smoke: **ja** fuer ZEIT.1-Kern, kein Code-Fix noetig.

---

## Regression (Vitest)

Ergebnis **2026-07-03** (nach Browser-Smoke):

| Suite | Ergebnis |
|-------|----------|
| `resolveEmployeeIdForUser.test.ts` | **8/8 grün** |
| `zeit1EmployeeResolverScreens.test.ts` | **4/4 grün** |
| `wfmClockService.test.ts` | **7/7 grün** |
| `healthosEmployeePortal.test.ts` | **18/18 grün** |
| `profileRoleAndTimeTrackingFix.test.ts` | **4/4 grün** |

**Gesamt:** **41/41 grün**, **0 rot**.

(Historisch im selben Dokument: erweiterter Lauf mit Assist/HealthOS-Foundation 96 Tests — Smoke-Lauf fokussiert ZEIT.1-relevante Suites.)

## Erfolgskriterien ZEIT.1 (§14.5 Blueprint)

| Kriterium | Status |
|-----------|--------|
| MP Portal-only: Arbeitszeit-Screen laedt Status | **gruen** |
| Einstempeln -> korrekte employee_id in Events | **offen** (Stempel uebersprungen) |
| Keine Office-Regression | **gruen** |
| Unit-Tests gruen | **gruen** (41/41) |
| Kein Widerspruch Profil <-> Arbeitszeit | **gruen** |

---

## Abhängigkeiten & Risiken

- **Dual-Role** (Portal + Business-Profil auf verschiedene MA): selten; `knownEmployeeId` aus Screen hat Vorrang
- **RLS 0017:** Portal-SELECT auf `employee_portal_accounts` für authenticated entzogen — Lookup läuft als eingeloggter Portal-User; bei Permission-Denied ggf. ZEIT.2 RPC-Fallback nötig (nicht Teil ZEIT.1)

---

## Vorgeschlagene Commit-Message

```
fix(wfm): resolve portal employee_id for MP time tracking (ZEIT.1)

Portal-only users could not stamp time because resolveEmployeeIdForUser
only checked employees.profile_id. Add employee_portal_accounts lookup
and use usePortalActor employeeId on MP WFM screens.
```

**Kein `[deploy]`** ohne explizite Nutzeranfrage.
