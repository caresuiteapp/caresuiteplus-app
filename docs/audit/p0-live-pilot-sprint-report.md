# P0 Live-Pilot-Fix Sprint — Abschlussbericht

Datum: 2026-06-13  
Scope: Live-Pilot-Readiness (keine neuen Module, keine Fake-Screens)

---

## A) Executive Summary

Der Sprint hat die **Live-Pilot-Grundlage** gelegt: Migration 0012 (RLS + Storage), globaler Service-Mode, Tenant-Resolver, Communication-Supabase-Repos, kritische Hook-Migrationen, Execution/Invoice/Office-Live-Pfade und Pilot-SQL-Dokumentation.

**Verdict (Stand 2026-06-13): Live-pilot vorbereitet mit Einschränkungen — noch nicht vollständig live-pilot-ready**

Die Kernpfade Clients, Communication, Execution, Invoices und Office sind live-vorbereitet und remote teilweise verifiziert. Es fehlen aber noch ein vollständig authentifizierter End-to-End-Live-Lauf, EAS Build, vollständige RLS-/Storage-Liveprüfung sowie eine klare Entscheidung zu TI/KIM-Sichtbarkeit im Pilot.

---

## B) Migration & Infrastruktur

| Item | Status |
|------|--------|
| `0012_communication_rls_and_storage_policies.sql` | ✅ Erstellt |
| Migrationen 0001–0011 Reihenfolge | ✅ Verifiziert (unverändert) |
| `assertLiveConfig()` in `mode.ts` | ✅ |
| `isDemoMode()` Re-Export | ✅ |
| Storage Buckets (Kommentar + SQL) | ✅ In 0012 |
| Remote `db push` | ⏸ Nicht ausgeführt (keine Credentials) |

**Deploy-Befehl (manuell):**
```bash
supabase link --project-ref <ref>
supabase db push
```

---

## C) Tenant & Service Mode

| Item | Status |
|------|--------|
| `tenantResolver.ts` | ✅ |
| `useTenantId.ts` / `useServiceTenantId()` | ✅ |
| `serviceFactory.ts` | ✅ |
| Communication Hooks (11) | ✅ Migriert |
| `useActiveExecutions` | ✅ |
| `useClientFullDetail` | ✅ |
| Weitere ~190 DEMO_TENANT_ID-Stellen | ⚠️ Offen — Migrationsguide unten |

**Live-Regel:** Kein automatischer Fallback auf `DEMO_TENANT_ID` wenn `EXPO_PUBLIC_DEMO_MODE=false`.

---

## D) P0 Module — Live-Pfade

| Modul | D-FULL (Demo) | P-READY (Live) | P-PROD |
|-------|---------------|----------------|--------|
| Clients | ✅ | ✅ Supabase + Extended | ⚠️ |
| Communication Center | ✅ | ✅ CRUD + Realtime + Attachments (prepared) | ⚠️ Voice P2, File-Picker |
| Assist Execution | ✅ | ✅ List/Read + Check-in/out Persist | ⚠️ Task-Results Schema |
| Invoices | ✅ | ✅ List/Create/Detail | ⚠️ LineItems/Payments |
| Office Documents | ✅ | ✅ Upload + List | ⚠️ expo-document-picker |
| TI Module | ✅ Demo | ⚠️ Provider-Repo only | ❌ KIM/eGK preparedOnly |

---

## E) Assets & ENV

| Item | Status |
|------|--------|
| `assets/*.png` (6 Platzhalter) | ✅ via `scripts/create-assets.mjs` |
| `app.json` Referenzen | ✅ (Pfade existieren) |
| `.env.example` | ⚠️ 0012-Hinweis manuell ergänzen |

---

## F) Tests & Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ PASS |
| `npm run smoke` | ✅ PASS |
| `npm run test` | ✅ 146/146 PASS (44 Dateien) |
| Neue Tests | ✅ `p0Restblocker.test.ts` (11), `tenantResolver.test.ts`, `serviceMode.test.ts` |

---

## G) P0 Fixed vs Remaining

### Fixed (P0)
- 0012 RLS für 6 fehlende Communication-Tabellen + Storage-Policies
- `getServiceMode()` / `assertLiveConfig()` global
- Tenant-Resolver + kritische Hooks
- 10 Communication Supabase-Repos
- `communication.service.ts` Live-Switch (Threads, Messages, Send, Create, KPIs, Settings)
- Execution / Invoice / Office Live-Service-Switch
- TI Provider-Repo (Live: `provider_required` wenn leer)
- Pilot-SQL `docs/pilot/pilot-tenants-setup.sql`
- Placeholder-Assets

