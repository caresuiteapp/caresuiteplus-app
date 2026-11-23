// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('react-native',()=>({
  Platform:{OS:'android'},useWindowDimensions:()=>({fontScale:1}),StyleSheet:{create:(v:unknown)=>v},
  View:({children,testID,accessibilityRole,accessibilityLabel}:any)=><div data-testid={testID} role={accessibilityRole} aria-label={accessibilityLabel}>{children}</div>,
  ScrollView:({children}:any)=><div>{children}</div>,Text:({children,accessibilityRole}:any)=><span role={accessibilityRole}>{children}</span>,
  Pressable:({children,onPress,disabled,accessibilityRole,accessibilityLabel,accessibilityState}:any)=><button role={accessibilityRole??'button'} aria-label={accessibilityLabel} aria-selected={accessibilityState?.selected} disabled={disabled} onClick={onPress}>{children}</button>,
}));
vi.mock('@expo/vector-icons/Ionicons',()=>({default:()=>null}));
vi.mock('@/design/web/WebFontScaleProvider',()=>({useWebFontScaleValue:()=>1}));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls',()=>({PortalTextSizeControls:()=>null}));
vi.mock('@/components/portal/PortalReadOnlyAvatar',()=>({PortalReadOnlyAvatar:()=>null}));
vi.mock('@/components/portal/employee/EmployeePortalHeaderStatus',()=>({EmployeePortalHeaderStatus:()=> <span>Uhrzeit und Wetter</span>}));
vi.mock('@/components/portal/employee/EmployeePortalBackdrop',()=>({EmployeePortalBackdrop:()=>null}));
vi.mock('@/components/portal/client/ClientPortalArtwork',()=>({ClientPortalArtwork:()=>null}));
vi.mock('@/components/portal/assist/PortalGlassModal',()=>({PortalGlassModal:({children,title,onClose}:any)=><div role="dialog" aria-label={title}><button onClick={onClose}>Schließen</button>{children}</div>}));
import {ClientPortalFrame} from '@/components/portal/client/ClientPortalFrame';
import {clientPortalActiveId} from '@/components/portal/client/clientPortalDesign';
import {liquidPortalNavigation} from '@/liquid-command/navigation/portalCatalog.web';
let host:HTMLDivElement,root:Root;const navigate=vi.fn(),signOut=vi.fn();
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);signOut.mockResolvedValue(undefined);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const mount=(overrides:any={})=>act(async()=>root.render(<ClientPortalFrame width={390} displayName="Helene Musterfrau" weatherOwner={null} navigation={liquidPortalNavigation.client} activeId="home" unreadCount={3} keyboardVisible={false} focus={false} insets={{top:0,bottom:0}} onNavigate={navigate} onSignOut={signOut} {...overrides}><span>Inhalt</span></ClientPortalFrame>));
const button=(label:string)=>host.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
const click=(label:string)=>act(async()=>button(label).click());
describe('client portal frame interaction',()=>{
 it('makes every released area reachable through the mobile More menu',async()=>{
  await mount();expect(host.querySelectorAll('[role="tab"]')).toHaveLength(4);
  await click('Mehr, alle Bereiche');expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  for(const item of liquidPortalNavigation.client)expect(button(item.id==='messages'?`${item.label}, 3 ungelesene Nachrichten`:item.label)).not.toBeNull();
  await click('Meine Akademie');expect(navigate).toHaveBeenLastCalledWith('/portal/client/akademie');expect(host.querySelector('[role="dialog"]')).toBeNull();
 });
 it('keeps narrow input and focused messenger space free of the bottom navigation',async()=>{
  await mount({keyboardVisible:true});expect(host.querySelector('[data-testid="client-portal-bottom-navigation"]')).toBeNull();
  await mount({focus:true});expect(host.querySelector('[data-testid="client-portal-header"]')).toBeNull();expect(host.textContent).toContain('Inhalt');
 });
 it('blocks simultaneous sign-outs and lets the user retry a failed sign-out',async()=>{
  let reject!:(reason:unknown)=>void;signOut.mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no;}));await mount();await click('Mehr, alle Bereiche');
  await act(async()=>{button('Abmelden').click();button('Abmelden').click();});expect(signOut).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('offline')));expect(host.querySelector('[role="alert"]')?.textContent).toContain('erneut');
  await click('Abmelden');expect(signOut).toHaveBeenCalledTimes(2);
 });
 it('selects signature details ahead of their documents parent and respects restricted navigation',async()=>{
  expect(clientPortalActiveId('/portal/client/documents/signatures/example',liquidPortalNavigation.client)).toBe('signatures');
  const allowed=liquidPortalNavigation.client.filter(item=>['home','profile','help'].includes(item.id));await mount({navigation:allowed});await click('Mehr, alle Bereiche');
  expect(button('Dokumente')).toBeNull();expect(button('Meine Akademie')).toBeNull();expect(button('Profil')).not.toBeNull();
 });
});
