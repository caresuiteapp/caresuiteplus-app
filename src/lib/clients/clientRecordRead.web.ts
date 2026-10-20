import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientRecordView } from './clientRecordService';
import { woundUuid } from '../pflege/woundCareDomain.ts';

type Original = Record<string, unknown>;
export type ClientParentReadInput = {
  clientId: unknown; userId: unknown; profileId: unknown; profileTenant: unknown; profileRole: unknown;
  serviceTenant: unknown; runtimeTenant: unknown; runtimeRole: unknown; portalSession: boolean;
  canRead: boolean; canSensitive: boolean; canEdit: boolean;
};
export type ClientParentReadScope = {
  key: string; tenantId: string; clientId: string; actorId: string; role: string;
  canRead: boolean; canSensitive: boolean; canEdit: boolean;
};
const roles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
/** Supplied current runtime rights in the exact native Auth owner. This is not permission-response provenance or server authorization. */
export function clientParentReadScope(input: ClientParentReadInput): ClientParentReadScope {
  const canRead = woundUuid(input.clientId) && woundUuid(input.userId) && input.userId === input.profileId
    && woundUuid(input.profileTenant) && input.profileTenant === input.serviceTenant && input.profileTenant === input.runtimeTenant
    && typeof input.profileRole === 'string' && roles.has(input.profileRole) && input.profileRole === input.runtimeRole
    && input.portalSession === false && input.canRead === true;
  let key: string;
  try { key = JSON.stringify([input.clientId, input.userId, input.profileId, input.profileTenant, input.profileRole, input.serviceTenant, input.runtimeTenant, input.runtimeRole, input.portalSession, input.canRead, input.canSensitive]); }
  catch { key = 'invalid-native-scope'; }
  return {
    key,
    tenantId: typeof input.profileTenant === 'string' ? input.profileTenant : '',
    clientId: typeof input.clientId === 'string' ? input.clientId : '',
    actorId: typeof input.profileId === 'string' ? input.profileId : '',
    role: typeof input.profileRole === 'string' ? input.profileRole : '',
    canRead, canSensitive: canRead && input.canSensitive === true, canEdit: canRead && input.canEdit === true,
  };
}
const object = (value: unknown): value is Original => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
/** Clone every supplied original field before delivery; getters, holes and non-DTO objects cannot disappear. */
function cloneOriginal(value: unknown, seen = new Set<object>()): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if ((!object(value) && !(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype)) || seen.has(value as object)) throw Error('Der ganze gelieferte Aktenbestand ist nicht verlustfrei als Original-DTO lesbar.');
  seen.add(value as object);
  const output: Original | unknown[] = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  for (const key of Reflect.ownKeys(value as object)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !('value' in descriptor) || !descriptor.enumerable || Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) throw Error('Der ganze gelieferte Aktenbestand enthält ungeklärte Originalfelder.');
    Object.defineProperty(output, key, { value: cloneOriginal(descriptor.value, seen), enumerable: true, writable: true, configurable: true });
  }
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw Error('Der ganze gelieferte Aktenbestand enthält eine lückenhafte Originalhistorie.');
  seen.delete(value as object);
  return output;
}
function freezeOriginal(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) freezeOriginal((value as Original)[key]);
  Object.freeze(value);
}
function rowOwner(row: unknown, scope: ClientParentReadScope, needsTenant = true, addressFallback = false): void {
  if (!object(row) || !Object.hasOwn(row, 'id') || !woundUuid(row.id) && !(addressFallback && row.id === `addr-fallback-${scope.clientId}`)
    || !Object.hasOwn(row, 'clientId') || row.clientId !== scope.clientId
    || needsTenant && (!Object.hasOwn(row, 'tenantId') || row.tenantId !== scope.tenantId)
    || !needsTenant && Object.hasOwn(row, 'tenantId') && row.tenantId !== scope.tenantId) throw Error('Eine gelieferte Aktenzeile gehört nicht eindeutig zum eigenen nativen Mandanten und Klienten.');
}
function checkDetail(value: unknown, scope: ClientParentReadScope): asserts value is ClientFullDetail {
  if (!scope || scope.canRead !== true || !woundUuid(scope.tenantId) || !woundUuid(scope.clientId) || !woundUuid(scope.actorId) || !roles.has(scope.role) || !object(value) || !Object.hasOwn(value, 'id') || value.id !== scope.clientId || !Object.hasOwn(value, 'tenantId') || value.tenantId !== scope.tenantId) throw Error('Der angefragte eigene Mandanten- und Klientenbezug der Akte ist nicht bestätigt.');
  if (!object(value.core) || value.core.id !== scope.clientId || value.core.tenantId !== scope.tenantId
    || !Object.hasOwn(value.core, 'id') || !Object.hasOwn(value.core, 'tenantId')
    || !Array.isArray(value.core.diagnoses) || !value.core.diagnoses.every(v => typeof v === 'string') || !Array.isArray(value.addresses)) throw Error('Eigene native Stammdaten und Adresszuordnungen der gelieferten Akte sind nicht bestätigt.');
  // Validate known owner fields already defined by the DTO. Address IDs can be the existing mapper's opaque fallback IDs.
  for (const key of ['addresses', 'contacts', 'careLevels', 'budgets', 'contracts', 'risks', 'consents', 'portalAccess', 'documents', 'tasks', 'internalNotes', 'timeline']) {
    if (!Object.hasOwn(value, key)) continue;
    const pool = value[key];
    if (!Array.isArray(pool)) throw Error(`Der ganze gelieferte Aktenbestand „${key}“ hat ein ungeklärtes Format.`);
    const ids = new Set<string>();
    for (const row of pool) {
      rowOwner(row, scope, key !== 'timeline', key === 'addresses');
      const originalId = (row as Original).id as string, identity = woundUuid(originalId) ? originalId.toLowerCase() : originalId;
      if (ids.has(identity)) throw Error('Der ganze gelieferte Aktenbestand enthält doppelte native Zeilenkennungen.');
      ids.add(identity);
    }
  }
  for (const key of ['billingProfile', 'preferences', 'emergencyPlan', 'schedulingWishes']) if (Object.hasOwn(value, key) && value[key] !== null && value[key] !== undefined) rowOwner(value[key], scope);
}
/** Scope-check both independent originals; never normalize times, filter/sort history or infer completion. */
export function captureClientParentDetail(input: unknown, scope: ClientParentReadScope): ClientFullDetail {
  const original = cloneOriginal(input);
  checkDetail(original, scope);
  freezeOriginal(original);
  return original;
}
export function captureClientParentRecord(input: unknown, scope: ClientParentReadScope): ClientRecordView {
  const original = cloneOriginal(input);
  if (!object(original)) throw Error('Der ganze gelieferte Aktenbestand fehlt.');
  checkDetail(original.detail, scope);
  for (const key of ['careContexts', 'tabs']) {
    const list = original[key];
    if (!Array.isArray(list) || !list.every(v => typeof v === 'string' && v.trim().length > 0) || new Set(list).size !== list.length) throw Error('Die gelieferten Aktenbereiche sind nicht eindeutig bestätigt.');
  }
  freezeOriginal(original);
  return original as unknown as ClientRecordView;
}
