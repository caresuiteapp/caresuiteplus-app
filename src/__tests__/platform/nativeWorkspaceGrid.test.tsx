// @vitest-environment happy-dom
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const hosts=vi.hoisted(()=>({fontScale:1,styles:new WeakMap<HTMLElement,Record<string,unknown>>(),layouts:new WeakMap<HTMLElement,(event:any)=>void>()}));
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
  return {...actual,Platform:{...actual.Platform,OS:'android'},View:primitive('div'),Pressable:primitive('button'),Text:primitive('span'),findNodeHandle:()=>null,useWindowDimensions:()=>({width:360,height:800,scale:1,fontScale:hosts.fontScale})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn()}));
vi.mock('@/liquid-command/components/DesktopCatalogArtwork.tsx',()=>({DesktopCatalogArtwork:()=>null}));

import {DesktopAreaSwitcher} from '@/liquid-command/components/DesktopAreaSwitcher.native';
import {DESKTOP_AREAS} from '@/liquid-command/navigation/desktopAreas';
import {workspaceGridWidths} from '@/lib/platform/nativeWorkspaceStyles.shared';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;hosts.fontScale=1;hosts.styles=new WeakMap();hosts.layouts=new WeakMap();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(children:ReactNode){await act(async()=>root.render(children));}
const template='repeat(auto-fit,minmax(112px,1fr))';

describe('native grid cells in the generated desktop-area chooser',()=>{
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
