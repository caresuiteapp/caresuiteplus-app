import type { WfmTimeEvent } from '@/types/modules/wfm';
import { berlinDateKey } from '@/lib/employeeLogbook/employeeLogbookDate';

type Interval = [number, number];
type State = { at: number; working: boolean; paused: boolean; kind?: 'drive' | 'service' };
const CLOCK_STARTS = new Set(['clock_in','office_check_in','homeoffice_start','standby_start','training_start','meeting_start','travel_start']);

function berlinMidnight(date: string): number {
  const probe = new Date(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(probe);
  return probe.getTime() - (Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value)) * 60_000;
}
function union(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const range of intervals.sort((a,b) => a[0]-b[0])) {
    const previous = merged[merged.length-1];
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1],range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Real event intervals, unioned across clock/Visit channels without counting gaps twice. */
export function deriveWfmRecordedDayTotals(events: WfmTimeEvent[], workDate: string, nowIso: string) {
  const dayStart = berlinMidnight(workDate);
  const nextDate = new Date(`${workDate}T12:00:00Z`); nextDate.setUTCDate(nextDate.getUTCDate()+1);
  const dayEnd = berlinMidnight(nextDate.toISOString().slice(0,10));
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now) || !Number.isFinite(dayStart)) throw new Error('Ungültiger Arbeitszeittag.');
  const states = new Map<string,State>(); const work: Interval[] = [], pauses: Interval[] = [];
  let lastEventAt: string | null = null;
  const advance = (state: State, end: number) => {
    const from = Math.max(dayStart,state.at), to = Math.min(dayEnd,end,now);
    if (state.working && to>from) { work.push([from,to]); if (state.paused) pauses.push([from,to]); }
  };
  for (const event of [...events].sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
    const at = Date.parse(event.occurredAt);
    if (!Number.isFinite(at) || at>now) throw new Error('Ungültiges oder zukünftiges Arbeitszeitereignis.');
    if (at>=dayEnd) continue;
    const assist = event.source==='assist' && event.referenceId;
    const channel = assist ? `visit:${event.referenceId}` : 'clock';
    const state = states.get(channel) ?? { at,working:false,paused:false };
    advance(state,at); state.at=at;
    if ((assist && ['visit_started','visit_drive_start'].includes(event.eventType)) || (!assist && CLOCK_STARTS.has(event.eventType))) {
      state.working=true;
      if (assist) state.kind=event.eventType==='visit_drive_start'?'drive':'service';
    }
    else if ((assist && (event.eventType==='visit_ended' || (state.kind==='drive' && ['visit_arrived','travel_end'].includes(event.eventType)))) || (!assist && event.eventType==='clock_out')) { state.working=false; state.paused=false; }
    else if (event.eventType==='pause_start' && state.working) state.paused=true;
    else if (event.eventType==='pause_end') state.paused=false;
    states.set(channel,state);
    if (at>=dayStart) lastEventAt=event.occurredAt;
  }
  const isOnline = [...states.values()].some(state => state.working);
  if (isOnline && workDate!==berlinDateKey(nowIso)) throw new Error('Nicht beendete historische Arbeitszeit: Abschluss muss geprüft werden.');
  for (const state of states.values()) advance(state,Math.min(now,dayEnd));
  const mergedWork=union(work), mergedPause=union(pauses);
  const grossMillis=mergedWork.reduce((sum,[from,to])=>sum+to-from,0);
  let pauseMillis=0;
  for (const [from,to] of mergedPause) for (const [start,end] of mergedWork) pauseMillis+=Math.max(0,Math.min(to,end)-Math.max(from,start));
  const grossMinutes=Math.round(grossMillis/60_000), pauseMinutes=Math.min(grossMinutes,Math.round(pauseMillis/60_000));
  return {grossMinutes,pauseMinutes,netMinutes:Math.max(0,grossMinutes-pauseMinutes),isOnline,lastEventAt,endedAt:isOnline?null:lastEventAt};
}
