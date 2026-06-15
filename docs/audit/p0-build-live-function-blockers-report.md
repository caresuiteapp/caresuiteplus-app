# CareSuite+ — P0 Build- und Live-Funktionsblocker Report

**Stand:** 2026-06-13  
**Scope:** P0 Sprint — Assets, EAS, DEMO-Guards, Uploads, Quality Gates  
**Kein Anspruch auf:** production-ready, store-ready, vollständig live-ready

---

## A. Executive Summary

CareSuite+ ist **build- und live-pilot-vorbereitet**, aber weiterhin **nicht production-ready / store-ready**, solange echte EAS Preview-Builds (Expo Login fehlt), vollständige Live-Fachmodule (Detail/Extension-Services) und Remote-Upload-E2E fehlen.

In diesem Sprint wurden **buildfähige temporäre Assets** erzeugt, **19 Modul-Services** auf `fetchDomainModuleSnapshot` + Supabase-Repos umgestellt, **Live-Service-Guards** eingeführt, **Office-Upload** mit `expo-document-picker` und tenant-isoliertem Storage-Pfad verdrahtet, und alle lokalen Quality Gates **grün** gehalten.

---

## B. Quality Gates

| Gate | Ergebnis | Details |
|------|----------|---------|
| typecheck | **PASS** | `tsc --noEmit` ohne Fehler |
| test | **PASS** | **308** Tests (inkl. 8 neue P0-Tests) |
| smoke | **PASS** | `scripts/smoke-check.mjs` |
| platform:audit | **PASS** | Shells, eas.json, app.config |
| store:audit | **PASS** | 4 erwartete Warnungen (EAS Platzhalter, Legal Screens, Submit-Creds) |

---

## C. Assets

| Datei | Status | Größe (bytes) | final? |
|-------|--------|---------------|--------|
| icon.png | ✓ | 52 695 | Nein — temporär C+ |
| splash-icon.png | ✓ | 184 786 | Nein |
| favicon.png | ✓ | 15 459 | Nein |
| android-icon-foreground.png | ✓ | 52 695 | Nein |
| android-icon-background.png | ✓ | 6 538 | Nein |
| android-icon-monochrome.png | ✓ | 14 939 | Nein |

**Script:** `node scripts/create-store-assets.mjs`  
**Dokumentation:** `docs/store/assets-readiness.md`

---

## D. EAS Projektstatus

| Check | Ergebnis |
|-------|----------|
| `npx eas-cli whoami` | **Not logged in** |
| `npx eas-cli project:info` | **Blockiert** — Login erforderlich |
| `npx eas-cli project:init` | **Nicht ausgeführt** |
| `extra.eas.projectId` | Platzhalter `00000000-0000-0000-0000-000000000000` |
| Android Preview Build | **Nicht gestartet** — EAS Login fehlt |
| iOS Preview Build | **Nicht gestartet** — EAS Login + Apple Credentials fehlen |

**Nutzer-Aktion:** `npx eas-cli login` oder `EXPO_TOKEN` setzen, dann `npx eas-cli project:init --non-interactive`.

---

## E. Store Audit

| | |
|--|--|
| Ergebnis | **PASS** (mit Warnungen) |
| Warnungen | EAS projectId Platzhalter; Apple/Google Submit-Platzhalter; DataRequest/Deletion Screens fehlen |
| P0-Blocker behoben | Assets vorhanden und >500 B |

---

## F. DEMO_TENANT_ID Audit

| Metrik | Wert |
|--------|------|
| Vorher (src, harte Guards) | ~55+ Treffer |
| Nachher (harte `tenantId !== DEMO_TENANT_ID` in Services/Screens) | **~21** (P1/P2 Rest) |
| P0 bereinigt | Alle 19 `*ModuleService.ts`, Pflege/Beratung List+Detail (teilweise Live), 15 Dashboard/List/Detail-Services auf `guardServiceTenant`, Module-Extensions Pflege/Beratung |
| Erlaubt verbleibend | `tenantResolver`, Demo-Repos, Tests, `demoCreateService`, QM Demo, Trip/CareRecord Detail (P1) |

