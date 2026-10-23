export type KimReceiveCursor = { createdAt: number; requestId: string };
export const KIM_RECEIVE_PAGE_SIZE = 10;
export type KimHostCommand = { tenantId: string } & ({ action: 'status'; requestId?: never; before?: never }
  | { action: 'start' | 'receive-start' | 'receive-status'; requestId: string; before?: never }
  | { action: 'receive-list'; before?: KimReceiveCursor | null; requestId?: never });
export type KimReceiveStatus = {
  version: 1; kind: 'card-receive'; tenantId: string; requestId: string; mailboxId: string; messageId: string; originalSha256: string;
  environment: 'test' | 'production'; state: 'prepared' | 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: number; startedAt: number | null; completedAt: number | null; reviewRequired: boolean; canStart: boolean; nextStartAt: number | null;
  errorCode: string | null; result: { kind: 'diagnostic' | 'unprotected'; sha256: string; octets: number; diagnosisCode: string | null;
    cardState: 'checked' | 'rejected' | null; cardStage: string | null; documentResult: 'VALID' | 'INVALID' | 'INCONCLUSIVE' | null;
    verificationReportSha256: string | null; identityStatus: 'unverified'; deliveryStatus: 'diagnostic-only' | 'unprotected';
    hardwareEvidence: 'not-attested'; tiEvidence: 'not-attested' } | null;
};
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const time = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const member = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const cursor = (v: unknown): v is KimReceiveCursor => {
  const c = object(v);
  return Object.keys(c).length === 2 && time(c.createdAt) && Number(c.createdAt) <= 8640000000000000 && uuid(c.requestId);
};
const sameCursor = (a: KimReceiveCursor | null, b: KimReceiveCursor | null) => a === null ? b === null
  : b !== null && a.createdAt === b.createdAt && a.requestId === b.requestId;
const older = (a: KimReceiveCursor, b: KimReceiveCursor) => a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.requestId < b.requestId);
export function readKimHostCommand(value: unknown): KimHostCommand {
  const v = object(value);
  if (JSON.stringify(v).length > 2048 || Object.keys(v).some(k => !['tenantId','action','requestId','before'].includes(k)) || !uuid(v.tenantId)
    || !member(v.action, ['status','start','receive-start','receive-status','receive-list'])
    || (v.action === 'status' || v.action === 'receive-list' ? v.requestId !== undefined : !uuid(v.requestId))
    || (v.action === 'receive-list' ? v.before !== undefined && v.before !== null && !cursor(v.before) : v.before !== undefined)) throw new Error('KIM_HOST_INPUT');
  return structuredClone(v) as KimHostCommand;
}
/** Metadata only. Unknown fields (including original mail/XML/certificates) are
 * rejected, and the response must belong to this exact tenant AND request. */
export function readKimReceiveStatus(value: unknown, tenantId: string, requestId: string): KimReceiveStatus {
  const s = object(value), reject = (): never => { throw new Error('KIM_HOST_RESPONSE'); };
  if (JSON.stringify(s).length > 8192 || Object.keys(s).some(k => !['version','kind','tenantId','requestId','mailboxId','messageId','originalSha256','environment','state',
    'createdAt','startedAt','completedAt','reviewRequired','canStart','nextStartAt','errorCode','result'].includes(k))
    || s.version !== 1 || s.kind !== 'card-receive' || !uuid(tenantId) || !uuid(requestId) || s.tenantId !== tenantId || s.requestId !== requestId
    || !uuid(s.mailboxId) || !uuid(s.messageId) || !hash(s.originalSha256) || !member(s.environment, ['test','production'])
    || !member(s.state, ['prepared','running','completed','failed','interrupted']) || !time(s.createdAt)
    || typeof s.reviewRequired !== 'boolean' || typeof s.canStart !== 'boolean') reject();
  if (s.nextStartAt !== null && (!time(s.nextStartAt) || s.state !== 'prepared' || s.canStart)) reject();
  if (s.state === 'prepared') {
    if (s.startedAt !== null || s.completedAt !== null || s.reviewRequired) reject();
  } else if (!time(s.startedAt) || Number(s.startedAt) < Number(s.createdAt) || s.canStart) reject();
  if (member(s.state, ['running','interrupted']) && (s.completedAt !== null || (s.state === 'running' && !s.reviewRequired))) reject();
  if (member(s.state, ['failed','completed']) && (!time(s.completedAt) || Number(s.completedAt) < Number(s.startedAt))) reject();
  if (s.state === 'failed') {
    if (typeof s.errorCode !== 'string' || !/^KIM_(?:HOST|CONNECTOR|MESSAGE|TSL|VZD|OCSP|RECEIVE)_[A-Z_]{1,64}$/.test(s.errorCode)) reject();
  } else if (s.errorCode !== null) reject();
  if (s.state === 'completed') {
    const r = object(s.result);
    if (Object.keys(r).some(k => !['kind','sha256','octets','diagnosisCode','cardState','cardStage','documentResult','verificationReportSha256','identityStatus','deliveryStatus','hardwareEvidence','tiEvidence'].includes(k))
      || !member(r.kind, ['diagnostic','unprotected']) || !hash(r.sha256) || !Number.isSafeInteger(r.octets) || Number(r.octets) < 1 || Number(r.octets) > 23_068_672
      || r.identityStatus !== 'unverified' || r.hardwareEvidence !== 'not-attested' || r.tiEvidence !== 'not-attested') reject();
    if (r.kind === 'unprotected') {
      if (r.deliveryStatus !== 'unprotected' || ['diagnosisCode','cardState','cardStage','documentResult','verificationReportSha256'].some(k => r[k] !== null) || s.reviewRequired) reject();
    } else if (r.deliveryStatus !== 'diagnostic-only' || typeof r.diagnosisCode !== 'string' || !/^(?:XCS_[A-Z_]{1,32}|\d{2,4})$/.test(r.diagnosisCode)
      || !member(r.cardState, ['checked','rejected'])
      || !member(r.cardStage, ['mime','card','decrypt','headers','certificate','document','directory','card-recheck','complete'])
      || (r.cardState === 'checked' && (r.cardStage !== 'complete' || r.documentResult !== 'VALID' || s.reviewRequired))) reject();
    if (r.documentResult !== null && !member(r.documentResult, ['VALID','INVALID','INCONCLUSIVE'])) reject();
    if ((r.documentResult === null) !== (r.verificationReportSha256 === null) || (r.verificationReportSha256 !== null && !hash(r.verificationReportSha256))) reject();
  } else if (s.result !== null) reject();
  return structuredClone(s) as KimReceiveStatus;
}