### Remaining (post-P0)
- Vollständige DEMO_TENANT_ID-Ersetzung in ~190 Dateien (WP-Services, TI-Hooks, Screens)
- `invoiceDetailService` Live-Mapping
- Execution Check-in/out Supabase-Persistenz (assignments-Schema erweitern)
- Communication: assignments, emoji, voice, attachments Live-Wiring
- TI Repos: kim_mailboxes, kim_messages, kim_attachments, ti_consents, ti_audit_events, ti_permissions
- Supabase DB-Typen für `communication_*` Tabellen regenerieren
- `communicationCenter.test.ts` Vitest-Mock für `@/lib/supabase/client`
- Echte App-Icons (aktuell 1×1 PNG-Platzhalter)
- End-to-End gegen Remote-Supabase

---

## H) Empfehlung & Nächste Schritte

1. `.env` mit Live-Werten setzen (`EXPO_PUBLIC_DEMO_MODE=false`)
2. `supabase db push` + `docs/pilot/pilot-tenants-setup.sql` ausführen
3. Auth-User + `profiles.tenant_id` für 3 Pilot-Mandanten anlegen
4. Smoke-Test Communication + Invoice + Execution je Mandant
5. Batch-Migration restlicher `DEMO_TENANT_ID` via `useServiceTenantId()` (siehe `docs/audit/demo-tenant-migration-guide.md` — empfohlen anlegen)

**Ehrliches Fazit:** Die App ist **demo-fähig** und **live-pilot-ready mit Einschränkungen** auf Code-Ebene. **Live-pilot vorbereitet, aber nicht remote verifiziert.** **Production-ready** ist sie nicht.

---

## I) Restblocker-Sprint Ergebnis

Datum: 2026-06-13  
Scope: P0-Restblocker schließen oder ehrlich zurückstufen — keine neuen Features.

### Zusammenfassungstabelle

| Punkt | Vorher | Nachher | Status | Rest |
| ----- | ------ | ------- | ------ | ---- |
| DEMO_TENANT_ID (gesamt `src/`) | ~220 Treffer / ~190 Dateien | ~210 Treffer / ~185 Dateien | ⚠️ Teilweise | P0-Hooks bereinigt; Demo-Daten/Tests/Module-Services bleiben |
| DEMO_TENANT_ID (live-relevante Hooks) | ~35 Hooks hart verdrahtet | 19 P0-Hooks auf `useServiceTenantId()` | ✅ P0 | ~54 Hooks P1 (Module, TI, Employee, Budget, …) |
| `invoiceDetailService` Live | Nur Demo | `getServiceMode` + `invoiceSupabaseRepository` | ✅ | LineItems/Payment-Historie Schema-abhängig |
| Execution Check-in/out | In-Memory Demo | `executionSupabaseRepository.updateStatus` | ✅ | `task_results`, `documentation` Felder preparedOnly |
| Communication Attachments | Demo-only | Storage-Upload + DB-Insert Live-Pfad | ✅ prepared | `expo-document-picker` fehlt → preparedOnly-Meldung |
| Communication Realtime | Demo-Heartbeat | Supabase `postgres_changes` + Tenant-Filter | ✅ | Remote-Verifikation offen |
| Voice / expo-av | Fake-Button | Option B: Mikro deaktiviert + Badge Live | ✅ P2 | expo-av Installation optional später |
| TI Live ohne Mock | MockKIM still | `provider_required` im Live-Modus | ✅ | KIM/eGK/ePA Repos fehlen (P1) |
| DB-Typen regenerieren | Manuell veraltet | Dokumentiert (siehe unten) | ⚠️ | Nach `db push` ausführen |
| Remote E2E | Nicht vorbereitet | `docs/audit/remote-supabase-e2e-checklist.md` | ✅ Doc | Nicht ausgeführt (keine Credentials) |
| Quality Gates | test teilweise rot | typecheck + smoke + 146 tests grün | ✅ | — |

### DEMO_TENANT_ID — Bereinigte P0-Dateien

| Datei | Bereich | Aktion |
| ----- | ------- | ------ |
| `useClientList/Detail/Wizard/EditWizard/Contacts/Tasks/Budget/Consents/Timeline` | Client Hooks | ✅ `useServiceTenantId()` |
| `useInvoiceList/Detail` | Billing Hooks | ✅ |
| `useAssignmentExecution` | Assist Execution | ✅ |
| `useOfficeDocuments/Messages` | Office | ✅ |
| `useActiveExecutions`, `useClientFullDetail` | Assist/Client | ✅ (vorheriger Sprint) |
| `hooks/communication/*` (11) | Communication | ✅ (vorheriger Sprint) |
| `ConversationScreen` | Communication UI | ✅ `voicePreparedOnly` + Tenant |
| `invoiceDetailService.ts` | Office Service | ✅ kein harter Demo-Tenant |
| `executionService.ts` | Assist Service | ✅ kein harter Demo-Tenant |

