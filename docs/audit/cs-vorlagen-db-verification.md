# CareSuite+ — Verifikation Migration 0233 (Vorlagen-Datenbank)

Stand: Phase 2.1 Dokumente & Unterschriften (2026-07-05)

## Migration

| Feld | Wert |
|------|------|
| Datei | `supabase/migrations/0233_cs_vorlagen_datenbank.sql` |
| Nummer | **0233** (nicht 0226) |
| Grund 0233 | `0226_employee_portal_uploads.sql` bereits auf `origin/main` |
| Feature-Commit | `a075fc8d` auf Branch `cursor/cs-vorlagen-documents-signatures-phase2` |
| Remote angewendet | **Ja** (2026-07-05, kontrolliert in Teilschritten) |
| Methode | Supabase MCP `apply_migration` / `execute_sql` (Dashboard-Äquivalent) |
| Push / Deploy | **Nein** / **Nein** |

## Warum 0233 statt 0226

Lokal war Phase 2 ursprünglich als `0226_cs_vorlagen_datenbank.sql` geplant. Nach Sync mit `origin/main` war `0226` durch `employee_portal_uploads` belegt. Die cs_*-Migration wurde auf **0233** renummeriert, ohne Inhalt zu verändern.

## Remote vorher (Ist-Zustand vor Phase 2.1)

| Beobachtung | Detail |
|-------------|--------|
| Tabellen/Funktionen | Teilweise vorhanden (DDL + Katalog), Seeds unvollständig |
| Verify vorher | Exit 1 — `42501` service_role grants fehlend, RPC-Parameter falsch im Script |
| Seed-Stand | 3/66 Vorlagen nach partiellem seed_01/02 |

## Remote nach Phase 2.1

| Entität | Erwartet | Remote |
|---------|----------|--------|
| Tabellen | 9/9 | **9/9** |
| RPCs | 3/3 | **3/3** (`cs_placeholder_value`, `cs_render_template_html`, `cs_seed_template`) |
| Kategorien | 10 | **10** |
| Platzhalter | 89 | **89** |
| Vorlagen | 66 | **66** |
| Aktive Versionen | 66 | **66** |
| Signaturfelder | variabel | **72** |
| Delivery Defaults | 66 | **66** |

### Angewendete Remote-Teile

1. `0233_cs_vorlagen_datenbank_ddl` — Tabellen + Funktionen
2. `0233_cs_vorlagen_datenbank_catalog` — Kategorien + Platzhalter
3. `0233_cs_vorlagen_datenbank_seed_01` … `_05` — Systemvorlagen (inkl. Repair-Läufe)
4. `0233_cs_vorlagen_datenbank_rls` — RLS + authenticated grants
5. `service_role` grants — für Audit/Verify via REST

### Verify-Script

```bash
node scripts/audit/verify-cs-vorlagen-db.mjs
```

**Ergebnis 2026-07-05:** Exit **0**

- Kein PGRST205
- `cs_render_template_html` RPC-Smoke: **OK** (`<p>CareSuite Test</p>`)
- Script-Fixes in Phase 2.1: RPC-Parameter `_html`/`_context`, `template_id` für delivery_defaults

## Erwartete Tabellen

| Tabelle | In Migration deklariert |
|---------|-------------------------|
| `cs_template_categories` | Ja |
| `cs_template_placeholders` | Ja |
| `cs_document_templates` | Ja |
| `cs_document_template_versions` | Ja |
| `cs_template_signature_fields` | Ja |
| `cs_template_delivery_defaults` | Ja |
| `cs_document_requests` | Ja |
| `cs_document_request_signatures` | Ja |
| `cs_document_request_files` | Ja |

## Unit-Tests

```bash
npm test -- src/__tests__/documents/csTemplateDatabase.test.ts
```

**Ergebnis:** 19/19 grün (2026-07-05)

## Remote manuell (SQL)

```sql
select count(*) from cs_template_categories;
select count(*) from cs_template_placeholders;
select count(*) from cs_document_templates;
select count(*) from cs_document_template_versions where status = 'active';
select count(*) from cs_template_signature_fields;
select count(*) from cs_template_delivery_defaults;
select public.cs_render_template_html('<p>{{tenant.legal_name}}</p>', '{"tenant":{"legal_name":"Test"}}'::jsonb);
```

## Offene Risiken

| Risiko | Status |
|--------|--------|
| Seed-Repair mit kompaktem HTML in einzelnen Batches | Keys/Metadaten vollständig; Body-HTML ggf. später aus `0233` nachziehen |
| Migration-History vs. vollständige SQL-Dateien | Supabase `schema_migrations` enthält Teilsteps; DB-Zustand verifiziert |
| Juristische Vorlagen | Technische Muster — vor Produktion rechtlich prüfen |
| PDF-Archiv (`cs_document_request_files`) | Phase 4 — **keine Fake-PDFs** |
| Einsatz-Blockade (`required_before_service`) | Phase 3 — **nicht** am Einsatzstart aktiv |

## Sicherheitsbestätigung Phase 2.1

- Kein Push
- Kein Deploy / kein `[deploy]`
- Keine Einsatzstart-Blockade aktiviert
- Keine Fake-Dateien in `cs_document_request_files`
- Keine produktiven Tabellen gelöscht
