// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultTenantCalendarSettings, type CalendarEvent } from '@/types/modules/calendarEvent';
import type { CalendarEventTemplate } from '@/types/calendar';
const f = vi.hoisted(() => ({ tenant:'tenant-a', actor:'actor-a', allowed:true, create:vi.fn(), update:vi.fn(), archive:vi.fn(), confirm:vi.fn(), close:vi.fn(), changed:vi.fn(), saveSettings:vi.fn(), push:vi.fn(), savePlan:vi.fn(), notify:vi.fn(), templates:vi.fn(), modal: {} as any }));
vi.mock('@/components/layout/platform', () => ({ PlatformModal: (props:any) => { f.modal=props; return props.visible ? <section role="dialog" aria-label={props.title}><button onClick={props.onClose}>Dialog schließen</button>{props.children}{props.footerContent}{props.footerActions?.map((action:any) => <button key={action.title} disabled={action.disabled} onClick={action.onPress}>{action.title}</button>)}</section> : null; } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push:f.push }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => f.allowed, isReadOnly:false }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile:{ id:f.actor, roleKey:'business_admin' } }) }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction:f.confirm }));
vi.mock('@/lib/calendar/calendarEventSaveService', () => ({ createCalendarEventFromForm:f.create, updateCalendarEventFromForm:f.update, resolveCalendarFormWritePermission: () => 'office.appointments.edit' }));
vi.mock('@/lib/calendar/calendarWorkspaceRefresh.web', () => ({ notifyCalendarWorkspaceChanged:f.notify }));
vi.mock('@/lib/calendar/calendarWorkspaceMutations', () => ({ archiveCustomCalendarEvent:f.archive }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList:async () => ({ ok:true, data:[{ id:'client-1', firstName:'Anna', lastName:'Meyer' }] }) }));
vi.mock('@/lib/assist/assignmentEmployeeListService', () => ({ fetchAssignmentEmployeeList:async () => ({ ok:true, data:[{ id:'employee-1', firstName:'Tom', lastName:'Neumann' },{ id:'employee-2', firstName:'Mara', lastName:'Becker' },{ id:'employee-3', firstName:'Lea', lastName:'Hoffmann' }] }) }));
vi.mock('@/components/ui/PremiumButton', () => ({ PremiumButton:({title,onPress,disabled}:any) => <button disabled={disabled} onClick={onPress}>{title}</button> }));
vi.mock('@/lib/calendar/employeePlanImport', () => ({ importEmployeePlan:vi.fn() }));
vi.mock('@/lib/calendar/employeeMonthPlanningService', () => ({ saveEmployeeMonth:f.savePlan }));
vi.mock('@/lib/calendar/calendarPlanningTemplates.web', () => ({ listCalendarPlanningTemplates:f.templates }));
import { CalendarEventCreateModal } from '@/components/calendar/CalendarEventCreateModal.web';
import { CalendarEventLabel, calendarEventAccessibleLabel } from '@/components/calendar/CalendarEventLabel.web';
import { CalendarEventDrawer, formatCalendarEventPeriod } from '@/components/calendar/CalendarEventDrawer.web';
import { EmployeeMonthPlanningModal } from '@/components/calendar/EmployeeMonthPlanningModal.web';
import { OfficeCalendarSettingsModal } from '@/components/office/calendar/OfficeCalendarSettingsModal.web';
let host:HTMLDivElement, root:Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true; vi.clearAllMocks(); f.tenant='tenant-a'; f.actor='actor-a'; f.allowed=true; f.templates.mockReset().mockResolvedValue({ok:true,data:[]}); f.confirm.mockResolvedValue(true); f.create.mockResolvedValue({ ok:false,error:'Speichern fehlgeschlagen' }); f.update.mockResolvedValue({ ok:true,data:{ sourceId:'source-1' } }); f.archive.mockResolvedValue({ ok:true,data:undefined }); host=document.createElement('div'); document.body.append(host); root=createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const mount = async (content:React.ReactNode) => { await act(async () => root.render(content)); };
const button = (text:string) => [...host.querySelectorAll('button')].find(node => node.textContent===text)!;
const click = async (text:string) => { expect(button(text),`Button ${text}`).toBeTruthy(); await act(async () => button(text).click()); };
const change = async (selector:string,value:string) => { const input=host.querySelector(selector) as HTMLInputElement; expect(input,selector).toBeTruthy(); await act(async () => { const prototype = input.tagName==='SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value); input.dispatchEvent(new Event(input.tagName==='SELECT' ? 'change' : 'input',{ bubbles:true })); }); };
const form = (visible=true) => <CalendarEventCreateModal visible={visible} sourceContext="calendar" calendarScope="office" moduleKey="office" onClose={f.close} onCreated={f.changed} />;
const title = () => [...host.querySelectorAll('label')].find(node => node.textContent?.includes('Titel *'))!.querySelector('input')!;
const basics = async () => { await mount(form()); const own=[...host.querySelectorAll('button')].find(node => node.textContent?.includes('Ohne Vorlage fortfahren'))!; await act(async () => own.click()); const input=title(); input.id='test-title'; await change('#test-title','Teamgespräch'); };
const preview = async () => { await click('Weiter'); await click('Weiter'); await click('Weiter'); };
const deferred = () => { let resolve!:(value:any)=>void; const promise=new Promise<any>(r => resolve=r); return { promise,resolve }; };
const event = (sourceType='custom_event'):CalendarEvent => ({ id:'event-1',title:'Teamgespräch',start:'2026-10-17T08:00:00Z',end:'2026-10-17T09:00:00Z',type:'termin',color:'#0878F9',sourceType,moduleKey:'office',clientName:'Anna Meyer',employeeName:'Tom Neumann', record:{ id:'record-1',tenantId:'tenant-a',sourceId:'source-1',sourceType,moduleKey:'office',internalNote:'Nur intern',address:'Musterstraße 1',isOfficeVisible:true,isModuleVisible:true } as any });
const meetingTemplate:CalendarEventTemplate = { id:'template-meeting',tenantId:null,moduleKey:'assist',templateKey:'assist_team_meeting',label:'Teamabstimmung',description:'Gemeinsame Planung',sourceType:'custom_event',eventType:'besprechung',defaultDurationMinutes:45,allDay:false,isSystem:true,isActive:true,roleKeys:[],fieldSchema:[],createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z' };
const chooseCard = async (text:string) => { const card=[...host.querySelectorAll('button')].find(node => node.querySelector('strong')?.textContent===text)!; expect(card, text).toBeTruthy(); await act(async () => card.click()); };
const employeeCheckbox = (name:string) => [...host.querySelectorAll('.cd-person-option')].find(node => node.textContent===name)?.querySelector('input') as HTMLInputElement;
const chooseEmployee = async (name:string) => { expect(employeeCheckbox(name),name).toBeTruthy(); await act(async () => employeeCheckbox(name).click()); };
const templateClock = () => { vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date('2026-10-17T08:00:00Z')); };
describe('active web calendar dialogs', () => {
  it('shows participant counts on meeting cards and all readable names in event details', async () => {
    const meeting=event(); meeting.type='team_meeting'; meeting.employeeName='Tom Neumann, Mara Becker';
    meeting.record={...meeting.record!,relatedEmployeeId:'employee-1',participantEmployeeIds:['employee-1','employee-2']};
    await mount(<CalendarEventLabel event={meeting}/>); expect(host.textContent).toContain('2 Mitarbeitende');
    expect(calendarEventAccessibleLabel(meeting)).toContain('Tom Neumann, Mara Becker');
    await mount(<CalendarEventDrawer visible event={meeting} onClose={f.close}/>);
    expect(host.textContent).toContain('Tom Neumann, Mara Becker');
  });
  it('applies an Assist calendar template and saves its type and duration as a calendar event', async () => {
    templateClock(); f.templates.mockResolvedValue({ok:true,data:[meetingTemplate]});
    await mount(<CalendarEventCreateModal visible sourceContext="calendar" calendarScope="module" moduleKey="assist" onClose={f.close}/>);
    await chooseCard('Termin oder Ereignis'); await chooseCard('Teamabstimmung');
    expect(title().value).toBe('Teamabstimmung');
    await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({moduleKey:'assist',sourceType:'custom_event',templateKey:'assist_team_meeting',eventType:'besprechung',title:'Teamabstimmung',allDay:false,startAt:'2026-10-17T08:00:00.000Z',endAt:'2026-10-17T08:45:00.000Z'}),'business_admin');
    expect(f.push).not.toHaveBeenCalled();
  });
  it('applies all-day template duration with an inclusive final calendar day', async () => {
    templateClock(); const template={...meetingTemplate,id:'template-day',templateKey:'team_days',label:'Teamtage',allDay:true,defaultDurationMinutes:2880};
    f.templates.mockResolvedValue({ok:true,data:[template]}); await mount(form()); await chooseCard('Teamtage');
    await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({sourceType:'custom_event',templateKey:'team_days',eventType:'besprechung',allDay:true,startAt:'2026-10-17T00:00:00.000Z',endAt:'2026-10-18T23:59:59.999Z'}),'business_admin');
  });
  it('clears the previous template and restores unedited defaults when continuing without one', async () => {
    templateClock(); const template={...meetingTemplate,allDay:true,defaultDurationMinutes:2880};
    f.templates.mockResolvedValue({ok:true,data:[template]}); await mount(form()); await chooseCard('Teamabstimmung');
    await click('Zurück'); await chooseCard('Ohne Vorlage fortfahren');
    expect(title().value).toBe(''); title().id='own-title'; await change('#own-title','Eigener Termin');
    await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({title:'Eigener Termin',templateKey:null,eventType:'termin',allDay:false,startAt:'2026-10-17T08:00:00.000Z',endAt:'2026-10-17T09:00:00.000Z'}),'business_admin');
  });
  it('retains an edited title and time range when removing the originating template', async () => {
    templateClock(); f.templates.mockResolvedValue({ok:true,data:[meetingTemplate]}); await mount(form()); await chooseCard('Teamabstimmung');
    title().id='edited-title'; await change('#edited-title','Individuelles Teamgespräch'); await click('Weiter');
    await change('[aria-label="Beginn: Uhrzeit"]','13:15'); await change('[aria-label="Ende: Uhrzeit"]','14:45');
    await click('Zurück'); await click('Zurück'); await chooseCard('Ohne Vorlage fortfahren');
    expect(title().value).toBe('Individuelles Teamgespräch'); await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({title:'Individuelles Teamgespräch',templateKey:null,eventType:'termin',startAt:'2026-10-17T11:15:00.000Z',endAt:'2026-10-17T12:45:00.000Z'}),'business_admin');
  });
  it('starts a preselected template with applied defaults and resets them when reopened', async () => {
    templateClock(); f.templates.mockResolvedValue({ok:true,data:[meetingTemplate]});
    const preselected=(visible=true) => <CalendarEventCreateModal visible={visible} sourceContext="calendar" calendarScope="office" moduleKey="office" preselectedTemplate={meetingTemplate} onClose={f.close}/>;
    await mount(preselected());
    expect(title().value).toBe('Teamabstimmung');
    await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({title:'Teamabstimmung',templateKey:'assist_team_meeting',eventType:'besprechung',allDay:false,startAt:'2026-10-17T08:00:00.000Z',endAt:'2026-10-17T08:45:00.000Z'}),'business_admin');
    await click('Zurück'); await click('Zurück'); await click('Zurück'); title().id='changed-preselected'; await change('#changed-preselected','Alter Entwurf');
    await mount(preselected(false)); await mount(preselected());
    expect(title().value).toBe('Teamabstimmung');
    await click('Weiter'); expect((host.querySelector('[aria-label="Ende: Uhrzeit"]') as HTMLInputElement).value).toBe('10:45');
  });
  it('retains focus and typed title while editing, saves stable person IDs and keeps rejected save open', async () => {
    await basics(); title().focus(); await change('#test-title','Teamgespräch morgen'); expect(document.activeElement).toBe(title());
    host.querySelector('select')!.id='client'; await change('#client','client-1'); await chooseEmployee('Tom Neumann'); await preview();
    expect(host.textContent).toContain('Anna Meyer'); expect(host.textContent).toContain('Tom Neumann'); await click('Termin speichern'); expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ title:'Teamgespräch morgen',relatedClientId:'client-1',relatedEmployeeId:'employee-1',sourceType:'custom_event' }),'business_admin'); expect(host.textContent).toContain('Speichern fehlgeschlagen'); expect(f.close).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled();
  });
  it('keeps selected employees across search and saves every participant in the preview', async () => {
    await basics(); await chooseEmployee('Tom Neumann');
    await change('input[type="search"]','mara'); expect(employeeCheckbox('Tom Neumann')).toBeUndefined();
    expect(host.querySelector('[aria-label="Ausgewählte Mitarbeitende"]')?.textContent).toContain('Tom Neumann');
    await chooseEmployee('Mara Becker'); await change('input[type="search"]','');
    expect(employeeCheckbox('Tom Neumann').checked).toBe(true); expect(employeeCheckbox('Mara Becker').checked).toBe(true);
    expect(host.textContent).toContain('2 Personen ausgewählt'); await preview();
    expect(host.textContent).toContain('Tom Neumann'); expect(host.textContent).toContain('Mara Becker');
    await click('Termin speichern'); expect(f.create).toHaveBeenCalledWith(expect.objectContaining({relatedEmployeeId:'employee-1',participantEmployeeIds:['employee-1','employee-2']}),'business_admin');
  });
  it('selects the whole team even during a search and removes an individual participant', async () => {
    await basics(); await change('input[type="search"]','mara'); await click('Alle auswählen');
    expect(host.textContent).toContain('3 Personen ausgewählt'); expect(button('Alle auswählen').disabled).toBe(true);
    await act(async () => (host.querySelector('[aria-label="Tom Neumann aus Auswahl entfernen"]') as HTMLButtonElement).click());
    await preview(); await click('Termin speichern');
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({relatedEmployeeId:'employee-2',participantEmployeeIds:['employee-2','employee-3']}),'business_admin');
  });
  it('restores multiple employees while editing and supports clearing the portal release with the selection', async () => {
    const saved=event(); saved.record={...saved.record!,relatedEmployeeId:'employee-1',participantEmployeeIds:['employee-1','employee-2'],isEmployeePortalVisible:true};
    await mount(<CalendarEventCreateModal visible sourceContext="calendar" calendarScope="office" moduleKey="office" editEvent={saved} onClose={f.close}/>);
    expect(employeeCheckbox('Tom Neumann').checked).toBe(true); expect(employeeCheckbox('Mara Becker').checked).toBe(true);
    await preview(); await click('Änderungen speichern');
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({participantEmployeeIds:['employee-1','employee-2'],isEmployeePortalVisible:true}),'business_admin');
    await click('Zurück'); await click('Zurück'); await click('Zurück'); await click('Auswahl aufheben');
    expect(host.textContent).toContain('0 Personen ausgewählt'); await preview(); await click('Änderungen speichern');
    expect(f.update).toHaveBeenLastCalledWith(expect.objectContaining({relatedEmployeeId:null,participantEmployeeIds:[],isEmployeePortalVisible:false}),'business_admin');
  });
  it('preserves a legacy single employee and clears the selection when another tenant opens the dialog', async () => {
    const saved=event(); saved.record={...saved.record!,relatedEmployeeId:'employee-2'};
    await mount(<CalendarEventCreateModal visible sourceContext="calendar" calendarScope="office" moduleKey="office" editEvent={saved} onClose={f.close}/>);
    expect(employeeCheckbox('Mara Becker').checked).toBe(true); await preview(); await click('Änderungen speichern');
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({participantEmployeeIds:['employee-2']}),'business_admin');
    f.tenant='tenant-b'; await mount(form()); await chooseCard('Ohne Vorlage fortfahren');
    expect(host.textContent).toContain('0 Personen ausgewählt'); expect(employeeCheckbox('Mara Becker').checked).toBe(false);
  });
  it('blocks continuation for inverted times before preview', async () => {
    await basics(); await click('Weiter'); await change('[aria-label="Beginn: Datum"]','2026-10-19'); await change('[aria-label="Ende: Datum"]','2026-10-18'); await click('Weiter'); expect(host.textContent).toContain('späteres Ende'); expect(host.querySelector('[aria-label="Beginn: Datum"]')).not.toBeNull(); expect(f.create).not.toHaveBeenCalled();
  });
  it('keeps saving single-flight and does not close while pending', async () => {
    const pending=deferred(); f.create.mockReturnValue(pending.promise); await basics(); await preview(); await click('Termin speichern'); await click('Dialog schließen'); expect(f.close).not.toHaveBeenCalled(); expect(f.create).toHaveBeenCalledOnce(); await act(async () => pending.resolve({ ok:true,data:{sourceId:'saved'} })); expect(f.changed).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledOnce(); expect(f.notify).toHaveBeenCalledExactlyOnceWith('tenant-a');
  });
  it('retries partial persistence with the same source ID', async () => {
    f.create.mockResolvedValue({ ok:false,persistedSourceId:'saved-source',error:'Abgleich offen' }); await basics(); await preview(); await click('Termin speichern'); await click('Abgleich erneut versuchen'); expect(f.create).toHaveBeenCalledOnce(); expect(f.update).toHaveBeenCalledWith(expect.objectContaining({existingSourceId:'saved-source'}),'business_admin');
  });
  it('asks before discarding changes and preserves the form on cancellation', async () => {
    f.confirm.mockResolvedValue(false); await basics(); await click('Dialog schließen'); expect(f.confirm).toHaveBeenCalledOnce(); expect(f.close).not.toHaveBeenCalled(); expect(title().value).toBe('Teamgespräch');
  });
  it('does not accept late completion after switching tenant', async () => {
    const pending=deferred(); f.create.mockReturnValue(pending.promise); await basics(); await preview(); await click('Termin speichern'); f.tenant='tenant-b'; await mount(form()); await act(async () => pending.resolve({ok:true,data:{sourceId:'old'}})); expect(f.close).not.toHaveBeenCalled(); expect(f.changed).not.toHaveBeenCalled();
  });
  it('makes an Office appointment editable and returns to details without losing its identity', async () => {
    await mount(<CalendarEventDrawer visible event={event('appointment')} onClose={f.close} onUpdated={f.changed} />); expect(host.textContent).toContain('Musterstraße 1'); expect(host.textContent).toContain('Nur intern'); await click('Bearbeiten'); expect(title().value).toBe('Teamgespräch'); await click('Dialog schließen'); expect(host.querySelector('[aria-label="Termindetails"]')).not.toBeNull(); expect(f.close).not.toHaveBeenCalled();
  });
  it('archives only a permitted custom event after confirmation and keeps failures visible', async () => {
    f.archive.mockResolvedValue({ok:false,error:'Keine Schreibberechtigung'}); await mount(<CalendarEventDrawer visible event={event()} onClose={f.close} onUpdated={f.changed} />); await click('Termin entfernen'); expect(f.archive).toHaveBeenCalledWith('tenant-a','record-1','business_admin'); expect(host.textContent).toContain('Keine Schreibberechtigung'); expect(f.close).not.toHaveBeenCalled();
  });
  it('never offers direct edits or removal for assignments or denied roles', async () => {
    const assignment={...event('assist_visit'),href:'/assist/assignments/visit-1'}; await mount(<CalendarEventDrawer visible event={assignment} onClose={f.close} />); expect(button('Bearbeiten')).toBeUndefined(); expect(button('Termin entfernen')).toBeUndefined(); await click('Einsatz öffnen'); expect(f.push).toHaveBeenCalledWith('/assist/assignments/visit-1'); f.allowed=false; await mount(<CalendarEventDrawer visible event={event()} onClose={f.close} />); expect(button('Bearbeiten')).toBeUndefined(); expect(button('Termin entfernen')).toBeUndefined();
  });
  it('keeps settings save errors inside the modal and disables writes without tenant management', async () => {
    f.saveSettings.mockRejectedValue(new Error('Datenbank nicht erreichbar')); const settings=() => <OfficeCalendarSettingsModal visible initial={null} saving={false} onSave={f.saveSettings} onClose={f.close}/>; await mount(settings()); await click('Einstellungen speichern'); expect(host.textContent).toContain('Datenbank nicht erreichbar'); expect(f.close).not.toHaveBeenCalled(); f.allowed=false; await mount(settings()); expect(button('Einstellungen speichern').disabled).toBe(true); await click('Einstellungen speichern'); expect(f.saveSettings).toHaveBeenCalledOnce();
  });
  it('preserves the settings draft across fresh equivalent server objects and a rejected save', async () => {
    const pending=deferred(); f.saveSettings.mockReturnValue(pending.promise);
    const defaults=buildDefaultTenantCalendarSettings('tenant-a');
    const settings=(saving=false) => <OfficeCalendarSettingsModal visible initial={{ ...defaults,visibleTypes:{...defaults.visibleTypes} }} saving={saving} onSave={f.saveSettings} onClose={f.close}/>;
    await mount(settings()); const week=[...host.querySelectorAll('button')].find(node => node.textContent?.startsWith('Woche'))!; await act(async () => week.click());
    await click('Einstellungen speichern'); await mount(settings(true));
    const selected=() => [...host.querySelectorAll('button')].find(node => node.getAttribute('aria-pressed')==='true'); expect(selected()?.textContent).toContain('Woche');
    await act(async () => pending.resolve({ok:false,error:'Einstellungen nicht gespeichert'})); await mount(settings());
    expect(selected()?.textContent).toContain('Woche'); expect(host.textContent).toContain('Einstellungen nicht gespeichert'); expect(f.saveSettings.mock.calls[0][0].defaultView).toBe('week');
  });
  it('keeps manual month planning scoped to the selected employee and prevents duplicate submissions', async () => {
    const pending=deferred(); f.savePlan.mockReturnValue(pending.promise);
    await mount(<EmployeeMonthPlanningModal tenantId="tenant-a" employeeId="employee-1" employeeName="Tom Neumann" month="2026-10" events={[]} onClose={f.close} onSaved={f.changed}/>);
    await act(async () => (host.querySelector('[aria-label="Tag 2026-10-19"]') as HTMLElement).click()); await click('1 Tag hinzufügen');
    const save=f.modal.footerActions[0].onPress; await act(async () => { void save(); void save(); });
    expect(f.savePlan).toHaveBeenCalledOnce(); expect(f.savePlan).toHaveBeenCalledWith('tenant-a','employee-1','2026-10',0,[expect.objectContaining({date:'2026-10-19',kind:'available',startTime:'08:00',endTime:'24:00'})]);
    await click('Dialog schließen'); expect(f.close).not.toHaveBeenCalled(); await act(async () => pending.resolve({ revision:1 })); expect(f.changed).toHaveBeenCalledOnce();
  });
  it('keeps failed month plans open and prohibits saving without planning permission', async () => {
    f.savePlan.mockRejectedValue(new Error('Plan wurde inzwischen geändert'));
    const plan=() => <EmployeeMonthPlanningModal tenantId="tenant-a" employeeId="employee-1" employeeName="Tom Neumann" month="2026-10" events={[]} onClose={f.close} onSaved={f.changed}/>;
    await mount(plan()); await click('Monatsplan speichern'); expect(host.textContent).toContain('Plan wurde inzwischen geändert'); expect(f.changed).not.toHaveBeenCalled();
    f.allowed=false; await mount(plan()); expect(button('Monatsplan speichern').disabled).toBe(true); expect(host.textContent).toContain('Schreibberechtigung');
  });
  it('formats all-day inclusive dates without timezone shifts and timed events in Berlin', () => {
    expect(formatCalendarEventPeriod({...event(),allDay:true,start:'2026-10-17T00:00:00.000Z',end:'2026-10-17T23:59:59.999Z'})).toBe('17.10.2026 · ganztägig'); expect(formatCalendarEventPeriod(event())).toBe('17.10.2026, 10:00 – 11:00 Uhr');
  });
});
