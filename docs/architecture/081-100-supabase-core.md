# CareSuite+ — Supabase Core Auth (Arbeitspaket 081–100)

## Überblick

Dieses Arbeitspaket legt die **Supabase-Authentifizierungsschicht** an, ohne den bestehenden Demo-Login zu brechen. Die App wählt automatisch zwischen `demo` und `supabase` anhand der Umgebungsvariablen.

```
App-Start
  └─ resolveAuthMode()
       ├─ demo     → AuthProvider startet abgemeldet, signInDemo() verfügbar
       └─ supabase → getSession() → bootstrapTenantContext() → Profil + Mandant
```

## Auth-Modi

| Modus | Bedingung | Verhalten |
|-------|-----------|-----------|
| `demo` | `EXPO_PUBLIC_DEMO_MODE=true` **oder** fehlende Supabase-URL/Key | Demo-Rollen-Login, keine Live-Session |
| `supabase` | `EXPO_PUBLIC_DEMO_MODE=false` **und** URL + Anon-Key gesetzt | Passwort-Login, Session-Persistenz via AsyncStorage |

`AuthProvider` stellt `authMode: 'demo' \| 'supabase'` über `useAuth()` bereit.

## Services

### `src/lib/supabase/authService.ts`

| Funktion | Zweck |
|----------|-------|
| `signInWithPassword(email, password)` | Supabase-Passwort-Login, deutsche Fehlermeldungen |
| `signOut()` | Supabase-Session beenden |
| `getSession()` | Persistierte Session laden |
| `onAuthStateChange(callback)` | Token-Refresh / Sign-out reagieren |
| `toGermanAuthError(error)` | Auth-Fehler → Deutsch |

Im Demo-Modus (`EXPO_PUBLIC_DEMO_MODE=true`) werden Supabase-Aufrufe **nicht** ausgeführt — stattdessen leere/null-Ergebnisse oder Bypass-Fehlermeldungen.

### `src/lib/supabase/tenantService.ts`

| Funktion | Zweck |
|----------|-------|
| `fetchTenantProfile(userId)` | Profilzeile aus `public.profiles` |
| `bootstrapTenantContext(session)` | Profil + Mandant + `AuthSession` für AuthProvider |

### Typen: `src/types/supabase/session.ts`

- `TenantSession` — Session inkl. Profil und Mandantenname
- `AuthBootstrapResult` — Ergebnis der Session-Wiederherstellung

## AuthProvider-Flow

1. **Initialisierung:** `resolveAuthMode()` bestimmt den Modus.
2. **Supabase-Modus:** `getSession()` → bei vorhandener Session `bootstrapTenantContext()`.
3. **Listener:** `onAuthStateChange` hält User/Profil/Session synchron.
4. **Abmeldung:** `signOut()` ruft im Supabase-Modus `authService.signOut()` auf.
5. **Demo unverändert:** `signInDemo(roleKey)` funktioniert wie zuvor, wenn `isDemoMode()` true ist.

## Umgebungsvariablen

Siehe `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
EXPO_PUBLIC_DEMO_MODE=true
```

| Variable | Pflicht (Live) | Hinweis |
|----------|----------------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | ja | Projekt-URL aus Supabase Dashboard |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ja | **Nur** Anon/Publishable Key — niemals `service_role` |
| `EXPO_PUBLIC_DEMO_MODE` | nein | `true` (Standard ohne URL) oder `false` für Live-Betrieb |

## Migration 0005

Datei: `supabase/migrations/0005_employees_and_profiles.sql`

Enthält:

- **`employees`** — Mandanten-Mitarbeitende (`profile_id` optional verknüpft)
- **Profil-Erweiterungen** — `is_active`, `locale` auf `profiles`
- **RLS** — Mandanten-Isolation + `office.employees.view`
- **Berechtigungen** — `office.employees.view` für Büro-Rollen

### Migration anwenden

```bash
# Lokal (Supabase CLI)
supabase db push

# Oder im Supabase SQL Editor
# → Inhalt von 0005_employees_and_profiles.sql ausführen
```

Reihenfolge: `0001` → `0002` → `0003` → `0004` → `0005`.

## Sicherheit

- RLS auf allen Tabellen in `public` (siehe WP 010)
- **`user_metadata` nicht für Autorisierung** — Rollen liegen in `profiles.role_key` / `role_permissions`
- Anon-Key ist clientseitig sichtbar; sensible Operationen nur über RLS-geschützte Tabellen/RPCs

## Nächste Schritte (WP 101+)

- Supabase-Passwort-Login-Screen (neben Demo-Login)
- `employeeRepository.supabase` für Mitarbeitendenlisten
- Profil-Onboarding (Mandant anlegen, `tenant_id` setzen)
- Edge Functions für Admin-Operationen
