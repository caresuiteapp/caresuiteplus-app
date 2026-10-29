import {readMonthlyAuthority,type MonthlyAuthority} from './monthlyAuthority';
import { UUID } from './sources';

export const MONTHLY_FILE_LIMIT = 2 * 1024 * 1024;
export const MONTHLY_WIRE_LIMIT = 2_850_000;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v) && v === v.toLowerCase();
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).length === allowed.length && Object.keys(v).every(k => allowed.includes(k));
function fail(): never { throw new Error('MONTHLY_ORIGINAL_CONTRACT'); }
export type MonthlyCapture = {tenantId: string; proofId: string; revision: number; captureId: string; authorityId?: string};
export type MonthlyOriginalCommand = MonthlyCapture & (
  {action: 'prepare' | 'read' | 'status' | 'archive'} |
  {action: 'acknowledge'; originalSha256: string} |
  {action: 'verify'; pngBase64: string}
);
export type MonthlyOriginalMeta = {captureId: string; proofId: string; revision: number; contentSha256: string;
  originalSha256: string; originalVersion: string; acknowledged: boolean; representative?: MonthlyAuthority};
export type MonthlyOriginalReceipt = {receiptId: string; captureId: string; proofId: string; revision: number; tenantId: string;
  actorId: string; contentSha256: string; originalSha256: string; signatureSha256: string};
type Envelope = MonthlyCapture & {version: 1; actorId: string};
export type MonthlyOriginalResponse = Envelope & (
  {kind: 'original'; original: MonthlyOriginalMeta; pdfBase64: string; archive: null | {status: 'final' | 'invalidated'; version: number; finalizedAt: string; invalidatedAt: string | null}} |
  {kind: 'acknowledged'; originalSha256: string} |
  {kind: 'receipt'; receipt: MonthlyOriginalReceipt} |
  {kind: 'state'; state: 'absent' | 'prepared' | 'acknowledged' | 'verified'; original: MonthlyOriginalMeta | null; receipt: MonthlyOriginalReceipt | null}
);
export function monthlyBase64(value: unknown, max = MONTHLY_FILE_LIMIT): Uint8Array {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(max / 3) * 4
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail();
  const raw = atob(value as string); if (raw.length > max || btoa(raw) !== value) fail();
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export function readMonthlyOriginalCommand(value: unknown): MonthlyOriginalCommand {
  if (!object(value) || !['prepare','read','status','archive','acknowledge','verify'].includes(value.action as string)
    || ![value.tenantId,value.proofId,value.captureId].every(uuid) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || (value.authorityId !== undefined && (!uuid(value.authorityId) || value.action === 'archive'))
    || !keys(value, [...(value.authorityId !== undefined ? ['authorityId'] : []),'action','tenantId','proofId','revision','captureId', ...(value.action === 'acknowledge' ? ['originalSha256'] : value.action === 'verify' ? ['pngBase64'] : [])])) fail();
  if (value.action === 'acknowledge' && !hash(value.originalSha256)) fail();
  if (value.action === 'verify') monthlyBase64(value.pngBase64);
  return structuredClone(value) as MonthlyOriginalCommand;
}
function meta(value: unknown, input: MonthlyCapture): MonthlyOriginalMeta {
  if (!object(value) || !keys(value, ['captureId','proofId','revision','contentSha256','originalSha256','originalVersion','acknowledged', ...(value.representative !== undefined ? ['representative'] : [])])
    || value.captureId !== input.captureId || value.proofId !== input.proofId || value.revision !== input.revision
    || !hash(value.contentSha256) || !hash(value.originalSha256) || !uuid(value.originalVersion) || typeof value.acknowledged !== 'boolean') fail();
  if (value.representative !== undefined) {
    const a=readMonthlyAuthority(value.representative);
    if(a.tenant_id!==input.tenantId || a.revoked_at!==null)fail();
    if((input as MonthlyOriginalCommand).action!=='archive' && a.id!==input.authorityId)fail();
  } else if(input.authorityId!==undefined)fail();
  return value as MonthlyOriginalMeta;
}
export function readMonthlyOriginalReceipt(value: unknown, input: MonthlyCapture, actorId: string): MonthlyOriginalReceipt {
  if (!object(value) || !keys(value, ['receiptId','captureId','proofId','revision','tenantId','actorId','contentSha256','originalSha256','signatureSha256'])
    || !uuid(value.receiptId) || value.captureId !== input.captureId || value.proofId !== input.proofId || value.revision !== input.revision
    || value.tenantId !== input.tenantId || value.actorId !== actorId || ![value.contentSha256,value.originalSha256,value.signatureSha256].every(hash)) fail();
  return structuredClone(value) as MonthlyOriginalReceipt;
}
export function readMonthlyOriginalResponse(value: unknown, input: MonthlyOriginalCommand, actorId: string): MonthlyOriginalResponse {
  if (!object(value) || value.version !== 1 || !uuid(actorId) || value.actorId !== actorId
    || ['tenantId','proofId','revision','captureId','authorityId'].some(k => value[k] !== input[k as keyof MonthlyCapture])) fail();
  const base = [...(input.authorityId !== undefined ? ['authorityId'] : []),'version','actorId','tenantId','proofId','revision','captureId','kind'];
  if (value.kind === 'original' && ['prepare','read','archive'].includes(input.action)) {
    if (!keys(value, [...base,'original','pdfBase64','archive'])) fail();
    meta(value.original, input); const bytes = monthlyBase64(value.pdfBase64);
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') fail();
    if (input.action === 'archive') {
      const a = value.archive;
      if (!object(a) || !keys(a, ['status','version','finalizedAt','invalidatedAt']) || !['final','invalidated'].includes(a.status as string)
        || !Number.isSafeInteger(a.version) || Number(a.version) < 1 || typeof a.finalizedAt !== 'string' || !Number.isFinite(Date.parse(a.finalizedAt))
        || (a.status === 'final' ? a.invalidatedAt !== null : typeof a.invalidatedAt !== 'string' || !Number.isFinite(Date.parse(a.invalidatedAt)))) fail();
    } else if (value.archive !== null) fail();
  } else if (value.kind === 'acknowledged' && input.action === 'acknowledge') {
    if (!keys(value, [...base,'originalSha256']) || value.originalSha256 !== input.originalSha256) fail();
  } else if (value.kind === 'receipt' && input.action === 'verify') {
    if (!keys(value, [...base,'receipt'])) fail(); readMonthlyOriginalReceipt(value.receipt, input, actorId);
  } else if (value.kind === 'state' && input.action === 'status') {
    if (!keys(value, [...base,'state','original','receipt']) || !['absent','prepared','acknowledged','verified'].includes(value.state as string)) fail();
    if (value.state === 'absent') { if (value.original !== null || value.receipt !== null) fail(); }
    else {
      const original = meta(value.original, input);
      if (original.acknowledged !== (value.state !== 'prepared')) fail();
      if (value.state === 'verified') {
        const receipt = readMonthlyOriginalReceipt(value.receipt, input, actorId);
        if (receipt.originalSha256 !== original.originalSha256 || receipt.contentSha256 !== original.contentSha256) fail();
      } else if (value.receipt !== null) fail();
    }
  } else fail();
  return structuredClone(value) as MonthlyOriginalResponse;
}
