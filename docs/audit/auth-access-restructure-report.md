# Auth & Access Restructure — Implementierungsbericht

**Datum:** 2026-06-13  
**Scope:** Registrierung, Login, Portalzugänge, Office-Benutzerverwaltung

---

## A. Executive Summary

Die öffentliche Auth-Struktur wurde auf vier Zugangstypen umgestellt. Auth-Screens, Services, Office-Zugangsverwaltung, Tests und Dokumentation sind implementiert. Demo-Modus ist voll nutzbar; Live-Produktivbetrieb erfordert weiterhin Supabase Auth, Migration und RLS.

---

## B. Neue Login-Struktur

| Route | Screen |
|-------|--------|
| `/auth` | AuthLandingScreen |
| `/auth/business-login` | BusinessLoginScreen |
| `/auth/register-business` | BusinessRegisterScreen |
| `/auth/employee-login` | EmployeePortalLoginScreen |
| `/auth/employee-first-login` | EmployeeFirstLoginPasswordScreen |
| `/auth/portal-code-login` | PortalCodeLoginScreen |
| `/auth/forgot-password` | ForgotPasswordScreen |

Legacy-Redirects: `/auth/register` → `register-business`, `/auth/client-login` → `portal-code-login`.

---

## C. Registrierung Unternehmen

- Nur öffentliche Unternehmensregistrierung
- `registerBusinessTenant()` in `businessAuthService.ts`
- Office wird bei Registrierung / Fachmodul-Aktivierung mit aktiviert

---

## D–F. Interne Benutzer, Mitarbeitendenportal, Portale

Office-Bereich `/business/office/access` mit Dashboard, Listen, Detail, Anlegen, Rollen, Audit.

Services: `accessManagementService`, `employeePortalAuthService`, `clientPortalAuthService`, `relativePortalAuthService`.

---

## G. Benutzername-Logik

`usernameGenerator.ts` — max. 20 Zeichen, Normalisierung, Kollisions-Suffix.

---

## H. Rechte & Module

`permissionService.ts` — Rollen-Defaults, PDL/Buchhaltung/Mitarbeitende-Hilfsfunktionen.

---

## I. Datenmodell / Migration

Types in `auth.types.ts`, Demo-Store `demoAccessStore.ts`. Supabase-Migration `0016_auth_access_portals_and_user_management.sql` vorbereitet (Tabellen + RLS). Live-Anwendung via `supabase db push` noch ausstehend.

---

## J. Security

Gehashte Passwörter/Codes, Login-Audit, Sperrprüfung, kein service_role im Frontend.

---

## K. Tests

| Datei | Inhalt |
|-------|--------|
| `usernameGenerator.test.ts` | Spec-Beispiele, 20-Zeichen, Kollision |
| `temporaryPassword.test.ts` | Generierung, Hash, Ablauf |
| `portalCodeGenerator.test.ts` | Format, Charset, Maskierung |
| `authAccessModel.test.ts` | Registrierung, Sperre, Portal, Rechte, Service Mode |

---

## L. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (258/258) |
| `npm run smoke` | **PASS** |

### Expo Router Typecheck-Fix (2026-06-13)

**Ursache:** Korrupte `.expo/types/router.d.ts` — das Interface schloss vorzeitig (Zeile 12–14), danach hingen Fragmente der `hrefInputParams`-Union als ungültige Top-Level-Zeilen (38k+ Zeichen) ohne `declare module`-Kontext. TypeScript meldete TS1128/TS1109 ab Zeile 15.

**Fix:** `.expo` gelöscht, Typed Routes mit korrektem `EXPO_ROUTER_APP_ROOT=app/` neu generiert (`scripts/regenerate-router-types.mjs`). Smoke führt Regeneration vor Typecheck aus.

**Keine Workarounds:** `strict` unverändert, kein `skipLibCheck`, kein Ausschluss von `.expo/types`.

---

## M. Was bleibt offen?

- Remote Supabase Auth + RLS Live-Validierung
- Edge Functions für Live-Registrierung
- Relative-Portal-Codes separat persistieren
- Vollständige Modulrechte-UI pro Benutzer

---

**Fazit:** Auth-Struktur fachlich umgesetzt, Quality Gates grün. Live-Produktivbetrieb erst nach Remote-Supabase-, Auth- und RLS-Prüfung.
