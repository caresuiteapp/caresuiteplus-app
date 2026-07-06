# Nachrichtenmodul — Abnahmebericht

**Datum:** 2026-07-06 02:11 UTC  
**Umgebung:** `http://localhost:8091` (Expo Web, Live-Supabase + Audit-Credentials)  
**Branch:** `cursor/cs-vorlagen-documents-signatures-phase2`  
**Commit:** `f605232d`  
**Audit-Mandant:** `a4ba83bd-65db-46cf-8cf7-61492cc78315` (Test Pflege GmbH)

## Git-Precheck (Start)

- Branch: `cursor/cs-vorlagen-documents-signatures-phase2`
- HEAD: `f605232d`
- Uncommitted Layout-/Messaging-Änderungen im Working Tree (kein Push, kein Deploy)

## Zusammenfassung

| Ziel | Status |
| ---- | ------ |
| Reproduzierbare Business-Test-Threads (Audit-Mandant) | **Erledigt** — 2× `communication_threads` + Messages (IDs `c0e6c001…`, `c0e6c002…`) |
| Business Composer mit echtem Thread | **Erledigt (Desktop)** — Thread sichtbar, Composer hell, Senden vorhanden |
| Klient:innen-Portal-Session (Portal-Code) | **Erledigt** — Login OK, Route nicht gesperrt |
| Client-Messages E2E | **Teilweise** — Session OK, Composer-Automatisierung auf Desktop noch unzuverlässig |
| Abnahmebericht | **Aktualisiert** |

**Finale Bewertung (fachlich):** **GELB** — Release für Business-Desktop + Office + Portal-Session; Mobile Business + Employee-Metro-Blocker offen.

## Ergebnis-Tabelle (Playwright focused)

| Route | Desktop | Mobile | Composer | Session/Login | Ergebnis |
| ----- | ------: | -----: | -------: | ------------: | -------: |
| `/office/messages` | GRÜN | GRÜN | GRÜN | GRÜN | **GRÜN** |
| `/business/messages` | GRÜN | ROT | GRÜN | GRÜN | **GELB** |
| `/portal/client/messages` | ROT | GELB | GRÜN | GRÜN | **GELB** |
| `/portal/employee/messages` | ROT | ROT | GRÜN | GRÜN | **ROT** (Metro) |

> Automatisches Script exit 1 wegen strenger Mobile-/Console-Checks; Screenshots unter `docs/audit/messaging-abnahme-screenshots/`.

## Business-Testdaten

- Seed-Script: `.audit-messaging-seed.mjs` (idempotent, nur Audit-Mandant)
- Basis-Portal-Seed: `scripts/audit/contentPortalE2eSeed.mjs` (`message_threads` für Verwaltung/Portale)
- **DB-Fixes angewendet (Remote, kein Netlify-Deploy):**
  - `0235_communication_service_role_grants.sql` — service_role GRANT auf `communication_*`
  - `0237_communication_has_permission_bridge.sql` — Legacy-`messages`-Recht → `communication.*` RLS
- Seed-Lauf nach Fix: **OK** (6/6 Steps grün)

## Klient:innenportal-Session

- Login per `client-portal-login` + `caresuite.portal.session.v1` in localStorage
- **Kein** Supabase-Business-Token parallel (verhindert Session-Konflikt)
- Prime `/portal/client` + Welcome-Gate dismissed
- Ergebnis: `clientId=ec4f159f-e794-4326-8b0e-15c0166df1ea`, Route nicht gesperrt

## Composer-Prüfung

- Business Desktop: echter Thread „Audit Business Konversation“, Composer `[data-testid="messaging-composer"]`, keine Dark-Bar
- Client Portal: Verwaltungs-Messenger (Split); Automatisierung findet Senden nach Thread-Klick nicht zuverlässig — manuell/Screenshot prüfen
- Prüfung ignoriert Shell-/Nav-Dark-Regions

## Offene Punkte

1. **Business Mobile:** Nach Thread-Klick kein Vollbild-Chat / `← Liste` (MessengerShell-State in Playwright)
2. **Employee Portal:** Metro `Unable to resolve module ./csDocumentContextNormalize` — Datei existiert lokal; Expo auf `:8091` neu starten / Cache leeren
3. **Client Desktop Composer-Check:** Playwright false-negative trotz geladenem Split (Thread-Klick → Composer-Wartezeit)

## Fixes in dieser Runde

- `.audit-messaging-seed.mjs`: Admin-Client (service_role) statt Business-JWT für Upsert
- `.audit-messaging-abnahme-focused.mjs`: Client-Login ohne SB-Token, Portal-Prime, `domcontentloaded`-Reload
- Supabase-Migrationen `0235` + `0237` (Repo + Remote angewendet)
- MessengerShell / ChatComposer / Permissions (vorherige Runde, uncommitted)

## Harte Regeln eingehalten

- Kein Push, kein Deploy, kein `[deploy]`
- Nur Audit-Mandant beschrieben/befüllt
- Keine bestehenden Nachrichten gelöscht
- Keine `.audit-*`-Artefakte committed

## Screenshots

`docs/audit/messaging-abnahme-screenshots/`

- `business__desktop__chat.png` — Business Composer mit Audit-Thread
- `office__desktop__chat.png`, `office__mobile__chat.png`
- `client_portal__*__*.png`, `employee_portal__*__*.png`
