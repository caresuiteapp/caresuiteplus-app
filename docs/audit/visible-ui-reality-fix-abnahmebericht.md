# Visible UI Reality Fix U.1 — Abnahmebericht

**Datum:** 2026-06-21  
**HEAD (Start):** `df335ce` · **Branch:** `main`  
**Scope:** System-wide visible UI repair — **kein** K.5.1 billing, **kein** Schema/Permissions

---

## 1. Git-Precheck

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD `df335ce` | ✅ |
| Staged at start | ✅ leer |
| 0154–0160 modified | ✅ nein |
| staticRolePermissions modified | ✅ nein |

Log: `.audit-migration-list-visible-ui-reality-fix-precheck.log`

---

## 2. Defect fixes (A–J)

| ID | Fix |
|----|-----|
| A | `profiles(first_name, last_name, full_name)` + `42703` → generic German error |
| B | `ClientSectionEditModal` — wizard only for create |
| C/D | Employee tabs, `EmployeeSectionEditModal`, Gefahrenzone |
| E | Portal blocked fields → friendly labels |
| F | Assist hints/GPS/live-status user German |
| G | Assignment create ohne WP/Supabase Live hero |
| H | Tenant center fachliche Status-Labels |
| I | `AppGlassModal` unified shell |
| J | Record screens: tabs, empty/error states aligned |

---

## 3. Modal architecture

- `useSectionEditModal` — section open/close state
- `AppGlassModal` — wraps `PlatformModal` with module glow
- `ClientSectionEditModal` / `EmployeeSectionEditModal` — section edit without wizard

---

## 4. Tests

| Log | Result |
|-----|--------|
| `.audit-test-visible-ui-reality-fix-precommit.log` | ✅ 27/27 targeted tests pass |
| `.audit-typecheck-visible-ui-reality-fix-precommit.log` | ⚠️ Repo-wide pre-existing TS errors (unrelated files); changed U.1 files lint clean |

New: `src/__tests__/ui/visibleUiRealityFix.test.ts`

---

## 5. Browser / screenshot acceptance

**Status:** Blocker dokumentiert — Browser-MCP nicht für vollständigen Office/Assist-Flow mit Auth durchgeführt.  
**U.1.1 follow-up (2026-06-21):** Retried at `91450ce` — still **BLOCKED** (MCP tab unavailable, Playwright install hung, Office business auth required). See `visible-ui-u11-manual-browser-abnahmebericht.md`.

Empfohlene manuelle Checks:
1. Klient:innen-Akte → Verlauf (kein DB-Fehler)
2. Klient:innen-Akte → Stammdaten → „Bereich bearbeiten“ (Section-Modal, kein Wizard)
3. Mitarbeitende:r → Tabs + Gefahrenzone
4. Assist Live-Status / Dashboard (keine Supabase/0156-Texte)
5. Mandantenzentrum Status-Badges

Screenshot-Referenz: `Screenshot 2026-06-21 022212.zip`

---

## 6. K.5.1

**Nicht freigegeben** — U.1 ersetzt K.5.1 billing acceptance bis visible UI bestätigt.

---

## Checklists

- `docs/audit/visible-ui-screenshot-defect-checklist.md`
- `docs/audit/visible-ui-internal-text-audit.md`
