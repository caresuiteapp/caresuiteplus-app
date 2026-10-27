import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertNativeReactHosts,findNativeReactHosts} from '../../../scripts/native-react-hosts.mjs';

const native=(source:string)=>new Map([['screen.native.tsx',source]]);

describe('native React host boundary',()=>{
  it('rejects the actual code55 calendar crash before packaging',()=>{
    const source="import {createElement} from 'react'; export const Planner=()=>createElement('style',{key:'calendar-profile-effects'},'.profile{border-radius:13px}');";
    expect(()=>assertNativeReactHosts(native(source))).toThrow(/screen\.native\.tsx:1:.* <style>/);
  });
  it.each([
    "import {createElement as element} from 'react';element('style',null,css);",
    "import React from 'react';React.createElement('div',null,'content');",
    "import * as React from 'react';React['createElement']('input',{value:''});",
    'export const Page=()=> <section><style>{css}</style></section>;',
  ])('rejects JSX and aliased React factories: %s',source=>{
    expect(findNativeReactHosts(native(source)).length).toBeGreaterThan(0);
  });
  it.each([
    "export function Page({compact}){const Surface=compact?'details':'section';return <Surface/>;}",
    "import {createElement} from 'react';const Surface=compact?'details':'section';createElement(Surface);",
    "const kind='section';export function Page(){const Surface=kind;return <Surface/>;}",
  ])('finds dynamically selected native hosts through their actual binding: %s',source=>{
    expect(findNativeReactHosts(native(source)).map(row=>row.tag)).toContain('section');
  });
  it('ignores unused host data and shadowed component parameters',()=>{
    const source="const Surface='details';function Inner(Surface){return <Surface/>;}export const data=Surface;";
    expect(findNativeReactHosts(native(source))).toEqual([]);
  });
  it('keeps component factories, local helper scopes and printed HTML strings valid',()=>{
    const source=`import {createElement} from 'react';
      const markup='<style>.report{color:blue}</style>';
      function local(createElement:(name:string)=>unknown){return createElement('style');}
      export const Page=()=>createElement(NativeStyle,null,markup);
      export const Other=()=> <View><NativeDiv>Content</NativeDiv></View>;`;
    expect(findNativeReactHosts(native(source))).toEqual([]);
    expect(()=>assertNativeReactHosts(new Map([['report.web.tsx',"import {createElement} from 'react';createElement('style',null,css);"]]))).not.toThrow();
  });
  it('checks every generated runtime module and receiving route, including the real calendar planner',()=>{
    const report=JSON.parse(readFileSync('docs/native-workspace-source-map.json','utf8'));
    const files=[...new Set([...report.modules,...report.routes].map((row:{native:string})=>row.native))] as string[];
    expect(files).toContain('src/components/calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx');
    expect(()=>assertNativeReactHosts(files.map(file=>[file,readFileSync(file,'utf8')]))).not.toThrow();
    const calendar=readFileSync('src/components/calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx','utf8');
    expect(calendar).toContain('createElement(NativeStyle,');
    expect(calendar).toContain('NativeWorkspaceStyleScope');
    const recommendations=readFileSync('src/components/documents/DocumentRecommendations.native.tsx','utf8');
    expect(recommendations).toMatch(/const Surface = props\.compact \? 'details' : 'section'/);
    expect(recommendations).toContain('nativeWorkspaceHost(Surface,');
    expect(recommendations).toContain('"details": NativeDetails');
    expect(recommendations).toContain('"section": NativeSection');
  },20000);
});
