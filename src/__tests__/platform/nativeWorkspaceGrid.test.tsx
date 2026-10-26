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
    const attach=(node:HTMLElement|null)=>{if(node){hosts.styles.set(node,{...style,__numberOfLines:props.numberOfLines});if(props.onLayout)hosts.layouts.set(node,props.onLayout);}if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
    return React.createElement(tag,{ref:attach,'data-native-host':tag,'data-testid':props.testID,'aria-label':props.accessibilityLabel,'aria-selected':props.accessibilityState?.selected,disabled:props.disabled,onClick:props.disabled?undefined:props.onPress},props.children);
  });
  return {...actual,Platform:{...actual.Platform,OS:'android'},View:primitive('div'),Pressable:primitive('button'),Text:primitive('span'),findNodeHandle:()=>null,PanResponder:{create:()=>({panHandlers:{}})},useWindowDimensions:()=>({width:hosts.width,height:800,scale:1,fontScale:hosts.fontScale})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',async()=>{
  const React=await import('react'),flatten=(value:any):Record<string,unknown>=>Array.isArray(value)?Object.assign({},...value.map(flatten)):value??{};
  const Svg=React.forwardRef<HTMLElement,any>((props,ref)=>React.createElement('div',{'data-native-svg':true,ref:(node:HTMLElement|null)=>{if(node)hosts.styles.set(node,{...flatten(props.style),__svgWidth:props.width,__svgHeight:props.height,__svgColor:props.color,__svgStroke:props.stroke});if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}},props.children));
  return {default:Svg,...Object.fromEntries('Path Circle Rect Line Polyline Polygon Ellipse G Defs Stop LinearGradient RadialGradient ClipPath Pattern Text TSpan'.split(' ').map(name=>[name,()=>null]))};
});
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn(),shareNativeFile:vi.fn()}));
vi.mock('@/lib/platformConsole/tenantDossierService.native.ts',()=>({getTenantDossier:vi.fn(),getTenantDossierPage:vi.fn()}));
vi.mock('@/liquid-command/components/DesktopCatalogArtwork.tsx',()=>({DesktopCatalogArtwork:()=>null}));