export type KimReceiveList = {
  version: 1; kind: 'card-receive-list'; tenantId: string; configured: boolean;
  environment: 'test' | 'production' | null; mailboxId: string | null;
  canStart: boolean; blockReason: 'active' | 'review' | 'cooldown' | null; nextStartAt: number | null;
  before: KimReceiveCursor | null; nextCursor: KimReceiveCursor | null; items: KimReceiveStatus[];
};
export function unconfiguredKimReceiveList(tenantId: string, before: KimReceiveCursor | null = null): KimReceiveList {
  return { version: 1, kind: 'card-receive-list', tenantId, configured: false, environment: null, mailboxId: null,
    canStart: false, blockReason: null, nextStartAt: null, before, nextCursor: null, items: [] };
}
/** One bounded page, tied to the requested tenant and keyset cursor. A malformed
 * row rejects the whole page; no partial list can hide a host-side review gate. */
export function readKimReceiveList(value: unknown, tenantId: string, before: KimReceiveCursor | null = null): KimReceiveList {
  const s = object(value), reject = (): never => { throw new Error('KIM_HOST_RESPONSE'); };
  if (JSON.stringify(s).length > 32768 || Object.keys(s).some(k => !['version','kind','tenantId','configured','environment','mailboxId',
    'canStart','blockReason','nextStartAt','before','nextCursor','items'].includes(k))
    || s.version !== 1 || s.kind !== 'card-receive-list' || !uuid(tenantId) || s.tenantId !== tenantId || typeof s.configured !== 'boolean'
    || typeof s.canStart !== 'boolean' || (before !== null && !cursor(before)) || (s.before !== null && !cursor(s.before))
    || !sameCursor(s.before as KimReceiveCursor | null, before) || (s.nextCursor !== null && !cursor(s.nextCursor))
    || !Array.isArray(s.items) || s.items.length > KIM_RECEIVE_PAGE_SIZE) reject();
  const items = s.items as unknown[];
  if (!s.configured) {
    if (s.environment !== null || s.mailboxId !== null || s.canStart || s.blockReason !== null || s.nextStartAt !== null || items.length || s.nextCursor !== null) reject();
  } else {
    if (!member(s.environment, ['test','production']) || !uuid(s.mailboxId)
      || (s.canStart ? s.blockReason !== null || s.nextStartAt !== null : !member(s.blockReason, ['active','review','cooldown']))
      || (s.blockReason === 'cooldown' ? !time(s.nextStartAt) : s.nextStartAt !== null)) reject();
    let previous = before; const requests = new Set<string>(), messages = new Set<string>();
    for (const item of items) {
      const job = readKimReceiveStatus(item, tenantId, object(item).requestId as string);
      if (job.mailboxId !== s.mailboxId || job.environment !== s.environment || (previous && !older(job, previous)) || requests.has(job.requestId) || messages.has(job.messageId)
        || job.canStart !== (job.state === 'prepared' && s.canStart)
        || job.nextStartAt !== (job.state === 'prepared' ? s.nextStartAt : null)) reject();
      previous = job; requests.add(job.requestId); messages.add(job.messageId);
    }
    if (s.nextCursor !== null && (items.length !== KIM_RECEIVE_PAGE_SIZE || !sameCursor(s.nextCursor as KimReceiveCursor, previous))) reject();
  }
  return structuredClone(s) as KimReceiveList;
}
