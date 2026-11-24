// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { BfarmReferenceLookup } from '@/components/pflege/BfarmReferenceLookup';

const mock=vi.hoisted(()=>({get:vi.fn(),pick:vi.fn(),allowed:true}));
vi.mock('@/lib/pflege/bfarmReferenceService',()=>({getBfarmReference:mock.get}));
vi.mock('@/theme',()=>({radius:{md:8,lg:12},spacing:{xs:4,sm:8,md:12},typography:{},useLegacyTheme:()=>({colors:{borderStrong:'#adc5db',bgInput:'#eff5ff',primary:'#1462aa',textPrimary:'#13283b',textSecondary:'#37526d'}})}));
vi.mock('@/components/ui/PremiumButton',()=>({PremiumButton:({title,disabled,loading,onPress}:{title:string;disabled?:boolean;loading?:boolean;onPress?:()=>void})=>
  <button disabled={disabled||loading} onClick={onPress}>{title}</button>}));
vi.mock('@/components/ui/PremiumInput',()=>({PremiumInput:({label,value,onChangeText,hint}:{label:string;value:string;hint?:ReactNode;onChangeText:(s:string)=>void})=>
  <label>{label}<input aria-label={label} value={value} onInput={e=>onChangeText(e.currentTarget.value)} />{hint}</label>}));
const tenant='10000000-0000-4000-8000-000000000001';
const record={product:{pzn:'00000017',name:'Testpräparat',ingredient:'Testwirkstoff',strength:null,dosageForm:'Kombipackung',brand:null,manufacturer:null,packageSize:null,source:'bfarm-31b',sourceVersion:'2026-11-15'},
  components:[{number:1,dosageForm:'Tablette',description:null,substances:[{name:'Testwirkstoff',strength:null,id:'00127',rank:0}]},
    {number:2,dosageForm:'Tablette',description:null,substances:[{name:'Testwirkstoff',strength:'10 mg',id:'00127',rank:1}]}],
  checkedAt:'2026-11-24T12:00:00Z',nextExpectedOn:'2026-12-01',stale:false};
let host:HTMLDivElement,root:Root;
const field=()=>host.querySelector('input')!;
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(e=>e.textContent===label)!;
const type=async(value:string)=>act(async()=>{field().value=value;field().dispatchEvent(new Event('input',{bubbles:true}));});
const click=async(label:string)=>act(async()=>button(label).click());
const render=async(props={})=>act(async()=>root.render(<BfarmReferenceLookup tenantId={tenant} enabled canEditNow={()=>mock.allowed} {...props} />));
beforeEach(()=>{(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;vi.resetAllMocks();mock.allowed=true;mock.get.mockResolvedValue({ok:true,data:record});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('BfArM exact PZN lookup',()=>{
  it('requests only a complete PZN and displays components with source and delivery date',async()=>{
    await render();await type('00');await click('Arzneimittel abrufen');expect(mock.get).not.toHaveBeenCalled();
    await type('00000017');await click('Arzneimittel abrufen');
    expect(mock.get).toHaveBeenCalledExactlyOnceWith(tenant,'00000017');
    expect(host.textContent).toContain('Wirkstärke nicht angegeben');expect(host.textContent).toContain('10 mg');
    expect(host.textContent).toContain('15.11.2026');expect(host.textContent).toContain('Bundesinstitut');
    expect(host.textContent).not.toContain('Referenzangaben übernehmen');
    expect(host.querySelector('a,[role="link"]')).not.toBeNull();
  });
  it('clears the previous record as soon as the PZN changes and shows unknown PZN separately from transport errors',async()=>{
    await render();await type('00000017');await click('Arzneimittel abrufen');expect(host.textContent).toContain('Testpräparat');
    await type('01234562');expect(host.textContent).not.toContain('Testpräparat');
    mock.get.mockResolvedValueOnce({ok:true,data:null});await click('Arzneimittel abrufen');expect(host.textContent).toContain('kein Datensatz');
    mock.get.mockResolvedValueOnce({ok:false,error:'Verbindung unterbrochen'});await click('Arzneimittel abrufen');expect(host.textContent).toContain('Verbindung unterbrochen');
    expect(host.textContent).not.toContain('kein Datensatz');
  });
  it('discards a late answer after tenant or permission changes',async()=>{
    let resolve:(value:unknown)=>void=()=>{};mock.get.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    await render();await type('00000017');await click('Arzneimittel abrufen');
    await render({tenantId:'10000000-0000-4000-8000-000000000002'});
    await act(async()=>resolve({ok:true,data:record}));expect(host.textContent).not.toContain('Testpräparat');
    await render({enabled:false});expect(host.textContent).toBe('');expect(mock.pick).not.toHaveBeenCalled();
  });
  it('labels a stale delivery and hides the record after a live permission loss',async()=>{
    mock.get.mockResolvedValueOnce({ok:true,data:{...record,stale:true}});
    await render();await type('00000017');await click('Arzneimittel abrufen');
    expect(host.textContent).toContain('Datenstand überholt');mock.allowed=false;await render({enabled:false});
    expect(host.textContent).toBe('');
  });
});
