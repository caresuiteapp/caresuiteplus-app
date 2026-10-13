// ACL-only fixtures: exact captured function headers, original argument types,
// defaults, return types and SECURITY DEFINER/search_path; synthetic stub bodies.
// These tests do not execute the original bodies and are not exploit evidence.
// No remote queries/writes, customer/Auth rows or integration dispatch occur.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const metadata = JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json', import.meta.url), 'utf8'));
const draft = readFileSync(new URL('../../docs/workflow-server-unused-auxiliary-rpc-draft.sql', import.meta.url), 'utf8');
const uuid = '10000000-0000-0000-0000-000000000001';
const writers = [
  { name: 'add_ai_message', types: ['uuid', 'ai_message_role', 'text'] },
  { name: 'refresh_final_readiness', types: ['uuid'] },
  { name: 'complete_follow_up', types: ['uuid', 'text'] },
  { name: 'add_support_ticket_message', types: ['uuid', 'text', 'boolean'] },
  { name: 'calculate_assessment_score', types: ['uuid'] },
  { name: 'complete_measure', types: ['uuid', 'text'] },
  { name: 'copy_system_template_to_tenant', types: ['uuid', 'uuid'] },
  { name: 'mark_notification_read', types: ['uuid'] },
  { name: 'create_ai_conversation', types: ['uuid', 'text', 'product_key', 'text', 'uuid'] },
  { name: 'log_app_event', types: ['uuid', 'text', 'text', 'text', 'app_event_level', 'product_key', 'text', 'text'] },
  { name: 'log_error', types: ['uuid', 'text', 'text', 'product_key', 'text', 'text', 'jsonb'] },
  { name: 'update_course_progress', types: ['uuid', 'numeric'] },
  { name: 'update_health_check', types: ['uuid', 'text', 'health_check_status', 'numeric', 'text', 'jsonb'] },
];
const enumTypes = new Set(['ai_message_role', 'product_key', 'app_event_level', 'health_check_status']);
const values = {
  uuid, text: 'Synthetic ACL argument', boolean: false, numeric: 37.5, jsonb: { synthetic: true },
  ai_message_role: 'user', product_key: 'office', app_event_level: 'info', health_check_status: 'ok',
};
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE ROLE fixture_unlisted;
CREATE TYPE ai_message_role AS ENUM ('system','user','assistant','tool');
CREATE TYPE product_key AS ENUM ('assist','pflege','stationaer','office','beratung','akademie');
CREATE TYPE app_event_level AS ENUM ('debug','info','warning','error','critical');
CREATE TYPE health_check_status AS ENUM ('ok','warning','critical','unknown');
CREATE TABLE fixture_acl_records (id uuid PRIMARY KEY, label text NOT NULL);
CREATE TABLE fixture_acl_calls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), function_name text, arguments jsonb);
INSERT INTO fixture_acl_records VALUES ('${uuid}','Preserved synthetic record');
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,fixture_unlisted;
GRANT USAGE ON TYPE ai_message_role,product_key,app_event_level,health_check_status
 TO anon,authenticated,service_role,fixture_unlisted;
CREATE FUNCTION fixture_unrelated() RETURNS text LANGUAGE sql AS 'SELECT ''untouched''::text';
`);
for (const writer of writers) {
  const captured = metadata.functions.find(f => f.name === writer.name);
  assert.ok(captured, 'captured metadata required: ' + writer.name);
  assert.equal(metadata.functions.filter(f => f.name === writer.name).length, 1, 'no unreviewed overload');
  const bodyStart = captured.definition.search(/\bAS\s+\$/);
  assert.ok(bodyStart > 0, 'captured dollar-quoted body required');
  const header = captured.definition.slice(0, bodyStart);
  assert.match(header, /SECURITY DEFINER/);
  assert.match(header, /SET search_path TO 'public', 'pg_temp'/);
  const argumentNames = captured.args.split(', ').map(arg => arg.split(' ')[0]);
  assert.equal(argumentNames.length, writer.types.length);
  const qualifiedTypes = writer.types.map(type => enumTypes.has(type) ? 'public.' + type : type);
  writer.signature = `public.${writer.name}(${qualifiedTypes.join(',')})`;
  writer.args = writer.types.map(type => values[type]);
  writer.sql = `SELECT public.${writer.name}(${qualifiedTypes.map((type, index) => `$${index + 1}::${type}`).join(',')}) AS result`;
  writer.defaultCount = (header.match(/ DEFAULT /g) ?? []).length;
  const result = /RETURNS jsonb/.test(header) ? "jsonb_build_object('synthetic_acl_only',true)" : 'gen_random_uuid()';
  // Retain the original header only. Every original body is intentionally replaced.
  await db.exec(`${header} AS $fixture$
BEGIN
 INSERT INTO fixture_acl_calls(function_name,arguments)
 VALUES ('${writer.name}',jsonb_build_array(${argumentNames.join(',')}));
 RETURN ${result};
