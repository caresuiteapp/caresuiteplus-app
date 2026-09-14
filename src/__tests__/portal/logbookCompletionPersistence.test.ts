import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishLogbookTrip, confirmEmployeeLogbookTrip } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
const mock = vi.hoisted(() => ({ row: {} as Record<string, any>, points: [] as Record<string, any>[], writes: [] as any[], ranges: [] as any[], hidden: false, error: false }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_: unknown, table: string) => {
  let payload: any; let start = 0; let end = 499; const filters: Record<string, unknown> = {};
  const result = () => {
    if (table === 'employee_logbook_trips') {
      const matches = Object.entries(filters).every(([k,v]) => mock.row[k] === v);
      if (payload) { mock.writes.push({ table, payload, filters }); if (mock.error) return { data:null,error:{message:'offline'} }; if (!mock.hidden && matches) Object.assign(mock.row, payload); }
      return { data: matches ? { ...mock.row } : null, error: null };
    }
    if (table === 'employee_logbook_points') {
      if (payload) { mock.writes.push({table,payload,filters}); mock.points.push(...payload); }
      return { data: mock.points.slice(start,end+1),error:null };
    }
    if (payload) mock.writes.push({ table,payload,filters });
    return { data:null,error:null };
  };
  const q:any = { select:()=>q, eq:(k:string,v:unknown)=>{filters[k]=v;return q;}, is:()=>q, order:()=>q,
    range:(a:number,b:number)=>{start=a;end=b;mock.ranges.push([a,b]);return q;},
    update:(p:any)=>{payload=p;return q;},insert:(p:any)=>{payload=p;return q;},
    maybeSingle:async()=>result(), then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject) };
  return q;
} }));
const input = { tenantId:'tenant',employeeId:'employee',points:[] };
const now = '2026-09-14T07:00:00Z';
beforeEach(()=>{
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  mock.row={id:'trip',tenant_id:'tenant',employee_id:'employee',status:'recording',started_at:'2026-09-14T06:30:00Z',ended_at:null,distance_final_km:1.2,notes:'Original note'};
  mock.points=[];mock.writes=[];mock.ranges=[];mock.hidden=false;mock.error=false;
});
afterEach(() => vi.useRealTimers());
describe('verified recording completion',()=>{
  it('stops a trip without a new GPS endpoint and verifies persisted status',async()=>{
    const saved=await finishLogbookTrip('trip',input);
    expect(saved.status).toBe('confirmation_required');expect(saved.endedAt).toBe(new Date(now).toISOString());
    const write=mock.writes.find(w=>w.table==='employee_logbook_trips');
    expect(write.filters).toEqual({id:'trip',tenant_id:'tenant',employee_id:'employee',status:'recording'});
  });
  it('rejects a zero-row update instead of displaying success',async()=>{mock.hidden=true;await expect(finishLogbookTrip('trip',input)).rejects.toThrow('nicht gespeichert');});
  it('shares five simultaneous completion attempts',async()=>{await Promise.all(Array.from({length:5},()=>finishLogbookTrip('trip',input)));expect(mock.writes.filter(w=>w.table==='employee_logbook_trips')).toHaveLength(1);});
  it('a retry leaves a confirmed trip and its original endpoint untouched',async()=>{mock.row.status='confirmed';mock.row.ended_at='2026-09-14T06:45:00Z';const saved=await finishLogbookTrip('trip',input);expect(saved.endedAt).toBe(mock.row.ended_at);expect(mock.writes).toHaveLength(0);});
  it('does not append Monday GPS or a Monday endpoint to a Friday trip',async()=>{
    mock.row.started_at='2026-09-11T07:00:00Z';mock.points=[{latitude:51,longitude:7,recorded_at:'2026-09-11T07:30:00Z'},{latitude:52,longitude:8,recorded_at:now}];
    const saved=await finishLogbookTrip('trip',{...input,points:[{latitude:53,longitude:9,recordedAt:now}]});
    expect(saved.status).toBe('review_required');expect(saved.endedAt).toBe('2026-09-11T07:30:00Z');expect(mock.points).toHaveLength(2);
    expect(mock.writes.filter(w=>w.table==='employee_logbook_segments')).toHaveLength(0);
  });
  it('reads all stored GPS pages',async()=>{mock.points=Array.from({length:501},(_,i)=>({latitude:51,longitude:7,recorded_at:new Date(new Date('2026-09-14T06:30:00Z').getTime()+i*1000).toISOString()}));await finishLogbookTrip('trip',input);expect(mock.ranges).toEqual([[0,499],[500,999]]);});
  it('does not act on another employee',async()=>{await expect(finishLogbookTrip('trip',{...input,employeeId:'other'})).rejects.toThrow('nicht geladen');expect(mock.writes).toHaveLength(0);});
  it('never treats cancellation or review as kilometre approval',async()=>{mock.row.status='cancelled';await expect(finishLogbookTrip('trip',input)).rejects.toThrow('storniert');await expect(confirmEmployeeLogbookTrip({trip:{status:'review_required'} as LogbookTrip,distanceKm:1})).rejects.toThrow('Verwaltung');});
});
