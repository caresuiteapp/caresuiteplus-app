import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const body = path => stripTypeScriptTypes(read(path)
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/^export\s*\{[\s\S]*?\}\s*(?:from\s+[^;]+)?;\n/gm, '')
  .replace(/\bexport /g, ''));
const empty = new Function(`${body('src/types/forms/clientIntakeForm.ts')};return EMPTY_CLIENT_INTAKE_FORM;`)();
const validate = new Function('getRequiredFieldsForClientContext', 'listApplicableIntakeTemplates', 'validateIntakeDocumentsStep',
  `${body('src/lib/clients/clientIntakeService.ts')};return validateIntakeStep;`)(() => [], () => [], () => ({ errors: {} }));
const validateDocuments = new Function('ASSIGNMENT_TEMPLATE_KEY', 'PRIVACY_TEMPLATE_KEY', 'resolveContractTemplateKey',
  `${body('src/features/intakeDocuments/validateIntakeDocuments.ts')};return validateIntakeDocumentsStep;`)(
  'assignment_declaration_care_health_insurance', 'privacy_consent_default', form => form.intakeContractType ? 'client_contract_default' : null,
);
const admission = patch => ({ ...structuredClone(empty), intakeCareNeedSummary: 'Pflegebedarf fachlich vollständig dokumentiert.',
  intakeCapacityStatus: 'confirmed', intakeCapacityReference: 'Dienstplan CAP-17', intakeAdmissionDecision: 'accepted',
  intakeAdmissionDecisionReason: 'Aufnahme durch die zuständige Fachkraft freigegeben.', ...patch });

test('the final review requires care need, capacity evidence and an explicit reasoned admission decision together', () => {
  assert.deepEqual(validate('pruefung', admission()), {});
  for (const [field, value] of [
    ['intakeCareNeedSummary', 'kurz'], ['intakeCapacityStatus', 'not_confirmed'], ['intakeCapacityReference', ''],
    ['intakeAdmissionDecision', 'pending'], ['intakeAdmissionDecisionReason', 'kurz'],
  ]) assert.ok(Object.hasOwn(validate('pruefung', admission({ [field]: value })), field));
});

const template = (templateKey, documentType, signatureRoles) => ({ templateKey, documentType, title: templateKey,
  signatureSlots: signatureRoles.map(role => ({ role, required: true })) });
const doc = (templateKey, documentType, signatures) => ({ templateKey, documentType, title: templateKey,
  status: 'finalized', missingPlaceholders: [], signatures });
const signed = role => ({ role, dataUrl: `data:image/png;base64,${role}`, signedAt: '2026-10-15T09:40:00.123456+00:00' });

test('privacy and contract are blocking prerequisites, including both required contract signatures', () => {
  const templates = [template('privacy_consent_default', 'privacy_consent', ['client']), template('client_contract_default', 'client_contract', ['client', 'employee'])];
  const form = admission({ intakeContractType: 'ambulant', intakeAssignmentEnabled: false, intakeOptionalConsents: [], intakeDocuments: [
    doc('privacy_consent_default', 'privacy_consent', { client: signed('client') }),
    doc('client_contract_default', 'client_contract', { client: signed('client'), employee: signed('employee') }),
  ] });
  assert.equal(validateDocuments(form, templates).ok, true);
  delete form.intakeDocuments[1].signatures.employee;
  const blocked = validateDocuments(form, templates);
  assert.equal(blocked.ok, false); assert.match(blocked.errors.intakeContract, /Mitarbeitende/);
  assert.deepEqual(blocked.warnings, {});
});
