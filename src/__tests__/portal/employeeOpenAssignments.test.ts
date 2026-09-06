import { describe, expect, it, vi } from 'vitest';
import { selectEmployeeOpenAssignments } from '@/lib/portal/employeePortalOpenAssignments';
import { readAllVisitPages } from '@/lib/assist/repositories/visitListPagination';
import { formatEditableVisitTime, parseEditableVisitTime } from '@/lib/portal/employeeOpenVisitTimeEdit';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: vi.fn() }));
vi.mock('@/lib/assist/assistExecutionVisitResolver', () => ({ resolveAssistVisitIdForPersistence: vi.fn() }));
const row = (id: string, status: PortalAppointmentItem['assignmentStatus'], extra: Partial<PortalAppointmentItem> = {}): PortalAppointmentItem => ({
  id, title:'Einsatz',location:null,clientId:'client',employeeId:'employee',startsAt:'2026-01-01T10:00:00Z',endsAt:'2026-01-01T11:00:00Z',status:'aktiv',assignmentStatus:status,...extra,
});
describe('open employee assignments', () => {
  it('keeps unfinished visits from earlier days and months in chronological order', () => {
    const items=[row('today','gestartet',{startsAt:'2026-09-06T10:00:00Z'}),row('old','beendet'),row('sign','unterschrift_offen')];
    expect(selectEmployeeOpenAssignments(items,'employee').map((item)=>item.id)).toEqual(['old','sign','today']);
  });
  it('removes completed visits immediately and does not require optional tasks', () => {
    expect(selectEmployeeOpenAssignments([row('done','abgeschlossen',{assignmentIncomplete:true}),row('cancel','storniert'),row('other','geplant',{employeeId:'other'}),row('own','bestaetigt')],'employee').map((item)=>item.id)).toEqual(['own']);
  });
  it('reads open work beyond the server default 1000-row cap', async () => {
    const rows=Array.from({length:1201},(_,id)=>({id}));
    const page=vi.fn(async(from:number,to:number)=>({data:rows.slice(from,to+1),error:null}));
    expect((await readAllVisitPages(page)).data).toHaveLength(1201);
    expect(page).toHaveBeenCalledTimes(7);
  });
  it('reports a later page failure instead of claiming all work has been loaded', async () => {
    const error={message:'Offline',code:'FETCH',hint:'',details:''};
    const page=vi.fn(async(from:number)=>from===0?{data:Array(200).fill({}),error:null}:{data:null,error});
    expect(await readAllVisitPages(page)).toEqual({data:null,error});
  });
  it('round-trips entered local times and rejects impossible calendar dates', () => {
    const text='06.09.2026 10:15';
    expect(formatEditableVisitTime(parseEditableVisitTime(text))).toBe(text);
    for(const bad of ['31.02.2026 10:00','06.09.2026 25:00','06.09.2026 10:70','', 'morgen']) expect(parseEditableVisitTime(bad)).toBeNull();
  });
});
