# CareSuite+ — Vollständiger App-Audit

**Stand:** 2026-06-13  
**Methode:** Code-Analyse, Grep, Stichproben kritischer Workflows  
**Ergänzt:** [Production Readiness Report](./production-readiness-closure-report.md)

---

## Verifikation (Parent, 2026-06-13)

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** — 128/128 |
| `npm run smoke` | **PASS** |

**Grep-Zählung (`src/**`):**

| Muster | Treffer |
|--------|---------|
| TODO / FIXME | **0** |
| console.log / warn / debug | **0** |
| Alert.alert | **0** |
| `onPress={() => {}}` | **1** (`ModuleOverviewScreen.tsx`, disabled) |
| `DEMO_TENANT_ID` | **~200+** in Hooks/Services |
| mock / demoStore | Communication, TI, viele Module |

---

## A. Executive Summary

**Gesamtzustand:** Reifer **Demo-/Pilot-Prototyp** mit breiter UI-Abdeckung (600 WP-Routen/Screens, Permissions, Workflow-Engine), aber **nicht produktiv betriebsfähig** für echte Pflegedienste ohne Integrationsaufwand.

**Produktiv nutzbar:** **Teilweise** — Demo-Modus + `tenant-demo-001` durchspielbar; Live-Supabase **fragmentarisch** (Klient:innen-CRUD + erweiterte Akte teilweise verdrahtet).

**Größte Blocker:**
- Migrationen 0001–0011 nicht auf Production deployed
- `DEMO_TENANT_ID` hardcoded statt `profile.tenantId`
- Communication/Assist/Billing/TI/Uploads überwiegend Demo-Store
- WP-100%-Report misst Datei-Vollständigkeit, nicht Produktionstiefe

| Dimension | % |
|-----------|---|
| UI/Routing/Navigation | ~90% |
| Demo-fähige Workflows | ~65% |
| Supabase-Schema (lokal) | ~85% |
| App↔Supabase-Verdrahtung | ~25% |
| **Produktionsreife gesamt** | **~22%** |

---

## B. Funktionsmatrix

| Bereich | Status | Produktiv | Hauptprobleme | Prio |
|---------|--------|-----------|---------------|------|
| Fundament / Auth | 🟡 | Teilweise | Supabase-Login braucht Env + Schema | P1 |
| Office — Klient:innen | 🟡 | Demo + teils Supabase | Hooks nutzen `DEMO_TENANT_ID` | **P0** |
| Office — Rechnungen | 🔴 | Nur Demo | `demoInvoices` | **P0** |
| Office — Dokumente/Upload | 🔴 | Nur UI | Fake-Upload | **P0** |
| Assist — Durchführung | 🟡 | Demo | Check-in/out nur In-Memory | P1 |
| Assist — Live-Tracking | 🔴 | Demo-only | Kein GPS | P2 |
| Communication Center | 🟡 | Demo | Kein Supabase-Repo | **P0** |
| Portale | 🟡 | Demo | Demo-Domains | P1 |
| TI (KIM, eGK, …) | 🔴 | Mock | `MockKIMProvider` | P1 |
| Supabase / RLS | 🔴 | Nicht live | Remote unvollständig | **P0** |

Legende: ✅ produktiv · 🟡 demo/teilweise · 🔴 UI/stub

---

## C. Button-/Aktionsprüfung (kritisch)

| Bereich | Screen | Button | Status | Problem | Prio |
|---------|--------|--------|--------|---------|------|
| Office | ClientCreateScreen | Speichern | 🟡 | `DEMO_TENANT_ID` | P0 |
| Office | OfficeDocumentUploadScreen | Hochladen | 🔴 | Kein File/Storage | P0 |
| Assist | AssignmentExecutionScreen | Check-in/out | 🟡 | Demo-Store | P0 |
| Communication | CommunicationCenterScreen | Neue Nachricht | ✅ Demo | Kein Supabase | P0 |
| Communication | ConversationScreen | Senden | ✅ Demo | demoStore | P0 |
| TI | EGKVorbereitungScreen | — | 🔴 | Nur Info-Text | P2 |
| Business | ModuleOverviewScreen | Modul aktivieren | 🔴 | `onPress={() => {}}` | P3 |

