# B.1k – Migration 0155 Apply Abschlussbericht

**Projekt:** CareSuite+ (`euagyyztvmemuaiumvxm`)  
**Migration:** `0155_sync_legacy_role_permissions.sql`  
**Datum:** 2026-06-20  
**HEAD (verifiziert):** `73cd7360cf533051c84b394d82a46b8e38c4b335`

---

## 1. Executive Summary

Migration **0155** wurde nach erfolgreicher Gate-Prüfung **einmalig** per `npx supabase db push` auf das verlinkte Supabase-Projekt **euagyyztvmemuaiumvxm** (caresuiteplus-production) angewendet. Vorher war **0155** remote ausstehend; nachher ist **0155** lokal und remote synchron (0154 weiterhin angewendet).

**Ergebnis:** Apply **erfolgreich**. Alle in 0155 definierten Permission-Keys sind für die Legacy-Rollen **owner, admin, management, billing, planning, office, readonly** in der Remote-DB vorhanden (Vollständigkeitstests je Rolle: erwartete Anzahl = vorhandene Anzahl, `missing_keys` = null). **owner/admin** haben **`office.invoices.create`**; **office** hat **kein** `office.invoices.create`. Keine doppelten `(role_id, permission_key)`-Paare (`dup_pairs = 0`).

Pre-/Post-Apply: **713** TypeScript-Fehler (Baseline unverändert), **19/19** Vitest-Tests grün. Kein Git-Commit/Push, keine Code-Änderungen.

---

## 2. Git/Repo-Status

| Prüfung | Ergebnis |
|--------|----------|
| Branch | `main` |
| HEAD | `73cd7360cf533051c84b394d82a46b8e38c4b335` (= erwartet) |
| Sync mit `origin/main` | `0 0` (weder behind noch diverged) |
| Staged files | **0** (Abort-Regel 4: OK) |
| `0154_sync_b1_permission_keys.sql` diff | leer (unverändert) |
| `0155_sync_legacy_role_permissions.sql` | getrackt, diff leer |
| `staticRolePermissions.ts` diff | leer |
| B.1j-Dateien (`workspaceRoles.ts`, `workspace.ts`) | diff leer |
| Untracked | viele Audit-/Build-Artefakte (kein Blocker für Apply) |

---

## 3. Migration-Safety-Matrix

| Kriterium | 0155 |
|-----------|------|
| INSERT-only | Ja (7 INSERT-Blöcke) |
| `ON CONFLICT DO NOTHING` | Ja (pro Block) |
| DROP / TRUNCATE / DELETE | Nein |
| Destructive UPDATE | Nein |
| RLS / Schema-Änderungen | Nein |
| Rollen-Umbenennung | Nein |
| Betroffene Rollen | Nur Legacy: owner, admin, management, billing, planning, office, readonly |
| User/Profile-Änderungen | Nein |

---

## 4. Migration-Status-Matrix (before/after)

| Migration | Vor Apply (Local \| Remote) | Nach Apply (Local \| Remote) |
|-----------|----------------------------|------------------------------|
| 0154 | 0154 \| 0154 | 0154 \| 0154 |
| 0155 | 0155 \| *(leer)* | 0155 \| 0155 |

**Dry-run (`npx supabase db push --dry-run`):** würde ausschließlich `0155_sync_legacy_role_permissions.sql` pushen.

**Supabase-Projekt:** `npx supabase projects list` → verlinktes Projekt `euagyyztvmemuaiumvxm` (caresuiteplus-production, eu-central-1).

Logs: `.audit-migration-list-b1k-preapply.log`, `.audit-migration-list-b1k-postapply.log`, `.audit-supabase-b1k-dryrun.log`

---

## 5. Apply-Protokoll

