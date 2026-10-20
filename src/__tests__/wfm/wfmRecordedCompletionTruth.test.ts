import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {WfmTimeEvent} from '@/types/modules/wfm';
import {deriveWfmRecordedDayTotals} from '@/lib/wfm/wfmRecordedDayTotals';
import {berlinDateKey} from '@/lib/employeeLogbook/employeeLogbookDate';
const h=vi.hoisted(()=>({events:vi.fn(),session:vi.fn(),update:vi.fn(),source:vi.fn(),rpc:vi.fn(),has:vi.fn(),insert:vi.fn(),resolve:vi.fn()}));
vi.mock('@/lib/assist/assistTrackingPersistenceService',()=>({fetchTimeEventsForVisit:h.source}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:h.rpc})}));
vi.mock('@/lib/wfm/wfmWorkSessionRepository',()=>({
 fetchSessionEvents:h.events,fetchSessionForDate:h.session,updateWorkSession:h.update,hasAssistWfmEvent:h.has,
 insertTimeEvent:h.insert,insertWorkSession:vi.fn(),resolveAuthUserIdForWfmSession:h.resolve,resolveEmployeeIdForUser:vi.fn(),
 workDateFromIso:(iso:string)=>berlinDateKey(iso),
}));
import {applyAssistServiceEndToWfmSession,syncAssistVisitTimesToWfm,syncAssistTimeEventToWfm} from '@/lib/wfm/wfmAssistAdapter';
let seq=0;
const event=(type:string,time:string,visit='v1',source='assist'):WfmTimeEvent=>({
 id:String(++seq),tenantId:'tenant',employeeId:'employee',userId:'auth',eventType:type as WfmTimeEvent['eventType'],
 workMode:'field',source:source as WfmTimeEvent['source'],occurredAt:'2026-09-18T'+time+':00Z',sessionId:'session',note:null,referenceType:'visit',referenceId:visit,
});
const day=()=>[event('visit_started','08:00'),event('pause_start','08:10'),event('pause_end','08:15'),event('pause_start','08:30'),event('pause_end','08:40'),event('visit_ended','09:00'),event('visit_started','10:00','v2'),event('visit_ended','11:00','v2')];
beforeEach(()=>{
 vi.clearAllMocks();seq=0;
 h.source.mockResolvedValue({ok:true,data:[{eventType:'service_start',occurredAt:'2026-09-18T08:00:00Z'},{eventType:'service_end',occurredAt:'2026-09-18T09:00:00Z'}]});
 h.session.mockResolvedValue({ok:true,data:{id:'session',lastEventAt:null}});h.events.mockResolvedValue({ok:true,data:day()});
 h.update.mockResolvedValue({ok:true,data:{id:'session'}});h.has.mockResolvedValue(false);h.insert.mockResolvedValue({ok:true,data:{id:'event'}});h.resolve.mockResolvedValue('auth');
});
describe('recorded daily WFM completion truth',()=>{
 it('retains both Visits and every pause without treating gaps as work',()=>{
  expect(deriveWfmRecordedDayTotals(day(),'2026-09-18','2026-09-18T12:00:00Z')).toMatchObject({grossMinutes:120,pauseMinutes:15,netMinutes:105,isOnline:false});
 });
 it('counts an Office clock block overlapping a Visit once and subtracts pauses once',()=>{
  expect(deriveWfmRecordedDayTotals([event('office_check_in','07:00','clock','portal'),...day(),event('clock_out','12:00','clock','portal')],'2026-09-18','2026-09-18T13:00:00Z'))
   .toMatchObject({grossMinutes:300,pauseMinutes:15,netMinutes:285});
 });
 it('preserves actual zero with no start and rejects an unmatched historical start',()=>{
  expect(deriveWfmRecordedDayTotals([event('visit_ended','09:00')],'2026-09-18','2026-09-18T10:00:00Z').netMinutes).toBe(0);
  expect(()=>deriveWfmRecordedDayTotals([event('visit_started','08:00')],'2026-09-18','2026-10-11T10:00:00Z')).toThrow('historische');
 });
 it('stores full daily totals instead of the last Visit and retains the server end receipt',async()=>{
  expect((await applyAssistServiceEndToWfmSession('tenant','employee','v1','2026-09-18')).ok).toBe(true);
  expect(h.update).toHaveBeenCalledWith('session',expect.objectContaining({grossMinutes:120,pauseMinutes:15,netMinutes:105,isOnline:false,status:'ended',endedAt:'2026-09-18T11:00:00Z'}));
 });
 it('does not overwrite totals when the authoritative day event read fails',async()=>{
  h.events.mockResolvedValue({ok:false,error:'Lesefehler'});
  expect(await applyAssistServiceEndToWfmSession('tenant','employee','v1','2026-09-18')).toEqual({ok:false,error:'Lesefehler'});
  expect(h.update).not.toHaveBeenCalled();
 });
 it.each([null,{},-1,0.5,'unknown',true])('does not invent a successful RPC receipt from %s',async value=>{
  h.rpc.mockResolvedValue({data:value,error:null});
  expect((await syncAssistVisitTimesToWfm('tenant','employee','auth','v1')).ok).toBe(false);
  expect(h.source).not.toHaveBeenCalled();
 });
 it('retains every repeated pause during a missing-RPC backfill',async()=>{
  h.rpc.mockResolvedValue({data:null,error:{message:'function sync_assist_visit_times_to_wfm does not exist'}});
  const source=[['service_start','08:00'],['pause_start','08:10'],['pause_end','08:15'],['pause_start','08:30'],['pause_end','08:40'],['arrived_manual','08:45'],['service_end','09:00']];
  h.source.mockResolvedValue({ok:true,data:source.map(([eventType,time])=>({eventType,occurredAt:'2026-09-18T'+time+':00Z'}))});
  expect((await syncAssistVisitTimesToWfm('tenant','employee','auth','v1')).ok).toBe(true);
  expect(h.insert.mock.calls.map(call=>call[0].eventType)).toEqual(['visit_started','pause_start','pause_end','pause_start','pause_end','visit_arrived','visit_ended']);
  expect(h.has.mock.calls.filter(call=>call[2]==='pause_start').map(call=>call[4])).toEqual(['2026-09-18T08:10:00Z','2026-09-18T08:30:00Z']);
 });
 it('shares same source-event writes while the first mirror is still pending',async()=>{
  let resolve!:(value:unknown)=>void;h.resolve.mockReturnValue(new Promise(r=>{resolve=r;}));
  const args=['tenant','employee','auth','v1','pause_start','2026-09-18T08:10:00Z'] as const;
  const a=syncAssistTimeEventToWfm(...args),b=syncAssistTimeEventToWfm(...args);
  resolve('auth');await Promise.all([a,b]);expect(h.insert).toHaveBeenCalledOnce();
 });
});
