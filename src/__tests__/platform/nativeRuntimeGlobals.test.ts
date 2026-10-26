import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertNativeRuntimeGlobals,findNativeRuntimeGlobals} from '../../../scripts/assert-native-runtime-globals.mjs';

const native=(source:string)=>new Map([['component.native.tsx',source]]);

describe('fail-closed browser global guard for produced native sources',()=>{
  it('rejects the actual document-return crash expression and accepts native registry focus',()=>{
    expect(()=>assertNativeRuntimeGlobals(native('export function back(){requestAnimationFrame(()=>rows.current?.querySelector(`[data-document-id="${CSS.escape(lastOpened.current)}"] button`)?.focus());}'))).toThrow(/component\.native\.tsx:1:.* CSS/);
    expect(()=>assertNativeRuntimeGlobals(native("import {nativeWorkspaceNodes} from './nativeWorkspaceNodes.shared'; export function back(id:string){requestAnimationFrame(()=>nativeWorkspaceNodes.all().find(handle=>handle.props?.['data-document-id']===id)?.focus());}"))).not.toThrow();
  });
  it.each(['CSS.escape(value)','new ResizeObserver(callback)','new MutationObserver(callback)','new DOMParser()','typeof ResizeObserver'])('rejects an unbound runtime expression: %s',expression=>{
    expect(()=>assertNativeRuntimeGlobals(native('export const result='+expression+';'))).toThrow('Unsupported browser runtime global');
  });
  it.each(['globalThis.CSS.escape(value)','window.DOMParser','global.ResizeObserver','globalThis["MutationObserver"]','window?.["CSS"]','const {CSS: escapeApi}=globalThis;','const {DOMParser}=window;'])('rejects explicit native-global property access: %s',expression=>{
    expect(()=>assertNativeRuntimeGlobals(native(expression))).toThrow('Unsupported browser runtime global');
  });
  it('accepts local values, imported XML parsing and genuinely type-only browser names',()=>{
    const source=`
      import {DOMParser} from '@xmldom/xmldom';
      import type {ResizeObserver} from './browser-types';
      type Settings={CSS:string;observer?:ResizeObserver;parser:DOMParser};
      interface View extends MutationObserver {css:CSSStyleDeclaration}
      const CSS='.card{border-radius:50%}';
      const data={CSS:'a value',DOMParser:'a label'};
      class Local {CSS='a field';DOMParser(){return data;}}
      export const parse=(text:string)=>new DOMParser().parseFromString(text,'application/xml');
      export {CSS};
    `;
    expect(findNativeRuntimeGlobals(native(source))).toEqual([]);
  });
  it('uses lexical scopes rather than treating any local spelling as a global binding',()=>{
    const findings=findNativeRuntimeGlobals(native('function local(CSS:{escape(value:string):string}){return CSS.escape("ok");}\nCSS.escape("unbound");'));
    expect(findings).toEqual([{file:'component.native.tsx',line:2,column:1,name:'CSS'}]);
    expect(()=>assertNativeRuntimeGlobals(new Map([['local.native.ts','const CSS="local";'],['bad.native.ts','CSS.escape("unbound");']]))).toThrow('bad.native.ts:1:1 CSS');
  });
  it('does not allow type-only or ambient declarations to supply a runtime parser',()=>{
    expect(()=>assertNativeRuntimeGlobals(native("import type {DOMParser} from '@xmldom/xmldom';new DOMParser();"))).toThrow('DOMParser');
    expect(()=>assertNativeRuntimeGlobals(native('declare const DOMParser:any;new DOMParser();'))).toThrow('DOMParser');
    expect(()=>assertNativeRuntimeGlobals(native('declare const DOMParser:any;type Parser=typeof DOMParser;'))).not.toThrow();
  });
  it('checks runtime class bases while allowing interface and generic type references',()=>{
    expect(()=>assertNativeRuntimeGlobals(native('class Parser extends DOMParser {}'))).toThrow('DOMParser');
    expect(()=>assertNativeRuntimeGlobals(native('class Parser extends CSS.Parser {}'))).toThrow('CSS');
    expect(()=>assertNativeRuntimeGlobals(native('interface Parser extends DOMParser {}; const parse=<T extends MutationObserver>(value:T)=>value;'))).not.toThrow();
  });
  it('preserves precise source positions and ignores strings, property names and Web-only output',()=>{
    const findings=findNativeRuntimeGlobals(new Map([['component.native.tsx','export const text="CSS.escape is browser-only";\nexport const parse=()=>new DOMParser();'],['document.web.tsx','CSS.escape("web");'],['report.json','new ResizeObserver()']]));
    expect(findings).toEqual([{file:'component.native.tsx',line:2,column:28,name:'DOMParser'}]);
  });
  it('accepts the actual corrected native document and Assist selector sources',()=>{
    const sources=new Map(['src/components/office/ClientRecordDocumentsPanel.native.tsx','src/components/assist/AssistLiveFilterSelect.native.tsx'].map(file=>[file,readFileSync(file,'utf8')]));
    expect(()=>assertNativeRuntimeGlobals(sources)).not.toThrow();
  });
});