| Schritt | Detail |
|--------|--------|
| Befehl | `npx supabase db push` (eine Apply-Runde) |
| Bestätigung | CLI-Default [Y/n] → angewendet |
| Angewendete Datei | `0155_sync_legacy_role_permissions.sql` |
| Exit | Erfolg („Finished supabase db push.“) |
| Log | `.audit-supabase-b1k-apply.log` |

`npx supabase status` (lokal): Docker nicht verfügbar → erwarteter Fehler; Remote-Workflow über `--linked` / `db push` unbeeinträchtigt.

---

## 6. DB-Verifikationsmatrix pro Rolle

**Hinweis:** Gesamt-Zählungen über alle Mandanten-Rollenzeilen sind höher als die 0155-Key-Sets (bestehende Seed-/Historien-Permissions). Verifikation fokussiert auf **Vollständigkeit der 0155-definierten Keys** ( EXISTS über Mandanten).

| Rolle | Erwartete Keys (0155) | Present (0155-Set) | missing_keys | Spezifische Checks |
|-------|----------------------|--------------------|--------------|-------------------|
| owner | 33 | 33 | null | `office.invoices.create` vorhanden |
| admin | 33 | 33 | null | `office.invoices.create` vorhanden |
| management | 32 | 32 | null | inkl. `office.invoices.create` |
| billing | 8 | 8 | — | idempotent zu 0154-Subset |
| planning | 15 | 15 | null | inkl. `geo.live_tracking` |
| office | 8 | 8 | — | `invoice_create_rows = 0` |
| readonly | 5 | 5 | null | nur View-Keys aus 0155 |

**Duplikate:** `SELECT … HAVING COUNT(*) > 1` → **dup_pairs = 0**.

**Distinct Permission-Keys (über alle Mandanten, informativ):** owner/admin 67, management 66, billing 22, planning 34, office 30, readonly 18.

Read-only SQL-Logs: `.audit-db-b1k-*-check.log`, `.audit-db-b1k-distinct-keys.log`, `.audit-db-b1k-dupes.log`, `.audit-db-b1k-invoice-create.log`

---

## 7. Permission/Role-Testergebnisse (before/after)

| Gate | Pre-Apply | Post-Apply |
|------|-----------|------------|
| `npm run typecheck` (Fehleranzahl) | **713** | **713** |
| Vitest `tenantBootstrap.test.ts` + `permissions.test.ts` | **19/19** passed | **19/19** passed |

Logs: `.audit-typecheck-b1k-preapply.log`, `.audit-typecheck-b1k-postapply.log`, `.audit-test-b1k-preapply.log`, `.audit-test-b1k-postapply.log`

---

## 8. Nicht ausgeführte Aktionen

- Kein `git add` / `commit` / `push`
- Keine weiteren Migrationen (0144–0153 bereits remote; keine zusätzlichen pending)
- Keine Code-Änderungen an Permissions-Mapping oder App-Logik
- Kein Deploy / Netlify
- Kein Assist Phase 3, B.2, ProductAccess, `assignmentWorkflowService`
- Supabase MCP `execute_sql` nicht genutzt (CLI `supabase db query --linked` stattdessen)

---

## 9. Verbleibende Risiken

- **Multi-Tenant-Konsistenz:** Vollständigkeit wurde über `EXISTS` (mindestens ein Mandant) geprüft, nicht mandantenweise für jede `roles`-Zeile einzeln.
- **Gesamt-Permission-Umfang:** Legacy-Rollen tragen weiterhin mehr als die 0155-B.1-Keys (historische Seeds); 0155 ergänzt nur fehlende B.1-Keys idempotent.
- **Lokale Supabase/Docker:** `supabase status` ohne Docker nicht aussagekräftig für lokale Entwicklung.

---

## 10. Nächster sinnvoller Schritt

Optional **B.1l** oder Folge-Audit: mandantenweise Stichprobe (ein Tenant pro Legacy-Rolle), Abgleich Remote-DB vs. `staticRolePermissions.ts` nach B.1j-Commit, dann erst weitergehende ProductAccess-/Assist-Phasen planen.
