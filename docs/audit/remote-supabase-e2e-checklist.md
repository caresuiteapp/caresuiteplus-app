# CareSuite+ — Remote Supabase E2E Checkliste

**Stand:** 2026-06-13 (P0 Sprint)  
**Projekt:** `euagyyztvmemuaiumvxm`  
**Hinweis:** Kein Anspruch auf vollständige Live-Abdeckung — ehrliche Status pro Workflow.

---

## Legende

| Spalte | Bedeutung |
|--------|-----------|
| Demo | `EXPO_PUBLIC_DEMO_MODE=true` lokal |
| Live Remote | Supabase Remote + `EXPO_PUBLIC_DEMO_MODE=false` |
| Ergebnis | PASS / PARTIAL / FAIL / NOT RUN |
| Blocker | Konkreter Grund |

---

## Workflows

| Workflow | Demo | Live Remote | Ergebnis | Blocker |
|----------|------|-------------|----------|---------|
| Business Registrierung | ✓ UI | ✓ Edge `register-business-tenant` 200 (0018) | PASS | — |
| Business Login | ✓ | ✓ Supabase Auth | PASS | — |
| Mitarbeiterzugang erstellen | ✓ Demo-Daten | PARTIAL | PARTIAL | Live-UI/Repo für Employee-Create nicht vollständig E2E dokumentiert |
| Mitarbeiterportal Login | ✓ | ✓ Edge `employee-portal-login` | PASS | — |
| Klientencode erstellen | ✓ | PARTIAL | PARTIAL | Portal-Code-Flow remote verifiziert, UI-E2E offen |
| Klient:innenportal Login | ✓ | ✓ Edge `portal-code-login` | PASS | — |
| Klient anlegen | ✓ | PARTIAL | PARTIAL | `clientRepository` live; Form-E2E nicht vollständig |
| Dokument hochladen | ✓ Demo-Referenz | PARTIAL | PARTIAL | `expo-document-picker` + Storage-Pfad live implementiert; Remote-E2E Upload noch manuell zu verifizieren |
| Nachricht senden | ✓ | PARTIAL | PARTIAL | Communication Center + Attachments vorbereitet; vollständiger Remote-Thread-E2E offen |
| Einsatz erstellen | ✓ | PARTIAL | PARTIAL | Assignment-Services teils Demo-only Detail |
| Einsatz starten/beenden | ✓ | ✓ `executionService` Supabase check-in/out | PASS (Code) | Remote manuell offen |
| Rechnung erstellen | ✓ | PARTIAL | PARTIAL | Invoice Supabase Repo; Create-E2E offen |
| QM-Kapitel erstellen | ✓ | PARTIAL | PARTIAL | QM Demo-Repo Guard; Live-QM noch begrenzt |
| MD-Paket prepared erstellen | ✓ preparedOnly | preparedOnly | PARTIAL | Kein Fake-Erfolg — Status „In Vorbereitung“ |

---

## Empfohlene nächste Remote-E2E-Schritte

1. Preview-Build mit `EXPO_PUBLIC_DEMO_MODE=false` + Live-Tenant nach `eas login`
2. Office-Dokument-Upload gegen Remote Storage (`caresuite-*` Buckets, Migration 0020)
3. Communication Thread + Attachment auf Remote
4. Klient Create → List → Detail auf Remote-Mandant
5. Assignment List/Detail Live-Mapping (P1)

---

## Verwandte Reports

- `docs/audit/live-supabase-auth-portal-remote-verification-report.md`
- `docs/audit/p0-build-live-function-blockers-report.md`
