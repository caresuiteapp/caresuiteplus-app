# CareSuite+ — App Start Page Cleanup Report

**Stand:** 2026-06-13  
**Scope:** Öffentliche Startseite bereinigen, Entwickler-Inhalte internalisieren, SaaS-Landing mit 4 Einstiegskarten  
**Kein Anspruch auf:** production-ready, store-ready, vollständig live-ready

---

## A. Executive Summary

Die öffentliche App-Startseite (`/` → `AppStartScreen`) zeigt keine internen Entwickler-Inhalte mehr (Technisches Fundament, Design System, WP-Nummern, Demo-Navigationskacheln). Stattdessen präsentiert sie vier produktähnliche Einstiegskarten für Unternehmen, Mitarbeitende, Klient:innen/Angehörige und Registrierung. Entwicklerwerkzeuge wurden nach `/business/admin/*` verlagert und sind nur bei `__DEV__` oder Admin-Rolle erreichbar.

---

## B. Ausgangslage (Before)

| Element | Ort | Problem |
|---------|-----|---------|
| `PUBLIC_ENTRIES` (9 Kacheln) | `src/data/demo/navigation.ts` | Enthielt Login, Onboarding, Registrierung, Business, Employee, Portal, **Fundament**, **Design System** |
| Demo-Badge + WP 002 Subtitle | `AppStartScreen.tsx` | Entwickler-orientierte Navigation |
| Architektur-Dokumentation Button | `AppStartScreen.tsx` | Link zu `/fundament` auf öffentlicher Startseite |
| `/fundament`, `/design-system` | `app/` | Öffentlich ohne Guard |

**Einstiegspunkt:** `app/index.tsx` → `AppStartScreen`

---

## C. Durchgeführte Änderungen

### C.1 Neue öffentliche Landing (`AppStartScreen`)

- Vier `PremiumCard`-Einstiege aus `src/data/landing/appStartEntries.ts`
- Responsives Grid: 1 Spalte (Phone), 2 Spalten (Tablet+)
- Keine `ModuleTile`-Badges („● Aktiv“)
- Footer via `AppStartFooter` mit `SUPPORT_LINKS`

### C.2 Entwickler-Inhalte internalisiert

| Bereich | Neuer Pfad | Guard |
|---------|-----------|-------|
| Entwickler-Hub | `/business/admin/developer` | `RequireDevOrAdmin` |
| Architektur / Fundament | `/business/admin/architecture` | `RequireDevOrAdmin` + Auth in Prod |
| Design System | `/business/admin/design-system` → Redirect `/design-system` | `DevToolGate` auf `/design-system` |
| Legacy `/fundament` | unverändert | `DevToolGate` (Redirect `/` ohne Zugriff) |

`DEV_TOOL_ENTRIES` in `navigation.ts` ersetzt die öffentliche Nutzung von `PUBLIC_ENTRIES`.

### C.3 Routing

| Alias | Ziel | Status |
|-------|------|--------|
| `/auth/register` | `/auth/register-business` | Bereits vorhanden |
| `/auth/client-login` | `/auth/portal-code-login` | Bereits vorhanden |
| `/business/dashboard` | `/business` | Neu (Alias für Demo-Dashboard) |

---

## D. Demo-Modus

| Zustand | Anzeige auf Startseite |
|---------|------------------------|
| `isDemoMode() === true` | Badge „Demo-Modus“ + Button „Demo-Dashboard öffnen“ → `/business/dashboard` |
| `isDemoMode() === false` | Kein Demo-Badge; Footer-Link „Demo ansehen“ → `/auth/business-login` |

Keine WP-Kacheln oder Entwickler-Navigation im Demo-Bereich der Startseite.

---

## E. Footer

Links über `src/lib/platform/supportLinks.ts`:

- Hilfe & Support
- Datenschutz
- Impressum
- Nutzungsbedingungen
- Version 1.0.0

Externe URLs (Platzhalter-Domain `caresuiteplus.de`) — keine dedizierten In-App-Screens.

---

## F. Tests

**Datei:** `src/__tests__/auth/appStartPage.test.ts` (8 Tests)

Abgedeckt:

- 4 Einstiegskarten mit korrekten Routen
- Keine Dev-Strings in `AppStartScreen`-Quelltext
- Demo-Badge nur bei `isDemoMode()`
- Auth-Alias-Redirects
- Admin-Routen und `DevToolGate`
- Footer + `supportLinks`

---

## G. Grep-Verifikation (öffentliche Startseite)

Nach Änderungen — **keine Treffer** in `src/screens/AppStartScreen.tsx` für:

- `Technisches Fundament`
- `Design System`
- `Architektur-Dokumentation`
- `WP 001` / `WP 002`
- `PUBLIC_ENTRIES`
- `ModuleTile`

---

## H. Quality Gates

| Gate | Ergebnis | Details |
|------|----------|---------|
| typecheck | **PASS** | `tsc --noEmit` |
| test | **PASS** | **316** Tests (8 neue Startseiten-Tests) |
| smoke | **PASS** | 252 Kern-Dateien, Router-Typen regeneriert |
| platform:audit | **PASS** | 22 Plattform-Dateien |
| store:audit | **PASS** | 4 erwartete Warnungen (EAS Platzhalter, Legal Screens) |

---

## I. Geänderte / neue Dateien

| Datei | Aktion |
|-------|--------|
| `src/screens/AppStartScreen.tsx` | Neu geschrieben |
| `src/data/landing/appStartEntries.ts` | Neu |
| `src/components/layout/AppStartFooter.tsx` | Neu |
| `src/screens/admin/DeveloperHubScreen.tsx` | Neu |
| `src/lib/auth/devAccess.ts` | Neu |
| `src/lib/auth/RequireDevOrAdmin.tsx` | Neu |
| `src/components/auth/DevToolGate.tsx` | Neu |
| `app/business/admin/**` | Neu (developer, architecture, design-system) |
| `app/business/dashboard.tsx` | Neu (Alias) |
| `app/business/_layout.tsx` | `__DEV__`-Bypass für Admin-Routen |
| `app/fundament.tsx` | `DevToolGate` |
| `app/design-system/_layout.tsx` | `DevToolGate` |
| `src/data/demo/navigation.ts` | `DEV_TOOL_ENTRIES` |
| `src/__tests__/auth/appStartPage.test.ts` | Neu |

---

## J. Offene Punkte / Verbleibende Risiken

1. **Footer-URLs** sind Platzhalter (`caresuiteplus.de`) — vor Store-Submission ersetzen.
2. **`/auth`-Landing** (`AuthLandingScreen`) zeigt weiterhin ähnliche 4 Kacheln mit `ModuleTile` und Badge — konsistent, aber nicht Teil dieser Startseiten-Änderung.
3. **Produktions-Admin-Zugriff** auf `/business/admin/*` erfordert Login + `business_admin`/`business_manager`; unauthentifizierter Zugriff nur in `__DEV__`.
4. **`FundamentScreen`** enthält intern weiterhin WP-Referenzen — korrekt hinter Guard, nicht auf öffentlicher Startseite.
5. **Kein visueller Browser-E2E-Test** der Startseite — nur Quelltext-/Unit-Tests.

---

## Verdict

**Startseiten-Cleanup abgeschlossen.** Öffentliche `/`-Route ist produktähnlich; Entwickler-Inhalte sind internalisiert und geschützt. Quality Gates grün. Nicht als production-/store-ready zu werten (siehe offene Punkte).
