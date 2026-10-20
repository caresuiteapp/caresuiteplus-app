# CareSuite+ — Registrierung, Login & Zugangsmodell

**Stand:** 2026-06-13

## Wer darf sich registrieren?

Nur **Unternehmen / Einrichtungen / Dienstleister** registrieren sich öffentlich unter `/auth/register-business`.

Mitarbeitende, Klient:innen und Angehörige erhalten Zugänge ausschließlich über **CareSuite+ Office / Verwaltung → Zugänge & Benutzer** (`/business/office/access`).

## Vier Zugangstypen

| Typ | Login-Route | Methode | Ziel nach Login |
|-----|-------------|---------|-----------------|
| Unternehmen / Verwaltung | `/auth/business-login` | Benutzername oder E-Mail + Passwort | `/business` |
| Mitarbeitendenportal | `/auth/employee-login` | Benutzername + Passwort / Einmalpasswort | `/portal/employee` |
| Klient:innenportal | `/auth/portal-code-login` | 6-stelliger Code | `/portal/client` |
| Angehörigenportal | `/auth/portal-code-login` | 6-stelliger Code | `/portal/relative` |

Die Auth-Landingpage unter `/auth` führt zu allen vier Einstiegen.

## Benutzername-Logik (max. 20 Zeichen)

Format: `firma.vorn.nachna`

- Normalisierung: Umlaute → ae/oe/ue/ss, Rechtsformen entfernen, Sonderzeichen entfernen
- Segmente: Firma 5 Zeichen, Vorname 4 Zeichen, Nachname Rest bis 20 Zeichen
- Kollision: numerisches Suffix (`helfe.kevi.reinha2`)
- Implementierung: `src/lib/auth/usernameGenerator.ts`

Beispiele:

- Helferhasen+ UG / Kevin Reinhardt → `helfe.kevi.reinhar`
- Pflege Müller GmbH / Maria Schmidt → `pfle.mari.schmid`

## Einmalpasswort

- Generierung: `src/lib/auth/temporaryPassword.ts`
- Mindestens 10 Zeichen, Groß/Klein/Zahlen, optional Sonderzeichen
- Nur gehasht gespeichert; nach Erstlogin ungültig
- Erstlogin-Screen: `/auth/employee-first-login`

## Portal-Code

- 6 Zeichen, Zeichensatz `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Nur gehasht gespeichert; Klartext einmal bei Erstellung
- Status: `active`, `blocked`, `expired`, `regenerated`, `revoked`
- Implementierung: `src/lib/auth/portalCodeGenerator.ts`

## Office — Zugänge & Benutzer

Route-Baum unter `/business/office/access`:

- Übersicht (Dashboard)
- Interne Benutzer (+ Detail, Anlegen)
- Mitarbeitendenportal (+ Detail, Anlegen)
- Klient:innenportal / Angehörigenportal
- Rollen & Rechte / Modulrechte
- Login-Protokoll

## Rechte & Module

Interne Rollen (PDL, Buchhaltung, …) erhalten Modulrechte über `permissionService` und optional `user_module_permissions`.

- **PDL:** Pflege/QM sehen/bearbeiten, keine Rechnungen
- **Buchhaltung:** Rechnungen sehen, keine Pflegedokumentation
- **Mitarbeitende:** nur eigene Einsätze / Portal-Inhalte

## Sicherheitsregeln

- Keine Klartextpasswörter oder dauerhaften Klartextcodes
- Login-Versuche in `login_audit_events`
- Sperrstatus vor jedem Login prüfen
- Tenant-Isolation (Demo: `DEMO_TENANT_ID`, Live: Profil-Mandant)
- Live-Modus: keine stillen Demo-Fallbacks (`getServiceMode()`)

## Service Mode

| Modus | Verhalten |
|-------|-----------|
| Demo (`EXPO_PUBLIC_DEMO_MODE=true`) | In-Memory `demoAccessStore`, Demo-Tenant |
| Live (Supabase konfiguriert) | Supabase Auth / Edge Functions erforderlich |

## Offene Punkte

- Supabase-Migration `0015_auth_access_portals_and_user_management.sql` für Produktivbetrieb
- RLS-Policies und Edge Functions für Live-Registrierung / Portal-Login
- Relative-Portal-Code-Persistenz getrennt von Klient:innen-Codes verfeinern
