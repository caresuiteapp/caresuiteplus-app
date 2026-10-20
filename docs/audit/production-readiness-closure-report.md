# CareSuite+ — Production Readiness & Closure Report

**Stand:** 2026-06-13  
**Projekt:** `CareSuite+`  
**Methode:** Code-Analyse, Migrationen, package.json, Grep/Glob  
**Quellen:** Codebase + `docs/architecture/live-pilot.md`, `docs/architecture/supabase-deployment.md` (gegen Code verifiziert)

---

## Verifikation

| Befehl | Ergebnis |
|--------|----------|
| `npm run typecheck` | **PASS** (2026-06-13, Parent-Verifikation) |
| `package.json` dependencies | Kein `expo-av`, kein `expo-notifications` |
| Glob `*supabase*` in `src/features/communication/` | **0 Dateien** |
| Glob `*supabase*` in `src/lib/ti/` | **0 Dateien** |
| Grep `getServiceMode` / `demoStore` | Communication/TI nutzen **hardcoded Demo** (`DEMO_TENANT_ID` / `TI_DEMO_TENANT`), nicht `getServiceMode()` |

---

## 1. Klassifikation offener Punkte

| Punkt | Status | Priorität | Warum offen? | Blockiert was? | Benötigt Dateien | Benötigt Supabase? | Benötigt externen Provider? | Nächster Schritt |
|-------|--------|-----------|--------------|----------------|------------------|--------------------|-----------------------------|------------------|
| **Echte TI-Provider** | Vorbereitet, aber nicht produktiv angebunden | **P0** | Nur `MockKIMProvider` + Edge-Stub; kein Vault-Lookup, kein gematik-Connector | KIM-Sync, eGK/ePA/eMP/E-Rezept in Produktion | `src/lib/ti/adapters/*.ts`, `supabase/functions/ti-provider-proxy/index.ts` | Ja (Tabellen + Edge + Vault) | **Ja** (KIM-Connector, Kartenleser, ePA-Gateway) | Edge Function mit Vault; Real-Adapter pro `kind` |
| **Supabase-Repos Kommunikation** | Funktioniert mit Demo-Daten | **P0** | Keine `*.supabase.ts`; alles über `communication.demoStore.ts` | Live-Pilot Nachrichten, Mandantenisolation, Persistenz | Neue Repos unter `src/features/communication/repositories/` | Ja (0011 deployed + RLS-Lücken schließen) | Nein | Repos pro Tabelle; `getServiceMode()`-Umschaltung; Storage-Upload |
| **Supabase-Repos TI** | Funktioniert mit Demo-Daten | **P0** | Alle Services lesen `@/data/demo/ti`; `tenantId !== TI_DEMO_TENANT` → Fehler | TI live für Pilot-Mandanten | `src/lib/ti/repositories/*.supabase.ts` | Ja (0009 deployed) | Nein (DB only) | Supabase-Repos für 14 TI-Tabellen |
| **Push Notifications** | Vorbereitet, aber nicht produktiv angebunden | **P1** | Kein `expo-notifications`; In-App nur Demo-Store; `push_enabled` default `false` | Mobile Push bei neuen Nachrichten | `expo-notifications`, Token-Registrierung, Edge/Cron | Ja (Token-Tabelle fehlt) | **Ja** (Expo Push / FCM / APNs) | Paket + Permissions; `push_tokens`-Migration |
| **expo-av Sprachnachrichten** | Nur UI (vorbereitet) | **P2** | Kein `expo-av`; Timer-Simulation; `onVoicePress={() => {}}` | Echte Sprachnachrichten im Pilot | `expo-av`, `communication.voice.ts` Refactor | Ja (Storage `communication-voice`) | Nein | expo-av voll implementieren **oder** Mikrofon-Button deaktivieren |
| **CareSuite+ Icon** | Fehlend — Build-blockierend | **P0** | `app.json` referenziert `./assets/*`; Ordner fehlt | EAS Build, Store-Submission | `assets/icon.png`, Splash, Android adaptive, favicon | Nein | Nein | Icon-Set erstellen und ablegen |

---

## 2. TI Provider — Deep Dive

