import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPANY_REGISTRATION_CATALOG } from '@/lib/catalogs/companyRegistrationCatalog';

describe('persisted company classification', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.tenants(id text PRIMARY KEY,legal_form text,industry text);
      INSERT INTO public.tenants VALUES('existing','UG','Alltagsbegleitung');`);
    await db.exec(readFileSync(resolve('supabase/migrations/20260912210000_company_registration_catalog.sql'), 'utf8'));
  }, 30000);
  afterAll(async () => { await db?.close(); });

  it('keeps existing records intact instead of silently backfilling classifications', async () => {
    const { rows } = await db.query('SELECT * FROM tenants WHERE id=$1', ['existing']);
    expect(rows[0]).toMatchObject({ legal_form: 'UG', industry: 'Alltagsbegleitung', legal_form_key: null, industry_key: null });
  });
  it('shares every catalog entry and alias with Web and server validation', async () => {
    const { rows } = await db.query<{ kind: 'legal_form' | 'industry'; key: string; label: string; aliases: string[] }>('SELECT kind,key,label,aliases FROM company_registration_catalog');
    expect(rows).toHaveLength(Object.values(COMPANY_REGISTRATION_CATALOG).flat().length);
    for (const row of rows) {
      expect(COMPANY_REGISTRATION_CATALOG[row.kind].find(entry => entry.key === row.key)).toMatchObject({ label: row.label, aliases: row.aliases });
    }
  });
  it('stores canonical display values and matching keys in the same tenant transaction', async () => {
    const { rows } = await db.query(`INSERT INTO tenants(id,legal_form,industry) VALUES($1,$2,$3) RETURNING *`, ['new','  UG  ','Alltagsbegleitung']);
    expect(rows[0]).toMatchObject({ legal_form: 'UG (haftungsbeschränkt)', industry: 'Ambulante Alltagsbegleitung', legal_form_key: 'ug', industry_key: 'alltagsbegleitung', registration_catalog_version: '2026-09-12' });
  });
  it('recomputes forged keys and keeps unrecognized legacy values available for manual review', async () => {
    const { rows } = await db.query(`INSERT INTO tenants(id,legal_form,industry,legal_form_key,industry_key) VALUES($1,$2,$3,$4,$5) RETURNING *`, ['legacy','Unbekannte Alt-Rechtsform','Pflege','gmbh','pflegedienst']);
    expect(rows[0]).toMatchObject({ legal_form: 'Unbekannte Alt-Rechtsform', legal_form_key: null, industry_key: 'pflege_allgemein', registration_catalog_version: null });
    const updated = await db.query(`UPDATE tenants SET industry_key='alltagsbegleitung' WHERE id='legacy' RETURNING industry_key`);
    expect(updated.rows[0]).toEqual({ industry_key: 'pflege_allgemein' });
  });
  it('retains the explanation for other selections and clears stale keys after reclassification', async () => {
    await db.query(`INSERT INTO tenants(id,legal_form,industry) VALUES($1,$2,$3)`, ['other','GmbH','Sonstige: Familienunterstützung']);
    const other = await db.query(`SELECT industry,industry_key FROM tenants WHERE id='other'`);
    expect(other.rows[0]).toEqual({ industry: 'Sonstige: Familienunterstützung', industry_key: 'sonstige' });
    const changed = await db.query(`UPDATE tenants SET industry='Unklassifizierter Altbestand' WHERE id='other' RETURNING industry_key,registration_catalog_version`);
    expect(changed.rows[0]).toEqual({ industry_key: null, registration_catalog_version: null });
  });
});
