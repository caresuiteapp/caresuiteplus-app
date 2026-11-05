import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],calls:[] as {from:number;to:number;filters:Record<string,unknown>}[],failOffset:-1}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({from:()=>{
  const filters:Record<string,unknown>={};
  const chain={select:()=>chain,eq:(key:string,value:unknown)=>{filters[key]=value;return chain;},
    order:()=>chain,in:(key:string,value:unknown)=>{filters[key]=value;return chain;},
    range:async(from:number,to:number)=>{
      f.calls.push({from,to,filters:{...filters}});
      if(from===f.failOffset)return{data:null,error:{message:'query unavailable',code:'PGRST205'}};
      const scoped=f.rows.filter(row=>Object.entries(filters).every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
      return{data:scoped.slice(from,to+1),error:null};
    }};return chain;
}})}));
import { listPortalRequests, listTenantPortalRequests } from '@/lib/portal/assist/portalRequestService';
beforeEach(()=>{f.rows=[];f.calls=[];f.failOffset=-1;});
function record(n:number,client='client-a') {return {id:`request-${n}`,tenant_id:'tenant',client_id:client,status:'offen',request_type:'rueckruf',title:'Rückruf',
  description:'Ungekürzter Nachrichtentext',client:{full_name:'Testperson'},office_thread_id:`thread-${n}`,office_message_id:`message-${n}`,office_delivered_at:'2026-11-05T09:00:00Z'};}
describe('complete and client-scoped portal request reads',()=>{
  it('filters the client in the database before pagination and loads more than twenty requests',async()=>{
    f.rows=[...Array.from({length:30},(_,n)=>record(n,'other-client')),...Array.from({length:151},(_,n)=>record(n+30))];
    const result=await listTenantPortalRequests('tenant',{clientId:'client-a'});
    expect(result.ok&&result.data).toHaveLength(151);
    expect(f.calls.map(x=>x.from)).toEqual([0,100]);
    expect(f.calls.every(x=>x.filters.client_id==='client-a'&&x.filters.tenant_id==='tenant')).toBe(true);
    expect(result.ok&&result.data[150]).toMatchObject({clientName:'Testperson',officeThreadId:'thread-180',description:'Ungekürzter Nachrichtentext'});
  });
  it('honours an explicit recent-list limit without hiding the remaining rows from complete reads',async()=>{
    f.rows=Array.from({length:151},(_,n)=>record(n));
    expect((await listPortalRequests('tenant','client-a',{limit:12}))).toMatchObject({ok:true,data:expect.any(Array)});
    expect(f.calls[0]).toMatchObject({from:0,to:11});
    const all=await listPortalRequests('tenant','client-a');expect(all.ok&&all.data).toHaveLength(151);
  });
  it('reports a failed later page instead of displaying a falsely complete partial result',async()=>{
    f.rows=Array.from({length:151},(_,n)=>record(n));f.failOffset=100;
    expect((await listTenantPortalRequests('tenant')).ok).toBe(false);
  });
  it('reports an unavailable request table rather than asserting that there are no requests',async()=>{
    f.failOffset=0;expect((await listTenantPortalRequests('tenant')).ok).toBe(false);
  });
});
