# Security WARN & Storage Tenant-Isolation — Remediation Report

**Datum:** 2026-06-13  
**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm` / caresuiteplus-production)  
**Migration:** `0020_storage_tenant_isolation_and_warn_remediation.sql` (remote: `storage_tenant_isolation_and_warn_remediation`)  
**Scope:** Verbleibende 58 Security-WARNs klassifizieren, Storage tenant-isolieren, App-Code prüfen, Regression + Quality Gates. Keine neuen Features, keine Production-ready-Ansprüche.

---

## A. Executive Summary

Nach Migration **0019** verblieben **58 WARN** (0 ERROR). Migration **0020** härten alle `caresuite-*` Storage-Policies auf `tenant/{tenant_id}/…`-Pfade, ergänzen `service_role`-Zugriff für Edge Functions und schließen UPDATE-Lücken bei Communication/Office-Buckets. Der Security Advisor zählt **58 WARN unverändert** — erwartbar, da Storage-Isolation kein Advisor-Lint ist und die 57 `authenticated_security_definer_function_executable` + 1 `auth_leaked_password_protection` bewusst verbleiben. Quality Gates: **typecheck PASS**, **test 284/284 PASS**, **smoke PASS**. Auth/Portal-Regression: **PASS** (401, keine `permission denied`).

**Verdict:** Security ERROR-frei, Storage Tenant-Isolation gehärtet, verbleibende WARNs dokumentiert.

---

## B. Methodik

| Schritt | Werkzeug | Ergebnis |
|---------|----------|----------|
| Baseline Advisor | MCP `get_advisors(type: security)` | 58 WARN (vor 0020) |
| Bucket-Audit | MCP `execute_sql` (`storage.buckets`, `pg_policies`) | 11 Buckets, 3 breite caresuite-Policies |
| Remediation | MCP `apply_migration` | 0020 angewendet |
| Post-Advisor | MCP `get_advisors` | 58 WARN (unverändert, erwartet) |
| Policy-Verifikation | MCP `execute_sql` | 16 Policies inkl. tenant-Prefix |
| App-Code-Audit | Quellcode-Review | Pfade + `assertTenantForMode` |
| Auth-Regression | `Invoke-WebRequest` → Edge Functions | PASS |
| Quality Gates | `npm run typecheck`, `test`, `smoke` | PASS |

Keine destruktiven SQL-Befehle (DROP TABLE/COLUMN, TRUNCATE, DELETE).

---

## C. WARN-Findings — Vollständige Tabelle (58)

**Klassifikation:** W1 = jetzt behoben (Storage), W2 = später migrieren, W3 = akzeptiert mit Begründung.

| Nr | Kategorie | Objekt | Beschreibung | Risiko | Aktion |
|----|-----------|--------|--------------|--------|--------|
| 1 | auth_secdef_executable | `add_ai_message` | SECURITY DEFINER für authenticated | RPC-Bypass-Risiko bei fehlender Input-Validierung | **W2** — später INVOKER/private |
| 2 | auth_secdef_executable | `add_live_tracking_event` | wie oben | wie oben | **W2** |
| 3 | auth_secdef_executable | `add_support_ticket_message` | wie oben | wie oben | **W2** |
| 4 | auth_secdef_executable | `book_payment_for_invoice` | wie oben | Finanz-RPC | **W2** |
| 5 | auth_secdef_executable | `calculate_assessment_score` | wie oben | wie oben | **W2** |
| 6 | auth_secdef_executable | `check_release_readiness` | wie oben | wie oben | **W2** |
| 7 | auth_secdef_executable | `complete_follow_up` | wie oben | wie oben | **W2** |
| 8 | auth_secdef_executable | `complete_measure` | wie oben | wie oben | **W2** |
| 9 | auth_secdef_executable | `copy_system_template_to_tenant` | wie oben | Cross-Tenant-Input | **W2** |
| 10 | auth_secdef_executable | `create_access_code_for_client` | wie oben | Portal-Code-Erzeugung | **W2** |
| 11 | auth_secdef_executable | `create_access_code_for_employee` | wie oben | wie oben | **W2** |
| 12 | auth_secdef_executable | `create_ai_conversation` | wie oben | wie oben | **W2** |
| 13 | auth_secdef_executable | `create_audit_log` | Trigger-Hilfs-RPC | Append-only Audit | **W3** — Trigger/Edge only |
| 14 | auth_secdef_executable | `create_care_report` | App-RPC | wie oben | **W2** |
| 15 | auth_secdef_executable | `create_dunning_case_for_invoice` | App-RPC | wie oben | **W2** |
| 16 | auth_secdef_executable | `create_invoice_from_service_record` | App-RPC | wie oben | **W2** |
| 17 | auth_secdef_executable | `create_service_record_from_assignment` | App-RPC | wie oben | **W2** |
| 18 | auth_secdef_executable | `create_support_ticket` | App-RPC | wie oben | **W2** |
| 19 | auth_secdef_executable | `current_profile_id` | RLS-Helfer | Benötigt für Policies | **W3** — akzeptiert |
| 20 | auth_secdef_executable | `current_tenant_id` | RLS-Helfer | Kern-Tenant-Isolation | **W3** — akzeptiert |
| 21 | auth_secdef_executable | `employee_portal_save_documentation` | Portal-RPC | Session-Token-Validierung intern | **W2** |
| 22 | auth_secdef_executable | `employee_portal_save_signature` | Portal-RPC | wie oben | **W2** |
| 23 | auth_secdef_executable | `employee_portal_set_assignment_status` | Portal-RPC | wie oben | **W2** |
| 24 | auth_secdef_executable | `enqueue_outbound_message` | App-RPC | Outbox | **W2** |
| 25 | auth_secdef_executable | `enqueue_pdf_generation_job` | App-RPC | PDF-Jobs | **W2** |
| 26 | auth_secdef_executable | `generate_invoice_number` | App-RPC | Sequenz | **W2** |
| 27 | auth_secdef_executable | `generate_support_ticket_number` | App-RPC | Sequenz | **W2** |
| 28 | auth_secdef_executable | `get_business_bootstrap` | Bootstrap-RPC | Session-Setup | **W2** |
| 29 | auth_secdef_executable | `get_final_readiness_report` | Report-RPC | wie oben | **W2** |
| 30 | auth_secdef_executable | `get_options_for_group` | Katalog-Helfer | Dropdown-RLS | **W3** — akzeptiert |
| 31 | auth_secdef_executable | `get_portal_bootstrap` | Portal-RPC | Session-Token | **W2** |
| 32 | auth_secdef_executable | `get_tenant_subscription_status` | Billing-RPC | wie oben | **W2** |
| 33 | auth_secdef_executable | `handle_new_user` | Auth-Trigger | Signup-Flow | **W3** — Trigger only |
| 34 | auth_secdef_executable | `has_module_access` | RLS-Helfer | Modul-Gates | **W3** — akzeptiert |
| 35 | auth_secdef_executable | `has_permission` | RLS-Helfer | Permission-Gates | **W3** — akzeptiert |
| 36 | auth_secdef_executable | `has_product_access` | RLS-Helfer | Produkt-Gates | **W3** — akzeptiert |
| 37 | auth_secdef_executable | `has_role_permission` | RLS-Helfer | Rollen-Gates | **W3** — akzeptiert |
| 38 | auth_secdef_executable | `is_feature_enabled` | RLS-Helfer | Feature-Flags | **W3** — akzeptiert |
| 39 | auth_secdef_executable | `is_tenant_admin` | RLS-Helfer | Admin-Gates | **W3** — akzeptiert |
| 40 | auth_secdef_executable | `log_app_event` | Logging-RPC | wie oben | **W2** |
| 41 | auth_secdef_executable | `log_error` | Logging-RPC | wie oben | **W2** |
| 42 | auth_secdef_executable | `log_portal_event` | Portal-Audit | wie oben | **W2** |
| 43 | auth_secdef_executable | `mark_notification_read` | App-RPC | wie oben | **W2** |
| 44 | auth_secdef_executable | `portal_send_message` | Portal-RPC | wie oben | **W2** |
| 45 | auth_secdef_executable | `refresh_demo_health_checks` | Demo-RPC | Nur Demo-Kontext | **W2** |
| 46 | auth_secdef_executable | `refresh_final_readiness` | Report-RPC | wie oben | **W2** |
| 47 | auth_secdef_executable | `render_template_preview` | Template-RPC | wie oben | **W2** |
| 48 | auth_secdef_executable | `rls_auto_enable` | Schema-Helfer | Migration/DDL | **W3** — intern |
| 49 | auth_secdef_executable | `search_catalog_items` | Katalog-RPC | wie oben | **W2** |
| 50 | auth_secdef_executable | `search_documentation_phrases` | Suche-RPC | wie oben | **W2** |
| 51 | auth_secdef_executable | `send_thread_message` | Kommunikation-RPC | wie oben | **W2** |
| 52 | auth_secdef_executable | `set_assignment_status` | Einsatz-RPC | wie oben | **W2** |
| 53 | auth_secdef_executable | `start_portal_session_by_code` | Portal-Login | Code-Validierung intern | **W2** |
| 54 | auth_secdef_executable | `update_course_progress` | Akademie-RPC | wie oben | **W2** |
| 55 | auth_secdef_executable | `update_health_check` | Health-RPC | wie oben | **W2** |
| 56 | auth_secdef_executable | `validate_access_code` | Portal-RPC | wie oben | **W2** |
| 57 | auth_secdef_executable | `validate_portal_session` | Portal-RPC | wie oben | **W2** |
| 58 | auth_leaked_password_protection | Supabase Auth (Dashboard) | HaveIBeenPwned deaktiviert | Compromised passwords | **W3** — Dashboard manuell |

### C.1 Klassifikations-Counts

| Klasse | Anzahl | Bedeutung |
|--------|--------|-----------|
| **W1** (fix now) | 0 Advisor + **1 Storage-Risiko behoben** | caresuite-* tenant-Isolation via 0020 |
| **W2** (later) | **45** | App-/Portal-RPCs → schrittweise INVOKER oder `private` Schema |
| **W3** (accepted) | **13** | 9 RLS-Helfer + 3 Trigger/Intern + 1 Dashboard Auth |

---

## D. Storage Bucket Audit

| Bucket | Public? | Tenant path? | Policies? | Risiko (vorher) | Fix (0020) |
|--------|---------|--------------|-----------|-----------------|------------|
| caresuite-documents | false | **Ja** (Policy) | SELECT/INSERT/UPDATE + tenant + permission | Cross-Tenant READ/WRITE | **Behoben** |
| caresuite-exports | false | **Ja** | wie oben + `qm.export_qm_documents` | Cross-Tenant | **Behoben** |
| caresuite-imports | false | **Ja** | wie oben + `is_tenant_admin()` | Cross-Tenant | **Behoben** |
| caresuite-media | false | **Ja** | wie oben + `office.documents.upload` | Cross-Tenant | **Behoben** |
| caresuite-signatures | false | **Ja** | tenant-Pfad, INSERT für authenticated | Cross-Tenant | **Behoben** |
| caresuite-support | false | **Ja** | tenant + `communication.view_center` | Cross-Tenant | **Behoben** |
| caresuite-public-assets | **true** | **Ja** (Schreiben) | SELECT `public/` oder `tenant/{id}/`; INSERT admin | Öffentliches Branding | **Dokumentiert** — kein PII |
| communication-attachments | false | Ja | SELECT/INSERT/UPDATE tenant | OK | UPDATE-Prefix gehärtet |
| communication-voice | false | Ja | SELECT/INSERT/UPDATE tenant | OK | UPDATE-Prefix gehärtet |
| communication-images | false | Ja | SELECT/INSERT/UPDATE tenant | OK | UPDATE-Prefix gehärtet |
| office-documents | false | Ja | SELECT/INSERT/UPDATE tenant | OK | UPDATE-Prefix gehärtet |

**service_role:** Neue Policy `storage_service_role_all` (ALL, USING/WITH CHECK true) für Edge Functions.

**Ersetzte Policies:** `caresuite_authenticated_read_private_buckets`, `caresuite_authenticated_upload_private_buckets`, `caresuite_authenticated_update_own_objects` → `caresuite_tenant_*` + `caresuite_public_assets_select`.

---

## E. Tenant-Pfad-Standard

```
tenant/{tenant_id}/<bereich>/<…>/<dateiname>
```

| Bereich | Pfad-Beispiel | Bucket |
|---------|---------------|--------|
| Office-Dokumente | `tenant/{id}/documents/{docId}/{file}` | `office-documents` |
| Kommunikation Anhang | `tenant/{id}/threads/{threadId}/attachments/{attId}/{file}` | `communication-attachments` |
| Kommunikation Voice | `tenant/{id}/communication/{threadId}/voice/{msgId}.m4a` | `communication-voice` |
| QM Export | `tenant/{id}/exports/{jobId}/{file}` | `caresuite-exports` |
| Import | `tenant/{id}/imports/{batchId}/{file}` | `caresuite-imports` |
| Media | `tenant/{id}/media/{assetId}/{file}` | `caresuite-media` |
| Signaturen | `tenant/{id}/signatures/{recordId}/{file}` | `caresuite-signatures` |
| Support | `tenant/{id}/support/{ticketId}/{file}` | `caresuite-support` |
| Mandant-Branding | `tenant/{id}/branding/{asset}` | `caresuite-public-assets` |
| Global-Branding | `public/branding/{asset}` | `caresuite-public-assets` (read-only CDN) |

Hilfsmodul: `src/lib/storage/storagePaths.ts` — `buildTenantStoragePath(tenantId, …segments)`.

---

## F. Migration 0020 — Zusammenfassung

1. **DROP/CREATE** 3 breite `caresuite_*` Policies → tenant-isolierte `caresuite_tenant_select/insert/update`
2. **caresuite-public-assets** — SELECT für `public/` (global) oder `tenant/{id}/`; Schreiben nur `tenant/{id}/` + `is_tenant_admin()`
3. **Permission-Gates** auf INSERT je Bucket (office/qm/export/import/communication)
4. **Communication/Office UPDATE** — `foldername[1]='tenant'` in USING ergänzt (0019-Lücke)
5. **service_role** — `storage_service_role_all` für Edge Functions

Remote bestätigt: `schema_migrations.name = storage_tenant_isolation_and_warn_remediation`.

---

## G. App Storage Code Audit

| Datei | Status | Befund / Änderung |
|-------|--------|-------------------|
| `officeDocumentsService.ts` | **OK** | `tenant/{id}/documents/…` via `buildTenantStoragePath`; `assertTenantForMode` |
| `communication.attachments.ts` | **Fix** | `assertTenantForMode` in `prepareAttachmentUpload` ergänzt |
| `communication.voice.ts` | **OK** (Pfad) | `VOICE_STORAGE_PATH` mit `{tenantId}`; Upload noch Placeholder (W2) |
| `qmExportService.ts` | **Demo only** | Kein Live-Storage; `assertTenantForMode` vorhanden |
| `mdAuditPackageService.ts` | **Demo only** | Kein Live-Storage; `assertTenantForMode` vorhanden |
| `storageService.ts` | **N/A** | Existiert nicht — `storagePaths.ts` als zentraler Pfad-Helper |
| `documentRepository.supabase.ts` | **N/A** | Existiert nicht — Office nutzt `fromUnknownTable` + direkten Storage-Upload |

**Live-Modus:** Kein `DEMO_TENANT_ID`-Fallback (`tenantResolver.ts`); `requireTenantId()` wirft ohne Profil-Mandant.

**Offen (W2):** Voice-Upload nutzt noch `communication-attachments`-Bucket statt `communication-voice` (Placeholder-Upload).

---

## H. Leaked Password Protection

| Aspekt | Status |
|--------|--------|
| Advisor-Lint | `auth_leaked_password_protection` — **1 WARN** |
| MCP/CLI-Automatisierung | **Nicht verfügbar** — nur Dashboard |
| Manuelle Schritte | 1. [Supabase Dashboard](https://supabase.com/dashboard/project/euagyyztvmemuaiumvxm/auth/providers) → **Authentication** → **Providers** → Email  2. **Password Security** → **Prevent the use of leaked passwords** aktivieren  3. Optional: Mindestlänge / Komplexität erhöhen |
| Dokumentation | [Password strength & leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| Klassifikation | **W3** — manueller Ops-Schritt, kein Schema-Blocker |

---

## I. RLS Helper Assessment (W3)

| Funktion | Rolle | Warum SECURITY DEFINER + authenticated EXECUTE |
|----------|-------|-----------------------------------------------|
| `current_tenant_id()` | Tenant aus `profiles` | RLS-Policies können `auth.uid()`-Join nicht inline; stabil über Profile |
| `current_profile_id()` | Profil-ID | Wie oben |
| `has_permission()` | Permission-Check | Join über `role_permissions` ohne RLS-Rekursion |
| `has_module_access()` | Modul-Gate | Subscription/Produkt-Check |
| `has_product_access()` | Produkt-Gate | Tenant-Produkt-Matrix |
| `has_role_permission()` | Rollen-Gate | Erweiterte Permission-Logik |
| `is_tenant_admin()` | Admin-Gate | `business_admin`/`business_manager` |
| `is_feature_enabled()` | Feature-Flag | Tenant-Feature-Matrix |
| `get_options_for_group()` | Dropdown-Katalog | System+Tenant-Katalog ohne RLS-Leak |

**Mitigation (0019):** `search_path = public, pg_temp`; `REVOKE` von PUBLIC/anon; nur `authenticated` + `service_role`.

**Revoke authenticated EXECUTE** würde alle RLS-Policies und Storage-Policies brechen — daher **W3 akzeptiert**.

Zusätzlich W3: `create_audit_log`, `handle_new_user`, `rls_auto_enable` (Trigger/DDL-Helfer).

---

## J. Before/After Advisor Comparison

| Metrik | Vor 0020 | Nach 0020 | Δ |
|--------|----------|-----------|---|
| **Gesamt** | 58 | 58 | 0 |
| ERROR | 0 | 0 | 0 |
| WARN | 58 | 58 | 0 |
| INFO | 0 | 0 | 0 |

| Lint-Name | Vorher | Nachher |
|-----------|--------|---------|
| authenticated_security_definer_function_executable | 57 | 57 |
| auth_leaked_password_protection | 1 | 1 |

**Ehrliche Einschätzung:** Die 58 Advisor-WARNs sind **nicht vollständig eliminierbar** ohne Breaking Changes (RLS-Helfer) oder Dashboard-Aktion (Leaked Password). **W1 Storage-Risiko** war kein Advisor-Lint, wurde aber in 0020 behoben.

---

## K. Auth/Portal Regression

| Flow | Test | HTTP | Ergebnis |
|------|------|------|----------|
| Employee Portal Login | Falsche Credentials | **401** | **PASS** — kein `permission denied` |
| Portal Code Login | Code `000000` | **401** | **PASS** — kein `permission denied` |

Storage-Härtung betrifft keine Edge-Function-Grants (0018 unverändert). `service_role` Storage-Policy neu — Edge Functions mit Storage-Zugriff funktionsfähig.

---

## L. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (284/284) |
| `npm run smoke` | **PASS** |

---

## M. Offene Risiken

1. **45 W2-RPCs** — SECURITY DEFINER für App/Portal; schrittweise INVOKER-Migration
2. **Leaked Password** — Dashboard manuell aktivieren
3. **caresuite-public-assets** — öffentlich lesbar (Branding only)
4. **Voice-Upload** — Bucket/Placeholder noch nicht produktionsreif
5. **Cross-Tenant Pen-Test** — mit zwei JWT-Mandanten noch nicht ausgeführt
6. **QM/MD Live-Storage** — noch Demo-Repository, Pfade für später vorbereitet

---

## N. Anhang — 10-Punkte Parent Return

1. **WARN before/after:** 58 → 58 (0 ERROR throughout)
2. **W1/W2/W3 counts:** W1 = 1 Storage-Risiko behoben (nicht Advisor); W2 = 45; W3 = 13
3. **Storage buckets:** 11 auditiert; 7 caresuite-* tenant-isoliert; 4 communication/office gehärtet; service_role ALL neu
4. **Tenant isolation:** **Gehärtet** — alle sensitiven Buckets erzwingen `tenant/{tenant_id}/…` + `current_tenant_id()`
5. **Migration 0020:** Ersetzt 3 breite caresuite-Policies; permission-gated INSERT; UPDATE-Prefix-Fix; service_role Policy
6. **Leaked password:** **Offen** — Dashboard manuell ([Doku](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection))
7. **RLS helpers:** 9 Helfer + 3 Intern — **W3 akzeptiert** (search_path gehärtet, anon entzogen)
8. **Regression:** Auth/Portal **PASS** (401); Document-Pfade App-seitig `tenant/{id}/…`
9. **Quality gates:** typecheck / test 284/284 / smoke **PASS**
10. **Verdict:** **Security ERROR-frei, Storage Tenant-Isolation gehärtet, verbleibende WARNs dokumentiert.**
