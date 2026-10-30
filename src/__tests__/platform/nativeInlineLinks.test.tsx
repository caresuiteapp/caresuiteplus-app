// @vitest-environment happy-dom
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const api=vi.hoisted(()=>({openURL:vi.fn(),push:vi.fn(),share:vi.fn(),alert:vi.fn(),styles:new WeakMap<HTMLElement,Record<string,unknown>>()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react'),InText=React.createContext(false);
  const primitive=(kind:'text'|'view'|'pressable')=>React.forwardRef<HTMLElement,any>((props,ref)=>{
    if(React.useContext(InText)&&kind!=='text')throw Error('Native View cannot be inserted in a Text run');
    const style=actual.StyleSheet.flatten(typeof props.style==='function'?props.style({pressed:false}):props.style)??{};
    const attach=(node:HTMLElement|null)=>{if(node)api.styles.set(node,{...style,...(props.contentContainerStyle?{__contentContainerStyle:actual.StyleSheet.flatten(props.contentContainerStyle)}:{})});if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
    return React.createElement(kind==='text'?'span':kind==='pressable'&&props.accessibilityRole==='button'?'button':'div',{ref:attach,'data-native-host':kind,'data-testid':props.testID,role:props.accessibilityRole,'aria-label':props.accessibilityLabel,'aria-disabled':props.accessibilityState?.disabled,'data-accessible':props.accessible,'aria-expanded':props.accessibilityState?.expanded,disabled:props.disabled,onClick:(event:any)=>{event.stopPropagation();if(!props.disabled)props.onPress?.();}},<InText.Provider value={kind==='text'}>{props.children}</InText.Provider>);
  });
  return {...actual,View:primitive('view'),Text:primitive('text'),Pressable:primitive('pressable'),ScrollView:primitive('view'),Image:primitive('view'),TextInput:({value,accessibilityLabel}:any)=><input aria-label={accessibilityLabel} value={value} readOnly/>,Modal:({visible,children}:any)=>visible?<div role="dialog">{children}</div>:null,Platform:{...actual.Platform,OS:'android'},useWindowDimensions:()=>({width:360,height:800,scale:1,fontScale:1.6}),Linking:{openURL:api.openURL},Alert:{alert:api.alert},findNodeHandle:()=>null};
});
vi.mock('expo-router',()=>({useRouter:()=>({push:api.push})}));
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@expo/vector-icons/Feather',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:api.share,shareNativeFile:vi.fn()}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({roleKey:'business_admin'})}));
vi.mock('@/hooks/useGoogleWorkspace.native.ts',()=>({useGoogleWorkspace:()=>({loading:false,connection:{status:'connected',email:'team@example.invalid',capabilities:{gmail:true,calendar:true}}}),useWorkspacePage:()=>({loading:false,data:{items:[{id:'mail-fixture',title:'Rückruf im Team',unread:true,subtitle:'Postfach'}],fetchedAt:'2026-10-26T08:00:00Z'}})}));
vi.mock('@/lib/platformConsole/tenantDossierService.native.ts',()=>({getTenantDossier:vi.fn(),getTenantDossierPage:vi.fn()}));

import {DesktopWeatherLocationDialog} from '@/liquid-command/screens/DesktopWeatherLocationDialog.native';
import {NativeA,NativeDiv,NativeFieldset,NativeImg,NativeP,NativeSpan,NativeTable,NativeTbody,NativeTr,NativeTd,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {nativeWorkspaceNodes} from '@/lib/platform/nativeWorkspaceNodes.shared';
import {GoogleWorkspaceWidget} from '@/components/googleWorkspace/GoogleWorkspaceWidget.native';
import {TenantDossierFields} from '@/screens/platformConsole/TenantDossierWorkspace.native';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();api.openURL.mockReset().mockResolvedValue(undefined);api.share.mockReset().mockResolvedValue(undefined);api.styles=new WeakMap();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(children:ReactNode){await act(async()=>root.render(children));}
async function click(element:HTMLElement){expect(element).toBeTruthy();await act(async()=>element.click());}
const links=()=>[...host.querySelectorAll<HTMLElement>('[role="link"]')];

describe('native inline links through the shared renderer',()=>{
  it('applies grid direction, wrapping and gaps to the scroll content rather than its viewport',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.scroll-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow-y:auto;gap:12px 18px;align-content:start}']}><NativeDiv className="scroll-grid" data-testid="scroll-grid"><NativeDiv>Erster Bereich</NativeDiv><NativeDiv>Zweiter Bereich</NativeDiv><NativeDiv>Dritter Bereich</NativeDiv></NativeDiv></NativeWorkspaceStyleScope>);
    const style=api.styles.get(host.querySelector<HTMLElement>('[data-testid="scroll-grid"]')!)!;
    expect(style.__contentContainerStyle).toMatchObject({flexDirection:'row',flexWrap:'wrap',rowGap:12,columnGap:18,alignContent:'flex-start'});
    expect(style.flexDirection).toBeUndefined();
    expect(style.rowGap).toBeUndefined();
  });
  it('keeps actual Google unread titles and dossier counters in single primitive text runs',async()=>{
    await render(<><GoogleWorkspaceWidget service="gmail"/><TenantDossierFields row={{first_name:'Anna',phone:'',active:true}}/></>);
    const title=[...host.querySelectorAll<HTMLElement>('[data-native-host="view"]')].find(node=>node.textContent==='● Rückruf im Team')!;expect(title).toBeTruthy();expect(title.children).toHaveLength(1);expect(title.firstElementChild!.textContent).toBe('● Rückruf im Team');
    const counter=[...host.querySelectorAll<HTMLElement>('[data-native-host="text"]')].find(node=>node.parentElement?.dataset.nativeHost==='view'&&node.textContent==='2 von 3 Feldern befüllt')!;expect(counter).toBeTruthy();expect(counter.children).toHaveLength(1);expect(counter.firstElementChild!.textContent).toBe('2 von 3 Feldern befüllt');
  });
  it('preserves styled element identity, original selector positions, link actions and newlines between text runs',async()=>{
    const view=(count:number)=><NativeWorkspaceStyleScope css={['.runs>span:nth-child(3){color:#b42336}']}><NativeDiv className="runs" data-testid="runs">Offen: {count}<NativeSpan key="stable" data-testid="styled"> Fälle </NativeSpan>{'\nStand: '}{5}<NativeA key="details" href="/business/office">Details</NativeA>.</NativeDiv></NativeWorkspaceStyleScope>;
    await render(view(2));const runs=host.querySelector<HTMLElement>('[data-testid="runs"]')!,styled=host.querySelector<HTMLElement>('[data-testid="styled"]')!;expect([...runs.children].map(node=>node.textContent)).toEqual(['Offen: 2',' Fälle ','\nStand: 5','Details','.']);expect(api.styles.get(styled)).toMatchObject({color:'#b42336'});await click(links()[0]);expect(api.push).toHaveBeenCalledExactlyOnceWith('/business/office');
    await render(view(9));expect(host.querySelector('[data-testid="styled"]')).toBe(styled);expect(runs.firstElementChild!.textContent).toBe('Offen: 9');
  });
  it('does not merge primitive slots belonging to grids or table cells',async()=>{
    await render(<NativeWorkspaceStyleScope css={['.raw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}']}><NativeDiv className="raw-grid" data-testid="grid">{1}{' von '}{3}</NativeDiv><NativeTable><NativeTbody><NativeTr><NativeTd data-testid="cell">{1}{' von '}{3}</NativeTd></NativeTr></NativeTbody></NativeTable></NativeWorkspaceStyleScope>);
    for(const id of ['grid','cell'])expect([...host.querySelector('[data-testid="'+id+'"]')!.children].map(node=>node.textContent)).toEqual(['1',' von ','3']);
  });

  it('renders the generated weather information as continuous paragraphs with three accessible inline actions',async()=>{
    await render(<DesktopWeatherLocationDialog visible place={null} preferenceError={null} onChoose={vi.fn()} onClose={vi.fn()}/>);
    const info=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Wetterinformationen')!;
    await click(info);
    const actions=links();expect(actions).toHaveLength(3);
    expect(actions.map(link=>link.textContent)).toEqual(['Deutscher Wetterdienst','GeoNames','CC BY 4.0']);
    for(const action of actions){expect(action.dataset.nativeHost).toBe('text');expect(action.dataset.accessible).toBe('true');expect(action.parentElement!.dataset.nativeHost).toBe('text');expect(api.styles.get(action)).toMatchObject({color:'#8BDFFF',fontSize:12,lineHeight:18,textDecorationLine:'underline'});}
    expect(actions[1].parentElement).toBe(actions[2].parentElement);
    expect(actions[1].parentElement!.textContent).toBe('Ortsverzeichnis: GeoNames, CC BY 4.0. Für die Ortssuche aufbereitet, Stand September 2026.');
    expect(actions[1].parentElement!.querySelector('[data-native-host="view"],[data-native-host="pressable"]')).toBeNull();
    for(const action of actions)await click(action);
    expect(api.openURL.mock.calls.map(call=>call[0])).toEqual(['https://www.dwd.de/EN/service/legal_notice/legal_notice.html','https://www.geonames.org/','https://creativecommons.org/licenses/by/4.0/']);
    expect(api.alert).not.toHaveBeenCalled();
  });
  it('preserves router, native file, hash, preventDefault and rejected URL behavior for inline links',async()=>{
    const scrollIntoView=vi.fn(),unregister=nativeWorkspaceNodes.register('weather-reference',{focus:vi.fn(),scrollIntoView});
    try{
      await render(<NativeP><NativeA href="/business/office">Office</NativeA> · <NativeA href="file:///cache/report.pdf" download="Bericht.pdf">PDF</NativeA> · <NativeA href="#weather-reference">Abschnitt</NativeA> · <NativeA href="https://example.invalid/blocked" onClick={event=>event.preventDefault()}>Abbrechen</NativeA> · <NativeA href="https://example.invalid/failure">Fehler</NativeA></NativeP>);
      const actions=links();expect(actions.every(link=>link.dataset.nativeHost==='text')).toBe(true);
      for(const action of actions.slice(0,4))await click(action);
      expect(api.push).toHaveBeenCalledExactlyOnceWith('/business/office');expect(api.share).toHaveBeenCalledExactlyOnceWith('file:///cache/report.pdf','Bericht.pdf');expect(scrollIntoView).toHaveBeenCalledOnce();expect(api.openURL).not.toHaveBeenCalled();
      api.openURL.mockRejectedValueOnce(new Error('Kein Browser verfügbar'));await click(actions[4]);
      expect(api.alert).toHaveBeenCalledExactlyOnceWith('Aktion nicht abgeschlossen','Kein Browser verfügbar');
    }finally{unregister();}
  });
  it('keeps unavailable inline links disabled and block, image or uncertain content as Pressables outside Text',async()=>{
    function UnknownContent(){return <NativeDiv>Unbekannter Inhalt</NativeDiv>;}
    await render(<NativeWorkspaceStyleScope css={['.block{display:flex}.decorated::before{content:"•"}.nested-block{display:block}.positional>a:first-child{display:flex}.disabled-block:disabled{display:flex}']}>
      <NativeFieldset disabled><NativeP>Gesperrt: <NativeA href="https://example.invalid/disabled">Gesperrter Link</NativeA></NativeP></NativeFieldset>
      <NativeP>Block: <NativeA className="block" href="/block">Blocklink</NativeA></NativeP>
      <NativeP>Bild: <NativeA href="/image"><NativeImg src="https://example.invalid/art.png" alt="Bild"/></NativeA></NativeP>
      <NativeP>Komponente: <NativeA href="/custom"><UnknownContent/></NativeA></NativeP>
      <NativeP>Dekoration: <NativeA className="decorated" href="/decorated">Dekoriert</NativeA></NativeP>
      <NativeP>Inhalt: <NativeA href="/nested"><NativeSpan className="nested-block">Eigener Block</NativeSpan></NativeA></NativeP>
      <NativeP>Geschachtelt: <NativeSpan><NativeA href="/inline">Inline</NativeA></NativeSpan></NativeP>
      <NativeP className="positional"><NativeA href="/first">Erster Link als Block</NativeA> und weitere Angaben.</NativeP>
      <NativeFieldset disabled><NativeP><NativeA className="disabled-block" href="/disabled-block">Gesperrter Blocklink</NativeA></NativeP></NativeFieldset>
      <NativeA href="/standalone">Eigenständiger Link</NativeA>
    </NativeWorkspaceStyleScope>);
    const actions=links(),disabled=actions.find(link=>link.textContent==='Gesperrter Link')!;
    expect(disabled.dataset.nativeHost).toBe('text');expect(disabled.getAttribute('aria-disabled')).toBe('true');await click(disabled);expect(api.openURL).not.toHaveBeenCalled();
    for(const text of ['Blocklink','Unbekannter Inhalt','Dekoriert','Eigener Block','Erster Link als Block','Gesperrter Blocklink','Eigenständiger Link'])expect(actions.find(link=>link.textContent===text)!.dataset.nativeHost).toBe('pressable');
    expect(actions.find(link=>link.querySelector('[data-native-host="view"]'))).toBeTruthy();
    expect(actions.find(link=>link.textContent==='Inline')!.dataset.nativeHost).toBe('text');
  });
});
