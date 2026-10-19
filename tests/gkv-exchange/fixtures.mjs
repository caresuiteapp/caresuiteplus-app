import { blankDraft, blankCase } from '../../src/lib/gkvExchange/model.ts';
export const tenantId = '11111111-1111-4111-8111-111111111111';
export const batchId = '22222222-2222-4222-8222-222222222222';
export const userId = '33333333-3333-4333-8333-333333333333';
export const invoiceId = '44444444-4444-4444-8444-444444444444';
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
