# Responsive Shell R.1 — Mobile/Tablet Only Abnahmebericht

**Datum:** 2026-06-22  
**Branch:** `main` (uncommitted — siehe § Git-Gates)  
**Scope:** Compact app shell für ≤1023px; Desktop ≥1024px unverändert  
**Spec:** RESPONSIVE SHELL R.1 MOBILE/TABLET ONLY

---

## 1. Executive Summary

**Ergebnis:** ✅ **R.1 Implementierung code-complete** für Mobile (≤767) und Tablet (768–1023).  
**Desktop (≥1024):** ✅ `PlatformShell` / `CareDesktopShell` Routing unverändert — Screenshots 1440×900 Kontrolle.  
**Commit:** ⛔ **BLOCKED** — globales Typecheck-Gate rot (pre-existing, nicht durch R.1 verursacht).

---

## 2. Git / Abort-Gates (Spec §18–20)

| Prüfung | Ergebnis |
|---------|----------|
| Branch | ✅ `main` |
| Staged files at start | ⚠️ Viele unstaged Änderungen im WT (pre-existing) — R.1 nur scoped paths |
| Desktop visibly changed | ✅ Nein — `CareAdaptiveShell` gated via `isDesktopOrWide` |
| Global typecheck | ⛔ FAIL — `.audit-typecheck-responsive-shell-r1-mobile-tablet-only-precommit.log` (pre-existing errors in Office/QM/Reporting) |
| R.1 scoped tests | ✅ 23/23 (`responsiveShellR1` 14 + `officeMobileLayout` 9) |
| Deploy | ✅ Nicht ausgelöst (kein `[deploy]`) |

**Commit-Entscheidung:** Kein Commit/Push — globales Typecheck-Gate nicht grün.

---

## 3. Implementierte Fixes

### A — Auth / Login (Mobile + Tablet)

- `resolveLlganViewGlass('login')` — card alpha 0.90 für stärkeres Milchglas
- Bestehende `useAuthFlowTypography()` / `GlassCard` / `InputField` login tokens unverändert auf Desktop

### B — Business / Office / Assist (Compact Platform Shell)

- **`MobileAppShell`**: Fixed `ShellAppBar` (☰, Titel, Profil), Bottom `AppTabBar`, Scroll-Content dazwischen
- **`ShellNavigationDrawer`**: Overlay-Modal (kein Slide-Sidebar) — Module-Rail + Modul-Nav-Gruppen
- **`CareAdaptiveShell`**: `<1024` → `CompactPlatformShell`; `≥1024` → `CareDesktopShell` (PlatformShell 1:1)
- **`usePlatformLayout`**: `showBottomTabs` / `showSideNavigation` an Compact-Breakpoint gekoppelt

### C — Client + Employee Portal

- **`PortalShellLayout`**: Left nav nur `≥1024`; Tablet/Mobile AppBar + Hamburger + Bottom Nav
- **`PortalNavigationDrawer`**: Overlay-Menü für Portal-Tabs
- **`PortalTopBar`**: Hamburger in compact mode
- **`PortalLeftNav` / `PortalTabLeftNav`**: LLGAN `lightLiquidGlass.sidebar` statt grauem `auroraGlass.panel`

### D — Preview / Tech-Text

- `PlatformShellPreviewContent`, `portal-shell-preview` — technische Vorschau-Strings nur auf Desktop

---

## 4. Desktop-Schutz (1440×900)

| Route | Before (legacy) | After R.1 desktop |
|-------|-----------------|-------------------|
| `business-shell-preview-web-desktop-1440.png` | Rail + Sidebar + Topbar | ✅ Gleiche IA — kein Hamburger, kein Bottom Nav |
| `portal-shell-preview-web-desktop-1440.png` | Left nav + topbar | ✅ Left nav sichtbar, kein Bottom Nav |
| `auth-business-login-web-desktop-1440.png` | Auth layout | ✅ Unverändert |

Screenshots: `docs/audit/responsive-screenshots/*-web-desktop-1440.png`

---

## 5. Mobile / Tablet Screenshots (390×844 / 834×1194)

| Bereich | Mobile | Tablet |
|---------|--------|--------|
| Login | `auth-business-login-mobile-390.png` | `auth-business-login-tablet-834.png` |
| Business | `business-shell-preview-mobile-390.png` | `business-shell-preview-tablet-834.png` |
| Assist | `assist-shell-preview-mobile-390.png` | `assist-shell-preview-tablet-834.png` |
| Client Portal | `portal-shell-preview-mobile-390.png` | `portal-shell-preview-tablet-834.png` |
| Employee Portal | `employee-portal-shell-preview-mobile-390.png` | `employee-portal-shell-preview-tablet-834.png` |

