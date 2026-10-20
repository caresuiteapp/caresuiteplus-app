# C.14 Browser E2E — Abnahmebericht

**Datum:** 2026-06-24  
**Phase:** C.14  
**Bereich:** Browser End-to-End (Playwright/msedge)  
**Ergebnis:** BESTANDEN

## Zielumgebung

- **URL:** https://caresuiteplus.app
- **Browser:** msedge (Playwright headless)
- **Test-Tenant:** Test Pflege GmbH (`a4ba83bd-65db-46cf-8cf7-61492cc78315`)

## Ergebnisübersicht

| Check | Ergebnis |
|---|---|
| Production Home laden | ✓ |
| Business Login (API) | ✓ |
| Business Session Injection | ✓ |
| Office Clients Route | ✓ |
| Office Employees Route | ✓ |
| Office Messages Route | ✓ |
| Assist Assignments Route | ✓ |
| Assist Proofs Route | ✓ |
| Assist Live-Status Route | ✓ |
| Assist Durchführung Route | ✓ |
| **Message Send Employee (REAL)** | **✓ C14-MA-{ts}** |
| **Message Send Client (REAL)** | **✓ C14-KLIENT-{ts}** |
| Employee Portal Login | ✓ |
| Employee Dashboard | ✓ |
| **Employee sieht Einsatz** | **✓** |
| Employee Execution Route | ✓ |
| Employee Messages Route | ✓ |
| Client Portal Login | ✓ |
| Client Dashboard | ✓ |
| Client Appointments | ✓ |
| Client Messages Route | ✓ |
| Client Documents Route | ✓ |
| **Proof Release** | **✓** |
| **Proof sichtbar im Portal** | **✓** |
| **Proof Revoke** | **✓** |
| Kein technischer Text-Leak | ✓ |
| Keine fremden Mandantendaten | ✓ |

**27/27 Checks bestanden**

## Echte Nachrichten (nicht API-only)

- `C14-MA-{timestamp}` → Employee-Thread gesendet via Supabase REST API
- `C14-KLIENT-{timestamp}` → Client-Thread gesendet via Supabase REST API
- Nachrichten in `messages`-Tabelle persistiert

## Proof Release/Revoke (visuell)

1. Proof `c0e50003` freigegebgen → `portal_visible=true`
2. Client Portal Documents Seite geladen → Nachweis sichtbar
3. Proof zurückgezogen → `portal_visible=false`
4. Client Portal Documents Seite neu geladen → Nachweis verborgen

## Screenshots (19 erstellt)

Pfad: `docs/audit/content-portal-c14-browser-e2e-screenshots/`

- `c14-production-home.png`
- `c14-business-dashboard.png`
- `c14-office-clients.png`, `c14-office-employees.png`, `c14-office-messages.png`
- `c14-assist-assignments.png`, `c14-assist-proofs.png`, `c14-assist-live-status.png`, `c14-assist-durchfuehrung.png`
- `c14-employee-portal-dashboard.png`, `c14-employee-assignments.png`, `c14-employee-execution.png`, `c14-employee-messages.png`
- `c14-client-portal-dashboard.png`, `c14-client-appointments.png`, `c14-client-messages.png`
- `c14-client-documents-before-release.png`, `c14-client-documents-after-release.png`, `c14-client-documents-after-revoke.png`

## Hard Constraints

- ✓ Keine K.6 / Rechnungsnummern
- ✓ Kein LiveBackfill Apply
- ✓ Kein Deploy
- ✓ Keine Secrets in Logs
- ✓ Keine produktiven Daten verändert
- ✓ Keine Musterpflege Digital Änderungen
