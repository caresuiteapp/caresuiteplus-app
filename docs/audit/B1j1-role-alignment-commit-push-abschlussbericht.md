# B.1j.1 — Role-Alignment Commit & Push Abschlussbericht

**Datum:** 2026-06-20  
**Scope:** Selektiver Git-Commit und Push der B.1j-Vorbereitung (ohne DB-Apply)  
**Project-Ref:** `euagyyztvmemuaiumvxm`  
**Branch:** `main`  
**Commit:** `73cd7360cf533051c84b394d82a46b8e38c4b335`  
**Remote:** `origin/main` (gepusht `32d30d8..73cd736`)

---

## 1. Executive Summary

| Punkt | Ergebnis |
|-------|----------|
| Committed | **Ja** |
| Gepusht | **Ja** → `origin/main` |
| Commit Hash | `73cd7360cf533051c84b394d82a46b8e38c4b335` |
| Dateien im Commit | **6** (425 Zeilen, +423 netto) |
| Migration 0155 angewendet | **Nein** |
| DB verändert | **Nein** |
| RLS verändert | **Nein** |
| Supabase db push | **Nein** |
| `git add .` / `git add -A` | **Nein** |

**Commit-Message:**

```
fix(security): align legacy workspace roles with permissions seed

add legacy-to-caresuite role mapping
map planning workspace role to dispatch
add idempotent 0155 legacy role permission seed
preserve legacy remote roles without renaming users or RLS
document B.1j role alignment preparation
no database apply in this commit
```

**Dateien im Commit:**

1. `src/types/permissions/workspace.ts`
2. `src/lib/permissions/workspaceRoles.ts`
3. `src/lib/permissions/index.ts`
4. `supabase/migrations/0155_sync_legacy_role_permissions.sql`
5. `docs/audit/B1j-legacy-role-alignment-abschlussbericht.md`
6. `src/__tests__/auth/tenantBootstrap.test.ts`

**Working Tree nach Commit/Push:** weiterhin dirty (~1000+ out-of-scope Einträge, unverändert).

---

## 2. Commit-Kandidaten-Matrix

| Datei | Änderung | Risiko | committed? |
|-------|----------|--------|------------|
| `src/types/permissions/workspace.ts` | `'planning'` zu `CanonicalWorkspaceRoleKey` | niedrig | **Ja** |
| `src/lib/permissions/workspaceRoles.ts` | `planning→dispatch`, `mapLegacyRoleKeyToRoleKey()` | niedrig | **Ja** |
| `src/lib/permissions/index.ts` | Export `mapLegacyRoleKeyToRoleKey` | niedrig | **Ja** |
| `supabase/migrations/0155_sync_legacy_role_permissions.sql` | INSERT-only Legacy-Rollen-Seed (neu) | mittel (bis Apply) | **Ja** |
| `docs/audit/B1j-legacy-role-alignment-abschlussbericht.md` | B.1j Abschlussdoku (neu) | niedrig | **Ja** |
| `src/__tests__/auth/tenantBootstrap.test.ts` | Tests planning/dispatch + Legacy-Mapping | niedrig | **Ja** |
| `supabase/migrations/0154_sync_b1_permission_keys.sql` | — | — | **Nein** (unverändert) |
| `src/lib/permissions/staticRolePermissions.ts` | — | — | **Nein** (unverändert) |
| Assist-/B.1h-/B.1i-Berichte | diverse WT-Änderungen | — | **Nein** |

---

## 3. Migration-0155-Safety-Matrix

