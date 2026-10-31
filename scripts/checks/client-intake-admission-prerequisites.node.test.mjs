import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { currentIntakeValidation } from './helpers/current-intake-validation.mjs';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const body = path => stripTypeScriptTypes(read(path)
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export\s*\{[\s\S]*?\}\s*(?:from\s+[^;]+)?;\n/gm, '')
  .replace(/\bexport /g, ''));
const empty = new Function(`${body('src/types/forms/clientIntakeForm.ts')};return EMPTY_CLIENT_INTAKE_FORM;`)();
const documentTypes = new Function(`${body('src/features/intakeDocuments/intakeDocumentTypes.ts')};return {ASSIGNMENT_TEMPLATE_KEY,PRIVACY_TEMPLATE_KEY,CARE_CONTEXT_TO_SERVICE_TYPE,CONTRACT_TEMPLATE_BY_SERVICE_TYPE};`)();
const resolveContracts = new Function(...Object.keys(documentTypes), `${body('src/features/intakeDocuments/buildIntakeDocumentContext.ts')};return resolveContractTemplateKeys;`)(...Object.values(documentTypes));
const validateDocuments = new Function('ASSIGNMENT_TEMPLATE_KEY', 'PRIVACY_TEMPLATE_KEY', 'resolveContractTemplateKeys',
  `${body('src/features/intakeDocuments/validateIntakeDocuments.ts')};return validateIntakeDocumentsStep;`)(
  documentTypes.ASSIGNMENT_TEMPLATE_KEY, documentTypes.PRIVACY_TEMPLATE_KEY, resolveContracts,
);
const admission = patch => ({ ...structuredClone(empty), intakeCareNeedSummary: 'Pflegebedarf fachlich vollständig dokumentiert.',
  intakeCapacityStatus: 'confirmed', intakeCapacityReference: 'Dienstplan CAP-17', intakeAdmissionDecision: 'accepted',
  intakeAdmissionDecisionReason: 'Aufnahme durch die zuständige Fachkraft freigegeben.', serviceStart:'2026-10-22',intakeContractType:'ambulatory_care', ...patch });
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function completion(){
 const calls=[],db={async rpc(name,args){calls.push([name,structuredClone(args)]);return{error:null,data:{client_id:id(3),request_id:id(4),status:'prepared',lead_updated_at:'2026-10-22T09:00:00.123456Z'}};}};
 const prepare=new Function('getSupabaseClient','isUuid',`${body('src/lib/clients/repositories/clientIntakeCompletionRepository.supabase.web.ts')};return prepareClientIntakeCompletion;`)(()=>db,isUuid);
 return{calls,prepare:form=>prepare(id(1),id(3),id(2),id(4),id(5),'2026-10-22T09:00:00.123456Z',form,id(6))};
}

test('the actual prepared completion requires care need, capacity evidence and an explicit reasoned admission decision before RPC', async () => {
  const valid=completion();assert.equal((await valid.prepare(admission())).ok,true);assert.equal(valid.calls.length,1);
  assert.equal(valid.calls[0][0],'web_prepare_packet_client_intake_completion');
  for (const [field, value] of [
    ['intakeCareNeedSummary', 'kurz'], ['intakeCapacityStatus', 'not_confirmed'], ['intakeCapacityReference', ''],
    ['intakeAdmissionDecision', 'pending'], ['intakeAdmissionDecisionReason', 'kurz'],
    ['serviceStart',''],['intakeContractType',''],
  ]) {const h=completion();assert.equal((await h.prepare(admission({ [field]: value }))).ok,false,field);assert.equal(h.calls.length,0,field);}
});
test('the current shared intake validator still checks the selected ambulatory intake fields',()=>{
 const form=admission({careContexts:['ambulatory_care'],firstName:'Anna',lastName:'Meyer',dateOfBirth:'1940-02-29'});
 assert.deepEqual(currentIntakeValidation.validateIntakeStep('stammdaten',form),{});
 assert.ok(Object.hasOwn(currentIntakeValidation.validateIntakeStep('stammdaten',{...form,serviceStart:''}),'serviceStart'));
 assert.ok(Object.hasOwn(currentIntakeValidation.validateIntakeStep('versorgung',form),'familyDoctor'));
});

const template = (templateKey, documentType, signatureRoles) => ({ templateKey, documentType, title: templateKey,
  signatureSlots: signatureRoles.map(role => ({ role, required: true })) });
const doc = (templateKey, documentType, signatures) => ({ templateKey, documentType, title: templateKey,
  status: 'finalized', missingPlaceholders: [], signatures });
const signed = role => ({ role, dataUrl: `data:image/png;base64,${role}`, signedAt: '2026-10-15T09:40:00.123456+00:00' });

test('privacy and contract are blocking prerequisites, including both required contract signatures', () => {
  const templates = [template('privacy_consent_default', 'privacy_consent', ['client']), template('client_contract_ambulatory_care', 'client_contract', ['client', 'employee'])];
  const form = admission({ intakeContractType: 'ambulatory_care', intakeAssignmentEnabled: false, intakeOptionalConsents: [], intakeDocuments: [
    doc('privacy_consent_default', 'privacy_consent', { client: signed('client') }),
    doc('client_contract_ambulatory_care', 'client_contract', { client: signed('client'), employee: signed('employee') }),
  ] });
  assert.equal(validateDocuments(form, templates).ok, true);
  delete form.intakeDocuments[1].signatures.employee;
  const blocked = validateDocuments(form, templates);
  assert.equal(blocked.ok, false); assert.match(blocked.errors.intakeContract, /Mitarbeitende/);
  assert.deepEqual(blocked.warnings, {});
});
