# Supabase Security Advisor — Remediation Report

**Datum:** 2026-06-13  
**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm` / caresuiteplus-production)  
**Migration:** `0019_security_advisor_remediation.sql` (remote: `security_advisor_remediation` + Nacharbeit via `execute_sql`)  
**Scope:** Security Advisor P0/P1 Remediation — keine neuen Features, keine Production-ready-Ansprüche.

---

## A. Executive Summary

Vor Remediation meldete der Supabase Security Advisor **235 Findings** (109 ERROR, 117 WARN, 9 INFO). Migration **0019** behebt alle **109 ERROR** (SECURITY DEFINER Views), alle **9 INFO** (RLS ohne Policy), **57 anon-WARN** (SECURITY DEFINER RPCs), **2 search_path-WARN**. Nachher: **58 WARN** (57 `authenticated_security_definer_function_executable`, 1 `auth_leaked_password_protection`). Auth/Portal-Edge-Functions antworten semantisch korrekt (401/400, kein `permission denied`). Quality Gates: **typecheck PASS**, **test 284/284 PASS**, **smoke PASS**.

**Verdict:** Security Advisor P0/P1 bereinigt, Restfindings dokumentiert.

---

## B. Methodik

| Schritt | Werkzeug | Ergebnis |
|---------|----------|----------|
| Baseline Advisor | MCP `get_advisors(type: security)` | 235 Findings |
| Schema-Inspektion | MCP `execute_sql` (RLS, Grants, Views, Storage) | Drift 0012/0009 bestätigt |
| Remediation | `apply_migration` + `execute_sql` | 0019 angewendet |
| Post-Advisor | MCP `get_advisors` | 58 WARN |
| Auth-Regression | `Invoke-WebRequest` → Edge Functions | PASS (401/400) |
| Quality Gates | `npm run typecheck`, `test`, `smoke` | PASS |

Keine destruktiven SQL-Befehle (DROP TABLE/COLUMN, TRUNCATE, DELETE).

---

## C. Findings vor Remediation (235)

### C.1 Zusammenfassung nach Severity

| Severity | Anzahl | Kategorien |
|----------|--------|------------|
| ERROR | 109 | `security_definer_view` |
| WARN | 117 | `anon_security_definer_function_executable` (57), `authenticated_security_definer_function_executable` (57), `function_search_path_mutable` (2), `auth_leaked_password_protection` (1) |
| INFO | 9 | `rls_enabled_no_policy` |
| **Gesamt** | **235** | |

### C.2 Vollständige Findings-Tabelle (kompakt nach Kategorie)

| Nr | Severity | Kategorie | Objekt | Beschreibung | Risiko | Fix (0019) |
|----|----------|-----------|--------|--------------|--------|------------|
| 1–109 | ERROR | security_definer_view | `public.v_*` (109 Views) | Views laufen als Owner → RLS-Bypass | Cross-Tenant-Datenleck über PostgREST | `ALTER VIEW … SET (security_invoker=true)` |
| 110–166 | WARN | anon_secdef_executable | 57 `public.*` SECURITY DEFINER RPCs | Anon kann privilegierte Funktionen aufrufen | Unautorisierter Datenzugriff / Escalation | `REVOKE FROM PUBLIC, anon`; `GRANT authenticated, service_role` |
| 167–223 | WARN | auth_secdef_executable | gleiche 57 RPCs für `authenticated` | SECURITY DEFINER für eingeloggte User | Bewusst für RLS-Helfer; Restrisiko | Dokumentiert P2; `search_path` gehärtet |
| 224–225 | WARN | function_search_path_mutable | `generate_six_digit_code`, `set_updated_at` | Mutable search_path | Schema-Hijacking | `SET search_path = public, pg_temp` |
| 226 | WARN | auth_leaked_password_protection | Supabase Auth (Dashboard) | HaveIBeenPwned-Check deaktiviert | Schwache/compromised Passwörter | Dashboard-Aktivierung (manuell) |
| 227–235 | INFO | rls_enabled_no_policy | 9 Tabellen (s. D) | RLS aktiv, keine Policy → Deny-all | Legitime Nutzer blockiert; Advisor-Noise | Tenant-isolierte Policies aus 0012/0009 |

---

## D. Typische Issues — Checkliste

| Issue | Status vorher | Status nachher |
|-------|---------------|----------------|
| RLS disabled | Keine Findings | — |
| RLS enabled, no policy | 9 Tabellen | **Behoben** (Policies angelegt) |
| SECURITY DEFINER Views | 109 Views | **Behoben** (0 ohne `security_invoker`) |
| search_path mutable | 2 Funktionen + 57 secdef | **Behoben** (`public, pg_temp`) |
| Leaked password protection | Deaktiviert | **Offen** (Dashboard) |
| Public Storage access | `caresuite-public-assets` public=true | Dokumentiert (bewusst) |
| Hash columns (portal) | Revoked SELECT authenticated | **Re-bestätigt** (0017/0018/0019) |
| portal_sessions anon SELECT | Möglich via PUBLIC | **REVOKE SELECT FROM anon** |
| service_role Edge Fn Grants | Vorhanden (0018) | **Re-GRANT idempotent** |

### D.1 Betroffene Tabellen ohne Policy (vorher)

- `communication_assignments`, `communication_audit_events`, `communication_notifications`, `communication_reactions`, `communication_read_receipts`
- `kim_attachments`, `ti_audit_events`, `ti_consents`, `ti_provider_checks`

---

## E. Priorisierung

| Priorität | Kategorie | Anzahl | Aktion 0019 |
|-----------|-----------|--------|-------------|
| **P0** | security_definer_view (ERROR) | 109 | Behoben |
| **P1** | rls_enabled_no_policy (INFO) | 9 | Behoben |
| **P1** | anon_secdef_executable (WARN) | 57 | Behoben (REVOKE PUBLIC+anon) |
| **P1** | function_search_path_mutable (WARN) | 2 | Behoben |
| **P1** | Hash/portal grants | — | Re-apply REVOKE/GRANT |
| **P2** | auth_secdef_executable (WARN) | 57 | Dokumentiert (RLS-Helfer, bewusst) |
| **P2** | Storage tenant isolation (caresuite-*) | 7 Buckets | Dokumentiert |
| **P3** | auth_leaked_password_protection | 1 | Dashboard manuell |
| **P3** | caresuite-public-assets public bucket | 1 | Branding-Assets, kein PII |

### E.1 Prioritäts-Counts

| Prio | Vorher | Nachher | Delta |
|------|--------|---------|-------|
| P0 | 109 | 0 | −109 |
| P1 | 68 | 0 | −68 |
| P2 | 57 | 57 | 0 |
| P3 | 1 | 1 | 0 |

---

## F. Migration 0019 — Inhalt

Datei: `supabase/migrations/0019_security_advisor_remediation.sql`

1. **109 Views** → `security_invoker = true` (inkl. Portal mgmt-Views)
2. **9 RLS-Policies** — Communication (5) + TI/KIM (4), tenant + permission-basiert
3. **57 SECURITY DEFINER Funktionen** — `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`; `search_path = public, pg_temp`
4. **`generate_six_digit_code` / `set_updated_at`** — search_path fix
5. **Portal Hash-Sicherheit** — REVOKE SELECT auf Hash-Tabellen; mgmt-View GRANTs
6. **service_role GRANTs (0018)** — idempotent re-applied für Edge Functions
7. **Storage** — Policies für `communication-voice`, `communication-images`; UPDATE für attachments/office-docs

---

## G. Geänderte Policies / Grants / Functions / Views

### Views (109 + 3 mgmt)
Alle `public.v_*` Overview/Dashboard/Portal-Views + `employee_portal_accounts_mgmt`, `client_portal_codes_mgmt`, `relative_portal_codes_mgmt` → `security_invoker=true`. Verifikation: `views_without_invoker = 0`.

### Policies (neu/ersetzt)
- Communication: `communication_assignments_*`, `communication_reactions_*`, `communication_read_receipts_*`, `communication_notifications_*`, `communication_audit_events_*`
- TI: `ti_provider_checks_*`, `kim_attachments_*`, `ti_consents_*`, `ti_audit_events_*`
- Storage: `comm_voice_*`, `comm_images_*`, `comm_attachments_update`, `office_docs_update`

### Grants
- `REVOKE SELECT` employee_portal_accounts, client_portal_codes, relative_portal_codes FROM authenticated, anon
- `REVOKE SELECT` portal_sessions FROM anon
- `GRANT SELECT` auf `*_mgmt` Views TO authenticated
- `GRANT SELECT,INSERT,UPDATE,DELETE` Auth/Portal-Tabellen TO service_role (0018)

### Functions
- 57 SECURITY DEFINER: PUBLIC/anon REVOKE, authenticated+service_role GRANT, search_path gehärtet
- `generate_six_digit_code()`, `set_updated_at()`: search_path fix

---

## H. Storage Security Audit

| Bucket | Public | Size Limit | Policies | Tenant-Pfad | Bewertung |
|--------|--------|------------|----------|-------------|-----------|
| caresuite-documents | false | 50 MB | SELECT/INSERT/UPDATE authenticated | **Kein** tenant-Prefix in Policy | P2 — breiter Zugriff |
| caresuite-exports | false | 100 MB | wie oben | Kein tenant-Prefix | P2 |
| caresuite-imports | false | 100 MB | wie oben | Kein tenant-Prefix | P2 |
| caresuite-media | false | 200 MB | wie oben | Kein tenant-Prefix | P2 |
| caresuite-signatures | false | 10 MB | wie oben | Kein tenant-Prefix | P2 |
| caresuite-support | false | 50 MB | wie oben | Kein tenant-Prefix | P2 |
| caresuite-public-assets | **true** | 10 MB | SELECT authenticated | Public CDN | P3 — nur Branding |
| communication-attachments | false | 25 MB | SELECT/INSERT/UPDATE + tenant/{id} | Ja | **OK** |
| communication-voice | false | 10 MB | SELECT/INSERT/UPDATE + tenant/{id} | Ja | **Neu in 0019** |
| communication-images | false | 10 MB | SELECT/INSERT/UPDATE + tenant/{id} | Ja | **Neu in 0019** |
| office-documents | false | 50 MB | SELECT/INSERT/UPDATE + tenant/{id} | Ja | UPDATE ergänzt |

**Hinweis:** App-Code nutzt Pfade `tenant/{tenantId}/…` (z. B. `officeDocumentsService.ts`). `caresuite-*`-Policies sollten in Folge-Sprint um Tenant-Prefix ergänzt werden.

---

## I. Before/After Advisor Comparison

| Metrik | Vorher | Nachher | Δ |
|--------|--------|---------|---|
| **Gesamt** | 235 | 58 | **−177** |
| ERROR | 109 | 0 | **−109** |
| WARN | 117 | 58 | **−59** |
| INFO | 9 | 0 | **−9** |

| Lint-Name | Vorher | Nachher |
|-----------|--------|---------|
| security_definer_view | 109 | 0 |
| anon_security_definer_function_executable | 57 | 0 |
| authenticated_security_definer_function_executable | 57 | 57 |
| function_search_path_mutable | 2 | 0 |
| rls_enabled_no_policy | 9 | 0 |
| auth_leaked_password_protection | 1 | 1 |

---

## J. Auth/Portal Regression

| Flow | Test | HTTP | Response (Auszug) | Ergebnis |
|------|------|------|-------------------|----------|
| Business Registration | POST ohne `adminEmail` | 400 | `Admin-E-Mail fehlt.` | **PASS** — Validierung, kein Schema/Grant-Fehler |
| Employee Portal Login | Falsche Credentials | 401 | `Benutzername oder Passwort ist falsch.` | **PASS** — kein `permission denied` |
| Portal Code Login | Code `000000` | 401 | `Code ungültig oder abgelaufen.` | **PASS** — kein `permission denied` |

**service_role Grants:** `has_table_privilege(service_role, employee_portal_accounts, SELECT) = true` (bestätigt).

Edge Functions (`register-business-tenant`, `employee-portal-login`, `portal-code-login`) bleiben erreichbar; 0018-Grants unverändert wirksam.

---

## K. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (284/284) |
| `npm run smoke` | **PASS** |

---

## L. Offene Risiken (Restfindings)

1. **57 WARN** `authenticated_security_definer_function_executable` — RLS-Helfer (`current_tenant_id`, `has_permission`, …) und App-RPCs benötigen SECURITY DEFINER + authenticated EXECUTE. Mitigation: `search_path` gehärtet, PUBLIC/anon entzogen.
2. **auth_leaked_password_protection** — Supabase Dashboard → Auth → Password Security aktivieren.
3. **caresuite-* Storage** — Policies ohne `tenant/{id}`-Pfad; Cross-Tenant-Risiko bei kompromittiertem JWT.
4. **caresuite-public-assets** — öffentlicher Bucket (Branding); kein PII, aber öffentlich lesbar.
5. **Cross-Tenant RLS Runtime-Tests** mit echten JWT-Kontexten nicht ausgeführt.
6. **CLI nicht linked** — lokale `supabase migration list --linked` weiterhin nicht verfügbar.

---

## M. Empfehlungen nächster Sprint

1. Dashboard: Leaked Password Protection aktivieren.
2. Storage: `caresuite-*`-Policies um `tenant/{tenant_id}`-Prefix erweitern.
3. SECURITY DEFINER RPCs schrittweise in `private` Schema oder SECURITY INVOKER migrieren (wo möglich).
4. Cross-Tenant Pen-Test mit zwei Test-Mandanten + JWT.

---

## N. Anhang — 10-Punkte Parent Return

1. **Findings before:** 235 (109 ERROR, 117 WARN, 9 INFO)
2. **Findings after:** 58 (0 ERROR, 58 WARN, 0 INFO)
3. **P0/P1 fixed:** 177 (109 ERROR + 9 INFO + 57 anon WARN + 2 search_path WARN)
4. **Migration 0019 summary:** security_invoker Views, RLS policies, anon/PUBLIC revoke secdef, search_path, portal hash grants, service_role re-grant, storage policies
5. **Changed:** 109+3 views, 18 table policies, 8 storage policies, 57 function grants, 2 search_path functions
6. **Storage:** 11 Buckets auditiert; voice/images Policies neu; caresuite-* tenant-Isolation offen
7. **Auth/Portal regression:** PASS (401/400, keine permission denied)
8. **Quality gates:** typecheck/test/smoke PASS
9. **Open risks:** 57 auth secdef WARN, leaked password, storage tenant paths, cross-tenant tests
10. **Verdict:** Security Advisor P0/P1 bereinigt, Restfindings dokumentiert.
