// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({read:vi.fn(),verify:vi.fn(),enroll:vi.fn(),user:'owner'}));
vi.mock('react-native',()=>({View:({children}:any)=><div>{children}</div>,Text:({children,accessibilityRole}:any)=><span role={accessibilityRole}>{children}</span>,TextInput:({value,onChangeText,accessibilityLabel}:any)=><input aria-label={accessibilityLabel} value={value} onChange={event=>onChangeText(event.currentTarget.value)}/>,StyleSheet:{create:(s:any)=>s},useWindowDimensions:()=>({width:320})}));
vi.mock('react-native-svg',()=>({SvgXml:()=> <div data-testid="authenticator-qr"/>}));
vi.mock('@/components/ui',()=>({PremiumButton:({title,onPress,disabled}:any)=><button onClick={onPress} disabled={disabled}>{title}</button>}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({user:{id:h.user}})}));
vi.mock('@/lib/auth/accountSecurityService',()=>({readMfaFactors:h.read,verifyMfaFactor:h.verify,enrollMfaFactor:h.enroll}));
import {MfaSettingsCard} from '@/components/auth/MfaSettingsCard';
let host:HTMLDivElement,root:Root;
const click=async(prefix:string)=>{const b=[...host.querySelectorAll('button')].find(item=>item.textContent?.startsWith(prefix));expect(b).toBeTruthy();await act(async()=>b!.click())};
const code=async()=>{await act(async()=>{const input=host.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'123456');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})};
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();h.user='owner';h.read.mockResolvedValue([{id:'primary',friendly_name:'Telefon'},{id:'backup',friendly_name:'Backupgerät'}]);h.verify.mockResolvedValue(undefined);host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());host.remove()});
it('can verify a backup authenticator when the first device is unavailable',async()=>{const done=vi.fn();await act(async()=>root.render(<MfaSettingsCard onVerified={done}/>));await click('Backupgerät');await code();await click('Authenticator-Code bestätigen');expect(h.verify).toHaveBeenCalledWith('owner','backup','123456');expect(done).toHaveBeenCalledOnce()});
it('keeps an unconfirmed code in the form and exposes the error without granting access',async()=>{const done=vi.fn();h.verify.mockRejectedValueOnce(Error('Ungültiger Code'));await act(async()=>root.render(<MfaSettingsCard onVerified={done}/>));await code();await click('Authenticator-Code bestätigen');expect(host.textContent).toContain('Ungültiger Code');expect(host.querySelector('input')?.value).toBe('123456');expect(done).not.toHaveBeenCalled()});
it('does not reveal a late enrollment secret after an account switch',async()=>{let resolve!:(v:any)=>void;h.enroll.mockReturnValueOnce(new Promise(done=>{resolve=done}));await act(async()=>root.render(<MfaSettingsCard/>));await click('Zweiten Authenticator');h.user='other';await act(async()=>root.render(<MfaSettingsCard/>));await act(async()=>resolve({id:'factor',totp:{secret:'OLD-SECRET',qr_code:'<svg/>'}}));expect(host.textContent).not.toContain('OLD-SECRET');expect(host.querySelector('[data-testid="authenticator-qr"]')).toBeNull()});
