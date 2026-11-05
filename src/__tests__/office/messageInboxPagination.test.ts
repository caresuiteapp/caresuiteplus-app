import {beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({calls:[] as number[],failOffset:-1,rows:[] as Record<string,unknown>[]}));
vi.mock('@/lib/permissions',()=>({enforcePermission:()=>null}));
vi.mock('@/lib/services/liveServiceGuard',()=>({guardServiceTenant:()=>null}));
vi.mock('@/lib/communication/officeComposeRouting',()=>({canViewOfficeInternalMessages:()=>true}));
vi.mock('@/lib/office/employeeGroupChatService',()=>({enrichThreadsWithEmployeeGroupParticipants:async(_tenant:string,threads:unknown[])=>threads}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({from:()=>{
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:async(from:number,to:number)=>{f.calls.push(from);return from===f.failOffset
    ?{data:null,error:{message:'later page unavailable'}}:{data:f.rows.slice(from,to+1),error:null};}};return q;
}})}));
import {fetchOfficeMessageNavBadgeData,fetchThreadsLive} from '@/lib/office/messagethreadservice';
beforeEach(()=>{f.calls=[];f.failOffset=-1;f.rows=Array.from({length:501},(_,n)=>({id:`thread-${n}`,tenant_id:'tenant',thread_type:'client',
  status:n===500?'new':'open',subject:'Portal-Anfrage',office_unread_count:n===500?1:0,created_at:'2026-11-03T09:47:31Z',updated_at:'2026-11-03T09:47:31Z'}));});
describe('message inbox completeness',()=>{
  it('includes unread portal requests beyond the old 120-row badge limit',async()=>{
    const result=await fetchOfficeMessageNavBadgeData('tenant','business_admin');
    expect(result.ok&&result.data.counts).toEqual({total:1,clients:1,employees:0,internal:0});expect(f.calls).toEqual([0,500]);
  });
  it('makes conversations beyond the old 200-row inbox limit reachable',async()=>{
    const result=await fetchThreadsLive('tenant');expect(result.ok&&result.data).toHaveLength(501);expect(f.calls).toEqual([0,500]);
  });
  it('does not return a partial successful inbox if a later page fails',async()=>{
    f.failOffset=500;expect((await fetchThreadsLive('tenant')).ok).toBe(false);
  });
});