END;
$fixture$;`);
  // Reproduce effective captured API grants, not unknown original ACL text.
  await db.exec(`REVOKE EXECUTE ON FUNCTION ${writer.signature} FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${writer.signature} TO service_role;`);
  if (captured.auth) await db.exec(`GRANT EXECUTE ON FUNCTION ${writer.signature} TO authenticated;`);
  if (captured.anon) await db.exec(`GRANT EXECUTE ON FUNCTION ${writer.signature} TO anon;`);
}
async function actor(role) {
  await db.exec('RESET ROLE');
  if (role) await db.exec('SET ROLE ' + role);
}
async function snapshot() {
  await actor();
  return {
    records: (await db.query('SELECT * FROM fixture_acl_records ORDER BY id')).rows,
    calls: (await db.query('SELECT * FROM fixture_acl_calls ORDER BY id')).rows,
  };
}
async function catalog() {
  await actor();
  const result = [];
  for (const writer of writers) {
    result.push((await db.query(`SELECT proname, pg_get_function_identity_arguments(oid) AS identity_args,
      pg_get_function_arguments(oid) AS arguments, pg_get_function_result(oid) AS result,
      prosrc, proconfig, prosecdef, pronargdefaults FROM pg_proc WHERE oid=$1::regprocedure`, [writer.signature])).rows[0]);
  }
  return result;
}
const originalCatalog = await catalog();
await test('thirteen fixtures preserve captured argument names/types/defaults, returns and security configuration', async () => {
  assert.equal(writers.length, 13);
  assert.equal(new Set(writers.map(writer => writer.signature)).size, 13);
  assert.equal([...draft.matchAll(/REVOKE EXECUTE ON FUNCTION /g)].length, 13);
  assert.equal([...draft.matchAll(/GRANT EXECUTE ON FUNCTION /g)].length, 13);
  for (const [index, writer] of writers.entries()) {
    const captured = metadata.functions.find(f => f.name === writer.name);
    const row = originalCatalog[index];
    assert.equal(row.identity_args.replaceAll('public.', ''), captured.args);
    assert.equal(row.pronargdefaults, writer.defaultCount);
    assert.equal(row.result, /RETURNS jsonb/.test(captured.definition) ? 'jsonb' : 'uuid');
    assert.equal(row.prosecdef, true);
    assert.deepEqual(row.proconfig, ['search_path=public, pg_temp']);
  }
});
await test('captured authenticated EXECUTE allows all thirteen ACL-shaped stubs before the draft', async () => {
  await actor('authenticated');
  for (const writer of writers) {
    assert.equal(metadata.functions.find(f => f.name === writer.name).auth, true);
    await db.query(writer.sql, writer.args);
  }
  assert.equal((await snapshot()).calls.length, 13);
});
await test('three draft applications preserve existing records, function bodies/signatures/defaults and unrelated API', async () => {
  const before = await snapshot();
  for (let pass = 0; pass < 3; pass++) await db.exec(draft);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await catalog(), originalCatalog);
  await actor('authenticated');
  assert.equal((await db.query('SELECT fixture_unrelated() AS result')).rows[0].result, 'untouched');
  await actor('fixture_unlisted');
  assert.equal((await db.query('SELECT fixture_unrelated() AS result')).rows[0].result, 'untouched');
});
await test('all thirteen effective browser/PUBLIC grants are absent and trusted service grants remain', async () => {
  await actor();
  for (const writer of writers) {
    const row = (await db.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,
      has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,
      has_function_privilege('fixture_unlisted',$1,'EXECUTE') AS unlisted,
      has_function_privilege('service_role',$1,'EXECUTE') AS service,
      EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
        WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public`, [writer.signature])).rows[0];
    assert.deepEqual(row, { anon: false, authenticated: false, unlisted: false, service: true, public: false });
  }
});
for (const role of ['anon', 'authenticated', 'fixture_unlisted']) {
  await test(role + ' is denied for each exact signature without changing any synthetic record', async () => {
    const before = await snapshot();
    await actor(role);
    for (const writer of writers) await assert.rejects(db.query(writer.sql, writer.args), /permission denied/i);
    assert.deepEqual(await snapshot(), before);
  });
}
await test('trusted service can call all original typed argument lists and their retained optional defaults', async () => {
  const before = await snapshot();
  await actor('service_role');
  let expectedCalls = before.calls.length;
  for (const writer of writers) {
    await db.query(writer.sql, writer.args);
    expectedCalls++;
    if (writer.defaultCount) {
      const required = writer.types.length - writer.defaultCount;
      const types = writer.types.slice(0, required).map(type => enumTypes.has(type) ? 'public.' + type : type);
      await db.query(`SELECT public.${writer.name}(${types.map((type, index) => `$${index + 1}::${type}`).join(',')})`, writer.args.slice(0, required));
      expectedCalls++;
    }
  }
  const after = await snapshot();
  assert.deepEqual(after.records, before.records);
  assert.equal(after.calls.length, expectedCalls);
  for (const writer of writers) {
    const calls = after.calls.filter(call => call.function_name === writer.name);
    assert.equal(calls.length, writer.defaultCount ? 3 : 2);
    assert.ok(calls.some(call => JSON.stringify(call.arguments) === JSON.stringify(writer.args)));
  }
});
await db.close();
