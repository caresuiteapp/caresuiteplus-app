import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFixture, id, companyMigration } from './company_access_fixture.mjs';

const f = await companyFixture();
const { db, actor, owner, scope, organization, siteA } = f;
try {
  await owner();
  await db.exec(`
    CREATE TABLE tenant_work_organizations(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text NOT NULL,code text NOT NULL,is_active boolean NOT NULL DEFAULT true);
    ALTER TABLE tenant_cost_centers ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE tenant_cost_centers ADD COLUMN organization_id uuid REFERENCES tenant_work_organizations(id),ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    CREATE TABLE tenant_custom_field_definitions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,is_active boolean NOT NULL DEFAULT true,visibility jsonb NOT NULL);
    CREATE TABLE tenant_custom_field_values(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,definition_id uuid NOT NULL REFERENCES tenant_custom_field_definitions(id),value jsonb,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,definition_id));
    ALTER TABLE tenant_custom_field_values ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON tenant_custom_field_definitions TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON tenant_custom_field_values TO authenticated;
  `);
  await db.exec(companyMigration('company_custom_values'));
  await db.exec(companyMigration('company_cost_centers'));
  await db.query("INSERT INTO tenant_work_organizations VALUES($1,$2,'Eigener Bereich','OWN',true),($3,$4,'Fremder Bereich','FOREIGN',true)", [id(201), id(10), id(202), id(11)]);
  await db.query("INSERT INTO tenant_custom_field_definitions VALUES($1,$2,true,'{\"office\":true}'),($3,$4,true,'{\"office\":true}'),($5,$2,true,'{\"office\":true,\"protected\":true}')", [id(211), id(10), id(212), id(11), id(213)]);
  const read = async () => (await db.query('SELECT public.company_cost_centers_read($1,0) result', [id(10)])).rows[0].result;
  const save = async (record = null, code = 'VERW', name = 'Verwaltung', org = id(201), active = true, expected = record?.updated_at ?? null) => (await db.query('SELECT public.company_cost_center_save($1,$2,$3,$4,$5,$6,$7) result', [id(10), record?.id ?? null, expected, code, name, org, active])).rows[0].result;
  let cost;
  await test('cost centers create and update existing rows, using server-side CAS and tenant references', async () => {
    await actor(); cost = await save(); assert.equal(cost.code, 'VERW'); assert.equal(cost.organization_id, id(201));
    assert.equal((await read()).costCenters.length, 1);
    await assert.rejects(save(null, 'FOREIGN', 'Fremd', id(202)), /gehört nicht/);
    await assert.rejects(save(null, 'verw'), /bereits vergeben/);
    await assert.rejects(save(cost, 'VERW', 'Überholt', id(201), true, '2000-01-01'), /geändert/);
  });
  await test('deactivation keeps actual site references and permits reactivation', async () => {
    await actor(); const linked = await organization('site', { cost_center_id: cost.id }, siteA.id, siteA.version);
    cost = await save(cost, 'VERW', 'Verwaltung', id(201), false); assert.equal(cost.is_active, false);
    assert.equal((await db.query('SELECT cost_center_id FROM company_sites WHERE id=$1', [linked.id])).rows[0].cost_center_id, cost.id);
    cost = await save(cost, 'VERW', 'Verwaltung', id(201), true); assert.equal(cost.is_active, true);
  });
  await test('legacy writers still advance the timestamp so company edits cannot overwrite them silently', async () => {
    const old = cost;
    await owner(); await db.query("UPDATE tenant_cost_centers SET name='Außerhalb aktualisiert' WHERE id=$1", [cost.id]);
    await actor(); await assert.rejects(save(old), /geändert/);
    cost = (await read()).costCenters[0];
  });
  await test('limited users, foreign sessions and anonymous sessions cannot read or mutate company cost centers through the new company RPCs', async () => {
    await actor(); await scope(21, [{ kind: 'site', targetId: siteA.id }]);
    await actor(21); await assert.rejects(read(), /Keine Berechtigung/); await assert.rejects(save(), /Keine Berechtigung/);
    await actor(24, 11); await assert.rejects(read(), /Keine Berechtigung/);
    await actor(null); await assert.rejects(read(), /permission denied/);
  });
  await test('custom values require unscoped management and a same-tenant visible definition', async () => {
    await actor(); await db.query('INSERT INTO tenant_custom_field_values(tenant_id,definition_id,value) VALUES($1,$2,$3)', [id(10), id(211), '"HV-1"']);
    assert.equal((await db.query('SELECT value FROM tenant_custom_field_values')).rows[0].value, 'HV-1');
    await assert.rejects(db.query('INSERT INTO tenant_custom_field_values(tenant_id,definition_id,value) VALUES($1,$2,$3)', [id(10), id(212), '"FOREIGN"']), /row-level security/);
    await assert.rejects(db.query('INSERT INTO tenant_custom_field_values(tenant_id,definition_id,value) VALUES($1,$2,$3)', [id(10), id(213), '"PROTECTED"']), /row-level security/);
    await actor(21); assert.equal((await db.query('SELECT value FROM tenant_custom_field_values')).rows.length, 0);
    await assert.rejects(db.query('INSERT INTO tenant_custom_field_values(tenant_id,definition_id,value) VALUES($1,$2,$3)', [id(10), id(211), '"LIMITED"']), /row-level security/);
  });
} finally { await db.close(); }
