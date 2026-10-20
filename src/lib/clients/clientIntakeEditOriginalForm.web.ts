import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { mapClientEditLoadToIntakeForm as mapSharedForm } from './clientIntakeFormMappers';
import { captureClientParentDetail, type ClientParentReadScope } from './clientRecordRead.web';
import { captureClientNativeRoot, cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import { woundInstant } from '../pflege/woundCareDomain.ts';

type MapperInput = Parameters<typeof mapSharedForm>[0];
export type ClientIntakeEditOriginalForm = {
  form: ClientIntakeFormData;
  /** Private captured inputs only; never merge this evidence into form/UI fields.
   * Caller receipt/lifetime, read permissions and native write continuation are separate. */
  originals: Readonly<{ input: MapperInput; nativeClient: ClientNativeRow }>;
};
type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function dateInput(source: ClientNativeRow, key: 'admission_date' | 'service_start'): string {
  if (!Object.hasOwn(source, key)) throw Error('Das ursprüngliche native Datumsfeld fehlt im gelieferten Klientenbestand.');
  const value = source[key];
  // Null has only an empty input representation; the native original stays null.
  if (value === null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number(value.slice(0, 4)) < 1 || woundInstant(`${value}T00:00:00Z`) === null) {
    throw Error('Die ursprüngliche native Datumsangabe ist ungeklärt; kein Ersatzdatum übernehmen.');
  }
  return value;
}

/** Pure private Web projection of exactly supplied originals. This neither proves
 * a fresh/atomic read nor authorizes saving the rest of the form or its dates. */
export function captureClientIntakeEditOriginalForm(
  input: unknown, nativeClient: unknown, scope: ClientParentReadScope,
): ClientIntakeEditOriginalForm {
  const ownScope = cloneClientNativeOriginal(scope);
  const capturedInput = cloneClientNativeOriginal(input);
  const originalClient = captureClientNativeRoot(nativeClient, ownScope);
  if (!object(capturedInput) || !object(capturedInput.detail)
    || !Object.hasOwn(capturedInput.detail, 'id') || !Object.hasOwn(capturedInput.detail, 'tenantId')
    || capturedInput.detail.id !== ownScope.clientId || capturedInput.detail.tenantId !== ownScope.tenantId) {
    throw Error('Die gelieferte Formulargrundlage gehört nicht zum eigenen nativen Mandanten und Klienten.');
  }
  captureClientParentDetail(capturedInput.fullClient, ownScope);
  const admissionDate = dateInput(originalClient, 'admission_date');
  const serviceStart = dateInput(originalClient, 'service_start');
  const originals = freezeClientNativeOriginal({ input: capturedInput as unknown as MapperInput, nativeClient: originalClient });
  // Keep every other shared mapping value. A separate editable clone cannot mutate
  // raw metadata, unknown fields, arrays or the captured original mapper inputs.
  const form = cloneClientNativeOriginal(mapSharedForm(originals.input));
  form.admissionDate = admissionDate;
  form.serviceStart = serviceStart;
  return { form, originals };
}
