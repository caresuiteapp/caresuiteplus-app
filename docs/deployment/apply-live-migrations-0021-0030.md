# Live-Migrationen 0021–0033 — Safe Apply Guide

**Sprint 46 / 72** — Remote-Anwendung der additiven Live-Pilot-Migrationen ohne undokumentiertes `db push`.

---

## Überblick

| Migration | Modul | Inhalt |
|-----------|-------|--------|
| `0021` | Assist Fahrten | trips Listen-Felder |
| `0022` | Assist Fahrten | trips Detail-Felder |
| `0023` | Stationär | care_records Listen-Felder |
| `0024` | Stationär | care_records Detail-Felder |
| `0025` | Akademie | catalogs Listen-Felder |
| `0026` | Akademie | catalogs Detail-Felder |
| `0027` | Reporting | reporting_reports Liste |
| `0028` | Reporting | reporting_reports Detail |
| `0029` | Reporting | PDL-Cockpit Snapshot |
| `0030` | Assist | Tracking-Dashboard Snapshot |
| `0031` | DSGVO | data_subject_requests + RLS |
| `0032` | DSGVO | Admin Status-UPDATE RLS |
| `0033` | Office | employees Live-Detail-Felder |

Alle Dateien unter `supabase/migrations/` sind **additiv** (ALTER ADD COLUMN, CREATE TABLE/INDEX). Kein DROP TABLE, TRUNCATE oder DELETE in 0021–0033.

---

## Sicherheitsregeln

1. **Kein `service_role` im Frontend** — nur `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` / EAS Secrets.
2. **Review vor Apply** — `migration list --linked` und Diff prüfen.
3. **Kein blindes `db push`** — `deploy-live-pilot.mjs` führt automatisch push aus; nur nach Checklist nutzen.
4. **Backfill getrennt** — Schema via Migration, Daten via `npm run seed:live-pilot`.
5. **Default ist Dry-Run** — ohne `--apply --confirm` werden **keine** DB-Änderungen ausgeführt.

---

## Empfohlener Ablauf

### 1. Checklist / Dry-Run (keine DB-Änderung)

```bash
node scripts/apply-live-migrations.mjs
# oder
npm run apply:live-migrations
```

Erwartete Ausgabe: Migrations-Checklist + `Dry-run abgeschlossen — keine DB-Änderungen.`

### 2. Remote-Status prüfen

```bash
node scripts/apply-live-migrations.mjs --list --project-ref=<ref>
```

Erfordert `supabase login` + `supabase link`. Zeigt `migration list --linked` — **kein Apply**.

### 3. Anwenden (explizite Bestätigung — nur nach User-Review)

```bash
node scripts/apply-live-migrations.mjs --apply --confirm --project-ref=<ref>
```

**Nicht ohne explizite Freigabe ausführen.** Das Script:

- verlinkt das Projekt (falls nötig),
- zeigt `migration list --linked`,
- führt **nur mit `--confirm`** `supabase db push` aus.

### 4. Backfill + Types

```bash
npm run seed:live-pilot -- --write-sql
# SQL in docs/pilot/ prüfen, dann manuell oder --apply
npm run fetch-remote-types
npm run typecheck && npm run test
```

---

## Alternative: Supabase Dashboard

1. SQL Editor öffnen
2. Dateien `0021` … `0033` nacheinander einfügen und ausführen
3. `migration list` im CLI zur Verifikation

---

## deploy-live-pilot.mjs

Das Deployment-Script (`npm run deploy:live-pilot`) führt weiterhin Link, **automatisches db push**, Types-Gen und Quality Gates aus. Für produktionsnahe Pilot-Umgebungen zuerst dieses Safe-Apply-Guide durchlaufen.

---

## Verwandte Docs

- [`live-supabase-anbindung.md`](live-supabase-anbindung.md)
- [`../pilot/pilot-tenants-setup-production.sql`](../pilot/pilot-tenants-setup-production.sql)
- [`../audit/mega-masterprompt-v2-progress.md`](../audit/mega-masterprompt-v2-progress.md)
