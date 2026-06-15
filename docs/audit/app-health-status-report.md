# CareSuite+ — App-Health-Status-Report

**Datum:** 2026-06-13  
**Scope:** Vollständiger App-Audit (Quality Gates, Module, Layout, Workflows, Remote/Supabase, Store/Build, Tests)  
**Einschätzung Produktionsreife gesamt:** ~25–30 % (UI ~90 %, Demo-Workflows ~65 %, Live-Verdrahtung ~35 %)

> **Nicht production-ready, nicht live-pilot-ready, nicht store-ready.**  
> Dieser Bericht ist ehrlich strukturiert — ohne Hype.

---

## Executive Summary

CareSuite+ ist ein **breiter Demo-/Schulungsprototyp** mit ~240 App-Routen, Permissions, responsive Shells und **grünen lokalen Quality Gates**. Es ist **nicht production-ready, nicht live-pilot-ready und nicht store-ready**.

Die größten Lücken bleiben: **EAS ohne Expo-Login**, viele Fachmodule hart auf `DEMO_TENANT_ID` begrenzt, Uploads ohne echten File-Picker, TI nur Mock, Remote-Live-Workflows größtenteils unverifiziert, und **58 Supabase-Security-WARNs** offen.

**Assets (Stand 13.06.2026, Verifikation Parent-Agent):** Der Ordner `assets/` **existiert** und enthält alle sechs vom Store-Audit referenzierten Dateien mit echter Dateigröße (keine 1×1-Platzhalter). Zum Zeitpunkt des Read-only-Subagent-Audits war der Ordner noch leer — seitdem wurden die Grafiken angelegt.

---

## Quality Gates

| Gate | Status | Details |
|------|--------|---------|
| `npm run typecheck` | **PASS** | Laut Audit 13.06.; letzte Verifikation in `eas-first-preview-build-report.md` |
| `npm run test` | **PASS** | **~300/300** (EAS-Report) bzw. **284/284** (Security-Report) |
| `npm run smoke` | **PASS** | Prüft Kern-Routen + typecheck |
| `npm run platform:audit` | **PASS** | Plattform-Schicht, `app.config.ts`, `eas.json` |
| `npm run store:audit` | **PASS (mit 4 Warnungen)** | Exit 0 am 13.06.2026; Assets vorhanden; EAS-Platzhalter, Apple-Credentials, Google-Key, DSGVO-Screens offen |

### `store:audit` — Warnungen (13.06.2026)

1. `EAS_PROJECT_ID` ist Platzhalter — vor Build: `npx eas project:init` und ID in `app.json` / `.env` setzen
2. `eas.json submit.production.ios`: Apple-Credentials noch Platzhalter
3. Google Play Service-Account-Key fehlt (erwartet vor Submit)
4. `DataRequestScreen` / `AccountDeletionRequestScreen` fehlen — DSGVO-Links nur über `supportLinks` (DesktopShell)

**Fazit:** Build-Vorbereitung OK, **Store-Submission noch nicht ready**.

---

## Assets (Ist-Zustand 13.06.2026)

| Datei | Vorhanden | Größe (Bytes) |
|-------|-----------|---------------|
| `assets/icon.png` | ✅ | 52.695 |
| `assets/favicon.png` | ✅ | 15.459 |
| `assets/splash-icon.png` | ✅ | 184.786 |
| `assets/android-icon-foreground.png` | ✅ | 52.695 |
| `assets/android-icon-background.png` | ✅ | 6.538 |
| `assets/android-icon-monochrome.png` | ✅ | 14.939 |

Alle sechs Dateien sind referenziert in `scripts/store-readiness-check.mjs` und bestehen die Größenprüfung (> 500 Bytes).

---

## Kritische Blocker (P0 / P1 / P2)

### P0

- **EAS:** `eas whoami` → nicht eingeloggt; `projectId` = Platzhalter-UUID
- **~55 Services** lehnen Live-Mandanten ab (`tenantId !== DEMO_TENANT_ID`) — Pflege, Stationär, Beratung, Akademie, Portale, viele Office/Assist-Hilfsdienste
- **Uploads:** `OfficeDocumentUploadScreen` ohne File-Picker; `sizeBytes: 0`, kein `expo-document-picker`
- **Generische Supabase-Repos** (z. B. `executionRepository` → `assignments` mit nur `title/status`) — Live-Pfad vorhanden, Datenmodell-Tiefe unzureichend

> **Hinweis:** Fehlende App-Assets waren P0 zum Zeitpunkt des Subagent-Audits; durch Anlage der sechs PNGs ist dieser Punkt **behoben** (Stand Verifikation 13.06.).

### P1

