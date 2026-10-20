# Staging Supabase — Setup & Apply

Anleitung für ein **dediziertes Supabase-Staging-Projekt** nach abgeschlossener Fresh-DB-Baseline (lokal bis Migration **0242**, Ziel **0240** WFM Reviews erreicht).

**Status:** vorbereitet — Staging-Projekt noch **nicht** angelegt, **kein** Remote-Apply erfolgt.

---

## 1. Ausgangslage (lokal verifiziert)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Baseline-Commits | `35130cec` … `9b5aa4ea` (5 thematische `fix(db)`-Commits) |
| Lokaler Fresh-DB-Reset | grün bis `0242_employee_portal_deferred_signature_rpc.sql` |
| WFM-Tests | **141/141** grün (ein früherer Suite-Timeout war flaky, isoliert + Gesamtlauf grün) |
| timeTracking-Tests | **32/32** grün |
| Production | **unverändert** — `0240` dort noch nicht applied |

---

## 2. Staging-Projekt anlegen

### 2.1 Neues Supabase-Projekt

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. **Region:** `eu-central-1` (Frankfurt) — gleiche Region wie Production für latenzähnliche Tests
3. **Name:** z. B. `caresuiteplus-staging` (frei wählbar, eindeutig von Production)
4. **Database password:** sicher speichern (Password Manager / Secrets), **nicht** in Git
5. **Project ref** notieren: `<STAGING_PROJECT_REF>` (20 Zeichen, z. B. `abcdefghijklmnop`)

### 2.2 Was Staging **nicht** ist

- **Kein** Clone/Dump/Restore von Production
- **Keine** echten Mandanten-, Klienten- oder Mitarbeiterdaten
- **Kein** Ersatz für Production-Pilot (`euagyyztvmemuaiumvxm`)
- **Kein** automatisches Deploy über Netlify (`[deploy]`-Commits auslösen keinen Build ohne explizite Freigabe)

---

## 3. Umgebungstrennung (Production vs. Staging)

### 3.1 Production-Referenz (nur zur Abgrenzung)

| Umgebung | Project ref | Verwendung |
|----------|-------------|------------|
| **Production** | `euagyyztvmemuaiumvxm` | Live-Pilot, FlutterFlow-Legacy, WFM 0190–0195 / 0223–0225 applied |
| **Staging** | `<STAGING_PROJECT_REF>` | Schema-Validierung, synthetische Seeds, WFM P2.1 (0240) vor Production |
| **Lokal** | Docker (`caresuite-plus`, Port 54322) | Fresh-DB-Reset, Entwicklung |

### 3.2 Secrets lokal halten

Staging-Credentials **nur** in lokaler `.env.staging` oder `.env.local` (gitignored):

```env
# Staging — NICHT committen
EXPO_PUBLIC_SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_PROJECT_REF=<STAGING_PROJECT_REF>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role>   # nur Server/CLI, nie Expo
PILOT_TENANT_ID=11111111-1111-1111-1111-111111111101
```

**Nicht** die Production-`.env` überschreiben. Für Staging-Tests bewusst `.env.staging` laden oder Variablen in der Shell setzen.

### 3.3 Skripte mit Production-Default — **nicht** blind nutzen

Diese Skripte defaulten auf Production-Ref `euagyyztvmemuaiumvxm`, wenn `SUPABASE_PROJECT_REF` fehlt:

| Skript | Risiko |
|--------|--------|
| `scripts/fetch-remote-types.mjs` | link + Types von Production |
| `scripts/deploy-live-pilot.mjs` | **automatisches `db push`** auf Production |
| `scripts/apply-live-migrations.mjs` | Remote-Apply auf Production |
| `scripts/audit/apply-cs-vorlagen-remote-*.mjs` | Audit-only, Production hardcoded |

**Staging-korrekt:**

```powershell
$env:SUPABASE_PROJECT_REF = "<STAGING_PROJECT_REF>"
npm run fetch-remote-types
```

**Für Staging-Apply:** siehe Abschnitt 6 — **kein** `deploy:live-pilot` ohne explizite Production-Freigabe.

---

## 4. Migrationen bis 0242

### 4.1 Scope

Staging erhält den **vollständigen Migrationsstand** aus dem Repo, lokal verifiziert bis:

| Version | Datei | Inhalt |
|---------|-------|--------|
| 0240 | `0240_wfm_time_reviews_phase2_p21.sql` | WFM P2.1 — `workforce_time_entry_reviews`, `workforce_time_review_actions`, RLS |
| 0241 | `0241_client_documents_employee_deferred_signature_rls.sql` | Client-Dokumente Deferred-Signature RLS |
| 0242 | `0242_employee_portal_deferred_signature_rpc.sql` | Employee-Portal Deferred-Signature RPC |

