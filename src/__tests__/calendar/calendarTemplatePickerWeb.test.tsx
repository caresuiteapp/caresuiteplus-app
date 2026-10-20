// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventTemplate } from '@/types/calendar';

const f = vi.hoisted(() => ({ tenant:'tenant-a', role:'business_admin', list:vi.fn(), select:vi.fn(), own:vi.fn() }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({profile:{id:'actor-a',roleKey:f.role}}) }));
vi.mock('@/lib/calendar/calendarPlanningTemplates.web', () => ({ listCalendarPlanningTemplates:f.list }));
import { CalendarEventTemplatePicker } from '@/components/calendar/CalendarEventTemplatePicker.web';

const template = (patch:Partial<CalendarEventTemplate> = {}):CalendarEventTemplate => ({
  id:'system-meeting',tenantId:null,moduleKey:'assist',templateKey:'assist_team_meeting',label:'Teamgespräch',description:'Gemeinsame Planung',sourceType:'custom_event',eventType:'besprechung',defaultDurationMinutes:45,allDay:false,isSystem:true,isActive:true,roleKeys:[],fieldSchema:[],createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',...patch,
});
let host:HTMLDivElement, root:Root;
beforeEach(() => {
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  f.tenant='tenant-a'; f.role='business_admin'; f.list.mockReset().mockResolvedValue({ok:true,data:[template()]}); f.select.mockReset(); f.own.mockReset();
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (disabled=false, selectedId?:string) => { await act(async () => root.render(<CalendarEventTemplatePicker moduleKey="assist" selectedId={selectedId} onSelect={f.select} onContinueWithoutTemplate={f.own} disabled={disabled}/>)); };
const button = (label:string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent===label || node.querySelector('strong')?.textContent===label)!;
const click = async (label:string) => { expect(button(label),label).toBeTruthy(); await act(async () => button(label).click()); };
const search = async (query:string) => {
  const input=host.querySelector<HTMLInputElement>('[aria-label="Kalendervorlage suchen"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,query); input.dispatchEvent(new Event('input',{bubbles:true})); });
};
const deferred = () => { let resolve!:(value:unknown)=>void; const promise=new Promise(resolveValue => { resolve=resolveValue; }); return {promise,resolve}; };

describe('calendar planning template picker on Web', () => {
  it('searches titles, descriptions and template keys and restores the full list after no results', async () => {
    const meeting=template(), reminder=template({id:'tenant-reminder',tenantId:'tenant-a',templateKey:'tenant_callback',label:'Rückruf',description:'Telefonische Rückmeldung',eventType:'erinnerung',isSystem:false});
    f.list.mockResolvedValue({ok:true,data:[meeting,reminder]}); await render(false,reminder.id);
    expect(host.textContent).toContain('2 Vorlagen'); expect(button('Rückruf').getAttribute('aria-pressed')).toBe('true');
    expect(button('Rückruf').textContent).toContain('Eigene Vorlage');
    await search('TEAMGESPRÄCH'); expect(button('Teamgespräch')).toBeTruthy(); expect(button('Rückruf')).toBeUndefined();
    await search('telefonische'); expect(button('Rückruf')).toBeTruthy(); expect(button('Teamgespräch')).toBeUndefined();
    await search('  ASSIST_TEAM_MEETING  '); expect(button('Teamgespräch')).toBeTruthy();
    await search('kein treffer'); expect(host.textContent).toContain('Keine Vorlage passt zu deiner Suche.');
    await click('Suche zurücksetzen'); expect(host.textContent).toContain('2 Vorlagen');
    expect((host.querySelector('[aria-label="Kalendervorlage suchen"]') as HTMLInputElement).value).toBe('');
    await click('Rückruf'); expect(f.select).toHaveBeenCalledExactlyOnceWith(reminder);
    await click('Ohne Vorlage fortfahren'); expect(f.own).toHaveBeenCalledOnce();
  });

  it('shows an actual empty catalogue without pretending the search caused it', async () => {
    f.list.mockResolvedValue({ok:true,data:[]}); await render();
    expect(host.textContent).toContain('Für diesen Bereich sind derzeit keine Kalendervorlagen verfügbar.');
    expect(host.textContent).not.toContain('Keine Vorlage passt zu deiner Suche.');
    expect(button('Suche zurücksetzen')).toBeUndefined();
    await click('Ohne Vorlage fortfahren'); expect(f.own).toHaveBeenCalledOnce();
  });

  it('keeps source failures visible and reloads successfully on request', async () => {
    f.list.mockResolvedValueOnce({ok:false,error:'Vorlagen konnten nicht geladen werden.'}).mockResolvedValueOnce({ok:true,data:[template()]});
    await render(); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Vorlagen konnten nicht geladen werden.');
    expect(host.textContent).not.toContain('0 Vorlagen');
    await click('Erneut laden'); expect(button('Teamgespräch')).toBeTruthy();
    expect(host.querySelector('[role="alert"]')).toBeNull(); expect(f.list).toHaveBeenCalledTimes(2);
    expect(f.list).toHaveBeenLastCalledWith('assist','tenant-a','business_admin');
  });

  it('discards stale tenant and role responses while loading the current catalogue', async () => {
    const first=deferred(), second=deferred(), third=deferred(), fourth=deferred();
    f.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise).mockReturnValueOnce(fourth.promise);
    await render(); f.tenant='tenant-b'; await render();
    await act(async () => first.resolve({ok:true,data:[template({label:'Alter Mandant'})]}));
    expect(host.textContent).not.toContain('Alter Mandant'); expect(host.textContent).toContain('Vorlagen werden geladen');
    f.role='caregiver'; await render();
    await act(async () => second.resolve({ok:true,data:[template({label:'Alte Rollenfreigabe'})]}));
    expect(host.textContent).not.toContain('Alte Rollenfreigabe');
    await act(async () => third.resolve({ok:true,data:[template({label:'Aktuelle Freigabe'})]}));
    expect(button('Aktuelle Freigabe')).toBeTruthy(); expect(f.list).toHaveBeenLastCalledWith('assist','tenant-b','caregiver');
    await search('Aktuelle'); f.role='business_admin'; await render();
    expect(button('Aktuelle Freigabe')).toBeUndefined();
    expect((host.querySelector('[aria-label="Kalendervorlage suchen"]') as HTMLInputElement).value).toBe('');
    await act(async () => fourth.resolve({ok:true,data:[template({label:'Neue Rolle'})]}));
    expect(button('Neue Rolle')).toBeTruthy();
  });

  it('disables template selection and own-entry actions when the parent blocks editing', async () => {
    await render(true); expect(button('Teamgespräch').disabled).toBe(true); expect(button('Ohne Vorlage fortfahren').disabled).toBe(true);
    expect((host.querySelector('[aria-label="Kalendervorlage suchen"]') as HTMLInputElement).disabled).toBe(true);
    await click('Teamgespräch'); await click('Ohne Vorlage fortfahren');
    expect(f.select).not.toHaveBeenCalled(); expect(f.own).not.toHaveBeenCalled();
  });
});