- **58 Security-WARNs** remote (0 ERROR nach Migration 0019): 57× SECURITY DEFINER RPCs, 1× Leaked-Password-Schutz deaktiviert
- Communication/TI haben Repos + `getServiceMode()`-Pfade, aber **Default = Demo**; Realtime/Push/Anhänge unvollständig
- Sprachnachrichten: `isPreparedOnly: true`, kein `expo-av`
- Remote-E2E-Checkliste (`remote-supabase-e2e-checklist.md`) größtenteils **offen**
- `supabase link` lokal nicht konfiguriert — CLI-Deploy unsicher

### P2

- Hardcoded Farben in einzelnen Screens statt `colors.*` aus Theme
- Master-Detail nur auf 3 Screens (Klient:innen, Business-Messages, Office-Messages)
- `AssistCalendarPlaceholderScreen` („Demnächst“) existiert als Legacy; Route nutzt Kalender mit Demo-Daten
- QM-Exports: `preparedOnly: true`

---

## Module: Demo vs. Live

| Modul | UI | Live-Verdrahtung |
|-------|-----|------------------|
| **Auth** | ✅ | 🟡 Edge Functions (0016–0018), Business/Portal-Login vorbereitet; Demo-Login ohne Supabase funktioniert |
| **Office** | ✅ | 🟡 Klienten, Rechnungen, Dokumente, Termine, Mitarbeitende teils `getServiceMode()`; viele Module-Services noch Demo-Guard |
| **Assist** | ✅ | 🟡 Execution mit Supabase-Pfad; Planung, Nachweise, Fahrten, Kalender → Demo |
| **Pflege / Stationär / Beratung / Akademie** | ✅ (Paket A) | 🔴 Demo-only (`tenantId !== DEMO_TENANT_ID`) |
| **Nachrichten** | ✅ | 🟡 Communication-Service + 10 Repos; Demo-Store default, Storage/Realtime/Push offen |
| **Dokumente** | ✅ | 🟡 Live-Storage-Pfad vorbereitet, kein echter Upload |
| **QM** | ✅ | 🟡 Demo-Repository; MD-Pakete UI-stark |
| **Vorlagen** | 🟡 | 🔴 Größtenteils Demo / `preparedOnly` |
| **Rechnungen** | ✅ | 🟡 `invoiceListService` hat Supabase-Pfad |
| **Reporting** | ✅ | 🔴 Demo |
| **Portale** | ✅ | 🟡 Auth-Edge deployed; Domain-Services Demo-Guard |
| **TI** | ✅ KIM-UI | 🟡 Repos + Live-Pfad; **MockKIMProvider**; eGK/ePA/eMP/E-Rezept nur Info-Text |
| **Einstellungen** | ✅ | 🟡 Pro Modul vorhanden |

---

## Layout / Responsive

- **Implementiert:** `MobileShell` / `TabletShell` / `DesktopShell`, Breakpoints, `ResponsiveLayout`
- **Master-Detail:** nur Klient:innen, Business-Messages, Office-Messages
- **Lücken:** Mitarbeitende, Rechnungen, KIM, Portal-Messages, Reporting ohne Split; Auth/Desktop ohne `max-width`-Formulare

Referenz: `docs/audit/multiplatform-store-desktop-readiness-report.md`

---

## Remote / Supabase

- Migrationen **0001–0020** lokal; remote per MCP: **0016–0020 angewendet** (Auth/Portal, Security, Storage-Isolation)
- Nach **0018:** Auth/Portal-E2E laut Report **PASS** (401 statt `permission denied`)
- Nach **0019:** **0 ERROR**, **58 WARN**
- Nach **0020:** Storage tenant-isoliert (`tenant/{id}/…`)
- `.env` mit `EXPO_PUBLIC_DEMO_MODE=false` dokumentiert
- `livePilotRemote.test.ts`: Remote-Tests nur bei `.env`; Pilot-Mandant-Seed **weich** verifiziert
- **Fehlend:** Cross-Tenant-Pen-Test, vollständiger Live-Workflow (Klient → Einsatz → Nachricht → Rechnung → Upload)

Referenzen: `live-supabase-auth-portal-remote-verification-report.md`, `security-warn-storage-remediation-report.md`, `remote-supabase-e2e-checklist.md`

---

## Store / Build

| Punkt | Status |
|-------|--------|
| Bundle-ID `de.caresuiteplus.app` | ✅ |
| EAS-Profile dev / preview / production | ✅ |
| Store-Assets (`assets/*.png`) | ✅ (13.06.2026) |
| `store:audit` | ✅ PASS, 4 Warnungen |
| Expo-Login / `project:init` | 🔴 Blocker |
| Erfolgreicher `eas build` | 🔴 Noch nicht |

Referenz: `docs/audit/eas-first-preview-build-report.md`

