import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const time = '2026-10-15T09:40:00.123456+00:00';
const source = stripTypeScriptTypes(readFileSync(new URL(
  '../../src/lib/clients/repositories/clientIntakeCompletionRepository.supabase.web.ts', import.meta.url,
), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
const validForm = patch => ({
  intakeCareNeedSummary: 'Pflegebedarf wurde vollständig geprüft.',
  intakeCapacityStatus: 'confirmed', intakeCapacityReference: 'CAP-17',
  intakeAdmissionDecision: 'accepted', intakeAdmissionDecisionReason: 'Aufnahme fachlich ausdrücklich freigegeben.',
  serviceStart: '2026-10-20', intakeContractType: 'ambulant', intakeDocuments: [], ...patch,
});

function environment(controls = {}) {
  const calls = []; let current;
  const db = { async rpc(name, args) {
    const call = { name, args: structuredClone(args) }; calls.push(call); await controls.before?.(call, env);
    if (controls.error) return { data: null, error: { message: 'transport' } };
    const active = name !== 'web_prepare_packet_client_intake_completion';
    const data = { request_id: args.p_request_id, client_id: args.p_client_id, status: active ? 'active' : 'prepared',
      lead_updated_at: args.p_expected_lead_updated_at ?? time,
      ...(active ? { row: { id: args.p_client_id, tenant_id: args.p_tenant_id, status: 'active', updated_by: args.p_actor_profile_id } } : {}),
    };
    const result = controls.mutate?.(structuredClone(data), call) ?? data;
    return { data: result, error: null };
  } };
  current = db;
  const functions = new Function('getSupabaseClient', 'isUuid', `${source};return {prepareClientIntakeCompletion,finalizeClientIntakeCompletion,confirmClientIntakeCompletion};`)(() => current, isUuid);
  const env = { db, calls, functions, setCurrent(value) { current = value; } };
  return env;
}

test('preparation captures the full professional decision before transport and accepts only its exact prepared receipt', async () => {
  const form = validForm(), e = environment({ before: () => { form.intakeCareNeedSummary = 'changed after dispatch'; } });
  const result = await e.functions.prepareClientIntakeCompletion(id(1), id(3), id(2), id(80), id(81), time, form, id(82));
  assert.equal(result.ok, true); const call = e.calls[0];
  assert.equal(call.name, 'web_prepare_packet_client_intake_completion');
  assert.equal(call.args.p_decision.care_need_summary, 'Pflegebedarf wurde vollständig geprüft.');
  assert.equal(call.args.p_decision.admission_decision, 'accepted');
  assert.equal(call.args.p_document_request_id,id(82));
});

for (const [label, patch] of [
  ['care need', { intakeCareNeedSummary: 'short' }], ['capacity', { intakeCapacityStatus: 'not_confirmed' }],
  ['capacity reference', { intakeCapacityReference: '' }], ['admission decision', { intakeAdmissionDecision: 'pending' }],
  ['admission reason', { intakeAdmissionDecisionReason: 'short' }], ['start date', { serviceStart: '' }],
  ['contract basis', { intakeContractType: '' }],
]) test(`missing ${label} fails before every RPC`, async () => {
  const e = environment(); assert.equal((await e.functions.prepareClientIntakeCompletion(id(1), id(3), id(2), id(80), id(81), time, validForm(patch), id(82))).ok, false);
  assert.equal(e.calls.length, 0);
});

test('a replaced SDK instance invalidates an otherwise matching preparation response', async () => {
  const replacement = { rpc: async () => ({ data: null, error: null }) };
  const e = environment({ before: () => e.setCurrent(replacement) });
  assert.equal((await e.functions.prepareClientIntakeCompletion(id(1), id(3), id(2), id(80), id(81), time, validForm(), id(82))).ok, false);
  assert.equal(e.calls.length, 1);
});

for (const mutate of [
  data => ({ ...data, client_id: id(9) }), data => ({ ...data, request_id: id(9) }),
  data => ({ ...data, status: 'active' }), data => ({ ...data, lead_updated_at: 'not-a-time' }),
]) test('a malformed preparation receipt never confirms the request', async () => {
  const e = environment({ mutate });
  assert.equal((await e.functions.prepareClientIntakeCompletion(id(1), id(3), id(2), id(80), id(81), time, validForm(), id(82))).ok, false);
});

test('finalization requires the exact active client row returned with the receipt', async () => {
  const e = environment();
  assert.equal((await e.functions.finalizeClientIntakeCompletion(id(1), id(3), id(2), id(80), time)).ok, true);
  const wrong = environment({ mutate: data => ({ ...data, row: { ...data.row, updated_by: id(9) } }) });
  assert.equal((await wrong.functions.finalizeClientIntakeCompletion(id(1), id(3), id(2), id(80), time)).ok, false);
});

test('read-only reload confirmation accepts only a durable active receipt and exact native row', async () => {
  const e = environment(); assert.equal((await e.functions.confirmClientIntakeCompletion(id(1), id(3), id(2), id(80))).ok, true);
  const prepared = environment({ mutate: data => ({ ...data, status: 'prepared' }) });
  assert.equal((await prepared.functions.confirmClientIntakeCompletion(id(1), id(3), id(2), id(80))).ok, false);
  assert.equal(prepared.calls.length, 1);
});