**Neue Hilfsmodule:** `liveServiceGuard.ts`, `fetchDomainModuleSnapshot.ts`, `adaptSnapshotListRepo`

---

## G. Fachmodule Live-Status

| Modul | Demo | Live | Problem |
|-------|------|------|---------|
| Pflege | ✓ | PARTIAL | List/Detail/Dashboard + Modul-Snapshot live; SIS/Settings Demo-only |
| Stationär | ✓ | PARTIAL | Modul-Snapshot live; Resident List/Detail Demo-only |
| Beratung | ✓ | PARTIAL | Case-List + Snapshot live; Protocols/Settings Demo-only |
| Akademie | ✓ | PARTIAL | Snapshot live; Kurs-List/Detail Demo-only |
| Portale | ✓ | PARTIAL | Snapshot live; Portal-Services teils Demo |
| Office | ✓ | PARTIAL | Clients/Employees/Billing Snapshots live; Appointment-List Demo |
| Assist | ✓ | PARTIAL | Planning/Execution/Trips Snapshots live; Assignment-Detail Demo |
| QM | ✓ | Demo | `qmRepository.demo` Guard — P1 |
| Reporting | ✓ | PARTIAL | Supabase Repo vorhanden |
| Vorlagen | ✓ | ✓ | Template-System unverändert live-fähig |

---

## H. Uploads

| Bereich | Status |
|---------|--------|
| expo-document-picker | ✓ installiert (`~13.0.3`) |
| Office Upload Screen | ✓ Datei-Picker, Live blockiert ohne Datei |
| officeDocumentsService | ✓ lehnt `sizeBytes<=0` / fehlendes Base64 im Live-Modus ab |
| Storage-Pfad | ✓ `tenant/{id}/office/documents/{docId}/{filename}` |
| Communication Attachments | PARTIAL — Service-Mode Switch vorhanden; vollständiger E2E P1 |
| QM/MD Export | preparedOnly — kein Fake-Erfolg |

---

## I. Remote-E2E Status

Siehe `docs/audit/remote-supabase-e2e-checklist.md`

| Workflow | Status | Blocker |
|----------|--------|---------|
| Auth/Portal | PASS (remote) | — |
| Dokument Upload | PARTIAL | Manueller Remote-Test ausstehend |
| Fachmodule CRUD | PARTIAL | Detail-Services noch Demo-only |
| EAS Preview App | NOT RUN | Expo Login |

---

## J. Tablet/Desktop Layout

| Bereich | Status |
|---------|--------|
| MobileShell / TabletShell / DesktopShell | ✓ vorhanden |
| MasterDetail (Clients, Messages) | ✓ 3 Referenz-Screens |
| P0 Layout kaputt | Keine bekannt |
| P1 Optimierung | Office Dashboard, QM-Handbuch, MD-Center, TI, Reporting — Master-Detail erweitern |

---

## K. Offene P0/P1/P2

### P0 (verbleibend)

- EAS Login + echte Preview-Builds (Android/iOS)
- Remote-E2E Upload + Kern-Workflows manuell/automatisiert
- Restliche ~21 DEMO_TENANT_ID-Guards in Detail/Hub-Services (P1 wenn nicht live-kritisch)

### P1

- Akademie/Stationär/Assignment Live List+Detail
- Communication Attachment Remote-E2E
- Tablet/Desktop Master-Detail auf weiteren Screens
- QM Live-Repository

### P2

- Voice / Push / TI Realadapter (preparedOnly)
- Desktop/Tauri
- Finale Store-Assets + Screenshots

---

## L. Final Verdict

**P0 Build-/Live-Funktionsblocker teilweise geschlossen.**

- Buildfähige temporäre Assets erstellt  
- Lokale Gates grün (308 Tests)  
- Modul-Snapshots und Pflege/Beratung-Listen live-fähig  
- Office-Upload-Grundlage echt (kein Fake-Erfolg im Live-Modus)  
- **EAS weiterhin durch Expo Login blockiert** — kein Android/iOS Preview Build queued  

**Nicht erlaubt:** Production-ready, Store-ready, vollständig live-ready.
