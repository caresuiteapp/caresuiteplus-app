# C.14 Client Portal Rebuild — Abnahmebericht

**Datum:** 2026-06-24  
**Phase:** C.14  
**Bereich:** Klient:innenportal  
**Ergebnis:** BESTANDEN

## Geprüfte Routen

| Route | Status | Screenshot |
|---|---|---|
| `/portal/client` | OK | c14-client-portal-dashboard.png |
| `/portal/client/appointments` | OK | c14-client-appointments.png |
| `/portal/client/messages` | OK | c14-client-messages.png |
| `/portal/client/documents` | OK | c14-client-documents-before-release.png |

## Datenfluss

- **Termine-Tab:** `PortalAppointmentsTab` → `portalAppointmentsLiveService` → `assignments` Tabelle
- **Nachrichten-Tab:** `ClientPortalMessagesScreen` → `PortalMessagesListShell` → `message_threads`
- **Dokumente-Tab:** `PortalDocumentsTab` → Portal-Dokumente + freigegebene Nachweise

## Authentication

- Client Portal Login via `client-portal-login` Edge Function
- Zugangsdaten: Username + Portal-Code
- Session über `PORTAL_SESSION_KEY`

## Proof Release Flow (E2E bestätigt)

1. Proof `portal_visible = true` → sichtbar im Klientenportal ✓
2. Proof `portal_visible = false` → verborgen im Klientenportal ✓
3. Screenshots: `c14-client-documents-after-release.png`, `c14-client-documents-after-revoke.png`

## Senior-Friendly Design

- `AdaptivePortalOverview` für Dashboard
- Große, klare Buttons und Schriftgrößen
- `PortalTabScreen` mit vereinfachter Navigation
- Offline-freundliche Fehlermeldungen

## Design-System

- `PortalTabScreen`, `PortalAppointmentsTab`, `PortalDocumentsTab`
- `PremiumCard`, `EmptyState`, `LoadingState`
- `AdaptivePortalOverview` für responsives Dashboard

## Ergebnis

Klient:innenportal vollständig funktional: Termine, Nachrichten, Dokumente, Proof-Release/Revoke bestätigt.
