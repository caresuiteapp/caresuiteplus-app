// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it, vi} from 'vitest';
vi.mock('react-native',()=>{const flatten=(value:any)=>Object.assign({},...[value].flat(Infinity).filter(Boolean));return {
 StyleSheet:{create:(value:any)=>value},Platform:{OS:'android'},
 View:({children,style}:any)=><div style={flatten(style)}>{children}</div>,
 Text:({children,style,accessibilityRole}:any)=><span role={accessibilityRole==='header'?'heading':undefined} style={flatten(style)}>{children}</span>,
};});
const f=vi.hoisted(()=>({props:null as any}));
vi.mock('@/components/layout/platform/platformmodal',()=>({PlatformModal:(props:any)=>{f.props=props;return <section>{props.children}<button onClick={props.footerActions[0].onPress}>{props.footerActions[0].title}</button></section>;}}));
vi.mock('@/components/brand/CareSuiteLogo',()=>({CareSuiteLogo:()=> <span aria-label="App-Logo"/>}));
import {BusinessWelcomeModal} from '@/components/auth/BusinessWelcomeModal';
import {lightSurfaceText} from '@/design/tokens/auroraGlass';
describe('business welcome presentation',()=>{
 it('binds readable content to the company modal surface and keeps the close action',async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host),close=vi.fn();
  try {
   await act(async()=>root.render(<BusinessWelcomeModal visible displayName="Testperson" tenantName="Testorganisation" onClose={close}/>));
   expect(f.props.surfaceScope).toBe('company');expect(f.props.subtitle).toBe('Verwaltung · CareSuite HealthOS');
   expect(host.textContent).toContain('CareSuite HealthOS');expect(host.textContent).not.toContain('CareSuite+');expect(host.textContent).toContain('Testperson');expect(host.textContent).toContain('Testorganisation');expect(host.textContent).not.toContain('Mandant Testorganisation');
   const greeting=[...host.querySelectorAll('[role="heading"]')][0] as HTMLElement;
   const probe=document.createElement('span');probe.style.color=lightSurfaceText.primary;
   expect(greeting.style.color).toBe(probe.style.color);
   await act(async()=>host.querySelector('button')!.click());expect(close).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());host.remove();}
 });
});
