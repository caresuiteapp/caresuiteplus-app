import {UUID} from './sources';

export const MONTHLY_PAPER_PAGES=20;
export type PaperBox={page:number;x:number;y:number;width:number;height:number};
export type PaperOriginal={pageCount:number;signatureBox:PaperBox;preparedAt:string};
export type PaperScan={scanSha256:string;scanVersion:string;renderSha256:string;pages:{sha256:string;width:number;height:number}[]};
export type PaperReview={scanSha256:string;reviewedPages:string[];signatureBox:PaperBox;signedAt:string;reviewConfirmed:true};
export type PaperReceipt={schema:'gkv-paper-review-v1';scanPath:string;scanVersion:string;scanSha256:string;renderSha256:string;
  pageSha256:string[];signatureBox:PaperBox;issuedAt:string;signedAt:string;reviewedAt:string;reviewedBy:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length && Object.keys(v).every(k=>keys.includes(k));
export const paperHash=(v:unknown):v is string=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
const uuid=(v:unknown)=>typeof v==='string' && UUID.test(v) && v===v.toLowerCase();
const time=(v:unknown):v is string=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
function fail():never{throw Error('MONTHLY_PAPER_INPUT');}
export function readPaperBox(v:unknown,pages=MONTHLY_PAPER_PAGES):PaperBox{
  if(!object(v)||!exact(v,['page','x','y','width','height'])||!Object.values(v).every(Number.isSafeInteger)
    ||Number(v.page)<1||Number(v.page)>pages||Number(v.x)<0||Number(v.y)<0||Number(v.width)<20||Number(v.height)<10
    ||Number(v.x)+Number(v.width)>1000||Number(v.y)+Number(v.height)>1000)fail();
  return structuredClone(v) as PaperBox;
}
export function readPaperOriginal(v:unknown):PaperOriginal{
  if(!object(v)||!exact(v,['pageCount','signatureBox','preparedAt'])||!Number.isSafeInteger(v.pageCount)
    ||Number(v.pageCount)<1||Number(v.pageCount)>MONTHLY_PAPER_PAGES||!time(v.preparedAt))fail();
  readPaperBox(v.signatureBox,Number(v.pageCount));return structuredClone(v) as PaperOriginal;
}
export function readPaperScan(v:unknown):PaperScan{
  if(!object(v)||!exact(v,['scanSha256','scanVersion','renderSha256','pages'])||!paperHash(v.scanSha256)||!paperHash(v.renderSha256)
    ||!uuid(v.scanVersion)||!Array.isArray(v.pages)||!v.pages.length||v.pages.length>MONTHLY_PAPER_PAGES)fail();
  for(const p of v.pages){if(!object(p)||!exact(p,['sha256','width','height'])||!paperHash(p.sha256)
    ||!Number.isSafeInteger(p.width)||!Number.isSafeInteger(p.height)||Number(p.width)<100||Number(p.height)<100
    ||Number(p.width)*Number(p.height)>2097152)fail();}
  return structuredClone(v) as PaperScan;
}
export function readPaperReview(v:unknown):PaperReview{
  if(!object(v)||!exact(v,['scanSha256','reviewedPages','signatureBox','signedAt','reviewConfirmed'])||!paperHash(v.scanSha256)
    ||!Array.isArray(v.reviewedPages)||!v.reviewedPages.length||v.reviewedPages.length>MONTHLY_PAPER_PAGES
    ||!v.reviewedPages.every(paperHash)||!time(v.signedAt)||v.reviewConfirmed!==true)fail();
  readPaperBox(v.signatureBox,v.reviewedPages.length);return structuredClone(v) as PaperReview;
}
export function readPaperReceipt(v:unknown,prefix:string):PaperReceipt{
  if(!object(v)||!exact(v,['schema','scanPath','scanVersion','scanSha256','renderSha256','pageSha256','signatureBox','issuedAt','signedAt','reviewedAt','reviewedBy'])
    ||v.schema!=='gkv-paper-review-v1'||v.scanPath!==`${prefix}/scan.pdf`||!uuid(v.scanVersion)||!uuid(v.reviewedBy)
    ||!paperHash(v.scanSha256)||!paperHash(v.renderSha256)||!Array.isArray(v.pageSha256)||!v.pageSha256.length
    ||v.pageSha256.length>MONTHLY_PAPER_PAGES||!v.pageSha256.every(paperHash)||![v.issuedAt,v.signedAt,v.reviewedAt].every(time)
    ||Date.parse(String(v.signedAt))<Date.parse(String(v.issuedAt))||Date.parse(String(v.reviewedAt))<Date.parse(String(v.signedAt))
    ||Date.parse(String(v.reviewedAt))-Date.parse(String(v.issuedAt))>7*86400000)fail();
  readPaperBox(v.signatureBox,v.pageSha256.length);return structuredClone(v) as PaperReceipt;
}
