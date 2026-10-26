// @vitest-environment happy-dom
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const hosts=vi.hoisted(()=>({width:360,fontScale:1,styles:new WeakMap<HTMLElement,Record<string,unknown>>(),layouts:new WeakMap<HTMLElement,(event:any)=>void>()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
  // Capture native prop geometry and deliver the same onLayout measurement the
  // grid receives on device. This verifies the shared presentation contract;
  // screenshots separately verify rendered pixels and scrolling.
  const primitive=(tag:'div'|'button'|'span')=>React.forwardRef<HTMLElement,any>((props,ref)=>{
    const style=actual.StyleSheet.flatten(props.style)??{};
    const attach=(node:HTMLElement|null)=>{if(node){hosts.styles.set(node,style);if(props.onLayout)hosts.layouts.set(node,props.onLayout);}if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
    return React.createElement(tag,{ref:attach,'data-native-host':tag,'data-testid':props.testID,'aria-label':props.accessibilityLabel,'aria-selected':props.accessibilityState?.selected,disabled:props.disabled,onClick:props.disabled?undefined:props.onPress},props.children);
  });
  return {...actual,Platform:{...actual.Platform,OS:'android'},View:primitive('div'),Pressable:primitive('button'),Text:primitive('span'),findNodeHandle:()=>null,useWindowDimensions:()=>({width:hosts.width,height:800,scale:1,fontScale:hosts.fontScale})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn(),shareNativeFile:vi.fn()}));
vi.mock('@/lib/platformConsole/tenantDossierService.native.ts',()=>({getTenantDossier:vi.fn(),getTenantDossierPage:vi.fn()}));
vi.mock('@/liquid-command/components/DesktopCatalogArtwork.tsx',()=>({DesktopCatalogArtwork:()=>null}));

import {DesktopAreaSwitcher} from '@/liquid-command/components/DesktopAreaSwitcher.native';
import {DESKTOP_AREAS} from '@/liquid-command/navigation/desktopAreas';
import {workspaceGridWidths} from '@/lib/platform/nativeWorkspaceStyles.shared';
import {NativeDiv,NativeSpan,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {TenantSetupPanel} from '@/screens/platformConsole/TenantDossierWorkspace.native';
import type {TenantDossier} from '@/lib/platformConsole/tenantDossierModel';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;hosts.width=360;hosts.fontScale=1;hosts.styles=new WeakMap();hosts.layouts=new WeakMap();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(children:ReactNode){await act(async()=>root.render(children));}
const template='repeat(auto-fit,minmax(112px,1fr))';

describe('native grid cells in the generated desktop-area chooser',()=>{
  it.each([[320,1,248],[320,1.6,248],[1280,1,1050],[1280,1.6,1050]])('places the actual generated dossier setup action in a readable track at %dpx scale %s',async(viewport,fontScale,available)=>{
    hosts.width=viewport;hosts.fontScale=fontScale;const onSection=vi.fn(),counts={total:0,active:0,deleted:0,complete:0,portalEnabled:0,portalLinked:0},dossier:TenantDossier={tenantId:'fixture',checkedAt:'2026-10-26T08:00:00Z',company:{name:'Firma A'},platform:{},branding:null,billing:null,bank:null,portal:null,tax:null,register:null,counts:{clients:counts,employees:counts,accounts:1,adminAccounts:1,loggedInAccounts:0,lastLoginAt:null,services:0,pricedServices:0,assignments:0,documents:0},sections:[]};
    await render(<TenantSetupPanel dossier={dossier} onSection={onSection}/>);
    const title=[...host.querySelectorAll<HTMLElement>('span')].find(node=>node.textContent==='Firmenprofil'&&node.parentElement?.dataset.nativeHost==='div')!,copy=title.parentElement!,step=copy.parentElement!;
    expect(hosts.layouts.has(step)).toBe(true);await act(async()=>hosts.layouts.get(step)!({nativeEvent:{layout:{x:0,y:0,width:available,height:300}}}));
    const action=[...step.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Daten prüfen')!,actionStyle=hosts.styles.get(action)!,copyStyle=hosts.styles.get(copy)!;
    if(viewport<780){expect([...step.children].map(child=>child.textContent)).toHaveLength(4);const gap=step.children[2] as HTMLElement;expect(gap.textContent).toBe('');expect(hosts.styles.get(gap)?.width).toBe(30);expect(actionStyle.width).toBe(available-44);expect(copyStyle.width).toBe(available-44);}else{expect(step.children).toHaveLength(3);expect(actionStyle.width).toBe(160);expect(Number(copyStyle.width)).toBeGreaterThan(600);expect(Number(copyStyle.width)+Number(actionStyle.width)+34+28).toBe(available);}
    expect(Number(actionStyle.minWidth)).toBeLessThanOrEqual(Number(actionStyle.width));await act(async()=>action.click());expect(onSection).toHaveBeenCalledExactlyOnceWith('tenants');
  });
  it('retains real holes, horizontal full rows and original selector positions without adding phantom cells',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.placement{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px}.placement>.positioned{grid-row:2;grid-column:2}.placement>.column{grid-column:2}.placement>.wide{grid-column:1/-1}.placement>span:first-child{color:#b42336}']}><NativeDiv className="placement" data-testid="placement"><NativeSpan className="positioned" key="positioned" data-testid="positioned">Positioniert</NativeSpan><NativeDiv key="automatic">Automatisch</NativeDiv><NativeDiv className="column" key="column">Spalte zwei</NativeDiv><NativeDiv className="wide" key="wide" data-testid="wide">Volle Zeile</NativeDiv><NativeDiv key="after" data-testid="after">Danach</NativeDiv></NativeDiv></NativeWorkspaceStyleScope>);
    const grid=host.querySelector<HTMLElement>('[data-testid="placement"]')!;await act(async()=>hosts.layouts.get(grid)!({nativeEvent:{layout:{x:0,y:0,width:248,height:300}}}));
    expect([...grid.children].map(child=>child.textContent)).toEqual(['Automatisch','Spalte zwei','','Positioniert','Volle Zeile','Danach']);expect(hosts.styles.get(grid.children[2] as HTMLElement)?.width).toBe(30);expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="positioned"]')!)?.color).toBe('#b42336');expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="wide"]')!)?.width).toBe('100%');expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="after"]')!)?.width).toBe(30);
  });

  it('keeps a marked calendar in seven columns when device text is enlarged',async()=>{
    hosts.fontScale=1.6;
    await render(<NativeWorkspaceStyleScope css={['.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}']}><NativeDiv className="calendar" data-grid-fixed-columns data-testid="calendar">{Array.from({length:14},(_,index)=><NativeDiv key={index} data-testid={'day-'+index}>{index+1}</NativeDiv>)}</NativeDiv></NativeWorkspaceStyleScope>);
    const calendar=host.querySelector<HTMLElement>('[data-testid="calendar"]')!;
    await act(async()=>hosts.layouts.get(calendar)!({nativeEvent:{layout:{x:0,y:0,width:280,height:300}}}));
    for(const child of calendar.children)expect(hosts.styles.get(child as HTMLElement)?.width).toBeCloseTo(34);
    expect([...calendar.children].map(child=>child.textContent)).toEqual(Array.from({length:14},(_,index)=>String(index+1)));
  });
  it('distributes an auto-fit row across its actual cards without leaving empty tracks',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px}']}><NativeDiv className="kpis" data-testid="kpis">{Array.from({length:4},(_,index)=><NativeDiv key={index}>{index+1}</NativeDiv>)}</NativeDiv></NativeWorkspaceStyleScope>);
    const grid=host.querySelector<HTMLElement>('[data-testid="kpis"]')!;
    await act(async()=>hosts.layouts.get(grid)!({nativeEvent:{layout:{x:0,y:0,width:1248,height:300}}}));
    for(const child of grid.children)expect(hosts.styles.get(child as HTMLElement)?.width).toBeCloseTo(303);
  });

  it.each([[248,1,2],[248,1.6,1],[748,1.6,4],[248,2,1]])('keeps scoped area buttons inside %dpx with fontScale %s',async(available,fontScale,columns)=>{
    hosts.fontScale=fontScale;
    await render(<DesktopAreaSwitcher selectedArea="office" areas={DESKTOP_AREAS.map(area=>({...area,disabled:area.key!=='office'&&area.key!=='assist'}))} onSelectArea={vi.fn()}/>);
    const grid=host.querySelector<HTMLElement>('[aria-label="Desktop im Katalog wechseln"]')!;
    expect(grid).not.toBeNull();
    await act(async()=>hosts.layouts.get(grid)!({nativeEvent:{layout:{x:0,y:0,width:available,height:500}}}));
    const tracks=workspaceGridWidths(template,available,8,fontScale);
    expect(tracks).toHaveLength(columns);
    expect(tracks.reduce((sum,width)=>sum+width,0)+8*(columns-1)).toBeCloseTo(available);
    const buttons=[...grid.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons).toHaveLength(DESKTOP_AREAS.length);
    for(const [index,button] of buttons.entries()){
      const cellWidth=Number(hosts.styles.get(button.parentElement!)?.width),buttonStyle=hosts.styles.get(button)!;
      expect(cellWidth).toBeCloseTo(tracks[index%columns]);
      expect(Number(buttonStyle.minWidth),button.getAttribute('aria-label')!).toBeLessThanOrEqual(cellWidth);
    }
    expect(buttons.find(button=>button.getAttribute('aria-label')==='Pflege-Desktop auswählen')!.textContent).toContain('Nicht freigegeben');
  });
  it('preserves selected and unavailable areas and delivers the exact enabled selection',async()=>{
    const onSelectArea=vi.fn();
    await render(<DesktopAreaSwitcher selectedArea="office" areas={DESKTOP_AREAS.map(area=>({...area,disabled:area.key==='pflege'}))} onSelectArea={onSelectArea}/>);
    const button=(label:string)=>host.querySelector<HTMLButtonElement>('[aria-label="'+label+'-Desktop auswählen"]')!;
    expect(button('Office').getAttribute('aria-selected')).toBe('true');
    await act(async()=>button('Office').click());
    await act(async()=>button('Pflege').click());
    expect(button('Pflege').disabled).toBe(true);expect(onSelectArea).not.toHaveBeenCalled();
    await act(async()=>button('Assist').click());
    expect(onSelectArea).toHaveBeenCalledExactlyOnceWith('assist');
  });
});
