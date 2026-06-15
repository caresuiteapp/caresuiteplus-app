# Mobile Environment Strategy — CareSuite+

**Stand:** 2026-06-13

---

## Umgebungsmodi

| Modus | `EXPO_PUBLIC_DEMO_MODE` | Backend | Zielgruppe |
|-------|-------------------------|---------|------------|
| Demo/Lokal | `true` (Default) | In-Memory + Demo-Tenant | Entwicklung, Store-Review-Demo |
| Live-Pilot | `false` | Supabase Remote + RLS | Interne QA, Pilot-Mandanten |
| Production | `false` | Supabase Production | Store-Builds nach Freigabe |

---

## Client-Variablen (`.env` / EAS Secrets)

| Variable | Pflicht Live | Beschreibung |
|----------|--------------|--------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Ja | Supabase Projekt-URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Ja | Anon/Publishable Key (kein service_role) |
| `EXPO_PUBLIC_DEMO_MODE` | Ja | `false` für Live/Production |
| `EAS_PROJECT_ID` | Für EAS | UUID aus `eas project:init` |
| `APP_ENV` | Auto | Gesetzt durch `eas.json` Profile |

**Niemals committen:** `.env`, Service-Role-Keys, Play Service Account JSON.

---

## EAS Profile → APP_ENV

| Profil | APP_ENV | Empfohlene Secrets |
|--------|---------|-------------------|
| development | development | Demo OK oder Live |
| preview | preview | Live für QA |
| production | production | Live, `DEMO_MODE=false` |

```bash
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co"
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>"
npx eas secret:create --name EXPO_PUBLIC_DEMO_MODE --value "false"
```

---

## Lokale Entwicklung

```bash
cp .env.example .env
# Werte eintragen
npm run start
```

`app.config.ts` liest `EAS_PROJECT_ID` zur Build-Zeit; Expo Public Vars zur Laufzeit.

---

## Web vs Native

Gleiche `.env`-Variablen für `expo start --web` und native Builds. Web-Export (`npx expo export -p web`) bündelt Public Vars zur Build-Zeit.

---

## Sicherheit

- Nur `EXPO_PUBLIC_*` im Client
- RLS auf Supabase für Mandantentrennung
- Keine Credentials in `reviewer-notes.md` oder Repo

---

## Vor erstem Production-Build

1. `.env.example` als Vorlage — echte Werte nur lokal / EAS Secrets
2. `EXPO_PUBLIC_DEMO_MODE=false` für preview/production
3. Migrationen 0001+ auf Remote angewendet
4. Demo-Credentials für App-Review separat in Store Consoles
