import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BUSINESS_REGISTRATION_DB_FIXTURE } from './businessRegistrationDbFixture';

const metadata = JSON.parse(readFileSync('docs/workflow-server-permission-metadata-20261011.json', 'utf8'));
const deployed = (name: string): string => metadata.functions.find((row: { name: string }) => row.name === name).definition;
const draft = readFileSync('docs/business-registration-release-gates.sql', 'utf8');
const oldTenant = randomUUID(), oldRole = randomUUID();
const registration = { companyName: 'Neu GmbH', legalForm: 'GmbH', industry: 'Pflege', street: 'Weg 1', zip: '12345', city: 'Berlin', phone: '1234', email: 'office@example.test', adminFirstName: 'Anna', adminLastName: 'Test', termsAccepted: true, selectedModules: [] };

describe('business registration PostgreSQL identity and provisioning contract', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite(); await db.exec(BUSINESS_REGISTRATION_DB_FIXTURE);
    await db.exec(readFileSync('supabase/migrations/20261006063320_registration_welcome_outbox.sql', 'utf8'));
    await db.exec(deployed('handle_new_user'));
    await db.exec('CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();');
    await db.query('INSERT INTO tenants(id,name,status) VALUES($1,$2,$3)', [oldTenant, 'Bestehend', 'active']);
    await db.query('INSERT INTO roles(id,tenant_id,key,name,is_admin_role) VALUES($1,$2,$3,$4,true)', [oldRole, oldTenant, 'owner', 'Owner']);
    // Reproduce the captured production bug before installing only the local draft.
    const id = randomUUID(); await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [id, 'before@example.test']);
    const before = await db.query('SELECT role_id,tenant_id FROM profiles WHERE auth_user_id=$1', [id]);
    expect(before.rows).toEqual([{ role_id: oldRole, tenant_id: null }]);
    await db.exec(draft);
  }, 30000);
  afterAll(async () => { await db?.close(); });
  async function identity(email = `owner-${randomUUID()}@example.test`) {
    const id = randomUUID(); await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3::jsonb)', [id, email, JSON.stringify({ display_name: 'Anna Test', role_key: 'owner', tenant_id: oldTenant })]);
    return { id, email };
  }
  async function register(user: { id: string; email: string }) {
    return (await db.query<{ result: { tenantId: string; owner: { id: string }; welcomeEmailQueued: boolean } }>('SELECT register_business_workspace($1,$2::jsonb) result', [user.id, JSON.stringify({ ...registration, adminEmail: user.email })])).rows[0].result;
  }
  it('creates a neutral invited profile and treats editable metadata only as display data', async () => {
    const user = await identity();
    const profile = (await db.query<{ id: string; auth_user_id: string; first_name: string; last_name: string; role_id: string | null; tenant_id: string | null; status: string }>('SELECT id,auth_user_id,first_name,last_name,role_id,tenant_id,status FROM profiles WHERE auth_user_id=$1', [user.id])).rows[0];
    expect(profile).toMatchObject({ auth_user_id: user.id, first_name: 'Anna', last_name: 'Test', role_id: null, tenant_id: null, status: 'invited' });
    expect(profile.id).not.toBe(user.id);
  });
  it('atomically provisions the matching profile, own owner role, every available free area and one welcome job; retries are idempotent', async () => {
    const user = await identity(); const receipt = await register(user); const retry = await register(user); expect(retry.tenantId).toBe(receipt.tenantId);
    const profile = (await db.query('SELECT p.tenant_id,p.status,p.is_active,r.key,r.tenant_id role_tenant,r.is_admin_role FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.auth_user_id=$1', [user.id])).rows[0];
    expect(profile).toEqual({ tenant_id: receipt.tenantId, status: 'active', is_active: true, key: 'owner', role_tenant: receipt.tenantId, is_admin_role: true });
    const products = await db.query('SELECT product_key,price_cents,monthly_price,access_type,billing_status FROM tenant_products WHERE tenant_id=$1 ORDER BY product_key', [receipt.tenantId]);
    expect(products.rows).toHaveLength(6); for (const product of products.rows) expect(product).toMatchObject({ price_cents: 0, monthly_price: 0, access_type: 'free', billing_status: 'free_active' });
    expect((await db.query('SELECT module_key,is_trial FROM platform_tenant_modules WHERE tenant_id=$1', [receipt.tenantId])).rows).toHaveLength(6);
    expect((await db.query('SELECT plan_key,billing_status,lifecycle_status FROM platform_tenants WHERE tenant_id=$1', [receipt.tenantId])).rows).toEqual([{ plan_key: 'free_platform', billing_status: 'manual_free', lifecycle_status: 'onboarding' }]);
    expect((await db.query<{ metadata: { plan_key: string; price_cents: number } }>('SELECT metadata FROM tenant_subscriptions WHERE tenant_id=$1', [receipt.tenantId])).rows[0].metadata).toMatchObject({ plan_key: 'free_platform', price_cents: 0 });
    expect((await db.query('SELECT id FROM tenant_users WHERE auth_user_id=$1', [user.id])).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM registration_welcome_outbox WHERE auth_user_id=$1', [user.id])).rows).toHaveLength(1);
    expect(receipt.welcomeEmailQueued).toBe(true);
  });
  it('blocks an existing legacy profile identity instead of assigning it a second workspace', async () => {
    const user = await identity(); await db.query('INSERT INTO profiles(id,tenant_id,role_id,status,is_active) VALUES($1,$2,$3,$4,true)', [user.id, oldTenant, oldRole, 'active']);
    await expect(register(user)).rejects.toThrow('registration_existing_account');
    expect((await db.query('SELECT tenant_id,role_id FROM profiles WHERE id=$1', [user.id])).rows).toEqual([{ tenant_id: oldTenant, role_id: oldRole }]);
    expect((await db.query('SELECT id FROM tenant_users WHERE auth_user_id=$1', [user.id])).rows).toHaveLength(0);
  });
  it('rejects a stale owner receipt when its actual profile has been assigned to another workspace', async () => {
    const user = await identity(); await register(user); await db.query('UPDATE profiles SET tenant_id=$1 WHERE auth_user_id=$2', [oldTenant, user.id]);
    await expect(register(user)).rejects.toThrow('registration_workspace_identity_invalid');
  });
  it('rolls provisioning back to the neutral profile when a transaction tail fails', async () => {
    const user = await identity('rollback-contract@example.test');
    await db.exec(`CREATE FUNCTION registration_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.recipient_email='rollback-contract@example.test' THEN RAISE EXCEPTION 'fixture_tail_failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER registration_fixture_failure BEFORE INSERT ON registration_welcome_outbox FOR EACH ROW EXECUTE FUNCTION registration_fixture_failure();`);
    await expect(register(user)).rejects.toThrow('fixture_tail_failure');
    expect((await db.query('SELECT role_id,tenant_id,status FROM profiles WHERE auth_user_id=$1', [user.id])).rows).toEqual([{ role_id: null, tenant_id: null, status: 'invited' }]);
    expect((await db.query('SELECT id FROM tenants WHERE billing_email=$1', [user.email])).rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM tenant_users WHERE auth_user_id=$1', [user.id])).rows).toHaveLength(0);
  });
  it('denies direct anonymous and authenticated registrar calls', async () => {
    const user = await identity();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`); await expect(register(user)).rejects.toThrow('permission denied'); await db.exec('RESET ROLE');
    }
  });
});