| Schicht | Pfad | Real vs. Placeholder |
|---------|------|----------------------|
| Adapter-Typen | `src/lib/ti/adapters/types.ts` | **Echt** (Interfaces) |
| Demo-Adapter | `src/lib/ti/adapters/MockKIMProvider.ts` | **Placeholder** |
| Provider-Service | `src/lib/ti/tiProviderService.ts` | **Demo only** — `TI_DEMO_TENANT` |
| KIM-Services | `kimMailboxService.ts`, `kimMessageService.ts`, … | **Demo only** |
| Edge Function | `supabase/functions/ti-provider-proxy/index.ts` | **Stub** — kein Vault-Lookup |
| Migration | `supabase/migrations/0009_ti_module.sql` | Schema + RLS definiert, **nicht remote deployed** |
| Screens | `src/screens/ti/*` | KIM: Demo; eGK/ePA/eMP/E-Rezept: **Nur UI** |

**Wichtig:** eGK, ePA, eMP, E-Rezept sind **nicht produktionsreif**.

- `secret_reference`: Schema + Demo (`vault:ti/kim/demo-connector`), Edge nutzt Wert nicht für echten API-Call
- Kein `functions.invoke('ti-provider-proxy')` in Client-Services
- ENV Edge: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; Provider-Secrets in Vault, nicht in App

---

## 3. Communication — Supabase-Repos

**0 / 10 Tabellen mit Supabase-Repo.** Alle Services → `communication.demoStore.ts`.

| Tabelle | Type | Service | Hook | Migration | RLS | Demo | Produktiv |
|---------|------|---------|------|-----------|-----|------|-----------|
| `communication_threads` | ✓ | ✓ | ✓ | 0011 | ✓ Policy | ✓ | **Nein** |
| `communication_messages` | ✓ | ✓ | ✓ | 0011 | ✓ | ✓ | **Nein** |
| `communication_participants` | ✓ | indirekt | indirekt | 0011 | **RLS ohne Policy** | ✓ | **Nein** |
| `communication_attachments` | ✓ | ✓ | ✓ | 0011 | **RLS ohne Policy** | ✓ Metadaten | **Nein** |
| `communication_reactions` | ✓ | ✓ | ✓ | 0011 | **RLS ohne Policy** | ✓ | **Nein** |
| `communication_assignments` | ✓ | ✓ | ✓ | 0011 | **RLS ohne Policy** | ✓ | **Nein** |
| `communication_read_receipts` | ✓ | teilweise | — | 0011 | **RLS ohne Policy** | teilweise | **Nein** |
| `communication_notifications` | ✓ | ✓ | ✓ | 0011 | **RLS ohne Policy** | ✓ In-App | **Nein** |
| `communication_audit_events` | ✓ | ✓ | — | 0011 | ✓ | ✓ | **Nein** |
| `communication_settings` | ✓ | ✓ | — | 0011 | ✓ | ✓ | **Nein** |

**Demo-Verhalten:** Soft delete, Archivieren, Senden, Lesestatus, Zuordnung, Portal-Filter (`communication.portalFilter.ts`) — **Funktioniert mit Demo-Daten**. Kein Storage-Upload.

---

## 4. TI — Supabase-Repos

**0 / 14 Tabellen mit Supabase-Repo.**

