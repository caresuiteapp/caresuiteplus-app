import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDeferredTimeCard } from '@/components/portal/EmployeeDeferredTimeCard';
import type { EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel.web';
const h=vi.hoisted(()=>({values:[] as any[],cursor:0,submit:vi.fn(),session:vi.fn()}));
vi.mock('react',async original=>({...await original<object>(),
  useState:(initial:any)=>{const i=h.cursor++;if(!(i in h.values))h.values[i]=initial;return [h.values[i],(v:any)=>{h.values[i]=typeof v==='function'?v(h.values[i]):v;}];},
  useRef:(initial:any)=>{const i=h.cursor++;return h.values[i]??={current:initial};},
}));
vi.mock('react-native',()=>({View:'View',Text:'Text',StyleSheet:{create:(s:any)=>s}}));
vi.mock('@/components/ui',()=>({PremiumButton:'Button',PremiumInput:'Input'}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({portalSession:null})}));
vi.mock('@/lib/auth/portalSupabaseAuth',()=>({ensurePortalWriteSession:(...a:any[])=>h.session(...a)}));
vi.mock('@/lib/portal/employeeDeferredTimeService',()=>({submitEmployeeDeferredTime:(...a:any[])=>h.submit(...a)}));
vi.mock('@/lib/portal/employeeDeferredTimeModel',()=>({EMPLOYEE_DEFERRED_REASON_LABELS:{incomplete:'Abschluss fehlt oder ist ungültig',missing:'Zeiterfassung fehlt'}}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>null}));
const saved=vi.fn(),open=vi.fn();
let task:EmployeeDeferredTime;
function nodes(n:any):any[]{return Array.isArray(n)?n.flatMap(nodes):n?.props?[n,...nodes(n.props.children)]:[];}
function render(){h.cursor=0;return nodes(EmployeeDeferredTimeCard({task,onSaved:saved,onOpenVisit:open}));}
function press(title:string){return render().find(n=>n.props.title===title).props.onPress();}
function fill(label:string,value:string){render().find(n=>n.props.label===label).props.onChangeText(value);}
function complete(){press('Zeiten korrigieren');fill('Arbeitsbeginn (TT.MM.JJJJ HH:MM)','31.10.2026 09:00');fill('Arbeitsende (TT.MM.JJJJ HH:MM)','31.10.2026 10:30');fill('Grund der Korrektur','Abschluss nachgetragen');}
beforeEach(()=>{
  vi.clearAllMocks();h.values=[];h.cursor=0;
  task={id:'session:source',workDate:'2026-10-31',label:'Arbeitszeit',reason:'incomplete',state:'correction_needed',entryKind:'session',referenceId:'source',
    sourceUpdatedAt:'2026-11-01T12:00:00Z',reviewUpdatedAt:null,visitRouteId:null,note:null,
    entry:{id:'session:source',actualStartAt:null,actualEndAt:null,pauseMinutes:0,plannedStartAt:'2026-10-31T08:00:00Z',plannedEndAt:'2026-10-31T10:00:00Z'} as any};
  h.session.mockResolvedValue({ok:true});h.submit.mockResolvedValue({ok:true,data:{reviewId:'review'}});saved.mockResolvedValue(true);
});
describe('employee correction form',()=>{
  it('never pre-fills actual work with planned times',()=>{
    press('Zeiten korrigieren');
    expect(render().filter(n=>n.type==='Input').slice(0,2).map(n=>n.props.value)).toEqual(['','']);
  });
  it('submits the entered times and preserves their source identity, then refreshes',async()=>{
    complete();await press('Korrektur zur Prüfung einreichen');
    expect(h.submit).toHaveBeenCalledWith(expect.objectContaining({task,reason:'Abschluss nachgetragen',pauseMinutes:0}));
    expect(saved).toHaveBeenCalledTimes(1);
    expect(render().some(n=>n.props.children==='Korrektur eingereicht. Die Verwaltung prüft die Zeiten vor der Nachberechnung.')).toBe(true);
  });
  it('requires complete actuals and a reason',async()=>{
    press('Zeiten korrigieren');await press('Korrektur zur Prüfung einreichen');expect(h.submit).not.toHaveBeenCalled();
    fill('Arbeitsbeginn (TT.MM.JJJJ HH:MM)','31.10.2026 09:00');fill('Arbeitsende (TT.MM.JJJJ HH:MM)','31.10.2026 10:30');
    await press('Korrektur zur Prüfung einreichen');expect(h.submit).not.toHaveBeenCalled();
    expect(render().some(n=>n.props.children==='Bitte begründen Sie die Korrektur.')).toBe(true);
  });
  it('retains the form after a server failure and never announces an unsaved correction',async()=>{
    h.submit.mockResolvedValue({ok:false,error:'Die Buchung wurde inzwischen geändert.'});complete();await press('Korrektur zur Prüfung einreichen');
    expect(render().find(n=>n.props.label==='Grund der Korrektur').props.value).toBe('Abschluss nachgetragen');
    expect(saved).not.toHaveBeenCalled();
    expect(render().some(n=>n.props.children==='Die Buchung wurde inzwischen geändert.')).toBe(true);
  });
  it('blocks concurrent submissions and requires a writable session',async()=>{
    let finish!:(v:any)=>void;h.submit.mockImplementation(()=>new Promise(r=>{finish=r;}));complete();
    const first=press('Korrektur zur Prüfung einreichen');await Promise.resolve();await press('Korrektur zur Prüfung einreichen');
    expect(h.submit).toHaveBeenCalledTimes(1);finish({ok:true,data:{reviewId:'one'}});await first;
    h.values=[];h.submit.mockClear();h.session.mockResolvedValue({ok:false,error:'Erneut anmelden'});complete();await press('Korrektur zur Prüfung einreichen');
    expect(h.submit).not.toHaveBeenCalled();
  });
  it.each(['awaiting_review','office_required'] as const)('does not offer an edit for %s',state=>{
    task={...task,state};expect(render().some(n=>n.props.title==='Zeiten korrigieren')).toBe(false);
  });
  it('reports that saving succeeded even if refreshing subsequently fails',async()=>{
    saved.mockResolvedValue(false);complete();await press('Korrektur zur Prüfung einreichen');
    expect(render().some(n=>n.props.children==='Korrektur eingereicht. Der Listenstand konnte noch nicht aktualisiert werden. Bitte erneut laden.')).toBe(true);
  });
});
