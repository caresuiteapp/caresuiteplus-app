// @vitest-environment happy-dom
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const bridge=vi.hoisted(()=>({styles:new Map<string,Record<string,unknown>>(),layouts:new Map<string,(event:any)=>void>()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
  const primitive=(input:boolean)=>React.forwardRef<HTMLElement,any>((props,ref)=>{
    const style=actual.StyleSheet.flatten(props.style)??{};
    // Match the Float-only Android Text / TextInput bridge, which RN Web does
    // not enforce. This is a prop contract test, not an Android device test.
    for(const [key,value] of Object.entries(style))if((/^border(?:.*Radius|.*Width)$/.test(key)||['fontSize','lineHeight','letterSpacing','opacity','zIndex'].includes(key))&&value!==null&&value!==undefined&&typeof value!=='number')throw new TypeError('Android '+key+' expected Double, received '+typeof value);
    if(props.testID){bridge.styles.set(props.testID,style);if(props.onLayout)bridge.layouts.set(props.testID,props.onLayout);}
    return input?<input ref={ref as any} data-testid={props.testID} aria-label={props.accessibilityLabel} readOnly value={props.value??''}/>:<span ref={ref as any} data-testid={props.testID} aria-label={props.accessibilityLabel}>{props.children}</span>;
  });
  return {...actual,Platform:{...actual.Platform,OS:'android'},Text:primitive(false),TextInput:primitive(true),useWindowDimensions:()=>({width:800,height:1280,scale:1,fontScale:1.6})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn()}));

import {Text as AndroidText} from 'react-native';
import {CareSuiteNativeText,CareSuiteNativeTextInput} from '@/components/ui/CareSuiteNativeText';
import {NativeWorkspaceStyleScope,NativeDiv,NativeI,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import {companyWorkspaceCss} from '@/components/company/companyWorkspaceCss.native';
import {catalogWorkspaceCss} from '@/components/catalog/catalogWorkspaceCss.native';
import {clientRecordsCss} from '@/components/office/clientRecordsCss.native';
import {compileWorkspaceCss,resolveWorkspacePresentation} from '@/lib/platform/nativeWorkspaceStyles.shared';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;bridge.styles.clear();bridge.layouts.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(children:ReactNode){await act(async()=>root.render(children));}
const measurement=(width:number,height:number)=>({nativeEvent:{layout:{width,height,x:0,y:0}}});

describe('Android text style bridge contract',()=>{
  it('reproduces the reported native failure with the actual company CSS before text conversion',async()=>{
    const dot=resolveWorkspacePresentation([compileWorkspaceCss(companyWorkspaceCss)],{tag:'i',props:{}},[{tag:'div',props:{className:'co-eyebrow'}}],800);
    expect(dot.box).toMatchObject({width:6,height:6,borderRadius:'50%'});
    await expect(render(<AndroidText style={dot.box}>●</AndroidText>)).rejects.toThrow('Android borderRadius expected Double');
  });
  it('renders the actual company, catalog and client CSS through native elements without unsafe text props',async()=>{
    await render(<NativeWorkspaceStyleScope css={[companyWorkspaceCss,catalogWorkspaceCss,clientRecordsCss]}>
      <NativeDiv className="co-eyebrow"><NativeI data-testid="company-dot"/>Unternehmen</NativeDiv>
      <NativeDiv className="co-area-indicator"><NativeI data-testid="area-dot"/>Office</NativeDiv>
      <NativeDiv className="cw-badge"><NativeSpan data-testid="catalog-dot"/>Aktiv</NativeDiv>
      <NativeDiv className="cs-records-status"><NativeI data-testid="client-dot"/>Aktiv</NativeDiv>
      <NativeDiv className="co-eyebrow"><NativeI data-testid="text-dot">●</NativeI></NativeDiv>
    </NativeWorkspaceStyleScope>);
    for(const id of ['company-dot','area-dot','catalog-dot','client-dot']){expect(host.querySelector('[data-testid="'+id+'"]')).not.toBeNull();expect(bridge.styles.has(id)).toBe(false);}
    expect(bridge.styles.get('text-dot')).toMatchObject({borderRadius:3,width:6,height:6});
    expect(host.textContent).toContain('Unternehmen');expect(host.textContent).toContain('Office');
  });
  it('keeps Text and TextInput geometry while resolving responsive corners from stable own measurements',async()=>{
    const onLayout=vi.fn();
    await render(<><CareSuiteNativeText testID="label" onLayout={onLayout} style={{width:'100%',borderRadius:'50%',fontSize:18}}>Abgerundeter Text</CareSuiteNativeText><CareSuiteNativeTextInput testID="input" value="Eingabe" style={{width:100,height:40,borderRadius:'50%'}}/></>);
    expect(bridge.styles.get('label')).toMatchObject({width:'100%',borderRadius:0,fontSize:18});
    expect(bridge.styles.get('input')).toMatchObject({width:100,height:40,borderRadius:20});
    await act(async()=>bridge.layouts.get('label')!(measurement(120,32)));
    expect(bridge.styles.get('label')).toMatchObject({width:'100%',borderRadius:16,fontSize:18});
    const stable=bridge.styles.get('label');
    await act(async()=>bridge.layouts.get('label')!(measurement(120,32)));
    expect(bridge.styles.get('label')).toBe(stable);expect(onLayout).toHaveBeenCalledTimes(2);
    await act(async()=>bridge.layouts.get('label')!(measurement(120,48)));
    expect(bridge.styles.get('label')!.borderRadius).toBe(24);
  });
});
