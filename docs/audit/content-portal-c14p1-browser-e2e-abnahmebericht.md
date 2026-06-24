# C.14P.1 Browser E2E Abnahmebericht

## Script

`scripts/audit/contentPortalC14P1BrowserE2e.mjs`

## Konfiguration

| Eigenschaft | Wert |
|---|---|
| Browser | msedge (Playwright, headless) |
| Basis-URL | `https://caresuiteplus.app` |
| Ziel-Tenant | Test Pflege GmbH (`a4ba83bd-...`, `internal_test`) |
| Screenshots | `docs/audit/content-portal-c14p1-screenshots/` |
| Ergebnis-JSON | `.audit-content-portal-c14p1-browser-results.json` |

## Prüfpunkte

| # | Check ID | Beschreibung | Typ |
|---|---|---|---|
| 1 | `api_business_login` | Business-Login über Supabase Auth | Kritisch |
| 2 | `business_login` | Session-Injection + Dashboard sichtbar | Kritisch |
| 3 | `employee_portal_login` | Mitarbeiterportal-Login | Kritisch |
| 4 | `execution_detail_loads` | **Fix 1**: Durchführungs-Route ohne Guard-Block | Kritisch |
| 5 | `execution_not_live_blocked` | Kein "Live-Modus nicht angebunden" Text | Kritisch |
| 6 | `employee_sees_assignments` | Einsätze in Mitarbeiterportal sichtbar | Standard |
| 7 | `employee_messages_route` | Nachrichten-Route lädt | Regression |
| 8 | `client_portal_login` | Klientenportal-Login | Kritisch |
| 9 | `client_dashboard` | Dashboard ohne Fehler | Standard |
| 10 | `proof_release_grant` | **Fix 2**: Nachweis freigeben → portal_visible | Kritisch |
| 11 | `proof_visible_after_release` | Nachweis in Klientenportal sichtbar | Standard |
| 12 | `proof_release_revoke` | **Fix 2**: Freigabe zurückziehen | Kritisch |
| 13 | `proof_hidden_after_revoke` | Kein veralteter Nachweis nach Widerruf | Standard |
| 14 | `message_send_employee` | Echte Nachricht (MA-Thread) | Kritisch |
| 15 | `message_send_client` | Echte Nachricht (Klient-Thread) | Kritisch |
| 16 | `client_messages_route` | Klientenportal Nachrichten laden | Regression |
| 17 | `no_technical_leak` | Kein `[object Object]`, Stack Trace etc. | Sicherheit |
| 18 | `no_foreign_data` | Keine Fremd-Mandanten-Daten sichtbar | Sicherheit |

## Bestanden-Kriterium

Alle als „Kritisch" markierten Checks müssen `pass: true` sein.

## Hinweis

Dieses Script ist produktionssicher: Credentials kommen ausschließlich aus `.env`, werden nie geloggt, und es werden nur Test-Tenant-Daten verwendet.
