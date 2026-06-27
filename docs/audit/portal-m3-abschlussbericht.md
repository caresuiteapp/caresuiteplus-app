# Portal M.3 — Abschlussbericht

Stand: 2026-06-27

## Zusammenfassung

Vollständige M.3-Nachlieferung nach verworfener Produktionsabnahme: Platzhalter entfernt, Avatar-Cache-Bust, Login-Weiterleitung, Landing-Beschreibungen, Detail-Helos bereinigt und Tests erweitert. Baut auf `01c379f` (Mobile Shell) und `b9e8d4e` (tenantId) auf.

---

## Geänderte Dateien

### Neu
- `docs/audit/portal-m3-ist-abgleich.md`
- `docs/audit/portal-m3-abschlussbericht.md`
- `src/lib/portal/portalDisplayLabels.ts`
- `src/lib/auth/profileAvatarUrl.ts`

### Portal-Shell & Navigation
- `src/components/layout/portal/PortalTopBar.tsx`
- `src/components/layout/TopbarProfileAvatar.tsx`

### Welcome & Login
- `src/components/auth/PortalWelcomeGate.tsx`
- `src/components/auth/PortalWelcomeModal.tsx`
- `src/screens/auth/EmployeePortalLoginScreen.tsx`
- `src/screens/auth/PortalCodeLoginScreen.tsx`

### Dashboards & Overview
- `src/components/portal/AdaptivePortalOverview.tsx`
- `src/components/portal/assist/MobilePortalDashboard.tsx`
- `app/portal/employee/(tabs)/index.tsx`
- `app/portal/client/(tabs)/index.tsx`

### Detail & Profil
- `src/components/portal/PortalAppointmentDetailHero.tsx`
- `src/components/portal/PortalEmployeeAssignmentDetailHero.tsx`
- `src/components/portal/PortalEmployeeProfileHero.tsx`
- `src/screens/portal/EmployeeProfileScreen.tsx`
- `src/screens/portal/PortalAssignmentDetailScreen.tsx`
- `src/screens/portal/PortalDocumentDetailScreen.tsx`
- `src/screens/portal/PortalMessageDetailScreen.tsx`
- `src/screens/portal/EmployeePortalVisitExecutionScreen.tsx`
- `src/screens/portal/PortalClientAppointmentDetailScreen.tsx`
- `src/screens/portal/PortalClientDocumentDetailScreen.tsx`
- `src/screens/portal/PortalClientMessageDetailScreen.tsx`

### Labels & Landing
- `src/hooks/useTenantDisplayName.ts`
- `src/lib/tenant/tenantDisplayName.ts`
- `src/lib/portal/engine/portalTerminology.ts`
- `src/data/landing/appStartEntries.ts`

### Tests
- `src/__tests__/portal/portalM3MobileLayout.test.ts`

---

## Checkliste vs. Anforderungen 1–7

| # | Anforderung | Status |
|---|-------------|--------|
| 1 | Mobile-Shell (Header, Bottom-Nav, Content-Scroll, 100dvh, Safe-Area) | ✅ (Basis `01c379f`, Nested-Scroll-Fix `AdaptivePortalOverview`) |
| 2 | Login → Welcome → Dashboard, keine Zwischenseiten | ✅ (`router.replace` nach Login + `PortalWelcomeGate`) |
| 3 | Mitarbeiter-Dashboard mit Namen, Mandant, Rolle, Einsätze, Leerzustand | ✅ (`EmployeePortalDashboardScreen`, Tenant-Fallback „Ihr Unternehmen“) |
| 4 | Klient:innenportal identische Shell + Senior-Layout | ✅ (`MobilePortalDashboard`, klare Texte) |
| 5 | Profilbild Header/Popup/Dashboard/Profil | ✅ (`appendProfileAvatarCacheBust` in `TopbarProfileAvatar`, Profil-Hero) |
| 6 | Platzhalter entfernt | ✅ (kein „Portal-Sicht“, „Ihr Mandant“, generisches „Portal“ in Portal-UI) |
| 7 | Landing vereinheitlicht | ✅ (deutsche Beschreibungen auf allen vier Karten) |

---

## Getestete Routen

| Route | Prüfung |
|-------|---------|
| `/` | Landing mit vier Karten + Beschreibungen |
| `/auth/employee-login` | Login → Redirect `/portal/employee` |
| `/auth/portal-code-login` | Login → Redirect `/portal/client` |
| `/portal/employee` | Dashboard, Welcome-Modal, Bottom-Nav |
| `/portal/employee/schedule` | Leerzustand „Keine Einsätze geplant“ |
| `/portal/employee/profile` | Avatar + Mitarbeiterportal-Badge |
| `/portal/client` | Mobile-Dashboard-Hierarchie |
| `/portal/client/appointments` | Einsätze-Tab |

**Automatisiert:** `npx vitest run src/__tests__/portal/portalM3MobileLayout.test.ts` — 13/13 grün.

---

## Prüfhinweise caresuiteplus.app

1. **Hard-Refresh** (Strg+F5) nach Deploy — alter Bundle-Cache kann M.3 verbergen.
2. **Startseite:** Vier Karten mit Kurzbeschreibung unter dem Titel.
3. **Mitarbeiter-Login:** Welcome-Modal mit Name + Mandant + Rolle → Übersicht mit Begrüßung, kein „Ihr Mandant“.
4. **Mobile (DevTools ≤768px):** Fixer Header „CareSuite+ / Mitarbeiterportal“, fixe Bottom-Nav, nur Inhalt scrollt.
5. **Profilbild:** Nach Upload sofort sichtbar (Initialen verschwinden ohne Reload).
6. **Einsatz-Detail:** Badge „MITARBEITERPORTAL“ statt „Portal-Sicht“.

---

## Commit & Deploy

- **Commit-Hash:** _(nach Push eintragen)_
- **Deploy-Status:** _(nach Netlify-Build eintragen)_
- **Commit-Message:** `feat(portal): complete M.3 overhaul — avatars, labels, login, landing [deploy]`

---

## Offene Punkte

- **Angehörigenportal** (`/portal/relative`): nicht Teil M.3-Soll, weiterhin ältere Overview-Komponente.
- **DomainPortalScreen** (Business-Portal-Previews): interne WP-Vorschau, nicht Endnutzer-Portal.
- **Office `PlatformProfileMenu`:** nutzt ebenfalls Public-URL ohne Cache-Bust — außerhalb M.3-Scope.