import {DesktopAreaSwitcher} from '@/liquid-command/components/DesktopAreaSwitcher.native';
import {DESKTOP_AREAS} from '@/liquid-command/navigation/desktopAreas';
import {workspaceGridWidths} from '@/lib/platform/nativeWorkspaceStyles.shared';
import {NativeH1,NativeButton,NativeDiv,NativeSpan,NativeTable,NativeThead,NativeTbody,NativeTr,NativeTh,NativeTd,NativeColgroup,NativeCol,NativeWorkspaceStyleScope,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import {WebActionIcon} from '@/components/icons/WebActionIcon.native';
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
    expect(Number(actionStyle.minWidth??0)).toBeLessThanOrEqual(Number(actionStyle.width));await act(async()=>action.click());expect(onSection).toHaveBeenCalledExactlyOnceWith('tenants');
  });
  it('retains real holes, horizontal full rows and original selector positions without adding phantom cells',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.placement{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px}.placement>.positioned{grid-row:2;grid-column:2}.placement>.column{grid-column:2}.placement>.wide{grid-column:1/-1}.placement>span:first-child{color:#b42336}']}><NativeDiv className="placement" data-testid="placement"><NativeSpan className="positioned" key="positioned" data-testid="positioned">Positioniert</NativeSpan><NativeDiv key="automatic">Automatisch</NativeDiv><NativeDiv className="column" key="column">Spalte zwei</NativeDiv><NativeDiv className="wide" key="wide" data-testid="wide">Volle Zeile</NativeDiv><NativeDiv key="after" data-testid="after">Danach</NativeDiv></NativeDiv></NativeWorkspaceStyleScope>);
    const grid=host.querySelector<HTMLElement>('[data-testid="placement"]')!;await act(async()=>hosts.layouts.get(grid)!({nativeEvent:{layout:{x:0,y:0,width:248,height:300}}}));
    expect([...grid.children].map(child=>child.textContent)).toEqual(['Automatisch','Spalte zwei','','Positioniert','Volle Zeile','Danach']);expect(hosts.styles.get(grid.children[2] as HTMLElement)?.width).toBe(30);expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="positioned"]')!)?.color).toBe('#b42336');expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="wide"]')!)?.width).toBe('100%');expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="after"]')!)?.width).toBe(30);
  });

  it('keeps inline controls and badges intrinsic in block flow, while explicit layouts retain stretch',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.flow{display:block}.badge,.action{display:inline-flex}.stack{display:flex;flex-direction:column}.wide{display:inline-flex;width:100%}.auto{display:inline-flex;width:auto;align-self:auto}']}><NativeDiv className="flow"><NativeButton data-testid="plain">Beginnen</NativeButton><NativeSpan className="badge" data-testid="badge">Aktiv</NativeSpan><NativeButton className="wide" data-testid="wide">Breite Aktion</NativeButton><NativeButton className="auto" data-testid="auto">Automatisch</NativeButton><NativeDiv className="stack"><NativeButton className="action" data-testid="stretch">Flex-Aktion</NativeButton></NativeDiv></NativeDiv></NativeWorkspaceStyleScope>);
    const style=(id:string)=>hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="'+id+'"]')!)!;
    expect(style('plain').alignSelf).toBe('flex-start');
    expect(style('badge').alignSelf).toBe('flex-start');
    expect(style('auto').alignSelf).toBe('flex-start');
    expect(style('stretch').alignSelf).toBeUndefined();
    expect(style('wide').width).toBe('100%');
    expect(style('wide').alignSelf).toBeUndefined();
  });

  it.each([[1280,['50%','30%','20%']],[900,['40%','30%','30%']]] as const)('shares authored first-row tracks with every body row at %dpx',async(width,expected)=>{
    hosts.width=width;
    const css='.records{table-layout:fixed}.records th:first-child{width:50%}.records th:nth-child(2){width:30%}.records th:nth-child(3){width:20%}@container(max-width:1000px){.records th:first-child{width:40%}.records th:nth-child(3){width:30%}}';
    await render(<NativeWorkspaceStyleScope css={[css]}><NativeTable className="records"><NativeThead><NativeTr>{['Name','Versorgung','Ort'].map((label,index)=><NativeTh key={label} data-testid={'head-'+index}>{label}</NativeTh>)}</NativeTr></NativeThead><NativeTbody><NativeTr>{['Helene Musterfrau','PG 2','Hannover'].map((value,index)=><NativeTd key={value} data-testid={'cell-'+index}>{value}</NativeTd>)}</NativeTr><NativeTr><NativeTd colSpan={2} data-testid="joined">Zusammenfassung</NativeTd><NativeTd>Stand</NativeTd></NativeTr></NativeTbody></NativeTable></NativeWorkspaceStyleScope>);
    for(const [index,value] of expected.entries())for(const prefix of ['head-','cell-'])expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="'+prefix+index+'"]')!)?.width).toBe(value);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="joined"]')!)?.width).toBe(String(parseFloat(expected[0])+parseFloat(expected[1]))+'%');
  });

  it('keeps explicit colgroup tracks ahead of first-row width hints',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.records{table-layout:fixed}.records th:first-child{width:70%}.records th:nth-child(2){width:30%}']}><NativeTable className="records"><NativeColgroup><NativeCol style={{width:'25%'}}/><NativeCol style={{width:'75%'}}/></NativeColgroup><NativeThead><NativeTr><NativeTh>Name</NativeTh><NativeTh>Ort</NativeTh></NativeTr></NativeThead><NativeTbody><NativeTr><NativeTd data-testid="name">Helene</NativeTd><NativeTd data-testid="city">Hannover</NativeTd></NativeTr></NativeTbody></NativeTable></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="name"]')!)?.width).toBe('25%');
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="city"]')!)?.width).toBe('75%');
  });

  it.each([['fixed','50%','30%','10%'],['fixed','50%','',''],['auto','50%','30%','20%']])('retains the fallback for a %s table without a complete percentage contract (%s/%s/%s)',async(layout,first,second,third)=>{
    await render(<NativeWorkspaceStyleScope css={['.records{table-layout:'+layout+'}.records th:first-child{width:'+first+'}.records th:nth-child(2){width:'+second+'}.records th:nth-child(3){width:'+third+'}.records td:first-child{width:50%}.records td:nth-child(2){width:30%}.records td:nth-child(3){width:20%}']}><NativeTable className="records"><NativeThead><NativeTr><NativeTh>Name</NativeTh><NativeTh>Versorgung</NativeTh><NativeTh>Ort</NativeTh></NativeTr></NativeThead><NativeTbody><NativeTr><NativeTd data-testid="fallback">Helene</NativeTd><NativeTd>PG 2</NativeTd><NativeTd>Hannover</NativeTd></NativeTr></NativeTbody></NativeTable></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="fallback"]')!)?.width).toBe(String(100/3)+'%');
  });

  it.each(['block','flex','grid'])('collapses adjacent positive block margins only in %s flow',async(display)=>{
    await render(<NativeWorkspaceStyleScope css={['.flow{display:'+display+'}.first{display:grid;margin-bottom:17px}.next{margin-top:17px;justify-self:center}']}><NativeDiv className="flow"><NativeDiv className="first" data-testid="first">Kennzahlen</NativeDiv><NativeDiv className="next" data-testid="next">Arbeitsbereich</NativeDiv></NativeDiv></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="first"]')!)?.marginBottom).toBe(17);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="next"]')!)?.marginTop).toBe(display==='block'?0:17);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="next"]')!)?.marginLeft).toBeUndefined();
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="next"]')!)?.marginRight).toBeUndefined();
  });

  it.each([[true,undefined,0],[true,44,44],[false,undefined,40]] as const)('keeps reset table-header actions compact (header=%s, authored minimum=%s)',async(inHeader,minimum,expected)=>{
    const action=<NativeButton className="reset" data-testid="sort">Nach Name sortieren</NativeButton>;
    await render(<NativeWorkspaceStyleScope css={['.reset{padding:0;border:0}'+(minimum===undefined?'':'.reset{min-height:'+minimum+'px}')]}>{inHeader?<NativeTable><NativeThead><NativeTr><NativeTh>{action}</NativeTh></NativeTr></NativeThead></NativeTable>:<NativeDiv>{action}</NativeDiv>}</NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="sort"]')!)?.minHeight).toBe(expected);
  });

  it('centers authored icon plates and delivers resolved dimensions/color to the real SVG adapter',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.plate{display:grid;place-items:center;width:52px;height:52px}.plate svg{--cs-action-icon-size:30px;color:#7990aa}']}><NativeDiv className="plate" data-testid="plate"><WebActionIcon>{null}</WebActionIcon></NativeDiv></NativeWorkspaceStyleScope>);
    const plate=hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="plate"]')!)!,svg=hosts.styles.get(host.querySelector<HTMLElement>('[data-native-svg]')!)!;
    expect(plate.alignItems).toBe('center');expect(plate.justifyContent).toBe('center');
    expect(svg.width).toBe(30);expect(svg.height).toBe(30);expect(svg.__svgWidth).toBe(30);expect(svg.__svgHeight).toBe(30);
    expect(svg.__svgColor).toBe('#7990aa');expect(svg.__svgStroke).toBe('currentColor');
  });

  it.each([['top','flex-start'],['middle','center'],['bottom','flex-end']])('honors authored %s table-cell alignment',async(value,expected)=>{
    await render(<NativeWorkspaceStyleScope css={['td{vertical-align:'+value+'}']}><NativeTable><NativeTbody><NativeTr><NativeTd data-testid="aligned">Kurzer Inhalt</NativeTd><NativeTd>Mehrzeiliger Inhalt</NativeTd></NativeTr></NativeTbody></NativeTable></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="aligned"]')!)?.justifyContent).toBe(expected);
  });

  it.each([[undefined,1,1],['normal',1,undefined],[undefined,1.6,undefined]] as const)('preserves normal-size inline control labels while respecting resets and enlarged text (%s, %s)',async(reset,scale,lines)=>{
    hosts.fontScale=scale;
    await render(<NativeWorkspaceStyleScope css={['.action{display:inline-flex;white-space:nowrap}'+(reset?'.label{white-space:'+reset+'}':'')]}><NativeDiv><NativeButton className="action"><NativeSpan className="label" data-testid="label">Akte öffnen</NativeSpan></NativeButton></NativeDiv></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="label"]')!)?.__numberOfLines).toBe(lines);
    if(lines===1)expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="label"]')!)?.flexShrink).toBe(0);
  });

  it('does not size an enlarged icon-only action from a hidden label',async()=>{
    hosts.fontScale=1.6;
    await render(<NativeWorkspaceStyleScope css={['.hidden{display:none}']}><NativeDiv><NativeButton data-testid="icon-only"><NativeSpan className="hidden">Sehr lange verborgene Aktionsbeschriftung</NativeSpan></NativeButton></NativeDiv></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="icon-only"]')!)?.minWidth).toBeUndefined();
  });

  it.each(['flex:1','flex:0 1 0;flex-grow:1'])('retains a readable minimum and zero basis for a flexible normal-size long-word action (%s)',async(flex)=>{
    await render(<NativeWorkspaceStyleScope css={['.library{display:inline-flex;'+flex+';white-space:normal}']}><NativeDiv><NativeButton className="library" data-testid="library">Vorlagenbibliothek</NativeButton></NativeDiv></NativeWorkspaceStyleScope>);
    const minimum=Number(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="library"]')!)?.minWidth);
    expect(minimum).toBeGreaterThan(100);expect(minimum).toBeLessThanOrEqual(360);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="library"]')!)?.flexBasis).toBe(0);
  });

  it.each([['font-size:1.5em',21],['font:inherit',14],['',28]] as const)('uses the parent for authored heading metrics while preserving an unstyled fallback (%s)',async(css,expected)=>{
    await render(<NativeWorkspaceStyleScope css={['.invoice{font-size:14px;line-height:1.5}.invoice h1{'+css+'}']}><NativeDiv className="invoice"><NativeH1 data-testid="relative-heading">Rechnungen</NativeH1></NativeDiv></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="relative-heading"]')!)?.fontSize).toBe(expected);
  });

  it('uses authored CSS flex defaults for metric buttons while keeping explicit action alignment',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.metric{display:flex;flex-direction:column;text-align:left}.action{display:inline-flex;align-items:center;justify-content:center;gap:8px}']}><NativeDiv><NativeButton className="metric" data-testid="metric"><NativeSpan>Offene Besuche</NativeSpan><NativeStrong>2</NativeStrong></NativeButton><NativeButton className="action" data-testid="aligned-action">Aktion</NativeButton><NativeButton data-testid="unstyled-action">Aktion</NativeButton></NativeDiv></NativeWorkspaceStyleScope>);
    const metric=hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="metric"]')!)!,action=hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="aligned-action"]')!)!,fallback=hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="unstyled-action"]')!)!;
    expect(metric.alignItems).toBe('stretch');expect(metric.justifyContent).toBe('flex-start');expect(metric.gap).toBe(0);
    expect(action.alignItems).toBe('center');expect(action.justifyContent).toBe('center');expect(action.rowGap).toBe(8);
    expect(fallback.alignItems).toBe('center');expect(fallback.gap).toBe(6);
  });

  it('keeps normal-size intrinsic header actions at their natural content width',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.actions{display:flex;flex-wrap:wrap;gap:8px}.action{display:inline-flex;padding:7px 10px;font-size:10px}']}><NativeDiv className="actions"><NativeButton className="action" data-testid="intrinsic-import">Import / Export</NativeButton><NativeButton className="action" data-testid="intrinsic-refresh">Aktualisieren</NativeButton></NativeDiv></NativeWorkspaceStyleScope>);
    for(const id of ['intrinsic-import','intrinsic-refresh'])expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="'+id+'"]')!)?.minWidth).toBeUndefined();
  });

  it('styles the first sibling of its type after text and a different element',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.flow>span{font-size:11px}.flow>span:first-of-type{font-size:13px}']}><NativeDiv className="flow">Text davor<NativeButton>Aktion</NativeButton><NativeSpan data-testid="first-type">Versorgung</NativeSpan><NativeSpan data-testid="next-type">Metadaten</NativeSpan></NativeDiv></NativeWorkspaceStyleScope>);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="first-type"]')!)?.fontSize).toBe(13);
    expect(hosts.styles.get(host.querySelector<HTMLElement>('[data-testid="next-type"]')!)?.fontSize).toBe(11);
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
