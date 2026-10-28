// @vitest-environment happy-dom
import React, {act, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {buildSync} from 'esbuild';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api={authMode:'supabase',authReady:true,user:{id:'user-a'},profile:{tenantId:'tenant'},portalSession:null,session:{accessToken:'token'},signOut:vi.fn(),retryProfileBootstrap:vi.fn()};
const read=vi.fn(),register=vi.fn(),saved=vi.fn(),removed=vi.fn(),offline=vi.fn();
const valid={active:true,mfaRequired:false,aal:'aal1',sessionId:'session-a'};
let appStateListener: (state:string)=>void=()=>{};
const keyboardDismiss=vi.fn();
const platform={OS:'web'};
const Element=({children,accessibilityElementsHidden,ref,...props}:any)=><div ref={ref} aria-hidden={accessibilityElementsHidden||undefined}>{children}</div>;
const deps:Record<string,any>={react:React,'react/jsx-runtime':await import('react/jsx-runtime'),
 'react-native':{ActivityIndicator:()=>null,AppState:{addEventListener:(_event:string,listener:(state:string)=>void)=>{appStateListener=listener;return{remove(){}}}},Keyboard:{dismiss:keyboardDismiss},Modal:({children,visible}:any)=>visible?<div role="dialog">{children}</div>:null,Platform:platform,ScrollView:Element,View:Element,Text:Element,StyleSheet:{create:(v:any)=>v}},
 '@/lib/auth/context':{useAuth:()=>api},'@/components/brand/appStartIntroSession':{useAppStartIntroReady:()=>true},
 '@/components/ui':{PremiumButton:({title,onPress}:any)=><button onClick={onPress}>{title}</button>},
 './MfaSettingsCard':{MfaSettingsCard:()=> <div>Authenticator-Prüfung</div>},
 '@/lib/auth/accountSecurityService':{readAccountSecurityState:read,registerCurrentAccountDevice:register},
 '@/lib/security/sensitiveAuthStorage':{sensitiveAuthStorage:{setItem:saved,removeItem:removed,getItem:async()=>null}},
 '@/lib/offline/connectivity':{isDeviceOffline:offline},
 '@/lib/auth/portalBiometricService':{authenticatePortalFace:vi.fn()},
 '@/lib/services/queryTimeout':{withServiceQueryTimeout:(p:Promise<any>)=>p},
 '@/lib/auth/accountSecurityReceipt':{matchesOfflineSecurityReceipt:()=>null},
};
const bundle=buildSync({entryPoints:['src/components/auth/AccountSessionGate.tsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:Object.keys(deps)}).outputFiles[0].text;
const module={exports:{} as any};new Function('require','module','exports',bundle)((id:string)=>{if(!(id in deps))throw Error(id);return deps[id]},module,module.exports);
const Gate=module.exports.AccountSessionGate;
let host:HTMLDivElement,root:ReturnType<typeof createRoot>,unmounts:number;
function Draft(){useEffect(()=>()=>{unmounts++},[]);return <input defaultValue="Offener Entwurf"/>}
const render=async()=>{await act(async()=>root.render(<Gate><Draft/></Gate>))};
const tick=async()=>{await act(async()=>{vi.advanceTimersByTime(60_000);await Promise.resolve()})};
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();platform.OS='web';(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;api.user={id:'user-a'};api.session={accessToken:'token'};read.mockResolvedValue(valid);register.mockResolvedValue(undefined);saved.mockResolvedValue(undefined);removed.mockResolvedValue(undefined);offline.mockReturnValue(false);unmounts=0;host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers()});
it('does not open protected workspaces before the required Authenticator check',async()=>{read.mockResolvedValue({...valid,mfaRequired:true});await render();expect(host.textContent).toContain('Authenticator-Prüfung');expect(host.querySelector('input')).toBeNull();expect(register).not.toHaveBeenCalled()});
it('preserves an edited form behind the blocking screen after a server error and restores it on retry',async()=>{await render();const input=host.querySelector('input')!;input.value='Ungespeicherte Änderung';input.focus();read.mockRejectedValueOnce(Error('Verbindung unterbrochen'));await tick();expect(host.textContent).toContain('Verbindung unterbrochen');expect(input.closest('[aria-hidden="true"]')).not.toBeNull();expect(unmounts).toBe(0);expect(document.activeElement).not.toBe(input);expect(input.closest('[inert]')).not.toBeNull();const retry=[...host.querySelectorAll('button')].find(b=>b.textContent==='Sichere Anmeldung erneut prüfen')!;await act(async()=>retry.click());expect(host.querySelector('input')).toBe(input);expect(input.value).toBe('Ungespeicherte Änderung');expect(input.closest('[aria-hidden="true"]')).toBeNull()});
it('blocks a revoked session without destroying local input',async()=>{await render();read.mockResolvedValue({...valid,active:false});await tick();expect(host.textContent).toContain('Diese Geräteanmeldung wurde beendet');expect(removed).toHaveBeenCalledWith('caresuite.security-receipt.user-a.tenant');expect(host.querySelector('input')?.closest('[aria-hidden="true"]')).not.toBeNull();expect(unmounts).toBe(0)});
it('metadata registration errors do not invalidate a server-confirmed session',async()=>{register.mockRejectedValue(Error('Metadata unavailable'));await render();expect(host.querySelector('input')).not.toBeNull();expect(host.textContent).not.toContain('Metadata unavailable')});
it('offline access without a bound recent receipt stays blocked',async()=>{offline.mockReturnValue(true);await render();expect(host.querySelector('input')).toBeNull();expect(host.textContent).toContain('offline noch keine gültige Gerätefreigabe');expect(read).not.toHaveBeenCalled()});

it('a late response from an old session cannot unlock a replacement session',async()=>{let resolve!:(v:any)=>void;read.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));await render();api.session={accessToken:'replacement'};read.mockResolvedValue({...valid,active:false});await render();await act(async()=>resolve(valid));expect(host.querySelector('input')).toBeNull();expect(host.textContent).toContain('Diese Geräteanmeldung wurde beendet')});

it('covers background content immediately, including native modal content, without discarding a draft',async()=>{platform.OS='android';await render();const input=host.querySelector('input')!;input.value='Entwurf';await act(async()=>appStateListener('background'));expect(host.querySelector('[role="dialog"]')?.textContent).toContain('CareSuite geschützt');expect(input.closest('[aria-hidden="true"]')).not.toBeNull();expect(keyboardDismiss).toHaveBeenCalled();await act(async()=>appStateListener('active'));expect(host.querySelector('[role="dialog"]')).toBeNull();expect(host.querySelector('input')?.value).toBe('Entwurf');expect(unmounts).toBe(0)});
it('requires reauthentication after a longer business-account background interval',async()=>{await render();await act(async()=>appStateListener('background'));await act(async()=>{vi.advanceTimersByTime(120001);await Promise.resolve()});await act(async()=>appStateListener('active'));expect(host.querySelector('[role="dialog"]')?.textContent).toContain('CareSuite gesperrt');expect(host.querySelector('input')?.closest('[inert]')).not.toBeNull();expect(unmounts).toBe(0)});
