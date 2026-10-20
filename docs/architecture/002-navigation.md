# CareSuite+ — Routen & Navigationsfluss (Arbeitspaket 002)

## Einstiegspunkte

| Pfad | Zielgruppe | Auth |
|------|------------|------|
| `/` | Alle | Nein |
| `/auth/business-login` | Geschäftsführung, Verwaltung | Nein |
| `/auth/employee-login` | Mitarbeiter:innen | Nein |
| `/auth/client-login` | Klient:innen, Angehörige | Nein |
| `/fundament` | Entwickler, Product Owner | Nein |

## Geschützte Bereiche

| Bereich | Prefix | Guard |
|---------|--------|-------|
| Business | `/business` | `RequireAuth` + Rollenprüfung |
| Module | `/office`, `/assist`, … | `RequireAuth` + `RequireProductAccess` |
| Portale | `/portal/employee`, `/portal/client` | `RequireAuth` + Rollenprüfung |

## Redirect-Regeln

1. **Nicht angemeldet** → passende Login-Route (`getLoginRedirectForPath`)
2. **Falsche Rolle** → Startseite `/` mit Hinweis
3. **Modul inaktiv** → `/business/modules`
4. **Nach Demo-Login** → `getPostLoginRedirect(roleKey)`

## Demo-Modus

- `AuthProvider` simuliert Session ohne Supabase
- Demo-Profile aus `src/data/demo/profiles.ts`
- Kein `service_role`, keine Secrets

## Rücksprung

- `ScreenHeader` mit `router.back()` auf allen Unterseiten
- Modul-Platzhalter verlinken zurück zum Business-Hub

## Bekannte Grenzen (nach WP 002)

- Keine echten Supabase-Auth-Sessions (→ WP 009/010)
- Modul-Screens sind Platzhalter (→ WP 003+)
- Kein Deep-Link-Handling (→ spätere WPs)
