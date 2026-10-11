import {beforeEach,expect,it,vi} from 'vitest';
import type {AssignmentDetail} from '@/lib/assist/repositories/assignmentRepository.supabase';
const h=vi.hoisted(()=>({rpc:vi.fn(),direct:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:h.rpc,from:h.direct})}));
vi.mock('@/lib/assist/assignmentAuditHelper',()=>({writeAssignmentAudit:h.audit}));
vi.mock('@/lib/async/deferredTask',()=>({scheduleDeferredTask:vi.fn()}));
import {assignmentSupabaseRepository as repo} from '@/lib/assist/repositories/assignmentRepository.supabase';
const detail:AssignmentDetail={id:'assignment',tenantId:'tenant',createdAt:'2026-09-18T07:00:00Z',updatedAt:'2026-09-18T10:00:00Z',
 visibility:'own',sensitivity:'care',appointmentId:null,title:'Einsatz',scheduledStart:'2026-09-18T08:00:00Z',scheduledEnd:'2026-09-18T09:00:00Z',
 status:'abgeschlossen',location:'Berlin',notes:null,clientName:'Klient',employeeName:'Mitarbeiter',allowedStatusActions:[],tasks:[],onTheWayAt:null,arrivedAt:null,finishedAt:'2026-09-18T09:00:00Z',documentationNotes:'Dokumentiert',plannedStartAt:'2026-09-18T08:00:00Z',plannedEndAt:'2026-09-18T09:00:00Z',employeeId:'employee',clientId:'client',assignmentStatus:'abgeschlossen',
 actualStartAt:'2026-09-18T08:00:00Z',actualEndAt:'2026-09-18T09:00:00Z'};
const receipt={version:'workflow-assignment-record-v1',id:'record',tenant_id:'tenant',assignment_id:'assignment',client_id:'client',employee_id:'employee',
 service_started_at:detail.actualStartAt,service_ended_at:detail.actualEndAt,actual_minutes:50,pdf_storage_path:'own/proof.pdf',pdf_sha256:'ab'.repeat(32),attested_at:'2026-09-18T10:00:00Z'};
beforeEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();vi.spyOn(repo,'getById').mockResolvedValue({ok:true,data:detail});
 h.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':receipt,error:null}));});
it('prepares only through the installed server contract and accepts its actual net-minute receipt',async()=>{
 expect(await repo.prepareServiceRecord('tenant','assignment')).toEqual({ok:true,data:{id:'record'}});
 expect(h.rpc.mock.calls.map(c=>c[0])).toEqual(['workflow_assignment_record_capability','workflow_prepare_assignment_service_record']);expect(h.direct).not.toHaveBeenCalled();
});
it.each([null,'old-version',false])('missing/old capability %s never starts a record mutation',async data=>{
 h.rpc.mockResolvedValue({data,error:null});expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(false);
 expect(h.rpc).toHaveBeenCalledOnce();expect(h.direct).not.toHaveBeenCalled();expect(h.audit).not.toHaveBeenCalled();
});
it.each([{actualStartAt:null},{actualEndAt:null},{actualEndAt:'2026-09-18T07:00:00Z'},{actualStartAt:'invalid'}])('missing or invalid actual pair %s cannot invent a record',async override=>{
 vi.mocked(repo.getById).mockResolvedValue({ok:true,data:{...detail,...override}});expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(false);expect(h.rpc).not.toHaveBeenCalled();
});
it.each([{pdf_sha256:'fake'},{attested_at:null},{pdf_storage_path:''},{tenant_id:'other'},{assignment_id:'other'},{client_id:'other'},{employee_id:'other'},{actual_minutes:61},{actual_minutes:null},{id:null},{service_ended_at:'2026-09-18T08:30:00Z'}])('rejects an unbound or false stored receipt %s',async override=>{
 h.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':{...receipt,...override},error:null}));
 expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(false);expect(h.audit).not.toHaveBeenCalled();
});
it('preserves recorded zero and returns no record before a completed assignment',async()=>{
 vi.mocked(repo.getById).mockResolvedValue({ok:true,data:{...detail,actualEndAt:detail.actualStartAt}});
 h.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':{...receipt,service_ended_at:detail.actualStartAt,actual_minutes:0},error:null}));
 expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(true);
 vi.mocked(repo.getById).mockResolvedValue({ok:true,data:{...detail,assignmentStatus:'unterschrift_offen'}});h.rpc.mockClear();
 expect(await repo.prepareServiceRecord('tenant','assignment')).toEqual({ok:true,data:null});expect(h.rpc).not.toHaveBeenCalled();
});
it('does not fall back to direct INSERT after a server rejection',async()=>{
 h.rpc.mockImplementation((name:string)=>Promise.resolve(name==='workflow_assignment_record_capability'?{data:'workflow-assignment-record-v1',error:null}:{data:null,error:{code:'42501',message:'denied'}}));
 expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(false);expect(h.direct).not.toHaveBeenCalled();
});

it('a thrown mutation response stays unconfirmed and never falls back',async()=>{h.rpc.mockImplementation((name:string)=>name==='workflow_assignment_record_capability'?Promise.resolve({data:'workflow-assignment-record-v1',error:null}):Promise.reject(new Error('network')));expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(false);expect(h.direct).not.toHaveBeenCalled();});

it('retains the real SupabaseClient receiver for its RPC methods',async()=>{
 h.rpc.mockImplementation(function(this:unknown,name:string){expect(this).toMatchObject({rpc:h.rpc});return Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':receipt,error:null});});
 expect((await repo.prepareServiceRecord('tenant','assignment')).ok).toBe(true);
});
