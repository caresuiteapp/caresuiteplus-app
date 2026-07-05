# CareSuite+ — Verifikation Migration 0226 (Vorlagen-Datenbank)

Stand: Phase 2 Dokumente & Unterschriften

## Migration

| Feld | Wert |
|------|------|
| Datei | `supabase/migrations/0233_cs_vorlagen_datenbank.sql` |
| Nummer frei | Ja (0233 — 0226 belegt durch `employee_portal_uploads`) |
| RLS | `current_tenant_id()` + Portal-Policies |

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

## Erwartete RPCs / Funktionen

| Funktion | Zweck |
|----------|--------|
| `cs_placeholder_value` | Platzhalter aus JSON-Kontext lesen |
| `cs_render_template_html` | HTML mit Kontext rendern |
| `cs_seed_template` | Systemvorlage + Version + Signaturfelder seeden |

## Erwartete Seed-Counts (aus SQL-Datei)

| Entität | Erwartete Anzahl |
|---------|------------------|
| Kategorien | 10 |
| Platzhalter | 89 (INSERT-Zeilen in Migration 0226) |
| Dokumentvorlagen | 66 (`cs_seed_template`-Aufrufe) |
| Aktive Versionen | 66 (je Vorlage eine aktive Version) |
| Signaturfelder | variabel pro Vorlage (via `cs_seed_template`) |
| Delivery Defaults | 66 (je Vorlage ein Default) |

## Verifikation ausführen

```bash
node scripts/audit/verify-cs-vorlagen-db.mjs
```

Das Script:

1. Parst die Migration und gibt erwartete Counts aus.
2. Prüft optional Remote-Supabase (`.env` mit `SUPABASE_SERVICE_ROLE_KEY`).
3. Ruft `cs_render_template_html` als RPC-Smoke auf.
4. Beendet mit Exit-Code `0` bei Erfolg, sonst `1`.

## Remote manuell (SQL)

```sql
select count(*) from cs_template_categories;
select count(*) from cs_template_placeholders;
select count(*) from cs_document_templates;
select count(*) from cs_document_template_versions where status = 'active';
select count(*) from cs_template_signature_fields;
select count(*) from cs_template_delivery_defaults;
```

## Hinweise

- **Kein Deploy** in Phase 2 — Migration muss separat auf Supabase angewendet werden (`supabase db push` / Dashboard).
- **PDF-Archiv** (`cs_document_request_files`) ist Phase 4 — keine Fake-PDFs.
- **Pflicht vor Einsatz** (`required_before_service`) wird erst in Phase 3 produktiv blockiert.
