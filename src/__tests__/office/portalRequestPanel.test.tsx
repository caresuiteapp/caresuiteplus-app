// @vitest-environment happy-dom
import React,{act} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const f=vi.hoisted(()=>({requests:[] as Record<string,unknown>[],error:null as string|null,refresh:vi.fn(),push:vi.fn(),hook:vi.fn()}));
vi.mock('@/hooks/useTenantPortalRequests',()=>({useTenantPortalRequests:(...args:unknown[])=>{f.hook(...args);return{requests:f.requests,error:f.error,loading:false,refresh:f.refresh};}}));
vi.mock('@/hooks/useFlowRouter',()=>({useFlowRouter:()=>({push:f.push})}));
vi.mock('@/design/components/GlassCard',()=>({GlassCard:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock('@/design/tokens/auroraGlass',()=>({useAuroraAdaptiveText:()=>({primary:'#111',secondary:'#444'})}));
vi.mock('@/design/tokens/responsiveTypography',()=>({resolveGalaxyTypography:()=>({body:{},caption:{}}),noBreakTextProps:{}}));
vi.mock('@/hooks/useDeviceClass',()=>({useDeviceClass:()=>({width:1200})}));
vi.mock('@/components/ui',()=>({LoadingState:()=>null}));
vi.mock('@/components/ui/PremiumButton',()=>({PremiumButton:({title,onPress,accessibilityLabel}:{title:string;onPress:()=>void;accessibilityLabel?:string})=><button onClick={onPress} aria-label={accessibilityLabel}>{title}</button>}));
vi.mock('@/lib/portal/assist',()=>({resolvePortalRequestTypeLabel:()=> 'Rückruf'}));
import { PortalRequestsOfficePanel } from '@/components/office/PortalRequestsOfficePanel';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();f.error=null;
  f.requests=Array.from({length:12},(_,n)=>({id:`r-${n}`,clientId:'client',clientName:'Testperson',title:`Rückruf ${n}`,requestType:'rueckruf',status:'offen',
    createdAt:'2026-11-03T09:47:31Z',description:`Vollständige Nachricht ${n}`,payload:{},officeThreadId:`thread-${n}`}));
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=()=>act(async()=>root.render(<PortalRequestsOfficePanel tenantId="tenant" clientId="client"/>));
const click=async(label:string)=>act(async()=>{const button=[...host.querySelectorAll('button')].find(x=>x.textContent===label)!;button.click();});
describe('Office request content and conversation entry',()=>{
  it('shows the original message, client and local timestamp and opens the exact client conversation',async()=>{
    await render();expect(f.hook).toHaveBeenCalledWith('tenant',true,'client');
    expect(host.textContent).toContain('Vollständige Nachricht 0');expect(host.textContent).toContain('Testperson');
    expect(host.textContent).toContain('03.11.2026');expect(host.textContent).toContain('10:47');
    await click('Nachricht öffnen');expect(f.push).toHaveBeenCalledWith('/office/messages?audience=clients&thread=thread-0');
  });
  it('makes every remaining request reachable instead of silently stopping after five',async()=>{
    await render();expect(host.textContent).not.toContain('Vollständige Nachricht 11');
    await click('Weitere Anfragen anzeigen (2)');expect(host.textContent).toContain('Vollständige Nachricht 11');
  });
  it('keeps errors distinct from an empty inbox and offers a working retry',async()=>{
    f.requests=[];f.error='Anfragen konnten nicht geladen werden';await render();
    expect(host.textContent).not.toContain('Keine offenen');expect(host.querySelector('[role=alert]')?.textContent).toContain(f.error);
    await click('Erneut laden');expect(f.refresh).toHaveBeenCalledOnce();
  });
});
