# Visible UI U.1.2 — Modal Scroll & Assist Card Fix Abnahmebericht

**Datum:** 2026-06-21  
**Branch:** `main` · **Basis:** `422a2d6` (U.1.1)  
**Scope:** Screenshot-proven hotfix — modal scroll system, Assist dashboard cards, residual internal text

---

## 1. Executive Summary

**Ergebnis:** ✅ **U.1.2 code complete** — modal scroll shell, Assist card CTA alignment, internal text cleanup.  
**K.5.1 / K.6:** ⛔ **weiterhin BLOCKED** bis manuelle Browser-Abnahme mit Business-Login (gleicher Gate wie U.1.1).

---

## 2. Git / Abort-Gates

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `422a2d6` | ✅ |
| Sync `origin/main` at start | ✅ |
| 0154–0160 modified | ✅ nein |
| `staticRolePermissions` modified | ✅ nein |

Log: `.audit-migration-list-visible-ui-u12-precheck.log`

---

## 3. Fixes Applied

### A — Modal scroll (systemic)

- `PlatformModal`: flex column, `maxHeight` 92vh, header/footer `flexShrink: 0`, body `overflowY: auto` (web) / `ScrollView` (native), backdrop scroll lock
- `AppGlassModal`: `maxHeightRatio={0.92}`
- `ClientSectionEditModal`: removed nested `ScrollView`; footer actions in modal shell
- `EmployeeSectionEditModal`: `modalShell` + sticky footer via `AppGlassModal.footerActions`

### B — Assist dashboard cards

- `InfoBanner`: optional `actionLabel` / `onAction` inside card
- `AssistSetupHintsBanner`: CTA „Mehr erfahren →“ moved inside banner card; unified `minHeight`

### C — Internal text cleanup

- `AssistDashboardHero`, `AssistLiveStatusScreen`, `assistDataSourceProbe`
- Portal/access profile heroes: „Cloud Live“
- `PreparedTemplateBanner`: Cloud-Anbindung

### D — Section edit usability

- Save/Cancel always in modal footer (not scrolled away)

---

## 4. Verification

| Signal | Result |
|--------|--------|
| `visibleUiRealityFix.test.ts` | ✅ 13/13 |
| Typecheck log | `.audit-typecheck-visible-ui-u12-precommit.log` |
| Test log | `.audit-test-visible-ui-u12-precommit.log` |
| Browser MCP | ⚠️ Not run — tab/view unavailable (U.1.1 class blocker) |

---

## 5. K.5.1 Release Gate

**Nicht freigegeben.** U.1.2 behebt screenshot-proven UI-Defekte auf Code-Ebene; K.5.1 erfordert weiterhin sichtbare Abnahme der Mandantenoberflächen.

---

## 6. Related docs

- `visible-ui-screenshot-defect-checklist.md` (U12-A … U12-E)
- `visible-ui-internal-text-audit.md`
- `visible-ui-u11-manual-browser-abnahmebericht.md`