Alle früheren Migrationen `0001` … `0239` sind Voraussetzung (Baseline-Stabilisierung in Commits `35130cec`–`9b5aa4ea`).

### 4.2 Ehemals gelbe Duplikatnummern (0215 / 0224 / 0230)

Historisch existierten **mehrere Dateien mit derselben Versionsnummer** (Production hatte idempotente Timestamp-Migrationen). Für Fresh-DB/Staging wurden Legacy-Duplikate bereinigt und in kanonische Dateien zusammengeführt:

| Nummer | Kanonische Datei (im Repo) | Entfernte/zusammengeführte Duplikate (Beispiele) |
|--------|----------------------------|--------------------------------------------------|
| **0215** | `0215_employee_personnel_documents_repair.sql` | ehem. `0215_p0_audit…` |
| **0224** | `0224_employee_group_chats.sql` | ehem. `0224_wfm_assist_portal_sync_rpc` (Inhalt merged) |
| **0230** | `0230_client_portal_settings_rls.sql` | ehem. `0230_employee_portal_team_calendar` (Inhalt merged) |

**Hinweis:** Auf **Production** kann die Migrationshistorie abweichen (ältere Timestamp-Dateien bereits applied). Staging startet **leer** — nur Repo-Migrationen zählen. Vor Apply `migration list --linked` mit lokalem Stand abgleichen.

**0167:** Nur `0167_assist_catalog_items_and_template_entries.sql` (kanonisch) ist in der Baseline committed. `0167a_*` / `0167b_*` sind **nicht** Teil der Baseline — nicht auf Staging anwenden, solange ausgeschlossen.

---

## 5. Synthetische Seeds (keine Produktivdaten)

### 5.1 Prinzipien

- Nur **fiktive** Mandanten-IDs (z. B. `11111111-1111-1111-1111-111111111101`)
- Keine echten Namen, Adressen oder Kontaktdaten aus Production
- INSERT-only, idempotent (`ON CONFLICT DO NOTHING`)

### 5.2 Empfohlene Reihenfolge

1. **Basis-Mandant** — SQL aus `docs/pilot/pilot-tenants-setup-production.sql`  
   *(Dateiname enthält „production“, Inhalt ist synthetisch — nur auf Staging-Ref ausführen, nicht auf Production ohne Review)*

2. **Modul-Backfill** — `npm run seed:live-pilot -- --write-sql`  
   Prüfen → SQL im Staging SQL Editor oder:
   ```powershell
   $env:SUPABASE_PROJECT_REF = "<STAGING_PROJECT_REF>"
   $env:PILOT_TENANT_ID = "11111111-1111-1111-1111-111111111101"
   node scripts/seed-live-pilot.mjs --apply
   ```

3. **Auth-User manuell** — Supabase Dashboard → Authentication → Users anlegen, dann `profiles` mit `tenant_id` + `auth_user_id` verknüpfen (wie in Pilot-Doku beschrieben)

4. **Kein** Import aus Production-Backups, **kein** `pg_dump`/`pg_restore` von `euagyyztvmemuaiumvxm`

---

## 6. Staging-Apply-Prozess

**Nur nach expliziter Freigabe ausführen.** Kein `[deploy]`, kein Netlify-Trigger, kein Production-Apply.

### 6.1 Checklist vor Apply

- [ ] Staging-Project-Ref notiert und in Shell/`SUPABASE_PROJECT_REF` gesetzt
- [ ] Production-Ref **nicht** verlinkt (`supabase projects list` prüfen)
- [ ] `supabase login` erfolgreich
- [ ] Keine uncommitted lokalen Migration-Drifts (Branch `main` ≥ `9b5aa4ea`)
- [ ] Backup-Bedarf: Staging ist leer/neu — kein Production-Risiko

### 6.2 Link & Status (kein Apply)

```powershell
cd "C:\Users\Kevin Reinhardt\Documents\CareSuite+"
$env:SUPABASE_PROJECT_REF = "<STAGING_PROJECT_REF>"
npx supabase link --project-ref $env:SUPABASE_PROJECT_REF
npx supabase migration list --linked
```

Erwartung: Remote leer oder partiell — Diff gegen lokalen Stand prüfen.

### 6.3 Migrationen anwenden (explizit)

**Option A — CLI (empfohlen für Staging-Erstaufbau):**

```powershell
# Bewusste Bestätigung — ersetzt <STAGING_PROJECT_REF>
npx supabase db push --linked
```

**Option B — Dashboard SQL Editor:**  
Dateien `0001` … `0242` nur wenn CLI nicht verfügbar — fehleranfällig, nicht empfohlen.

