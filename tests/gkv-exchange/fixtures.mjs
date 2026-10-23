import { blankDraft, blankCase } from '../../src/lib/gkvExchange/model.ts';
import { importInvoiceCase } from '../../src/lib/gkvExchange/sources.ts';
import { createHash } from 'node:crypto';
export const tenantId = '11111111-1111-4111-8111-111111111111';
export const batchId = '22222222-2222-4222-8222-222222222222';
export const userId = '33333333-3333-4333-8333-333333333333';
export const invoiceId = '44444444-4444-4444-8444-444444444444';
export const itemId = '55555555-5555-4555-8555-555555555555';
export const recordId = '66666666-6666-4666-8666-666666666666';
export const pdfBytes = Buffer.from('%PDF-1.7\nFictional integrity fixture only\n%%EOF');
export function linkedFixture({proof=false,record=false}={}) {
  const source = { id:invoiceId,tenant_id:tenantId,updated_at:'2026-10-18T10:00:00Z',status:'issued',invoice_number:'RE2026-1',invoice_date:'2026-10-18',total_amount:'80.00',client_id:userId,
    service_period_from:'2026-10-01',service_period_to:'2026-10-31',selected_proof_ids:proof?[`record:${recordId}`]:[],
    client:{id:userId,tenant_id:tenantId,first_name:'Erika',last_name:'Mustermann',date_of_birth:'1950-01-01',insurance_number:'A123456789',care_level:'2'},
    items:[{id:itemId,tenant_id:tenantId,invoice_id:invoiceId,updated_at:'2026-10-18T10:00:00Z',service_record_id:record?recordId:null,description:'Fiktive Beratung',service_date:'2026-10-16',quantity:'1.00',unit:'Stück',unit_price:'80.00',net_amount:'80.00',gross_amount:'80.00',vat_amount:'0.00',vat_rate:'0.00',sort_order:1}],
    records:record?[{id:recordId,tenant_id:tenantId,client_id:userId,updated_at:'2026-10-18T09:00:00Z',service_date:'2026-10-16',actual_minutes:60,billable_minutes:60,status:'billed',billed_invoice_id:invoiceId,source_receipt:{}}]:[],
    proofs:proof?[{id:`record:${recordId}`,updated_at:'2026-10-18T09:00:00Z',service_date:'2026-10-16',path:`tenant/${tenantId}/proofs/example.pdf`,sha256:createHash('sha256').update(pdfBytes).digest('hex')}]:[],
  };
  const draft=fixture();const original=draft.cases[0];draft.cases=[importInvoiceCase(source,'2026-10')];
  Object.assign(draft.cases[0],{documentNumber:original.documentNumber,proofConfirmed:true});
  Object.assign(draft.cases[0].lines[0],original.lines[0]);
  return {draft,source};
}
/** Deliberately fictional data. Never submit these fixtures to an insurer. */
export function fixture() {
  const draft = blankDraft(new Date('2026-10-19T10:15:30.000Z'));
  Object.assign(draft.profile, { providerIk: '123456789', senderIk: '123456789', name: 'Musterpflege GmbH', billingCode: '11', tariffCode: '05001', taxExemptionCode: '01' });
  Object.assign(draft, { payerIk: '181234567', insuranceIk: '181234567', receiverIk: '109876543', physicalReceiverIk: '109876543' });
  const item = blankCase('2026-10', '2026-10-18');
  Object.assign(item, { invoiceNumber: 'RE2026-1', documentNumber: 'BELEG1', insuranceNumber: 'A123456789', firstName: 'Erika', lastName: 'Mustermann', birthDate: '1950-01-01', careGrade: '2', proofConfirmed: true, grossCents: 8000 });
  item.lines = [{ day: '16', remuneration: '08', qualification: '0', code: '1', duration: '00', unitPriceCents: 8000, quantityHundredths: 100, totalCents: 8000, employeeNumber: '123456789' }];
  draft.cases = [item];
  return draft;
}
export function catalog(messages) {
  return "UNB+UNOC:3+123456789+999999999+20261001:1200+1++EKPFL202610'" + messages.map((body, index) => {
    const count = body.split("'").filter(Boolean).length + 2;
    return `UNH+${index + 1}+KOTR:02'${body}UNT+${String(count).padStart(6, '0')}+${index + 1}'`;
  }).join('') + `UNZ+${messages.length}+1'`;
}
export function directorySource({ kind = '03', delivery = '07', address = 'test@example.invalid', receiverUntil = '20270131', protocol = '070' } = {}) {
  return catalog([
    "IDK+181234567+99+Pflegekasse'VDT+20260501+20270131'FKT+04'VKG+01+182345678+6'NAM+01+Pflegekasse'",
    `IDK+182345678+99+Kostentraeger'VDT+20260501+20270131'FKT+04'VKG+${kind}+109876543+6++${delivery}+1+05++09'NAM+01+Kostentraeger'`,
    `IDK+109876543+99+Annahmestelle'VDT+20260501+${receiverUntil}'FKT+04'NAM+01+Annahmestelle'UEM+1+01+I1'VDT+20260501+20270131'DFU+01+${protocol}+++++${address}'`,
  ]);
}