---

## D. Speichern-/Löschen-Prüfung

| Formtyp | Status |
|---------|--------|
| Klient:in anlegen/bearbeiten | Demo + optional Supabase; Tenant-Bug |
| Klient Extended | Demo/Supabase (`clientExtendedRepository.supabase.ts`) |
| Einsatz durchführen | **Nur Demo** |
| Communication Nachricht/Thread | **Nur Demo** |
| Dokument hochladen (Office) | **Nur UI** |
| Rechnung | **Nur Demo** |

---

## E. Supabase-Prüfung

- **Modus:** Demo default ohne `.env` (`getServiceMode()`)
- **Migrationen lokal:** 0001–0011
- **Remote:** nur Auth-Trigger — **0001–0011 ausstehend**
- **Verdrahtet:** `clientRepository.supabase.ts`, `clientExtendedRepository.supabase.ts`
- **~25 Repos vorhanden, nicht an Services gekoppelt**
- **Nur Demo:** Communication, Assist execution, Invoices, TI
- **Storage:** nicht implementiert; Upload-Code schreibt nicht in Supabase

---

## F. Workflow-Prüfung

| Workflow | Demo | Produktiv |
|----------|------|-----------|
| Einsatzplanung | ✅ | 🔴 |
| Zeiterfassung | ✅ In-Memory | 🔴 |
| Live-Tracking | 🟡 Demo-Geofence | 🔴 |
| Signatur/Nachweise | 🟡 Anzeige | 🔴 Erfassung fehlt |
| Abrechnung | ✅ Listen | 🔴 |
| Communication Center | ✅ voll | 🔴 |
| Klient-Wizard | ✅ Validierung | 🟡 Tenant-Bug |

---

## G. Vorlagenprüfung

| Typ | Status |
|-----|--------|
| Task-Katalog | 🟡 hardcoded Demo |
| Katalog-Einträge | 🟡 `catalogMutations` Demo |
| TI Provider | 🔴 Mock |
| E-Mail/Doc Templates | 🔴 Fehlt |

---

## H. Upload- und Aktenprüfung

| Bereich | Status |
|---------|--------|
| Office Dokumente | 🔴 UI only |
| Klient-Akte Dokumente | 🟡 Anzeige Demo |
| Communication Anhänge | 🔴 Kein echtes File |
| Storage-Pfade | 🔴 Definiert, nicht implementiert |

---

## I. Kritische Blocker P0

1. Migrationen 0001–0011 nicht remote deployed
2. `DEMO_TENANT_ID` in Hooks (`useClientWizard`, Communication, Assist, …)
3. Communication → nur `demoStore`
4. Assist execution → nur Demo
5. Invoices → nur Demo
6. `OfficeDocumentUploadScreen` → kein Upload
7. `MockKIMProvider` → einziger KIM-Adapter
8. Fehlende `assets/` Icons (Build)
9. WP-100%-Report irreführend für Stakeholder

---

## J. Nächste Reparatur-Reihenfolge

1. `supabase db push` (0001–0011)
2. Zentraler `useTenantId()` aus Auth
3. Klient:innen Live end-to-end
4. Communication Supabase-Repos + Storage
5. Assist Execution Live-Repos
6. Billing/Invoices Live
7. Document Upload + Storage
8. TI Edge Function + Provider
9. Pilot mit 3 Mandanten, `DEMO_MODE=false`

---

## K. Cursor-Fix-Prompts (P0)

1. Migrationen deployen und Remote-Stand dokumentieren
2. `DEMO_TENANT_ID` → `profile.tenantId` in allen Hooks
3. `communicationRepository.supabase.ts` + `getServiceMode()`
4. Assist execution an `executionRepository.supabase.ts`
5. Invoices an `invoiceRepository.supabase.ts`
6. OfficeDocumentUpload: picker + Storage + DB Insert
7. TI: Edge Function statt Mock
8. `module-completion-report.md`: D-FULL vs P-PROD trennen
9. PilotReadiness gegen Live-Supabase prüfen

---

**Fazit:** App ist **demo-/schulungsfähig**, **nicht produktiv pilot-ready**. Quality Gates (TS/Test/Smoke) grün — das misst Code-Qualität, nicht Live-Anbindung.