Capture: `node scripts/capture-responsive-screenshots-r1.mjs` @ `:8082`

---

## 6. Tests (Spec §17)

| Testfile | Result |
|----------|--------|
| `src/__tests__/platform/responsiveShellR1.test.ts` | ✅ 14/14 |
| `src/__tests__/office/officeMobileLayout.test.ts` | ✅ 9/9 |
| `src/__tests__/design/adaptiveShellAdoption.test.ts` | ✅ CareAdaptiveShell-Test aktualisiert |

Log: `.audit-test-responsive-shell-r1-mobile-tablet-only-precommit.log`

---

## 7. Geänderte Dateien (R.1 Scope)

```
src/components/layout/MobileAppShell.tsx          (neu)
src/components/layout/CompactPlatformShell.tsx   (neu)
src/components/layout/ShellAppBar.tsx             (neu)
src/components/layout/ShellNavigationDrawer.tsx   (neu)
src/components/layout/CareAdaptiveShell.tsx
src/components/layout/portal/PortalShellLayout.tsx
src/components/layout/portal/PortalTopBar.tsx
src/components/layout/portal/PortalLeftNav.tsx
src/components/layout/portal/PortalTabLeftNav.tsx
src/components/layout/portal/PortalNavigationDrawer.tsx (neu)
src/hooks/usePlatformLayout.ts
src/lib/platform/shellLayoutMetrics.ts
src/design/tokens/lightLiquidGlassAuroraNebula.ts
src/components/dev/PlatformShellPreviewContent.tsx
app/assist-shell-preview.tsx                    (neu)
app/employee-portal-shell-preview.tsx           (neu)
app/portal-shell-preview.tsx
src/__tests__/platform/responsiveShellR1.test.ts (neu)
scripts/capture-responsive-screenshots-r1.mjs    (neu)
```

**Nicht geändert:** `src/components/layout/platform/platformshell.tsx` (Desktop ≥1024)

---

## 8. Known Gaps

- Globales Typecheck weiterhin rot (Office Messenger, QM Cockpit, Reporting — pre-existing)
- Live `/business` ohne Auth weiterhin Redirect — QA via `/shell-preview`
- Manuelle Browser-Hamburger/Drawer-Interaktion nicht per MCP verifiziert (Screenshot-only)

---

## 9. Abschlussantwort (Spec §21 — 20 Punkte)

1. **Scope eingehalten:** Nur Mobile/Tablet; Desktop ≥1024 unangetastet.  
2. **Login-Kontrast:** Stärkeres Login-Milchglas (alpha 0.90).  
3. **Business Mobile:** Desktop-Rail/Sidebar ausgeblendet via Routing.  
4. **Business Tablet:** Kein Topbar-Overlap — separates Compact Shell statt PlatformTopbar.  
5. **Assist Mobile/Tablet:** Gleiches Compact Shell wie Business.  
6. **Client Portal:** Hamburger + Drawer + Bottom Nav; kein graues Sidebar auf Tablet.  
7. **Employee Portal:** Hamburger + Drawer + Bottom Nav auf Compact.  
8. **AppBar:** ☰ links, Titel Mitte, Profil rechts.  
9. **Bottom Nav:** Modul-spezifische Tabs via `useAppShell` / `PortalMobileNav`.  
10. **Drawer:** Overlay-Modal, nicht Slide-Panel.  
11. **Safe Area:** `useSafeAreaInsets` in Shell + Portal.  
12. **Preview-Text:** Auf Mobile/Tablet ausgeblendet.  
13. **LLGAN Glass:** Portal sidebars auf lightLiquidGlass.  
14. **Breakpoint:** 1023 / 767 Conditionals via `useDeviceClass` + `shellLayoutMetrics`.  
15. **Tests:** 14 R.1 + 9 office mobile = 23 grün.  
16. **Screenshots:** 15 neue PNGs (5 routes × 3 viewports).  
17. **Desktop-Kontrolle:** 1440×900 before/after kompatibel.  
18. **Typecheck:** Global FAIL — Commit blockiert.  
19. **Deploy:** Nicht ausgelöst.  
20. **Nächster Schritt:** Globales Typecheck bereinigen, dann scoped Commit mit Message `fix(shell): repair mobile and tablet navigation`.
