# B.1e — Security-Commit Abschlussbericht

**Datum:** 2026-06-20  
**Scope:** Gruppe B.1e — gezieltes Staging und Commit des Permission-Security-Pakets (B.1 / B.1b / B.1c / B.1d). **Kein** Push, **kein** Supabase-Deploy, **kein** B.2.

---

## Executive Summary

Das B.1-Permission-Paket wurde selektiv gestaged und committed: untracked P0-Dateien `staticRolePermissions.ts` und Migration `0154` sind versioniert; Runtime-Gates (Intake, Portal-Profil, Invoice Create, Relative-Portal-Layout) und `check.ts`-Wiring auf die statische Matrix sind enthalten. Pre-Commit: Typecheck **713** Fehler (Δ 0 vs. B.1d), Permission-Tests **8/8** grün.

---

## Staging-Matrix

| Datei | Aktion | Begründung |
|-------|--------|------------|
| `src/lib/permissions/staticRolePermissions.ts` | add (neu) | P0 ROLE_PERMISSIONS / B.1-Keys |
| `supabase/migrations/0154_sync_b1_permission_keys.sql` | add (neu) | P0 idempotenter DB-Key-Sync |
| `src/types/permissions/index.ts` | modify | A4.3 + `office.invoices.create` PermissionKey |
| `src/lib/permissions/check.ts` | modify | Import staticRolePermissions statt Demo |
| `src/lib/permissions/index.ts` | modify | Re-Export static matrix |
| `src/lib/clients/clientIntakeService.ts` | modify | enforcePermission create/edit |
| `src/hooks/useClientIntakeWizard.ts` | modify | actorRoleKey + B.1d-Scope |
| `src/lib/portal/clientProfileService.ts` | modify | Portal/Office-Zweig, deny by default |
| `src/lib/office/invoiceCreateService.ts` | modify | `office.invoices.create` |
| `app/portal/relative/_layout.tsx` | modify | RequireAuth + RequireRole |
| `docs/audit/A4.3-abschlussbericht.md` | add | Audit-Nachweis |
| `docs/audit/B1-permission-p0-abschlussbericht.md` | add | Audit-Nachweis |
| `docs/audit/B1b-permission-runtime-sync-abschlussbericht.md` | add | Audit-Nachweis |
| `docs/audit/B1c-permission-db-seed-sync-abschlussbericht.md` | add | Audit-Nachweis |
| `docs/audit/B1d-release-readiness-abschlussbericht.md` | add | Release-Readiness / Checkliste |
| `docs/audit/B1e-security-commit-abschlussbericht.md` | add | Dieser Bericht |

**Bewusst nicht gestaged:** `.expo-resolve-test/`, `.audit-*` Logs, übriger Working Tree (Intake-Edit-Umfang, Client-Module, etc.).

---

## Pre-Commit-Checks

| Check | Ergebnis | Log |
|-------|----------|-----|
| `npm run typecheck` | **713** TS-Fehler, Exit 2 | `.audit-typecheck-b1e-precommit.log` |
| Δ vs. B.1d (713) | **0** | — |
| `npm test -- permissions + portal profile live` | **8/8** passed | `.audit-test-b1e-permissions.log` |

Migration 0154: INSERT-only, `ON CONFLICT DO NOTHING`, keine DROP/TRUNCATE/RLS in staged diff.

---

## Commit-Inhalt

**Hash:** `ad0474b4b34bb0720a513bbbea2c6ecf9a0832b2` (kurz: `ad0474b`)  
**Dateien:** 16 (2528+/40−)  
**Message:** `security(permission): sync B1 permission gates and DB keys` (+ Body gemäß B.1e-Vorgabe)

*(Hash-Nachtrag lokal; nicht im Commit `ad0474b` enthalten — optional separat versionieren.)*

---

## Verbleibender Working Tree

Nach Commit verbleiben u. a. geänderte Client-Intake-/Office-Dateien, `.expo-resolve-test/`, diverse untracked Tests/Komponenten und Audit-Artefakte — **nicht** Teil dieses Commits.

---

## Nicht ausgeführte Aktionen

- Kein `git push`
- Kein Netlify-/Remote-Deploy
- Kein `supabase db push` / Migration-Apply
- Kein B.2-Scope
- Kein zweiter Commit

---

## Nächster Schritt

1. Review des Commits durch Release Owner  
2. Manuell Migration **0154** auf Ziel-DB anwenden (nach Freigabe)  
3. Planung Live-Rollen-Migration (`owner`/`admin`/…) — siehe B.1d  
4. Optional: verbleibenden Intake-Edit-Working-Tree separat committen
