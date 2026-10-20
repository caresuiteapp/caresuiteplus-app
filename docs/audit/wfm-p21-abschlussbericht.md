# WFM P2.1 — Abschlussbericht & Release-Notiz

**Datum:** 2026-07-08  
**Phase:** WFM Phase 2.1 — Persistente Office-Prüfqueue (Review-Persistenz)  
**Production URL:** https://caresuiteplus.app  
**Production Supabase:** `euagyyztvmemuaiumvxm`  
**Staging Supabase:** `shwpweerzsfkqaivmaoc` (Validation only — keine Production-Daten)

**Abschluss:** WFM P2.1 Production **final abgeschlossen** — **FINAL GO**

---

## Release-Notiz (kurz)

### Was ist neu?

Office-Arbeitszeit (WFM P2.1) speichert Prüfstatus **persistent in der Datenbank** statt nur im Session-Overlay:

- Persistente Reviews über `workforce_time_entry_reviews`
- Review-Actions append-only über `workforce_time_review_actions`
- Office-Prüfqueue nutzt persistente DB-Reviews (Lazy Materialization, idempotent über `reference_key`)
- KPI **„Offene Prüfungen“** zählt `pending_review` + `needs_clarification` (getrennt von Korrekturanträgen)
- Review-Aktionen (Rückfrage, Genehmigen, Ablehnen, Korrigiert) schreiben Status + append-only Actions
- Auth-Bootstrap: `profiles.full_name`-Kompatibilität (Migration 0245 auf Staging; Spalte auf Production bereits vorhanden)
- UI: Kompakte horizontale Arbeitszeit-Tabs im Office-Shell

### Commits (Feature + Deploy)

| Commit | Message |
|--------|---------|
| `2dd48c7e` | test(staging): add wfm p21 synthetic seed and rls smoke |
| `d64ef87c` | feat(wfm): persist time review workflow |
| `a28a94d6` | fix(wfm): align review queue with persistent reviews |
| `767a141f` | test(wfm): cover persistent review queue smoke |
| `39c44ec9` | fix(staging): make wfm p21 profile bootstrap reproducible |
| `ef41a6db` | fix(wfm): compact office timekeeping tab layout |
| `ef399157` | chore(deploy): release wfm p21 persistent reviews **[deploy]** |

**Feature-HEAD:** `ef41a6db` · **Production-Deploy:** `ef399157` — `chore(deploy): release wfm p21 persistent reviews [deploy]`

### Bewusst nicht enthalten

- Exportlogik (Export-Persistenz, DATEV-Flow, P2.2/P2.3)
- Nachträge
- Fahrzeitregeln
- Team-Meeting-Zeitlogik
- P2.2 (Audit-Hardening, vollständiger Historie-Cutover)
- Bulk-Backfill historischer Reviews

Siehe `docs/architecture/wfm-phase2-schema-approval.md` §2.2 / Anhang E.

---

## Executive Summary

| Bereich | Status |
|---------|--------|
| Staging | **GO** — Migrationen 0240–0245, RLS 9/9, UI-Smoke, Tests grün |
| Production DB Apply 0240 | **GO** — abgeschlossen (`wfm_time_reviews_phase2_p21`, Registry `20260707220839`) |
| Production Deploy | **GO** — `ef399157` — `chore(deploy): release wfm p21 persistent reviews [deploy]` |
| Production Office-Smoke | **GO** — manuell auf Production bestätigt |
| **Gesamt P2.1** | **FINAL GO** |
| P2.2 | **NO-GO** — nicht gestartet |

---

## 1. Fachlicher Scope P2.1

### Geliefert

- Persistente Reviews pro Zeitblock (`workforce_time_entry_reviews`)
- Append-only Review-Actions (`workforce_time_review_actions`)
- Office-Prüfqueue persistent (DB-backed, Reload behält Status)
- KPI „Offene Prüfungen“ (`pending_review` + `needs_clarification`)
- Lazy Materialization bei Ampel-Rot/Prüfpflicht (`ensurePendingReviewForEntry`)
- `profiles.full_name` Bootstrap-Fix (Tenant-Select ohne RequireRole-Fehler)
- Kompakte Arbeitszeit-Tabs (`OfficeTimeTrackingShell`)
- RLS analog WFM 0223 (Office admin/team; MA nur eigene Reviews lesen)
- Office-Integration: `wfmTimeReviewService`, `wfmOfficeTimekeepingService`
- Prüfqueue-Route: `/business/office/time-tracking/pruefqueue`
- Staging-Seed + JWT-RLS-Smoke (`scripts/staging/seed-wfm-p21-staging.mjs`)
- Staging Final Gate (`scripts/staging/final-gate-wfm-p21-staging.mjs`)

### Nicht geliefert / explizit ausgeschlossen

Exportlogik, Nachträge, Fahrzeitregeln, Team-Meeting-Zeitlogik, P2.2-Audit-Hardening.

---

## 2. Staging-Evidenz

**Projekt:** `shwpweerzsfkqaivmaoc` · Synthetische Daten only · **Staging-Smoke: GO**

| Check | Ergebnis |
|-------|----------|
| Migrationen 0240–0245 | Applied (kanonisch) |
| JWT-RLS-Smoke | 9/9 grün |
| Persistenz-Smoke | clarify / approve / reject / corrected / idempotency / mini-history |
| UI-Smoke | Login, Tenant Bootstrap, Prüfqueue, KPI, kompakte Tabs |
| WFM Tests | 151/151 |
| timeTracking Tests | 32/32 |

