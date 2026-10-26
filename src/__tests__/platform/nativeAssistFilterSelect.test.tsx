// @vitest-environment happy-dom
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const api=vi.hoisted(()=>({changed:vi.fn(),dismiss:null as (()=>void)|null,expanded:new Map<string,boolean>()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
  const Pressable=React.forwardRef<any,any>((props,ref)=>{if(props.accessibilityRole==='combobox')api.expanded.set(props.accessibilityLabel,props.accessibilityState?.expanded);return <actual.Pressable {...props} ref={ref}/>;});
  return {...actual,Pressable,Platform:{...actual.Platform,OS:'android'},useWindowDimensions:()=>({width:390,height:844,scale:1,fontScale:1.6}),Modal:({visible,children,onRequestClose}:any)=>{if(visible)api.dismiss=onRequestClose;return visible?<div role="dialog">{children}</div>:null;}};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn()}));

import {AssistLiveFilterSelect} from '@/components/assist/AssistLiveFilterSelect.native';
type Option={value:string;label:string;disabled?:boolean};
const EMPLOYEES:Option[]=[{value:'',label:'Alle Mitarbeitenden'},{value:'employee-a',label:'Anna Beispiel'},{value:'employee-b',label:'Bea Beispiel'},{value:'employee-locked',label:'Nicht auswählbar',disabled:true}];
function Filters({options=EMPLOYEES,disabled=false}:{options?:Option[];disabled?:boolean}){
  const [state,setState]=useState({employeeId:'',status:'all',selectedId:'visit-fixture'});
  const select=(key:'employeeId'|'status',value:string)=>{api.changed({[key]:value,selectedId:null});setState(previous=>({...previous,[key]:value,selectedId:''}));};
  return <><AssistLiveFilterSelect className="ls-field" label="Mitarbeitende" ariaLabel="Mitarbeitende filtern" value={state.employeeId} options={options} disabled={disabled} onChange={value=>select('employeeId',value)}/><AssistLiveFilterSelect className="ls-field" label="Einsatzstatus" ariaLabel="Einsatzstatus filtern" value={state.status} options={[{value:'all',label:'Alle Einsätze'},{value:'active',label:'Aktuell aktiv'}]} onChange={value=>select('status',value)}/><output>{JSON.stringify(state)}</output></>;
}
let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;api.changed.mockReset();api.dismiss=null;api.expanded.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(options?:Option[],disabled=false)=>{await act(async()=>root.render(<Filters options={options} disabled={disabled}/>));};
const trigger=(label='Mitarbeitende filtern')=>host.querySelector<HTMLElement>('[role="combobox"][aria-label="'+label+'"]')!;
const click=async(element:HTMLElement)=>{expect(element).toBeTruthy();await act(async()=>element.click());};

describe('native live filters through the actual select and modal adapters',()=>{
  it('opens, retains the list across fresh options, selects an employee and status, and closes',async()=>{
    await render();await click(trigger());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();expect(api.expanded.get('Mitarbeitende filtern')).toBe(true);
    await render(EMPLOYEES.map(option=>({...option,label:option.value==='employee-b'?'Bea Aktualisiert':option.label})));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await click(host.querySelector('[role="radio"][aria-label="Bea Aktualisiert"]')!);
    expect(api.changed).toHaveBeenLastCalledWith({employeeId:'employee-b',selectedId:null});
    expect(host.querySelector('output')!.textContent).toContain('"status":"all"');
    expect(host.querySelector('[role="dialog"]')).toBeNull();expect(trigger().textContent).toContain('Bea Aktualisiert');
    await click(trigger('Einsatzstatus filtern'));await click(host.querySelector('[role="radio"][aria-label="Aktuell aktiv"]')!);
    expect(api.changed).toHaveBeenLastCalledWith({status:'active',selectedId:null});
    expect(host.querySelector('output')!.textContent).toContain('"employeeId":"employee-b"');expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('closes on native back without changing a filter and blocks disabled options',async()=>{
    await render();await click(trigger());
    await click(host.querySelector('[role="radio"][aria-label="Nicht auswählbar"]')!);
    expect(api.changed).not.toHaveBeenCalled();expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async()=>api.dismiss!());
    expect(host.querySelector('[role="dialog"]')).toBeNull();expect(api.changed).not.toHaveBeenCalled();expect(api.expanded.get('Mitarbeitende filtern')).toBe(false);
  });
  it('does not open a modal or emit a value for empty, disabled or entirely unavailable options',async()=>{
    await render([]);expect(host.textContent).toContain('Keine Auswahl verfügbar.');await click(trigger());expect(host.querySelector('[role="dialog"]')).toBeNull();
    await render(EMPLOYEES,true);await click(trigger());expect(host.querySelector('[role="dialog"]')).toBeNull();
    await render([{value:'locked',label:'Gesperrt',disabled:true}]);await click(trigger());expect(host.querySelector('[role="dialog"]')).toBeNull();expect(api.changed).not.toHaveBeenCalled();
  });
  it('exposes focusable radio choices that can be activated with Enter',async()=>{
    await render();await click(trigger());const radio=host.querySelector<HTMLElement>('[role="radio"][aria-label="Anna Beispiel"]')!;await act(async()=>radio.focus());
    await act(async()=>{radio.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));radio.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));});
    expect(api.changed).toHaveBeenCalledWith({employeeId:'employee-a',selectedId:null});expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