| Tabelle | Type | Service | Migration | RLS | Demo | Produktiv |
|---------|------|---------|-----------|-----|------|-----------|
| `ti_providers` | ✓ | `tiProviderService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `ti_provider_checks` | ✓ | — | 0009 | ✓ | — | **Nein** |
| `kim_mailboxes` | ✓ | `kimMailboxService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `kim_messages` | ✓ | `kimMessageService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `kim_attachments` | ✓ | `kimAttachmentService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `ti_document_assignments` | ✓ | Demo + Screen | 0009 | ✓ | ✓ | **Nein** |
| `egk_insurance_data_drafts` | ✓ | — | 0009 | ✓ | minimal | **Nur UI** |
| `epa_connections` | ✓ | — | 0009 | ✓ | — | **Nur UI** |
| `emp_medication_plans` | ✓ | — | 0009 | ✓ | — | **Nur UI** |
| `emp_medication_items` | ✓ | — | 0009 | ✓ | — | **Nein** |
| `erezept_items` | ✓ | — | 0009 | ✓ | — | **Nur UI** |
| `ti_consents` | ✓ | `tiConsentService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `ti_audit_events` | ✓ | `tiAuditService.ts` | 0009 | ✓ | ✓ | **Nein** |
| `ti_permissions` | ✓ | `tiPermissionService.ts` | 0009 | ✓ | ✓ | **Nein** |

---

## 5. Push Notifications

| Aspekt | Status |
|--------|--------|
| `expo-notifications` | **Fehlt** |
| Push-Token-Registrierung | **Nicht implementiert** |
| Token-Tabelle | **Fehlt** |
| In-App Notifications | **Funktioniert mit Demo-Daten** |
| `push_enabled` in DB | Default `FALSE` |

**Fehlt für echten Push:** expo-notifications, Token-Persistenz, Server-Trigger bei `message_created`, EAS Push Credentials.

---

## 6. expo-av — Sprachnachrichten

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Installiert | **Nein** |
| Aufnahme | Timer-Simulation, kein Mikrofon |
| Wiedergabe | Play-Button ohne Audio-Engine |
| Upload | Demo-Metadaten, keine echte Datei |
| UI | `onVoicePress={() => {}}` — **No-Op** |
| Hook | `isPreparedOnly: true` |

**Empfehlung:** Mikrofon-Button deaktivieren oder klar als „vorbereitet“ kennzeichnen.

---

## 7. CareSuite+ Icon

`app.json` referenziert `./assets/icon.png`, `splash-icon.png`, `android-icon-*.png`, `favicon.png` — **Ordner `assets/` fehlt**. EAS/Store-Build blockiert.

---

## 8. Production Readiness Statement

> **Demo-fähig für Präsentation und interne QA — nicht live-pilot-ready für mandantenfähigen Produktivbetrieb.**

- Office/Assist/Ops: Repos existieren teilweise — **Vorbereitet, aber nicht produktiv angebunden** ohne `db push`
- Communication, TI, Push, Voice: **Funktioniert mit Demo-Daten**
- Remote-Production: nur Auth-Trigger — Migrationen **0001–0011 ausstehend**

---

## 9. Remote-DB + Environment

### ENV-Variablen

| Variable | Pflicht (Live) | Zweck |
|----------|----------------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Ja | Supabase-Projekt |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Ja | Client (nie `service_role`) |
| `EXPO_PUBLIC_DEMO_MODE` | `false` für Live | Demo/Live-Umschaltung |

### Migrationen

| Datei | Inhalt | Remote |
|-------|--------|--------|
| 0001–0008 | Core, Office, Assist, Ops | **Ausstehend** |
| 0009 | TI (14 Tabellen) | Ausstehend |
| 0010 | Client extended | Ausstehend |
| 0011 | Communication (10 Tabellen) | Ausstehend |

### Storage Buckets (manuell)

`communication-attachments`, `communication-voice`, `communication-images`, `communication-exports` — in 0011 kommentiert, **keine Policies im Repo**.

### RLS-Lücken (Communication 0011)

Policies fehlen für: `participants`, `attachments`, `reactions`, `assignments`, `read_receipts`, `notifications`.

### Edge Functions

| Function | Status |
|----------|--------|
| `ti-provider-proxy` | Stub, nicht produktiv |

---

## 10. Priorisierte Maßnahmenlisten

### A. P0 — sofort

1. `supabase db push` (0001–0011)
2. Communication Supabase-Repos + RLS-Policies für 6 Tabellen
3. TI Supabase-Repos (KIM + Provider + Consent + Audit)
4. `assets/`-Icons erstellen
5. Pilot-Mandanten in `tenants` + Auth

### B. P1 — vor Pilotbetrieb

1. TI Edge Function mit Vault + KIM-Connector
2. Communication Storage + Upload
3. Push (expo-notifications + Token-Tabelle)
4. E2E mit `EXPO_PUBLIC_DEMO_MODE=false`
5. `0011` in Deployment-Docs ergänzen

### C. P2–P3 — später

1. expo-av oder Button deaktivieren
2. eGK/ePA/eMP/E-Rezept Real-Provider
3. Supabase Realtime statt Demo-Intervalle
4. Store-Release nach Pilot

---

## 11. Ehrliche Gesamtbewertung

| Bereich | Formulierung |
|---------|--------------|
| Gesamt-App (Demo) | **Funktioniert mit Demo-Daten** |
| Office/Assist (Live) | **Vorbereitet, nicht produktiv angebunden** |
| Communication | **Funktioniert mit Demo-Daten** |
| TI (KIM) | **Funktioniert mit Demo-Daten**; eGK/ePA/eMP/E-Rezept: **Nur UI** |
| TI-Provider | **Vorbereitet, nicht produktiv angebunden** |
| Push | **Nicht implementiert** |
| Sprachnachrichten | **Nur UI** |
| App-Icons | **Fehlend** — Build-blockierend |
| Remote Supabase | **Nicht deployed** |

---

**Erstellt:** Audit-Session 2026-06-13 · Typecheck Parent-Verifikation PASS
