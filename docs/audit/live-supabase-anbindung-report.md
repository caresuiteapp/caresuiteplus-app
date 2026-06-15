# Live Supabase Anbindung — Abschlussbericht (Auth/Portal-Block)

**Datum:** 2026-06-13  
**Projekt:** `caresuiteplus-production` (`euagyyztvmemuaiumvxm`)  
**Scope:** Schritte 1–9 des Live-Supabase-Blocks nach Auth-Restrukturierung

---

## Kurzfassung

Der Live-Supabase-Block ist **implementiert und lokal verifiziert** (Tests, Auth-Services, Edge-Function-Quellcode, RLS-Migration 0017). Remote wurden die Auth-/Portal-Tabellen (0016) und RLS-Härtung (0017) per Supabase MCP angewendet; TypeScript-Typen wurden aus dem Remote-Schema regeneriert.

**Nicht behauptet:** production-ready, live-ready oder vollständig E2E-verifiziert. Remote Auth-Flows, Edge-Function-Deploy und RLS unter Last sind **separat zu prüfen**.

---

## 1. `supabase db push` — Migrationen

| Migration | Inhalt | Remote-Status |
|-----------|--------|---------------|
| `0016_auth_access_portals_and_user_management.sql` | `tenant_users`, `employee_portal_accounts`, `client_portal_codes`, `relative_portal_codes`, `portal_access_permissions`, `role_permission_sets`, `user_module_permissions`, `login_audit_events`, … + RLS | Angewendet via Supabase MCP |
| `0017_auth_portal_rls_hardening.sql` | Indizes, sichere Views ohne Hashes, REVOKE SELECT auf Hash-Tabellen, Write-only-Policies | Angewendet via Supabase MCP |

**Hinweis:** Lokales `supabase db push` scheiterte ohne `supabase login` / Access Token. MCP-Migrationen wurden stattdessen ausgeführt. CLI-Historie und MCP-Historie können divergieren — bei Bedarf `supabase migration repair` / manueller Abgleich.

---

## 2. `database.types.ts` / `types.ts`

- Regeneriert aus Remote via Supabase MCP `generate_typescript_types`
- Geschrieben nach:
  - `src/lib/supabase/types.ts`
  - `src/lib/supabase/database.types.ts`
- Skript: `scripts/write-generated-types.mjs` + `npm run fetch-remote-types`

Neue Tabellen (`tenant_users`, `employee_portal_accounts`, …) sind in den generierten Types enthalten.

---

## 3. Auth Live-Registrierung (Supabase Auth)

**Edge Function:** `register-business-tenant`  
**Client:** `businessAuthService.registerBusinessTenant()` ruft Edge Function auf, danach `signInWithPassword()`.

Ablauf serverseitig:
1. Mandant + Adresse + Kontakt
2. `auth.admin.createUser` mit `app_metadata.tenant_id`
3. `profiles`-Update (`business_admin`)
4. `tenant_users`-Owner-Zeile
5. `tenant_products` (Office + gewählte Module)
6. Login-Audit-Eintrag

**Edge Function Deploy:** Quellcode liegt unter `supabase/functions/register-business-tenant/` — **Deploy auf Remote noch manuell** (`supabase functions deploy register-business-tenant --no-verify-jwt`).

---

## 4. Edge Function — Mitarbeiterportal-Login

**Function:** `employee-portal-login`  
**Client:** `employeePortalAuthService.loginEmployeePortal()`

- Service-Role-Lookup nach Username
- Passwortprüfung gegen `temporary_password_hash` (SHA-256, kompatibel mit App)
- Erstellt `portal_sessions`-Zeile + Audit
- Gibt `sessionToken`, `account`, `mustChangePassword` zurück
- AuthProvider: `signInPortalSession()` für Portal-Sessions ohne Supabase Auth

---

## 5. Edge Function — Portal-Code-Login

**Function:** `portal-code-login`  
**Client:** `clientPortalAuthService.validatePortalCodeLogin()`

- Prüft Client- oder Relative-Codes (Hash-Vergleich serverseitig)
- Erstellt `portal_sessions` + Audit
- Gibt `portalAccountId`, `tenantId`, `sessionToken` zurück

---

## 6. RLS — Auth-/Portal-Tabellen

