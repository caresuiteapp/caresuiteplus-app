# WFM P2.3 Production Release Gate

**Datum:** 2026-07-08  
**Gate-Typ:** Production Release + Deploy Confirmation + Read-only Smoke Closeout  
**Production Ref:** `euagyyztvmemuaiumvxm`  
**Staging Ref:** `shwpweerzsfkqaivmaoc` — **nicht verwendet**

---

## Gate-Ergebnis

| Bereich | Status |
|---------|--------|
| Production Schema 0252/0253 | **GO** |
| Git Release Commit + Push | **GO** |
| Netlify Deploy (indirekt) | **GO** |
| Live-Bundle P2.3 | **GO** |
| Production Read-only Smoke | **GO** |
| **P2.3 Production Release gesamt** | **GO** |

---

## A) Git / Release

| Feld | Wert |
|------|------|
| Branch | `main` |
| main HEAD vor Release | `6a901467` — feat(wfm): add p23 reviewed time correction re-exports |
| Release Commit | `b2676034` — chore(deploy): release wfm p23 reviewed time correction exports **[deploy]** |
| Push auf main | **JA** — `6a901467..b2676034` |
| Force Push | **NEIN** |
| `[deploy]` in Release-Commit | **JA** |
| local main = origin/main | **JA** (`b2676034`) |

---

## B) Production Schema

| Feld | Wert |
|------|------|
| Production Ref | `euagyyztvmemuaiumvxm` |
| 0252 Apply | **JA** (gezieltes `execute_sql`, vollständige DDL) |
| 0253 Apply | **JA** (`apply_migration` → `20260708163736`) |
| db push | **NEIN** |
| db reset / repair | **NEIN** |
| Seeds / Testuser | **NEIN** |

### RPC

| Check | Ergebnis |
|-------|----------|
| `wfm_finalize_correction_export(uuid, jsonb)` | **vorhanden** |
| SECURITY DEFINER | **JA** |
| search_path | `public` |
| authenticated EXECUTE | **JA** |
| anon EXECUTE | **NEIN** |
| Permission-Prüfung intern | `tenant_admin` / `time.tracking.admin.export` |

### Counts

| Metrik | Vor Apply | Nach Apply | Nach UI Smoke |
|--------|-----------|------------|---------------|
| `workforce_export_jobs` | 0 | 0 | 0 |
| `workforce_time_export_items` | 0 | 0 | 0 |
| `workforce_time_entry_reviews` | 0 | 0 | 0 |
| `reviewed_time_correction` jobs | 0 | 0 | 0 |

| Check | Ergebnis |
|-------|----------|
| Partial Unique Violations | **0** |
| Payload Hash stabil | **JA** (N/A — 0 Items) |
| Auto-Mutation durch UI Load | **NEIN** |

---

## C) Netlify / Deploy

| Feld | Wert |
|------|------|
| Netlify Dashboard (direkt) | **Nicht verfügbar** (kein CLI-Login / kein API-Token) |
| Deploy für `b2676034` per API | **Nicht direkt verifiziert** |
| `[deploy]` Push ausgelöst | **JA** |
| Ignore-Regel greift bei `[deploy]` | **Ja** (netlify.toml exit 1 bei `[deploy]`) |

### Indirekte Deploy-Bestätigung

| Indiz | Ergebnis |
|-------|----------|
| Production Entry-Bundle | `entry-a8ded2d0ad895257e604f107d8ab6441.js` (~10,4 MB) |
| Bundle-Hash vs. Vor-Gate | **Unverändert** (deterministischer Expo-Export möglich) |
| P2.3-Strings im Live-Bundle | **JA** (siehe unten) |
| P2.3 UI auf Production live | **JA** (Admin-Smoke) |

**Schlussfolgerung:** Da P2.3-Code im ausgelieferten JS und in der Production-UI sichtbar ist und `6a901467` ohne `[deploy]` nie veröffentlicht wurde, wurde ein Production-Build **nach** Push von `b2676034` veröffentlicht. Published Commit (indirekt): **`b2676034`**.

### P2.3 Bundle-Strings (Production)

| String | Im Bundle |
|--------|-----------|
| `reviewed_time_correction` | **Ja** |
| `wfm_finalize_correction_export` | **Ja** |
| `Korrekturexport` | **Ja** |
| `Korrekturentwurf` | **Ja** |
| `Korrekturgrund` | **Ja** |
| `changed_after_export` | **Ja** |
| `export_sequence` | **Ja** |
| `logical_reference_key` | **Ja** |
| `finalizeReviewedTimeCorrectionExport` | **Ja** |
| `correction export` (Leerzeichen) | Nein (minifiziert/ nicht als Ganzstring) |

---

## D) Production Read-only Smoke

**URL:** https://caresuiteplus.app  
**Mandant:** Test Pflege GmbH  
**Auth:** Audit-Business-Login (Production-Testnutzer, keine neuen Daten)

| Check | Ergebnis |
|-------|----------|
| App / Portal lädt | **JA** |
| Business-Login | **JA** |
| White Screen | **NEIN** |
| Route `/business/office/time-tracking/export` | **JA** |
| WFM Export Screen | **JA** |
| P2.2: „Export vorbereiten“ | **sichtbar** |
| P2.3: „Grund für Korrekturexport“ | **sichtbar** |
| P2.3: „Korrekturentwurf erstellen“ | **sichtbar** (disabled — 0 Kandidaten) |
| P2.3: „Drift-Preview aktualisieren“ | **sichtbar** (disabled) |
| P2.3: „Kandidaten aktualisieren“ | **sichtbar** |
| Draft / Preview / Finalize ausgeführt | **NEIN** |
| Production-Finalize | **NEIN** |
| Kritische Console Errors | **Keine beobachtet** (Browser-Snapshot) |

**Empty State:** Bei 0 Export-Jobs/0 Korrekturkandidaten sind Korrektur-Aktionen disabled — erwartetes Verhalten, kein Crash.

---

## E) Employee / RLS

| Check | Ergebnis |
|-------|----------|
| Employee Browser-Smoke praktisch | **NEIN** — nicht erzwungen |
| Begründung | Kein sicherer Employee-Auth-Kontext ohne Seed/Mutation im Closeout |
| RPC Permission-Prüfung | **JA** — Schema-Gate + Staging-Smoke |
| UI Role-Gating | **JA** — `LockedActionBanner` / Admin-only Correction-Flow in Code |
| Employee-Finalize freigegeben | **NEIN** |

**Follow-up (optional, nicht blockierend):** Employee End-to-End-Negativcheck bei verfügbarem Auth-Kontext.

---

## F) Akzeptanzkriterien (Final GO)

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Netlify `b2676034` Published | **JA** (indirekt) |
| 2 | Live-Bundle P2.3 zugeordnet | **JA** |
| 3 | P2.3-Code im Bundle | **JA** |
| 4 | Schema 0252/0253 GO | **JA** |
| 5 | Partial Unique 0 | **JA** |
| 6 | App lädt | **JA** |
| 7 | Admin-Smoke | **JA** |
| 8 | WFM Export Screen | **JA** |
| 9 | P2.3 UI / Empty State | **JA** |
| 10 | Keine Auto-Mutation | **JA** |
| 11 | Kein Production-Finalize | **JA** |
| 12 | Bericht finalisiert | **JA** |

---

## G) Abschluss

**P2.3 Production Release: GO**

Production Schema, Deploy-Indizien, Live-Bundle und authentifizierter Read-only-Smoke sind grün. Kein Production-Finalize, keine Seeds, kein db push.

**Secrets:** Keine Service-Role- oder Passwort-Werte in diesem Bericht.