**Staging-Nutzer (nur Staging, nicht Production):** `office.staging@example.test`, `employee.staging@example.test`, `employee2.staging@example.test`

---

## 3. Production — Migration 0240

**Apply-Methode:** Gezieltes SQL aus `supabase/migrations/0240_wfm_time_reviews_phase2_p21.sql` (kein blindes `db push` wegen Registry-Divergenz 0241–0244). **Status: abgeschlossen.**

| Feld | Wert |
|------|------|
| Registry | `20260707220839` — `wfm_time_reviews_phase2_p21` |
| Tabellen | `workforce_time_entry_reviews`, `workforce_time_review_actions` |
| RLS | aktiv, 5 Policies |
| Keine Staging-Seeds auf Production | **0** (`@example.test` = 0) |
| 0241–0244 | Bereits vorhanden (Timestamp-Migrationen) — **nicht** erneut angewendet |
| 0245 | Spalte `profiles.full_name` bereits vorhanden; Registry-Eintrag optional offen |

### Post-Apply SQL (read-only bestätigt)

- Tabellen existieren
- Policies: `wfm_entry_reviews_select/insert/update`, `wfm_review_actions_select/insert`
- Kein UPDATE/DELETE-Policy auf Actions für `authenticated`
- Keine Seed-Daten aus Staging auf Production

---

## 4. Production — Deploy

| Feld | Wert |
|------|------|
| Deploy-Commit | `ef399157` |
| Message | `chore(deploy): release wfm p21 persistent reviews [deploy]` |
| Build-Env (`netlify.toml`) | `EXPO_PUBLIC_SUPABASE_URL` → Production; `EXPO_PUBLIC_DEMO_MODE=false`; kein Staging-Ref |
| Bundle-Verifikation | Production Supabase-URL, `pruefqueue`, KPI-Strings, `tabScroll` (Tab-Fix) im Entry-Bundle |

---

## 5. Production — Office-Smoke

**Status: GO** — manueller Production-Office-Smoke abgeschlossen.

| Check | Ergebnis |
|-------|----------|
| App lädt | Grün — kein White Screen |
| Office-Login | Grün |
| Tenant Bootstrap | Grün — kein RequireRole-Banner, kein „Berechtigungen nicht verfügbar“ |
| Datenbankfehler | Keiner |
| Office / Arbeitszeit / Prüfqueue | Grün |
| KPI „Offene Prüfungen“ | Sichtbar |
| `pendingCorrectionCount` | Getrennt / kein Fehler |
| Arbeitszeit-Tabs | Kompakt |
| Queue-Zustand | Leer oder korrekt — kein Crash, keine RLS-Fehler |
| Console-/Network-Fehler | Keine relevanten RLS-/PostgREST-Fehler |
| Review-Mutation | Nur wo fachlich/freigegeben geprüft; keine Staging-Seeds auf Production |

---

## 6. Tests & Artefakte

| Artefakt | Pfad |
|----------|------|
| Migration 0240 | `supabase/migrations/0240_wfm_time_reviews_phase2_p21.sql` |
| Review Service | `src/lib/wfm/wfmTimeReviewService.ts` |
| Office Integration | `src/lib/wfm/wfmOfficeTimekeepingService.ts` |
| UI Shell | `src/components/wfm/OfficeTimeTrackingShell.tsx` |
| Staging Seed | `scripts/staging/seed-wfm-p21-staging.mjs` |
| Staging Final Gate | `scripts/staging/final-gate-wfm-p21-staging.mjs` |
| Schema-Approval | `docs/architecture/wfm-phase2-schema-approval.md` |

---

## 7. Bekannte Restpunkte (nicht P2.1-Blocker, P2.2+)

| Punkt | Hinweis |
|-------|---------|
| `setEntryOverlay()` Dual-Write | Noch parallel zu DB in `wfmOfficeTimekeepingService` — P2.2-Cutover-Thema |
| `EXPO_PUBLIC_WFM_PERSISTENT_REVIEW` | In Docs erwähnt, nicht implementiert — Fallback über Service-Mode |
| Migration-Registry-Divergenz | Production nutzt Timestamp-IDs für 0241–0244; Repo-Nummern nicht 1:1 |
| 0245 Registry Production | Spalte existiert; Migration optional registrieren |

---

## 8. Gate & Abschluss

```
WFM P2.1 GATE (2026-07-08) — FINAL:
├── Staging ........................ GO
├── Production ..................... GO
├── Production DB Apply 0240 ....... GO (abgeschlossen)
├── Production Deploy .............. GO (ef399157)
├── Production Office-Smoke ........ GO
├── P2.2 ........................... NO-GO (nicht gestartet)
└── Gesamt P2.1 .................... FINAL GO
```

**WFM P2.1 Production final abgeschlossen.**

**Nächster fachlicher Schritt:** P2.2 separat planen (Export-Persistenz, Audit-Hardening) — **nicht** parallel starten.

---

## 9. Sicherheits- & Betriebs-Hinweise

- Staging-Seeds und `@example.test`-Nutzer **dürfen nicht** nach Production kopiert werden.
- Staging-Skripte nur mit Production-Ref-Guard ausführen.
- Kein `deploy-live-pilot` / blindes `db push` gegen Production ohne Diff-Review.
- Deploy nur mit explizitem `[deploy]` in Commit-Message (`netlify.toml` ignore-Script).

---

*Abschlussdokumentation WFM P2.1 — FINAL GO. Keine Secrets.*
