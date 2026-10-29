import {readPaperOriginal,readPaperScan,readPaperReview,readPaperReceipt,paperHash,type PaperOriginal,type PaperScan,type PaperReview,type PaperReceipt} from './monthlyPaper';
import {readMonthlyAuthority,type MonthlyAuthority} from './monthlyAuthority';
import { UUID } from './sources';

export const MONTHLY_FILE_LIMIT = 2 * 1024 * 1024;
export const MONTHLY_WIRE_LIMIT = 2_850_000;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v) && v === v.toLowerCase();
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).length === allowed.length && Object.keys(v).every(k => allowed.includes(k));
function fail(): never { throw new Error('MONTHLY_ORIGINAL_CONTRACT'); }
export type MonthlyCapture = {tenantId: string; proofId: string; revision: number; captureId: string; authorityId?: string;method?: 'paper'};
export type MonthlyOriginalCommand = MonthlyCapture & (
  {action: 'prepare' | 'read' | 'status' | 'archive' | 'archive-scan'} |
  {action: 'upload-scan'; pdfBase64: string} |
  {action: 'scan-page'; page: number; scanSha256: string} |
  {action: 'review-scan'; review: PaperReview} |
  {action: 'acknowledge'; originalSha256: string} |
  {action: 'verify'; pngBase64: string}
);
export type MonthlyOriginalMeta = {captureId: string; proofId: string; revision: number; contentSha256: string;
  originalSha256: string; originalVersion: string; acknowledged: boolean; representative?: MonthlyAuthority;paper?:PaperOriginal};
export type MonthlyOriginalReceipt = {receiptId: string; captureId: string; proofId: string; revision: number; tenantId: string;
  actorId: string; contentSha256: string; originalSha256: string; signatureSha256: string;paper?:PaperReceipt};
