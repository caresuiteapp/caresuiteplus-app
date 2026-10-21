import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientRecordView } from './clientRecordService';
import type { ClientParentReadScope } from './clientRecordRead.web';
import { woundUuid } from '../pflege/woundCareDomain.ts';

export type ClientRecordAction = 'edit' | 'recovery' | 'archive' | 'delete';
export type ClientRecordActionOriginal = Readonly<{
  scopeKey: string; owner: object; recordTicket: number; fullTicket: number;
  record: ClientRecordView; full: ClientFullDetail; scope: ClientParentReadScope;
}>;
export type ClientRecordActionTicket = Readonly<{
  action: ClientRecordAction; original: ClientRecordActionOriginal; nativeOwner: string; epoch: number; lifetime: number;
}>;
export type ClientRecordActionAttempt = Readonly<{ ticket: ClientRecordActionTicket }>;
type Outcome = 'pending' | 'acknowledged' | 'blocked' | 'uncertain';
type AttemptState = { outcome: Outcome; error: string | null };
type Access = {
  original: ClientRecordActionOriginal | null;
  liveOriginal: () => ClientRecordActionOriginal | null;
  livePermission: (action: ClientRecordAction) => boolean;
  canEdit: boolean; canArchive: boolean; canDelete: boolean;
};
const actions: ClientRecordAction[] = ['edit', 'recovery', 'archive', 'delete'];
const roles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
export const CLIENT_RECORD_ACTION_DENIED = 'Die Aktion benötigt die aktuelle eigene Originalakte und das zugehörige Aktionsrecht.';
export const CLIENT_RECORD_WRITE_UNCERTAIN = 'Der Schreibausgang ist nicht sicher bestätigt. Bitte den aktuellen Aktenstand prüfen. Die Aktion wird nicht automatisch wiederholt.';
export const CLIENT_RECORD_LIVE_ARCHIVE_BLOCK = 'Direkte Archivierung ist gesperrt. Bitte „Kündigung & Offboarding“ verwenden.';

/** Compare both whole delivered originals and the native read generation, never the identity of a newly returned receipt wrapper. */
export function sameClientRecordActionOriginal(a: ClientRecordActionOriginal | null, b: ClientRecordActionOriginal | null): boolean {
  return !!a && !!b && a.scopeKey === b.scopeKey && a.owner === b.owner && a.recordTicket === b.recordTicket
    && a.fullTicket === b.fullTicket && a.record === b.record && a.full === b.full;
}
function nativeOwner(original: ClientRecordActionOriginal | null): string | null {
  if (!original || !original.owner || typeof original.owner !== 'object' || typeof original.scopeKey !== 'string'
    || !Number.isSafeInteger(original.recordTicket) || original.recordTicket < 1 || !Number.isSafeInteger(original.fullTicket) || original.fullTicket < 1) return null;
  const scope = original.scope;
  if (!scope || scope.canRead !== true || scope.key !== original.scopeKey || !woundUuid(scope.tenantId) || !woundUuid(scope.clientId)
    || !woundUuid(scope.actorId) || !roles.has(scope.role) || !original.record || !original.full || !Object.isFrozen(original.record)
    || !Object.isFrozen(original.full) || original.record.detail?.id !== scope.clientId || original.record.detail.tenantId !== scope.tenantId
    || original.full.id !== scope.clientId || original.full.tenantId !== scope.tenantId || original.full.core?.id !== scope.clientId
    || original.full.core.tenantId !== scope.tenantId) return null;
  return JSON.stringify([scope.tenantId, scope.clientId, scope.actorId, scope.role]);
}
function permitted(access: Access, action: ClientRecordAction): boolean {
  const supplied = action === 'delete' ? access.canDelete === true : action === 'archive' ? access.canArchive === true : access.canEdit === true;
  try { return supplied && access.livePermission(action) === true; } catch { return false; }
}

