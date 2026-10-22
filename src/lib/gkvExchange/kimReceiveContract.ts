export type KimHostCommand = { tenantId: string } & ({ action: 'status'; requestId?: never }
  | { action: 'start' | 'receive-start' | 'receive-status'; requestId: string });
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
export function readKimHostCommand(value: unknown): KimHostCommand {
  const v = object(value);
  if (JSON.stringify(v).length > 2048 || Object.keys(v).some(k => !['tenantId','action','requestId'].includes(k)) || !uuid(v.tenantId)
    || !member(v.action, ['status','start','receive-start','receive-status'])
    || (v.action === 'status' ? v.requestId !== undefined : !uuid(v.requestId))) throw new Error('KIM_HOST_INPUT');
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