type Envelope = MonthlyCapture & {version: 1; actorId: string};
export type MonthlyOriginalResponse = Envelope & (
  {kind: 'original'; original: MonthlyOriginalMeta; pdfBase64: string; archive: null | {status: 'final' | 'invalidated'; version: number; finalizedAt: string; invalidatedAt: string | null}} |
  {kind: 'scan';scan:PaperScan} |
  {kind: 'scan-page';page:number;scanSha256:string;sha256:string;width:number;height:number;pngBase64:string} |
  {kind: 'archived-scan';paper:PaperReceipt;pdfBase64:string;status:'final'|'invalidated'} |
  {kind: 'acknowledged'; originalSha256: string} |
  {kind: 'receipt'; receipt: MonthlyOriginalReceipt} |
  {kind: 'state'; state: 'absent' | 'prepared' | 'acknowledged' | 'verified'; original: MonthlyOriginalMeta | null; receipt: MonthlyOriginalReceipt | null;scan?:PaperScan|null}
);
export function monthlyBase64(value: unknown, max = MONTHLY_FILE_LIMIT): Uint8Array {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(max / 3) * 4
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail();
  const raw = atob(value as string); if (raw.length > max || btoa(raw) !== value) fail();
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
const archiveAction=(action:unknown)=>action==='archive'||action==='archive-scan';
const captureKeys=(v:Record<string,unknown>)=>[...(v.authorityId!==undefined?['authorityId']:[]),...(v.method!==undefined?['method']:[])];
const prefix=(input:MonthlyCapture)=>`tenant/${input.tenantId}/gkv/monthly/${input.proofId}/captures/${input.captureId}`;
export function readMonthlyOriginalCommand(value: unknown): MonthlyOriginalCommand {
  if (!object(value) || !['prepare','read','status','archive','archive-scan','acknowledge','verify','upload-scan','scan-page','review-scan'].includes(value.action as string)
    || ![value.tenantId,value.proofId,value.captureId].every(uuid) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || (value.authorityId !== undefined && (!uuid(value.authorityId) || archiveAction(value.action)))
    || (value.method!==undefined && (value.method!=='paper'||archiveAction(value.action)))
    || (['upload-scan','scan-page','review-scan'].includes(String(value.action)) && value.method!=='paper')
    || (value.action==='verify' && value.method!==undefined)) fail();
  const extra=value.action==='acknowledge'?['originalSha256']:value.action==='verify'?['pngBase64']:value.action==='upload-scan'?['pdfBase64']
    :value.action==='scan-page'?['page','scanSha256']:value.action==='review-scan'?['review']:[];
  if(!keys(value,[...captureKeys(value),'action','tenantId','proofId','revision','captureId',...extra]))fail();
  if (value.action === 'acknowledge' && !hash(value.originalSha256)) fail();
  if (value.action === 'verify') monthlyBase64(value.pngBase64);
  if(value.action==='upload-scan' && new TextDecoder().decode(monthlyBase64(value.pdfBase64).subarray(0,5))!=='%PDF-')fail();
  if(value.action==='scan-page' && (!Number.isSafeInteger(value.page)||Number(value.page)<1||Number(value.page)>20||!hash(value.scanSha256)))fail();
  if(value.action==='review-scan')readPaperReview(value.review);
  return structuredClone(value) as MonthlyOriginalCommand;
}
function meta(value: unknown, input: MonthlyCapture): MonthlyOriginalMeta {
  if (!object(value) || !keys(value, ['captureId','proofId','revision','contentSha256','originalSha256','originalVersion','acknowledged', ...(value.representative !== undefined ? ['representative'] : []),...(value.paper!==undefined?['paper']:[])])
    || value.captureId !== input.captureId || value.proofId !== input.proofId || value.revision !== input.revision
    || !hash(value.contentSha256) || !hash(value.originalSha256) || !uuid(value.originalVersion) || typeof value.acknowledged !== 'boolean') fail();
  if (value.representative !== undefined) {
    const a=readMonthlyAuthority(value.representative);
    if(a.tenant_id!==input.tenantId || a.revoked_at!==null)fail();
    if(!archiveAction((input as MonthlyOriginalCommand).action) && a.id!==input.authorityId)fail();
  } else if(input.authorityId!==undefined)fail();
  if(value.paper!==undefined)readPaperOriginal(value.paper);
  if(!archiveAction((input as MonthlyOriginalCommand).action) && (value.paper!==undefined)!==(input.method==='paper'))fail();
  return value as MonthlyOriginalMeta;
}
export function readMonthlyOriginalReceipt(value: unknown, input: MonthlyCapture, actorId: string): MonthlyOriginalReceipt {
  if (!object(value) || !keys(value, ['receiptId','captureId','proofId','revision','tenantId','actorId','contentSha256','originalSha256','signatureSha256',...(value.paper!==undefined?['paper']:[])])
    || !uuid(value.receiptId) || value.captureId !== input.captureId || value.proofId !== input.proofId || value.revision !== input.revision
    || value.tenantId !== input.tenantId || value.actorId !== actorId || ![value.contentSha256,value.originalSha256,value.signatureSha256].every(hash)) fail();
  if(value.paper!==undefined){const paper=readPaperReceipt(value.paper,prefix(input));if(paper.reviewedBy!==actorId)fail();}
  if((value.paper!==undefined)!==(input.method==='paper'))fail();
  return structuredClone(value) as MonthlyOriginalReceipt;
}
export function readMonthlyOriginalResponse(value: unknown, input: MonthlyOriginalCommand, actorId: string): MonthlyOriginalResponse {
  if (!object(value) || value.version !== 1 || !uuid(actorId) || value.actorId !== actorId
    || ['tenantId','proofId','revision','captureId','authorityId','method'].some(k => value[k] !== input[k as keyof MonthlyCapture])) fail();
  const base = [...captureKeys(input),'version','actorId','tenantId','proofId','revision','captureId','kind'];
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
  } else if (value.kind === 'receipt' && ['verify','review-scan'].includes(input.action)) {
    if (!keys(value, [...base,'receipt'])) fail(); readMonthlyOriginalReceipt(value.receipt, input, actorId);
  } else if(value.kind==='scan' && input.action==='upload-scan'){
    if(!keys(value,[...base,'scan']))fail();readPaperScan(value.scan);
  } else if(value.kind==='scan-page' && input.action==='scan-page'){
    if(!keys(value,[...base,'page','scanSha256','sha256','width','height','pngBase64']) ||value.page!==input.page||value.scanSha256!==input.scanSha256
      ||!paperHash(value.sha256)||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)
      ||Number(value.width)<100||Number(value.height)<100||Number(value.width)*Number(value.height)>2097152)fail();
    const png=monthlyBase64(value.pngBase64);if(png[0]!==137||new TextDecoder().decode(png.subarray(1,4))!=='PNG')fail();
  } else if(value.kind==='archived-scan' && input.action==='archive-scan'){
    if(!keys(value,[...base,'paper','pdfBase64','status'])||!['final','invalidated'].includes(String(value.status)))fail();
    readPaperReceipt(value.paper,prefix(input));if(new TextDecoder().decode(monthlyBase64(value.pdfBase64).subarray(0,5))!=='%PDF-')fail();
  } else if (value.kind === 'state' && input.action === 'status') {
    if (!keys(value, [...base,'state','original','receipt',...(value.scan!==undefined?['scan']:[])]) || !['absent','prepared','acknowledged','verified'].includes(value.state as string)) fail();
    if (value.state === 'absent') { if (value.original !== null || value.receipt !== null || value.scan!==undefined) fail(); }
    else {
      const original = meta(value.original, input);
      if(original.paper){if(value.scan===undefined)fail();if(value.scan!==null && readPaperScan(value.scan).pages.length!==original.paper.pageCount)fail();}
      else if(value.scan!==undefined)fail();
      if (original.acknowledged !== (value.state !== 'prepared')) fail();
      if (value.state === 'verified') {
        const receipt = readMonthlyOriginalReceipt(value.receipt, input, actorId);
        if (receipt.originalSha256 !== original.originalSha256 || receipt.contentSha256 !== original.contentSha256) fail();
      } else if (value.receipt !== null) fail();
    }
  } else fail();
  return structuredClone(value) as MonthlyOriginalResponse;
}
