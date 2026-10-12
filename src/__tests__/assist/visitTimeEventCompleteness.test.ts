import {beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({rows:[] as Record<string,any>[],queries:[] as any[],page:0,failPage:0,onPage:undefined as (()=>void)|undefined,highError:null as unknown}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({from:(table:string)=>{
 const q:any={table,filters:{} as Record<string,any>,orders:[] as [string,boolean][],select:(value:string)=>{q.selected=value;return q;},
  eq:(key:string,value:unknown)=>{q.filters[key]=value;return q;},lte:(key:string,value:unknown)=>{q.upper={key,value};return q;},
  order:(key:string,options:{ascending:boolean})=>{q.orders.push([key,options.ascending]);return q;},limit:(n:number)=>{q.n=n;return q;},
  or:(filter:string)=>{q.cursor=filter;return q;},then:(resolve:any,reject:any)=>{
   h.queries.push(q);
   if(q.selected==='created_at'&&h.highError)return Promise.resolve({data:null,error:h.highError}).then(resolve,reject);
   if(q.selected==='*'){h.page+=1;h.onPage?.();if(h.page===h.failPage)return Promise.resolve({data:null,error:{message:'Spätere Seite nicht erreichbar'}}).then(resolve,reject);}
   let rows=h.rows.filter(r=>Object.entries(q.filters).every(([key,value])=>r[key]===value)&&(!q.upper||r[q.upper.key]<=q.upper.value));
   if(q.cursor){const match=q.cursor.match(/^created_at.gt.(.+),and\(created_at.eq.(.+),id.gt.(.+)\)$/)!;
    rows=rows.filter(r=>r.created_at>match[1]||(r.created_at===match[2]&&r.id>match[3]));}
   rows=rows.sort((a,b)=>{for(const [key,asc] of q.orders){const d=String(a[key]).localeCompare(String(b[key]));if(d)return asc?d:-d;}return 0;}).slice(0,q.n);
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }};return q;
 }} )}));
import {fetchTimeEventsForVisit} from '@/lib/assist/assistTrackingPersistenceService';
const row=(id:number,overrides={})=>({id:String(id).padStart(4,'0'),tenant_id:'tenant',visit_id:'visit',event_type:'pause_start',occurred_at:'2026-09-18T08:00:00Z',
 created_at:'2026-09-18T08:00:00Z',session_id:null,recorded_by:null,duration_seconds:null,metadata:{},...overrides});
beforeEach(()=>{h.rows=[];h.queries=[];h.page=0;h.failPage=0;h.onPage=undefined;h.highError=null;});
describe('complete chronological Visit time event reads',()=>{
 it('returns early start, all pauses and newest correction beyond the historical 50-row cap',async()=>{
  h.rows=Array.from({length:130},(_,i)=>row(i+1));h.rows[0].event_type='service_start';h.rows[129].event_type='service_end';
  h.rows[129].metadata={source:'administrative_follow_up'};
  const result=await fetchTimeEventsForVisit('tenant','visit',50);expect(result.ok).toBe(true);
  if(!result.ok)return;expect(result.data).toHaveLength(130);expect(result.data[0].eventType).toBe('service_start');
  expect(result.data[129].eventType).toBe('service_end');expect(result.data[129].metadata).toEqual({source:'administrative_follow_up'});
  expect(new Set(result.data.map(e=>e.id)).size).toBe(130);
  expect(h.queries.every(q=>q.filters.tenant_id==='tenant'&&q.filters.visit_id==='visit')).toBe(true);
 });
 it('does not shift or duplicate equal-timestamp pages when a newer event is appended during the read',async()=>{
  h.rows=Array.from({length:110},(_,i)=>row(i+1));
  h.onPage=()=>{if(h.page===1)h.rows.push(row(999,{created_at:'2026-09-18T08:01:00Z',occurred_at:'2026-09-18T07:59:00Z'}));};
  const result=await fetchTimeEventsForVisit('tenant','visit',50);if(!result.ok)throw Error(result.error);
  expect(result.data).toHaveLength(110);expect(new Set(result.data.map(e=>e.id)).size).toBe(110);
  expect(result.data.some(e=>e.id==='0999')).toBe(false);
  h.onPage=undefined;const refreshed=await fetchTimeEventsForVisit('tenant','visit',50);
  if(!refreshed.ok)throw Error(refreshed.error);expect(refreshed.data).toHaveLength(111);expect(refreshed.data[0].id).toBe('0999');
 });
 it('fails the whole history instead of returning partial truth when a later page fails',async()=>{
  h.rows=Array.from({length:110},(_,i)=>row(i+1));h.failPage=2;
  const result=await fetchTimeEventsForVisit('tenant','visit',50);expect(result.ok).toBe(false);
  if(result.ok)return;expect(result.error).toContain('Spätere Seite');expect('data' in result).toBe(false);
 });
 it('keeps the explicit missing-table availability signal',async()=>{
  h.highError={code:'PGRST205',message:'Could not find the table public.assist_time_events'};
  expect(await fetchTimeEventsForVisit('tenant','visit')).toEqual({ok:true,data:[],tableMissing:true});
 });
});