/** Private mounted Web parent boundary. Shared services retain their own internal awaits and actual native outcomes. */
export class ClientRecordActionGuard {
  private access: Access = { original: null, liveOriginal: () => null, livePermission: () => false, canEdit: false, canArchive: false, canDelete: false };
  private live = false;
  private lifetime = 0;
  private epochs: Record<ClientRecordAction, number> = { edit: 0, recovery: 0, archive: 0, delete: 0 };
  private tickets = new Map<ClientRecordAction, ClientRecordActionTicket>();
  private minted = new WeakSet<ClientRecordActionTicket>();
  private attempts = new WeakMap<ClientRecordActionAttempt, AttemptState>();
  private ownerAttempts = new Map<string, ClientRecordActionAttempt>();

  mount(): void { if (!this.live) { this.live = true; this.lifetime++; this.tickets.clear(); } }
  dispose(): void { this.live = false; this.lifetime++; this.tickets.clear(); }
  get mounted(): boolean { return this.live; }
  update(access: Access): void {
    const originalChanged = !sameClientRecordActionOriginal(this.access.original, access.original);
    for (const action of actions) {
      if (originalChanged || permitted(this.access, action) !== permitted(access, action)) {
        this.epochs[action]++; this.tickets.delete(action);
      }
    }
    this.access = { ...access, canEdit: access.canEdit === true, canArchive: access.canArchive === true, canDelete: access.canDelete === true };
  }
  private liveOriginal(): ClientRecordActionOriginal | null {
    if (!this.live) return null;
    try {
      const original = this.access.liveOriginal();
      return sameClientRecordActionOriginal(original, this.access.original) && nativeOwner(original) !== null ? original : null;
    } catch { return null; }
  }
  private currentPermission(action: ClientRecordAction): boolean {
    if (permitted(this.access, action)) return true;
    if (this.tickets.has(action)) { this.epochs[action]++; this.tickets.delete(action); }
    return false;
  }
  private writeBlocked(owner: string, original: ClientRecordActionOriginal): boolean {
    const attempt = this.ownerAttempts.get(owner), state = attempt && this.attempts.get(attempt);
    if (!attempt || !state) return false;
    return state.outcome === 'pending' || state.outcome === 'uncertain'
      || state.outcome === 'acknowledged' && (attempt.ticket.action === 'delete' || sameClientRecordActionOriginal(attempt.ticket.original, original));
  }
  capture(action: ClientRecordAction): ClientRecordActionTicket | null {
    if (!actions.includes(action)) return null;
    const original = this.liveOriginal(), owner = nativeOwner(original);
    if (!original || !owner || !this.currentPermission(action) || (action === 'edit' || action === 'recovery') && original.scope.canEdit !== true) return null;
    const existing = this.tickets.get(action);
    if (existing && this.current(existing)) return existing;
    const ticket = Object.freeze({ action, original: Object.freeze({ ...original, scope: Object.freeze({ ...original.scope }) }), nativeOwner: owner,
      epoch: this.epochs[action], lifetime: this.lifetime });
    this.minted.add(ticket); this.tickets.set(action, ticket);
    return ticket;
  }
  /** Current original/right/lifetime only. Outcome follow-ups additionally require their own confirmed attempt. */
  current(ticket: ClientRecordActionTicket | null): boolean {
    if (!ticket || !this.minted.has(ticket) || !this.live || ticket.lifetime !== this.lifetime || ticket.epoch !== this.epochs[ticket.action]
      || !this.currentPermission(ticket.action)) return false;
    const original = this.liveOriginal();
    return sameClientRecordActionOriginal(ticket.original, original) && nativeOwner(original) === ticket.nativeOwner
      && (ticket.action !== 'edit' && ticket.action !== 'recovery' || original?.scope.canEdit === true);
  }
  mayLaunch(ticket: ClientRecordActionTicket | null): boolean {
    return !!ticket && this.current(ticket) && !this.writeBlocked(ticket.nativeOwner, ticket.original);
  }
  begin(ticket: ClientRecordActionTicket | null): ClientRecordActionAttempt | null {
    if (!ticket || ticket.action === 'edit' || !this.current(ticket) || this.writeBlocked(ticket.nativeOwner, ticket.original)) return null;
    const attempt = Object.freeze({ ticket });
    this.attempts.set(attempt, { outcome: 'pending', error: null });
    this.ownerAttempts.set(ticket.nativeOwner, attempt);
    return attempt;
  }
  /** A negative shared result does not prove that none of its earlier native steps wrote. Known no-write is reserved for the explicit live archive hard block. */
  finish(attempt: ClientRecordActionAttempt, result: unknown, knownNoWrite = false): Outcome | null {
    const state = this.attempts.get(attempt);
    if (!state || state.outcome !== 'pending') return null;
    let ok = false, rejected = false, error: string | null = null;
    try {
      const okField = result && typeof result === 'object' ? Object.getOwnPropertyDescriptor(result, 'ok') : null;
      const errorField = result && typeof result === 'object' ? Object.getOwnPropertyDescriptor(result, 'error') : null;
      ok = !!okField && Object.hasOwn(okField, 'value') && okField.value === true;
      rejected = !!okField && Object.hasOwn(okField, 'value') && okField.value === false;
      error = errorField && Object.hasOwn(errorField, 'value') && typeof errorField.value === 'string' ? errorField.value : null;
    } catch { /* A malformed transport outcome cannot establish an acknowledgement. */ }
    if (ok) { state.outcome = 'acknowledged'; state.error = null; }
    else if (knownNoWrite === true && rejected && attempt.ticket.action === 'archive' && error === CLIENT_RECORD_LIVE_ARCHIVE_BLOCK) {
      state.outcome = 'blocked'; state.error = error;
      if (this.ownerAttempts.get(attempt.ticket.nativeOwner) === attempt) this.ownerAttempts.delete(attempt.ticket.nativeOwner);
    } else { state.outcome = 'uncertain'; state.error = error ? `${CLIENT_RECORD_WRITE_UNCERTAIN} ${error}` : CLIENT_RECORD_WRITE_UNCERTAIN; }
    return state.outcome;
  }
  /** A private controller may prove that exactly this pending attempt never began
   * a mutation. A lost read/right grants no UI access and does not erase that proof. */
  finishUnstarted(attempt: ClientRecordActionAttempt, proof: () => boolean): Outcome | null {
    const state = this.attempts.get(attempt);
    if (!this.live || !state || state.outcome !== 'pending' || !this.minted.has(attempt.ticket)
      || attempt.ticket.lifetime !== this.lifetime || this.ownerAttempts.get(attempt.ticket.nativeOwner) !== attempt) return null;
    try { if (typeof proof !== 'function' || proof() !== true) return null; } catch { return null; }
    if (!this.live || attempt.ticket.lifetime !== this.lifetime || state.outcome !== 'pending'
      || this.ownerAttempts.get(attempt.ticket.nativeOwner) !== attempt) return null;
    state.outcome = 'blocked'; state.error = null;
    this.ownerAttempts.delete(attempt.ticket.nativeOwner);
    return state.outcome;
  }
  acknowledged(attempt: ClientRecordActionAttempt | null): boolean {
    return !!attempt && this.attempts.get(attempt)?.outcome === 'acknowledged';
  }
  error(attempt: ClientRecordActionAttempt): string | null { return this.attempts.get(attempt)?.error ?? null; }
  mayFollowup(attempt: ClientRecordActionAttempt | null): boolean {
    return !!attempt && this.acknowledged(attempt) && this.current(attempt.ticket);
  }
  mayNotify(attempt: ClientRecordActionAttempt): boolean {
    return this.live && nativeOwner(this.liveOriginal()) === attempt.ticket.nativeOwner;
  }
  status(): { busy: boolean; blocked: boolean; warning: string | null; pendingAction: ClientRecordAction | null } {
    const original = this.liveOriginal(), owner = nativeOwner(original);
    if (!original || !owner) return { busy: false, blocked: true, warning: null, pendingAction: null };
    const attempt = this.ownerAttempts.get(owner), state = attempt && this.attempts.get(attempt);
    const warning = state?.outcome === 'uncertain'
      ? sameClientRecordActionOriginal(attempt!.ticket.original, original) ? state.error : CLIENT_RECORD_WRITE_UNCERTAIN : null;
    return { busy: state?.outcome === 'pending', blocked: this.writeBlocked(owner, original), warning,
      pendingAction: state?.outcome === 'pending' ? attempt!.ticket.action : null };
  }
}