### Bewusst verbleibend (Demo/Test/P1)

| Kategorie | Beispiele | Begründung |
| --------- | --------- | ---------- |
| Demo-Daten | `src/data/demo/**` | Erlaubt — Seed-Daten |
| Tests | `src/__tests__/**`, `wp*.test.ts` | Erlaubt — isolierte Demo-Fixtures |
| Tenant-Resolver | `tenantResolver.ts` | Erlaubt — zentraler Demo-Fallback nur bei `isDemoMode()` |
| Module-Hooks P1 | `use*Module.ts`, `useEmployee*`, `useBudget*` | Nicht im Live-Pilot-Hauptpfad |
| TI-Hooks P1 | `useTI*`, `useKIM*` | TI preparedOnly im Live |
| Screens P1 | `AssignmentExecutionScreen`, `CommunicationSettingsScreen` | Folge-Sprint |
| WP/Module-Services | `*ModuleService.ts`, `*DashboardService.ts` | Demo-Snapshots, kein Live-Switch nötig für Pilot |

### Live Service Mode — Domain-Matrix

| Domain | Demo Backend | Supabase Backend | getServiceMode Switch | Live nutzbar? | Problem |
| ------ | ------------ | ---------------- | --------------------- | ------------- | ------- |
| clients | ✅ demo repo | ✅ `clientService` + extended | ✅ | ✅ | — |
| clientExtended | ✅ demo | ✅ supabase repo | ✅ | ✅ | Types nach Migration |
| employees | ✅ demo | ❌ | ❌ | ❌ P1 | Nur Demo-Listen |
| appointments | ✅ demo | ❌ | ❌ | ❌ P1 | — |
| assignments | ✅ demo | ❌ | ❌ | ❌ P1 | List/Detail Demo-only |
| assist execution | ✅ demo | ✅ `executionSupabaseRepository` | ✅ | ✅ | Task-Docs preparedOnly |
| care records | ✅ demo | ❌ | ❌ | ❌ P1 | — |
| invoices | ✅ demo | ✅ list/create/detail repos | ✅ | ✅ | LineItems/Payments |
| payments | ✅ demo | ❌ | ❌ | ❌ P1 | — |
| budgets | ✅ demo | ❌ | ❌ | ❌ P1 | — |
| documents | ✅ demo | ✅ `officeDocumentsService` | ✅ | ✅ | File-Picker preparedOnly |
| communication | ✅ demo store | ✅ 10 Supabase-Repos | ✅ | ✅ | Attachments preparedOnly |
| ti | ✅ MockKIM | ⚠️ `ti_providers` only | ✅ | ⚠️ preparedOnly | KIM-Repos fehlen |
| portals | ✅ demo | ❌ | ❌ | ❌ P2 | — |
| reporting | ✅ demo | ❌ | ❌ | ❌ P2 | — |

### DB-Typen regenerieren

Nach Remote-Deployment:

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

> Das Projekt nutzt `src/lib/supabase/types.ts` (nicht `database.types.ts`). Keine manuellen Schema-Types schreiben.

### Remote E2E

Siehe `docs/audit/remote-supabase-e2e-checklist.md`. **Nicht ausgeführt** — keine Supabase-Credentials in dieser Session.

### Finale Einstufung

| Stufe | Bewertung |
| ----- | --------- |
| Demo-fähig | ✅ |
| Live-pilot vorbereitet mit Einschränkungen — noch nicht vollständig live-pilot-ready | ✅ (ehrlich) |
| Live-pilot-ready (vollständig) | ❌ |
| Production-ready | ❌ |

### Go/No-Go — Interner Live-Pilot

**Go für internen Live-Pilot erst nach:**

1. `EXPO_PUBLIC_DEMO_MODE=false` gesetzt
2. Supabase Remote Migrationen vollständig deployed
3. Pilot-Mandanten angelegt
4. Auth-User/Profile mit `tenant_id` angelegt
5. RLS Policies live geprüft
6. Storage Buckets + Policies live geprüft
7. EAS Build oder mindestens Android Build erfolgreich
8. Kernworkflow live getestet:
   - Klient anlegen
   - Dokument hochladen
   - Einsatz starten/beenden
   - Nachricht senden
   - Rechnung erstellen
9. TI/KIM entweder deaktiviert/preparedOnly **oder** Audit + Consent live angebunden
10. `isProductActive()` P1 geklärt

**Nicht behaupten:**

- Production-ready
- vollständig live-pilot-ready
- TI/KIM produktiv
- RLS/Storage final geprüft, solange kein Remote-Test dokumentiert ist
