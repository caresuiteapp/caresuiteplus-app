import test from 'node:test';
import assert from 'node:assert/strict';
import { readVitalCaseWeb, readVitalCasesWeb, vitalCaseOptions } from '../../src/lib/pflege/vitalCaseApi.web.ts';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const tenantId = id(11);
const person = (n, patch = {}) => ({
  id: id(n), tenant_id: tenantId, first_name: 'Anna', last_name: 'Testfall', client_number: String(n), ...patch,
});
const ok = data => ({ status: 200, error: null, data });
const unsupported = { status: 404, error: { code: 'PGRST202' }, data: null };
const check = () => {};

test('Pflegefallseiten bewahren Originale und setzen den UUID-Cursor bis zur leeren Endseite fort', async () => {
  const requests = [];
  const data = [person(1), person(2)];
  const sdk = { rpc: async (name, args) => {
    requests.push({ name, args });
    return ok(args.p_after_id === null ? data : []);
  } };
  const result = await readVitalCasesWeb(sdk, tenantId, check);
  assert.deepEqual(requests.map(item => item.args.p_after_id), [null, id(2)]);
  assert.ok(requests.every(item => item.name === 'list_ambulatory_vital_cases'));
  assert.ok(Object.isFrozen(result.rows[0]));
  assert.deepEqual(vitalCaseOptions(result.rows).map(item => item.name), ['Anna Testfall · 1', 'Anna Testfall · 2']);
});

test('nur eine fehlende Lesefunktion zu Beginn erlaubt den vorhandenen Lesepfad', async () => {
  assert.equal(await readVitalCasesWeb({ rpc: async () => unsupported }, tenantId, check), null);
  await assert.rejects(readVitalCasesWeb({ rpc: async () => ({ status: 403, error: { code: '42501' }, data: null }) }, tenantId, check));
  await assert.rejects(readVitalCasesWeb({ rpc: async (_name, args) => args.p_after_id ? unsupported : ok([person(1)]) }, tenantId, check));
  await assert.rejects(readVitalCasesWeb({ rpc: async () => ok([person(1, { tenant_id: id(12) })]) }, tenantId, check));
  await assert.rejects(readVitalCasesWeb({ rpc: async () => ok([person(2), person(1)]) }, tenantId, check));
});

test('Detail-Freigaben kommen aus der aktuellen genauen Fallantwort', async () => {
  const result = await readVitalCaseWeb({ rpc: async () => ok([person(1, { vital_path: false, respiratory_path: true })]) }, tenantId, id(1), check);
  assert.equal(result.vital_path, false);
  assert.equal(result.respiratory_path, true);
  await assert.rejects(readVitalCaseWeb({ rpc: async () => ok([]) }, tenantId, id(1), check));
  await assert.rejects(readVitalCaseWeb({ rpc: async () => ok([person(1, { vital_path: true, respiratory_path: true })]) }, tenantId, id(2), check));
});
