import { beforeEach, describe, expect, it } from 'vitest';
import { officeMonthPeriod, shiftOfficeMonth } from '@/lib/wfm/wfmOfficeMonth';
import { calculateOfficeLogbookTime, officeAbsenceMinutes } from '@/lib/wfm/wfmOfficeLinkedTotals';
import { createWfmOfficeManualEntry, applyWfmOfficeTimeCorrection, getWfmOfficeTimeOverview } from '@/lib/wfm/wfmOfficeTimekeepingService';
import { resetWfmOfficeTimekeepingStore } from '@/lib/wfm/wfmOfficeTimekeepingStore';
import { resetWfmTimeReviewDemoStore } from '@/lib/wfm/wfmTimeReviewService';
import { notifyWfmOfficeDataChanged } from '@/lib/wfm/wfmOfficeDataChanged';
import { registerRealtimeSubscription, clearAllRealtimeSubscriptions } from '@/lib/realtime/channelManager';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
const tenant = 'tenant-month-sync-test', role = 'business_manager' as const;
const trip = (start: string, end: string, counts=true, status='completed') => ({started_at:`2026-08-03T${start}:00Z`,ended_at:`2026-08-03T${end}:00Z`,status,counts_as_work_time:counts});
describe('Office month selection and connected totals',()=>{
 beforeEach(()=>{resetWfmOfficeTimekeepingStore();resetWfmTimeReviewDemoStore();clearAllRealtimeSubscriptions();});
 it('selects historical months, leap years and year boundaries',()=>{
  expect(officeMonthPeriod('2024-02').toDate).toBe('2024-02-29');
  expect(officeMonthPeriod('2026-02').toDate).toBe('2026-02-28');
  expect(shiftOfficeMonth('2026-01',-1)).toBe('2025-12');
  expect(shiftOfficeMonth('2026-12',1)).toBe('2027-01');
  expect(()=>officeMonthPeriod('2026-13')).toThrow();
 });
 it('counts driving intervals once and does not add travel already inside booked work',()=>{
  const entries=[{actualStartAt:'2026-08-03T08:00:00Z',actualEndAt:'2026-08-03T09:00:00Z'}] as WfmOfficeTimeEntry[];
  const totals=calculateOfficeLogbookTime([trip('07:30','08:15'),trip('07:45','08:30'),trip('09:00','09:30',false),trip('10:00','11:00',true,'cancelled')],entries);
  expect(totals).toEqual({travelMinutes:60,additionalMinutes:30});
  expect(calculateOfficeLogbookTime([trip('08:00','08:30')],entries).additionalMinutes).toBe(0);
 });
 it('credits approved absence only on contractual days in the selected period',()=>{
  const absence={status:'approved',absence_type:'vacation',starts_at:'2026-08-01',ends_at:'2026-08-07'};
  expect(officeAbsenceMinutes(absence,{mon:8,tue:4},'2026-08-01','2026-08-02')).toBe(0);
  expect(officeAbsenceMinutes(absence,{mon:8,tue:4},'2026-08-03','2026-08-03')).toBe(480);
  expect(officeAbsenceMinutes({...absence,status:'rejected'},{mon:8},'2026-08-01','2026-08-07')).toBe(0);
 });
 it('reloads historical saved entries from review persistence after clearing transient entry maps',async()=>{
  const first=await createWfmOfficeManualEntry(tenant,'reviewer',role,{employeeId:'employee',workDate:'2026-08-03',workKind:'buero',actualStartAt:'2026-08-03T08:00:00Z',actualEndAt:'2026-08-03T10:00:00Z',pauseMinutes:15,reason:'Nachtrag'});
  expect(first.ok, JSON.stringify(first)).toBe(true); if(!first.ok) return;
  resetWfmOfficeTimekeepingStore();
  const read=await getWfmOfficeTimeOverview(tenant,role,{preset:'custom',fromDate:'2026-08-01',toDate:'2026-08-31'});
  expect(read.ok && read.data.entries.find(e=>e.id===first.data.id)?.netMinutes).toBe(105);
  const corrected=await applyWfmOfficeTimeCorrection(tenant,'reviewer',role,{entryId:first.data.id,pauseMinutes:120,reason:'Vollständig als Pause korrigiert'},first.data);
  expect(corrected.ok && corrected.data.netMinutes).toBe(0);
  const stale=await applyWfmOfficeTimeCorrection(tenant,'reviewer',role,{entryId:first.data.id,pauseMinutes:30,reason:'Veralteter Entwurf'},first.data);
  expect(stale.ok).toBe(false);
 });
 it('refreshes every open view of this tenant immediately, isolating failing listeners',()=>{
  let a=0,b=0,other=0;
  registerRealtimeSubscription(`wfm-live:${tenant}`,{handlers:new Set([()=>{a++;},()=>{throw new Error('failed query');},()=>{b++;}]),pollCleanup:null});
  registerRealtimeSubscription('wfm-live:other',{handlers:new Set([()=>{other++;}]),pollCleanup:null});
  notifyWfmOfficeDataChanged(tenant); expect([a,b,other]).toEqual([1,1,0]);
 });
});