---

## Tests — Lücken

- **59 Testdateien**, ~300 Tests — alle **lokal/Demo-basiert**
- Keine durchgängigen E2E mit `DEMO_MODE=false` in CI
- Communication/TI-Supabase-Repos kaum mit Live-DB getestet
- Remote-E2E optional/skipped ohne `.env`

---

## Codebase-Gesundheit (Grep)

| Muster | Befund |
|--------|--------|
| TODO/FIXME in `src/` | **0** |
| `onPress={() => {}}` | **0** (ModuleOverview behoben) |
| `DEMO_TENANT_ID` | **~160 Dateien** (v. a. Demo-Daten + Demo-Guards) |
| `tenantId !== DEMO_TENANT_ID` | **~55 Services** — Live blockiert |
| `preparedOnly` | Voice, QM-Exports, Modul-Tiles |
| Supabase-Repos | **48 Dateien** (Communication, TI, Office, …) — Verdrahtung ungleichmäßig |

---

## Workflow-Gaps

| Workflow | Status |
|----------|--------|
| Auth (Demo) | ✅ Funktioniert ohne Supabase |
| Auth (Live Business/Portal) | 🟡 Edge deployed, E2E positiv nach 0018 |
| Klient CRUD | 🟡 Supabase-Pfad vorhanden, Pilot unvollständig |
| Rechnungen | 🟡 `invoiceListService` mit Supabase-Pfad |
| Einsätze / Execution | 🟡 Supabase-Repo generisch, Modell flach |
| Dokument-Upload | 🔴 Kein File-Picker, `sizeBytes: 0` |
| Nachrichten / Anhänge | 🟡 Repos da, Storage/Realtime/Push offen |
| Sprachnachrichten | 🔴 `isPreparedOnly`, kein Audio |
| TI KIM | 🟡 Mock-Provider |
| Pflege → Rechnung (End-to-End Live) | 🔴 Nicht verifiziert |

---

## Empfohlene nächste Schritte (priorisiert)

1. **`npx eas-cli login`** + `project:init` + Preview-Build Android/iOS
2. **Demo-Guards entfernen** in Pflege/Stationär/Beratung/Akademie/Portale — `getServiceMode()` + Repos nutzen
3. **`expo-document-picker`** + echter Upload-Flow (Office + Communication)
4. **Remote-E2E-Checkliste** Punkt für Punkt mit Pilot-Mandant
5. **Master-Detail** auf Rechnungen, Mitarbeitende, KIM ausweiten
6. **Push/Sprachnachrichten** entscheiden: implementieren oder UI deaktivieren
7. **TI:** Real-Adapter oder klar als „Vorbereitet“ kennzeichnen
8. **Security-WARNs W2** schrittweise (RPC INVOKER-Migration)
9. **Leaked-Password-Schutz** im Supabase-Dashboard aktivieren
10. **DSGVO-Screens** (`DataRequestScreen`, `AccountDeletionRequestScreen`) anlegen

---

## Kurz-Zusammenfassung (10 Punkte)

- CareSuite+ ist ein **reifer Demo-Prototyp** mit breiter UI (~240 Routen), **nicht** production- oder store-ready.
- **Quality Gates lokal grün** (typecheck, ~300 Tests, smoke, platform:audit); **`store:audit` PASS mit 4 Warnungen** (13.06.2026).
- **Expo/EAS blockiert:** kein Login, Platzhalter-`projectId`, kein erfolgreicher Preview-Build.
- **Live-Fortschritt:** Migrationen 0016–0020 remote; Auth/Portal nach Fix **E2E-positiv**; **58 Security-WARNs** bleiben.
- **Kern-Live-Pfade** existieren für Klienten, Rechnungen, Communication, TI, Execution — aber **Default-Modus ist Demo**.
- **Pflege, Stationär, Beratung, Akademie, Portale** sind für echte Mandanten **hart gesperrt** (`DEMO_TENANT_ID`-Check).
- **Uploads, Sprachnachrichten, Push** sind vorbereitet, aber **ohne echte Datei-/Audio-/Notification-Integration**.
- **TI KIM** läuft mit Mock; eGK/ePA/eMP/E-Rezept sind **reine Vorbereitungs-Screens**.
- **Responsive-Architektur** steht; Master-Detail nur auf **3 Kernscreens** — Tablet/Desktop-Nutzung eingeschränkt.
- **Geschätzte Produktionsreife ~25–30 %** — Demo-Schulung ja, NRW-Pilot/Store **nein**, bis EAS, Live-Guards und E2E geschlossen sind.

---

*Erstellt aus Subagent-Audit b543471e (Read-only) + Verifikation Assets/`store:audit` am 13.06.2026.*