| Tabelle | Isolation | Besonderheit |
|---------|-----------|--------------|
| `tenant_users` | `current_tenant_id()` | Standard FOR ALL |
| `employee_portal_accounts` | Write-only für authenticated; Lesen über `employee_portal_accounts_mgmt` View | Kein SELECT auf Hash-Spalten |
| `client_portal_codes` / `relative_portal_codes` | Write-only; Lesen über `*_mgmt` Views | Code-Hashes nur via Edge Function |
| `login_audit_events` | SELECT mandant + NULL; INSERT erlaubt | Edge Functions + Client-Audit |
| `role_permission_sets` | Mandantenisolation | Tenant-spezifische Overrides |

**Security Advisors:** Nach DDL separat mit `get_advisors(type: security)` prüfen — nicht in diesem Bericht abgeschlossen.

---

## 7. Runtime-Permissions aus DB

**Neu:** `src/lib/supabase/permissionRepository.ts`

- Live-Modus: lädt `role_permissions` (global) + optional `role_permission_sets` (tenant)
- Cache pro `(tenantId, roleKey)`
- `usePermissions` lädt async via `fetchRuntimePermissions`
- Demo-Modus: unverändert `getPermissionsForRole()` aus Demo-Daten

---

## 8. `DEMO_MODE=false` — Verhalten

| Variable | Verhalten |
|----------|-----------|
| `EXPO_PUBLIC_DEMO_MODE=false` + URL + Anon | `getServiceMode() === 'supabase'` — keine Demo-Fallbacks für Registrierung/Portal-Login |
| Fehlende Supabase-Konfiguration | Weiterhin Demo-Fallback (bestehendes Verhalten) |

**Tests:** `src/__tests__/auth/liveSupabaseAuth.test.ts` (5 Tests, gemockte Edge Functions)

---

## 9. Kernworkflow — Live-Prüfung

| Gate | Ergebnis |
|------|----------|
| Auth-Tests (`vitest run src/__tests__/auth/`) | **33/33 PASS** |
| Gesamte Test-Suite | siehe Quality Gates unten |
| Remote E2E (Registrierung → Login → Office) | **Nicht ausgeführt** — erfordert Edge-Deploy + `.env` Live-Werte |
| Remote Portal-Login E2E | **Nicht ausgeführt** |

---

## Quality Gates (lokal)

| Gate | Status |
|------|--------|
| `npm run test` | **263/263 PASS** |
| `npm run typecheck` | Langsam (vollständiges Remote-Schema in `types.ts`) — separat ausführen |
| `npm run smoke` | Enthält typecheck — nach Abschluss empfohlen |

---

## Offene Schritte (manuell)

1. **Edge Functions deployen:**
   ```bash
   supabase login
   supabase functions deploy register-business-tenant --no-verify-jwt
   supabase functions deploy employee-portal-login --no-verify-jwt
   supabase functions deploy portal-code-login --no-verify-jwt
   ```
2. **`.env`:** `EXPO_PUBLIC_DEMO_MODE=false`, URL, Anon Key
3. **E2E:** Business-Registrierung → Login → Office-Dashboard
4. **RLS/Security Advisor** auf Remote durchgehen
5. **CLI-Migration-Historie** mit Remote abgleichen

---

## Geänderte / neue Artefakte

- `supabase/migrations/0017_auth_portal_rls_hardening.sql`
- `supabase/functions/register-business-tenant/`
- `supabase/functions/employee-portal-login/`
- `supabase/functions/portal-code-login/`
- `supabase/functions/_shared/`
- `src/lib/supabase/edgeFunctions.ts`
- `src/lib/supabase/permissionRepository.ts`
- `src/lib/auth/portalSessionStore.ts`
- Live-Pfade in `businessAuthService`, `employeePortalAuthService`, `clientPortalAuthService`
- `AuthProvider` + Portal-Session-Support
- `usePermissions` — DB-Permissions
- `src/lib/supabase/database.types.ts` (neu, generiert)

---

**Fazit:** Code- und Schema-Grundlage für Live-Supabase-Auth ist gelegt. Remote-Verifikation (Edge Deploy, E2E, Security Advisor) bleibt bewusst offen — **nicht** als production-ready oder live-ready deklariert.