**Nicht verwenden auf Staging:**

- `npm run deploy:live-pilot` (Production-Default + automatisches push)
- `scripts/audit/apply-cs-vorlagen-remote-*.mjs`
- MCP `apply_migration` gegen Production

### 6.4 Nach Apply

```powershell
$env:SUPABASE_PROJECT_REF = "<STAGING_PROJECT_REF>"
npm run fetch-remote-types
npm run typecheck
npm test -- src/__tests__/wfm --run
npm test -- src/__tests__/timeTracking --run
```

---

## 7. Verifikation Migration 0240 (Review / RLS)

Nach erfolgreichem Apply im Staging SQL Editor oder via CLI:

```sql
-- Tabellen vorhanden
SELECT
  to_regclass('public.workforce_time_entry_reviews')   AS entry_reviews,
  to_regclass('public.workforce_time_review_actions') AS review_actions;

-- RLS aktiv
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('workforce_time_entry_reviews', 'workforce_time_review_actions');

-- Policies (erwartet: 4 auf reviews/actions)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('workforce_time_entry_reviews', 'workforce_time_review_actions')
ORDER BY tablename, policyname;
```

**Erwartete Policies (P2.1):**

| Tabelle | Policy | Operation |
|---------|--------|-----------|
| `workforce_time_entry_reviews` | `wfm_entry_reviews_select` | SELECT |
| `workforce_time_entry_reviews` | `wfm_entry_reviews_insert` | INSERT |
| `workforce_time_entry_reviews` | `wfm_entry_reviews_update` | UPDATE |
| `workforce_time_review_actions` | `wfm_review_actions_select` | SELECT |
| `workforce_time_review_actions` | `wfm_review_actions_insert` | INSERT |

Migrationseintrag prüfen:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '%0240%' OR name LIKE '%0240%';
```

---

## 8. Bekannte nicht-blockierende Hinweise

Diese Punkte blockieren **nicht** das Staging-Setup, sollten aber dokumentiert bleiben:

| Thema | Hinweis |
|-------|---------|
| Storage-Policies | Auf Fresh-DB lokal teils übersprungen (Owner `supabase_storage_admin`) — Security Advisor auf Staging erneut prüfen |
| Prepared-Tabellen ohne RLS | ~13 Tabellen (Migrationen 0131/0136 ff.) — bekanntes Baseline-Thema, nicht Teil P2.1 |
| Production vs. Staging Drift | Production hat Legacy-Enums/Timestamp-Migrationen; Staging folgt Repo-Kanon |
| WFM P2.2/P2.3 | Export-Felder in 0240 **bewusst ausgeschlossen** — siehe `docs/architecture/wfm-phase2-schema-approval.md` |

---

## 9. Nächste Schritte (Reihenfolge)

1. **Staging-Projekt anlegen** (Abschnitt 2) — Region `eu-central-1`
2. **Staging-Apply** (Abschnitt 6) — nur mit expliziter Freigabe
3. **Synthetische Seeds** (Abschnitt 5)
4. **0240-Verifikation** (Abschnitt 7)
5. **App gegen Staging testen** — `.env.staging`, Demo-Mode aus
6. **Erst danach:** Production-Apply von `0240` separat planen (eigene Freigabe, eigener Runbook-Eintrag)

---

## 10. Verwandte Dokumente

- [`live-supabase-anbindung.md`](live-supabase-anbindung.md) — Production-Pilot (veralteter Migrationsstand in Doku, nicht für Staging kopieren)
- [`apply-live-migrations-0021-0030.md`](apply-live-migrations-0021-0030.md) — Safe-Apply-Muster (Production-Scope 0021–0033)
- [`../architecture/wfm-phase2-schema-approval.md`](../architecture/wfm-phase2-schema-approval.md) — P2.1 Scope 0240
- [`../pilot/pilot-tenants-setup-production.sql`](../pilot/pilot-tenants-setup-production.sql) — synthetische Mandanten (Staging-tauglich)

---

## Sicherheits-Checkliste (Kurz)

- [ ] Kein Push/Deploy/Production-Apply in diesem Schritt
- [ ] Keine Production-Daten auf Staging
- [ ] `SUPABASE_PROJECT_REF` vor jedem CLI-Befehl gesetzt
- [ ] Kein `service_role` in Expo/React-Code
- [ ] Audit-Skripte (`scripts/audit/`) nicht gegen Staging/Production ohne Review

**Letzte Baseline-Validierung:** Fresh-DB lokal bis 0242, WFM 141/141, timeTracking 32/32 (HEAD `9b5aa4ea`).
