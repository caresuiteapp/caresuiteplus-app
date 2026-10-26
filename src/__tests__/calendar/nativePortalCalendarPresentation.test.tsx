// @vitest-environment happy-dom
import {act,useState,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const hosts=vi.hoisted(()=>({width:1280,fontScale:1,styles:new WeakMap<HTMLElement,Record<string,unknown>>(),layouts:new WeakMap<HTMLElement,(event:any)=>void>()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
  const primitive=(kind:'view'|'text'|'pressable')=>React.forwardRef<HTMLElement,any>((props,ref)=>{
    const style=actual.StyleSheet.flatten(typeof props.style==='function'?props.style({pressed:false}):props.style)??{};
    const attach=(node:HTMLElement|null)=>{if(node){hosts.styles.set(node,style);if(props.onLayout)hosts.layouts.set(node,props.onLayout);}if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
    return React.createElement(kind==='text'?'span':kind==='pressable'?'button':'div',{ref:attach,'data-native-host':kind,'data-testid':props.testID,'aria-label':props.accessibilityLabel,'aria-pressed':props.accessibilityState?.selected,role:props.accessibilityRole,disabled:props.disabled,onClick:()=>{if(!props.disabled)props.onPress?.();}},props.children);
  });
  return {...actual,Platform:{...actual.Platform,OS:'android'},View:primitive('view'),Pressable:primitive('pressable'),Text:primitive('text'),ScrollView:primitive('view'),findNodeHandle:()=>null,useWindowDimensions:()=>({width:hosts.width,height:800,scale:1,fontScale:hosts.fontScale})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null,NativeSvgPath:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn()}));

import {CalendarToolbar} from '@/components/calendar/CalendarToolbar.native';
import {CalendarAgendaList} from '@/components/calendar/CalendarAgendaList.native';
import type {CalendarEvent,CalendarViewMode} from '@/types/modules/calendarEvent';

const event:CalendarEvent={id:'visit-fixture',title:'Alltagsbegleitung',type:'einsatz',sourceType:'assignment',sourceId:'assignment-fixture',start:'2026-10-26T09:00:00+01:00',end:'2026-10-26T11:00:00+01:00',color:'#176ad2',status:'confirmed',clientName:'Alex Beispiel',employeeName:'Mara Muster',employeeId:'employee-fixture',serviceTitle:'Unterstützung im Alltag'};
let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;hosts.width=1280;hosts.fontScale=1;hosts.styles=new WeakMap();hosts.layouts=new WeakMap();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(children:ReactNode){await act(async()=>root.render(children));}
const button=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent===text)!;

describe('actual native calendar components used in both portals',()=>{
  it.each([[320,1],[360,1.6],[1280,1]])('gives the standalone toolbar its real stylesheet at %dpx scale %s',async(width,fontScale)=>{
    hosts.width=width;hosts.fontScale=fontScale;
    const onPrev=vi.fn(),onNext=vi.fn(),onToday=vi.fn(),onViewModeChange=vi.fn();
    await render(<CalendarToolbar viewMode="agenda" title="26. Okt. – 1. Nov." onPrev={onPrev} onNext={onNext} onToday={onToday} onViewModeChange={onViewModeChange}/>);
    const navigation=host.querySelector<HTMLElement>('[aria-label="Zeitraum wechseln"]')!;
    expect(hosts.styles.get(navigation)).toMatchObject({flexDirection:'row',flexWrap:'wrap',columnGap:7,rowGap:7});
    const previous=host.querySelector<HTMLButtonElement>('[aria-label="Vorheriger Zeitraum"]')!;
    expect(hosts.styles.get(previous)).toMatchObject({minWidth:40,minHeight:40,borderRadius:11,paddingLeft:9});
    const views=host.querySelector<HTMLElement>('[aria-label="Kalenderansicht"]')!;
    expect(hosts.styles.get(views)).toMatchObject({flexDirection:'row',flexWrap:'wrap',borderRadius:13});
    expect(hosts.styles.get(button('Agenda'))).toMatchObject({backgroundColor:'#fff'});
    expect(hosts.styles.get(button('Agenda').querySelector<HTMLElement>('[data-native-host="text"]')!)).toMatchObject({color:'#1461b4'});
    await act(async()=>{previous.click();host.querySelector<HTMLButtonElement>('[aria-label="Nächster Zeitraum"]')!.click();button('Heute').click();button('Monat').click();});
    expect(onPrev).toHaveBeenCalledOnce();expect(onNext).toHaveBeenCalledOnce();expect(onToday).toHaveBeenCalledOnce();expect(onViewModeChange).toHaveBeenCalledExactlyOnceWith('month');
  });
  it.each([[320,1],[360,1.6],[1280,1]])('keeps the actual event label stacked and selectable at %dpx scale %s',async(width,fontScale)=>{
    hosts.width=width;hosts.fontScale=fontScale;
    const onEventPress=vi.fn();
    await render(<CalendarAgendaList events={[event]} onEventPress={onEventPress}/>);
    const action=host.querySelector<HTMLButtonElement>('button')!;
    expect(action).toBeTruthy();expect(action.getAttribute('aria-label')).toContain('Alex Beispiel');
    expect(hosts.styles.get(action)).toMatchObject({flexDirection:'column',paddingLeft:10,borderRadius:10,borderLeftWidth:4});
    const label=[...action.querySelectorAll<HTMLElement>('[data-native-host="view"]')].find(node=>hosts.styles.get(node)?.flexDirection==='column'&&node.textContent?.includes('Alex Beispiel'))!;
    expect(label).toBeTruthy();expect(hosts.styles.get(label)).toMatchObject({rowGap:3,columnGap:3});
    const primary=[...label.querySelectorAll<HTMLElement>('[data-native-host="text"]')].find(node=>node.textContent==='Alex Beispiel')!;
    expect(primary).toBeTruthy();expect(hosts.styles.get(primary)).toMatchObject({fontSize:14});expect(hosts.styles.get(primary)?.lineHeight).toBeCloseTo(18.9);
    await act(async()=>action.click());expect(onEventPress).toHaveBeenCalledExactlyOnceWith(event);
  });
  it('retains the clicked event and active view when toolbar state changes',async()=>{
    function Calendar(){const [view,setView]=useState<CalendarViewMode>('agenda'),[selected,setSelected]=useState<CalendarEvent|null>(null);return <><CalendarToolbar viewMode={view} title="26. Okt. – 1. Nov." onPrev={()=>{}} onNext={()=>{}} onToday={()=>{}} onViewModeChange={setView}/><CalendarAgendaList events={[event]} onEventPress={setSelected}/><output>{selected?.id??'Kein Eintrag geöffnet'}</output></>;}
    await render(<Calendar/>);const action=[...host.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.getAttribute('aria-label')?.includes('Alex Beispiel'))!;
    await act(async()=>action.click());expect(host.querySelector('output')!.textContent).toBe(event.id);
    await act(async()=>button('Monat').click());expect(button('Monat').getAttribute('aria-pressed')).toBe('true');expect(host.querySelector('output')!.textContent).toBe(event.id);
  });
});