| Prüfpunkt | Ergebnis | Risiko | Status |
|-----------|----------|--------|--------|
| INSERT-/UPSERT-only | Ja — nur `INSERT … ON CONFLICT DO NOTHING` | niedrig | ✅ |
| Idempotent | Ja | niedrig | ✅ |
| ON CONFLICT vorhanden | Ja `(role_id, permission_key)` | niedrig | ✅ |
| DROP / TRUNCATE / DELETE | Keine | niedrig | ✅ |
| Destructive UPDATEs | Keine | niedrig | ✅ |
| RLS-Änderung | Keine | niedrig | ✅ |
| Rollen-Umbenennung | Keine | niedrig | ✅ |
| User/Profile/Tenant-Member | Keine | niedrig | ✅ |
| Hardcoded User-/Tenant-IDs | Keine | niedrig | ✅ |
| Nur Legacy-Rollen | `owner`, `admin`, `management`, `billing`, `planning`, `office`, `readonly` | niedrig | ✅ |
| No-Op wenn Rolle fehlt | Ja (`WHERE r.key = …`) | niedrig | ✅ |
| owner/admin + `office.invoices.create` | Ja (33 Keys) | mittel (Apply) | ✅ vorbereitet |
| billing idempotent zu 0154 | Ja (8 Keys) | niedrig | ✅ |
| planning dispatch-nahe Keys | Ja (15 Keys inkl. Geo) | niedrig | ✅ |
| office ohne invoice.create | Ja (8 Keys) | niedrig | ✅ |
| readonly nur View-Keys | Ja (5 Keys) | niedrig | ✅ |
| **Remote angewendet** | **Nein** | — | ⏸ B.1k |

---

## 4. Typecheck / Test-Ergebnis

| Befehl | Ergebnis | Log | Status |
|--------|----------|-----|--------|
| `npm run typecheck` | **713** Fehler (Baseline unverändert), 0 neue in B.1j-Dateien | `.audit-typecheck-b1j1-precommit.log` | ✅ |
| `npx vitest run src/__tests__/auth/tenantBootstrap.test.ts src/__tests__/core/permissions.test.ts` | **19/19** bestanden | `.audit-test-b1j1-precommit.log` | ✅ |

---

## 5. Push-Ergebnis

| Feld | Wert |
|------|------|
| Remote | `https://github.com/caresuiteapp/caresuiteplus-app.git` |
| Branch | `main` |
| Commit | `73cd7360cf533051c84b394d82a46b8e38c4b335` |
| Push-Range | `32d30d8..73cd736 main -> main` |
| ahead/behind danach | **0 / 0** (`## main...origin/main`) |
| Force-Push | **Nein** |
| Pull/Merge/Rebase | **Nein** |

---

## 6. Pre-Commit-Gates (Phase 1–3)

| Gate | Ergebnis |
|------|----------|
| Staged Dateien vor Start | Keine |
| Branch | `main` |
| Hinter origin/main | Nein |
| Divergenz | Nein |
| 0154 unverändert | Ja (`git diff` leer) |
| staticRolePermissions unverändert | Ja (`git diff` leer) |
| Staging-Methode | Nur 6 exakte Pfade (`git add <pfad>`) |

---

## 7. Nicht ausgeführte Aktionen

Explizit **nicht** ausgeführt:

- kein Supabase `db push`
- Migration 0155 **nicht** angewendet
- keine DB-Daten verändert
- keine RLS geändert
- keine Rollen umbenannt
- keine User/Profile/Tenant-Members geändert
- Migration 0154 nicht geändert / nicht erneut angewendet
- kein Assist Phase 3
- kein B.2
- kein ProductAccess
- kein `assignmentWorkflowService`
- kein `git add .` / `git add -A`
- kein breites Ordner-Staging

---

## 8. Nächster sinnvoller Schritt

1. **B.1k** — Migration `0155_sync_legacy_role_permissions.sql` remote anwenden und verifizieren (insb. `owner`/`admin` → `office.invoices.create`, `planning` → Geo-Keys).
2. Danach **Assist Phase 3** (Schema-Gaps Signature/Proof/Tracking) gemäß Abnahme-Checkliste.

---

*B.1j.1 abgeschlossen — Commit + Push ohne DB-Apply.*
