# VoiceCore AI — Supabase Deployment

CareSuite+ VoiceCore verbindet das Expo-Frontend mit Supabase (Auth, RLS, Edge Functions) und OpenAI **nur serverseitig**.

**Projekt:** `euagyyztvmemuaiumvxm`  
**URL:** `https://euagyyztvmemuaiumvxm.supabase.co`

## Sicherheitsregeln

| Erlaubt im Client (`.env`, Expo) | Nur serverseitig (CLI / Edge Secrets) |
|----------------------------------|---------------------------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | PostgreSQL connection URL / `DATABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `service_role` / `sb_secret` |
| `EXPO_PUBLIC_DEMO_MODE` | `OPENAI_API_KEY` |

**KI schreibt nie direkt** — alle Änderungen laufen über `ai_pending_actions` + Freigabe-Sheet.

---

## A) Supabase Login

```bash
npx supabase login
```

---

## B) Projekt verknüpfen

```bash
npx supabase link --project-ref euagyyztvmemuaiumvxm
```

---

## C) Migrationen anwenden

```bash
npx supabase db push
```

Enthält `0113_voicecore_ai.sql`:

- `tenant_memberships`, `is_tenant_member()`
- `ai_sessions`, `ai_messages`, `ai_pending_actions`, `ai_action_logs`, `document_chunks`
- RLS mit `tenant_id` + Mandantenmitgliedschaft

---

## D) OpenAI Secret setzen

```bash
npx supabase secrets set OPENAI_API_KEY=sk-DEIN_OPENAI_KEY
```

Ohne dieses Secret:

- **Textmodus** (`ai-text-chat`) → HTTP 503
- **Sprachmodus** (`ai-realtime-token`) → HTTP 503
- **Textmodus im Panel** bleibt sichtbar, zeigt Fehlermeldung

---

## E) Edge Functions deployen

```bash
npx supabase functions deploy ai-realtime-token
npx supabase functions deploy ai-action-dispatch
npx supabase functions deploy ai-commit-approved-action
npx supabase functions deploy ai-text-chat
```

### Funktionen

| Function | Zweck |
|----------|--------|
| `ai-realtime-token` | OpenAI Realtime Session + Tool-Registry |
| `ai-text-chat` | Textmodus mit Tool-Loop (Fallback ohne Mikro) |
| `ai-action-dispatch` | Tools A–P, tenant-scoped, Audit-Log |
| `ai-commit-approved-action` | Speichern nach Nutzerfreigabe |

Alle prüfen:

- `Authorization` Header → `getUser()`
- `verifyAiTenantAccess` (Membership + Profil-Fallback)
- `tenant_id` im Body
- JSON-Fehler 400 / 403 / 503
- Keine Secrets in Responses

---

## F) Frontend `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://euagyyztvmemuaiumvxm.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Ytq7qbmiw1oBnZze7sEg8w_ykL-DAa0
EXPO_PUBLIC_DEMO_MODE=false
```

```bash
npm install
npx expo start
```

---

## G) Verifikation

```bash
npm run typecheck
npm run test -- src/__tests__/ai/voicecoreTools.test.ts
```

### Manuell im Browser (Live-Modus)

1. Einloggen mit Mandantenzugang
2. VoiceOrb unten links („CareSuite+ KI“) sichtbar
3. Klick → **AiMiniPanel** (Textmodus)
4. Frage stellen, z. B. „Suche Klient Müller“
5. Schreibaktion → **Entwurfs-Sheet** erscheint (goldener Pending-State am Orb)
6. Freigabe → Datensatz via `ai-commit-approved-action`

### Sprache (Web only)

1. Mikro im Panel oder Orb starten
2. Benötigt Browser-Mikro + `OPENAI_API_KEY` Secret
3. Long-Press am Orb stoppt Session

---

## Tool-Matrix (A–P)

| Tool | Status | Hinweis |
|------|--------|---------|
| A `search_caresuite` | Live | clients, employees, appointments, document_chunks |
| B `get_current_page_context` | Live | Client-seitig registriert |
| C `get_client_details` | Live | inkl. contacts, notes, tasks |
| D `get_employee_details` | Live | employees |
| E `get_client_tasks` | Live | client_tasks |
| F `get_schedule_conflicts` | Live | appointments overlap |
| G `create_schedule_pending_action` | Live | pending → commit appointment |
| H `create_admission_protocol_pending_action` | Live | 24 Kapitel aus Stammdaten |
| I `search_documents` | Live | document_chunks + client_documents |
| J `open_document_preview` | Live | Navigation |
| K `summarize_client_case` | Live | Aggregation |
| L `create_document_draft_pending_action` | Live | pending → generated_documents |
| M `create_care_note_pending_action` | Live | pending → client_notes |
| N `navigate_to_module` | Live | caresuite:navigate |
| O `ask_missing_required_fields` | Live | Pflichtfeld-Check |
| P `approve_pending_action` | UI only | Freigabe im Sheet |

---

## RLS-Hinweise / bekannte Lücken

- `ai_action_logs`: SELECT/INSERT für authenticated; **kein UPDATE** (absichtlich append-only)
- `document_chunks`: SELECT only — Befüllung/Embeddings separat
- Edge `verifyAiTenantAccess` nutzt service_role nur für Profil-Fallback (nicht im Client)
- Tabellen wie `client_contacts` / `client_tasks`: wenn in Mandant fehlend, Tools liefern leere Arrays/Fehler (kein Demo-Fallback)

---

## Checkliste nach Deploy

- [ ] `supabase db push` ohne Fehler
- [ ] Tabellen `ai_sessions`, `ai_pending_actions`, `ai_action_logs` sichtbar
- [ ] `OPENAI_API_KEY` als Secret gesetzt
- [ ] Vier Edge Functions deployed
- [ ] App im Live-Modus (`EXPO_PUBLIC_DEMO_MODE=false`)
- [ ] Textmodus im Panel funktioniert
- [ ] Pending Action + Freigabe getestet
- [ ] Optional: Realtime-Sprache im Web getestet
