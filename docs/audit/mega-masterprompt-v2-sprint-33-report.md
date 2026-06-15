# MEGA Masterprompt v2 — Sprint 33 Report

**Datum:** 2026-06-14  
**Scope:** Live-Pilot Seed / Backfill Script (safe INSERT only)  
**Verdict:** Pilot-Backfill dokumentiert — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 33 lieferte ein **idempotentes Seed-Script** für den Live-Pilot-Mandanten — minimal rows für trips, care_records (residents), catalogs (courses) und reporting_reports. Keine Migration, keine destruktiven SQL-Befehle. User führt manuell aus.

---

## 2. Implementiert

| Artefakt | Zweck |
|----------|-------|
| `scripts/seed-live-pilot.mjs` | Generator + optional `--apply` via Supabase CLI |
| `docs/pilot/seed-live-pilot.sql` | Generiertes SQL (INSERT + ON CONFLICT DO NOTHING) |
| `npm run seed:live-pilot` | Schreibt SQL nach `docs/pilot/` |
| `scripts/deploy-live-pilot.mjs` | Verweist auf Seed-Script nach db push |

**Seed-Inhalt (Pilot-Mandant `11111111-1111-1111-1111-111111111101`):**

| Tabelle | Rows | Live-Felder |
|---------|------|-------------|
| `trips` | 3 | employee_name, vehicle_label, purpose, started_at, addresses, notes |
| `care_records` | 2 | record_type=resident, first/last_name, wing, room, care_level |
| `catalogs` | 2 | catalog_type=course, category, duration, mandatory, instructor |
| `reporting_reports` | 2 | category, period, summary, kpi_snapshot |

**Manuelle Ausführung:**

```bash
npm run seed:live-pilot
# → docs/pilot/seed-live-pilot.sql in Supabase SQL Editor einfügen
# Oder: node scripts/seed-live-pilot.mjs --apply
```

Voraussetzung: Migrationen 0021–0028 angewendet, Pilot-Mandant existiert (`docs/pilot/pilot-tenants-setup-production.sql`).

---

## 3. Demo vs. Live

| Aspekt | Status |
|--------|--------|
| **Seed-Script** | Server-side SQL only — kein Frontend |
| **service_role im Frontend** | ❌ Nicht verwendet |
| **Destruktive Ops** | ❌ Kein DROP/TRUNCATE/DELETE |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **576** passed (+8 kumulativ, inkl. Seed-Tests Sprint 34) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 35+

| Priorität | Item |
|-----------|------|
| P2 | Live `completeTrip` + Tracking-Dashboard |
| P2 | View-Toggle Karten/Tabelle Durchführung + Fahrten |
| P2 | PDL-Cockpit Live-Wiring |
| P2 | QM Live-Repository |
| P2 | Store/EAS-Audit |

---

## 6. Verdict

Live-Pilot kann jetzt **manuell mit Demo-Daten befüllt** werden — Fahrten, Bewohner, Kurse und Berichte erscheinen in Live-Modus nach Seed + Auth-Setup. Kein Store-Release.
