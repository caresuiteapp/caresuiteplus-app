// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({end:vi.fn(),clear:vi.fn(),refresh:vi.fn(),demo:vi.fn(),replace:vi.fn()}));
vi.mock('expo-router',()=>({useRouter:()=>({replace:api.replace,push:vi.fn()}),usePathname:()=>'/platform/tenants/a'}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({signOut:api.clear})}));
vi.mock('@/lib/supabase/authService',()=>({signOut:api.end}));
vi.mock('@/lib/platformConsole/platformAuthService',()=>({setDemoPlatformUser:api.demo}));
vi.mock('@/lib/platformConsole/PlatformAuthProvider',()=>({usePlatformAuth:()=>({platformUser:{role:'platform_owner',fullName:'Inhaber'},refresh:api.refresh})}));
vi.mock('@/lib/platformConsole',()=>({getPlatformReleaseInfo:()=>({environment:'preview'}),platformRoleHasCapability:()=>true,PLATFORM_ROLE_LABELS:{platform_owner:'Inhaber'}}));
vi.mock('@/hooks/useDesktopWorkspacePreferences',()=>({useDesktopWorkspacePreferences:()=>({leftCollapsed:true,toggleLeft:vi.fn()})}));
vi.mock('@/components/layout/HealthOSPageSurface',()=>({HealthOSPageSurface:({children}:any)=><div>{children}</div>}));
vi.mock('@/liquid-command/components/LiquidPrimitives',()=>({LiquidLogo:()=>null}));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls',()=>({PortalTextSizeControls:()=>null}));
vi.mock('@/components/platformConsole/PlatformGlobalSearch',()=>({PlatformGlobalSearch:()=>null}));
vi.mock('@/components/layout/DesktopSidebarToggle',()=>({DesktopSidebarToggle:()=>null}));
import {PlatformShellLayout} from '@/components/platformConsole/PlatformShellLayout.web';
let root:Root,host:HTMLDivElement;
const logout=()=>host.querySelector('[aria-label="Abmelden"]') as HTMLButtonElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();api.end.mockResolvedValue({ok:true});api.clear.mockResolvedValue(undefined);api.refresh.mockResolvedValue(undefined);host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('keeps logout available with a collapsed navigation and locks repeated clicks until all session state is cleared',async()=>{
  let resolve!:(value:any)=>void;api.end.mockReturnValue(new Promise(r=>{resolve=r;}));
  await act(async()=>root.render(<PlatformShellLayout title="Mandantenakte"><div>Unternehmen</div></PlatformShellLayout>));
  expect(logout()).not.toBeNull();await act(async()=>{logout().click();logout().click();});expect(api.end).toHaveBeenCalledTimes(1);expect(api.replace).not.toHaveBeenCalled();
  await act(async()=>resolve({ok:true}));expect(api.clear).toHaveBeenCalledTimes(1);expect(api.demo).toHaveBeenCalledWith(null);expect(api.refresh).toHaveBeenCalledTimes(1);expect(api.replace).toHaveBeenCalledWith('/platform/login');
});
it('shows a failed logout without pretending the session was cleared and allows retry',async()=>{
  api.end.mockResolvedValueOnce({ok:false,error:'unavailable'});
  await act(async()=>root.render(<PlatformShellLayout><div>Unternehmen</div></PlatformShellLayout>));await act(async()=>logout().click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Abmeldung konnte nicht bestätigt');expect(api.clear).not.toHaveBeenCalled();expect(api.replace).not.toHaveBeenCalled();
  await act(async()=>logout().click());expect(api.replace).toHaveBeenCalledWith('/platform/login');
});
