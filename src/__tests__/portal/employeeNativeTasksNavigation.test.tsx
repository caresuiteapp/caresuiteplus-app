// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  path: '/portal/employee', width: 360, push: vi.fn(), replace: vi.fn(), list: vi.fn(), update: vi.fn(),
  actor: { tenantId: 'tenant-a', employeeId: 'employee-a' as string | null, actorId: 'user-a', roleKey: 'employee_portal', isReady: true, isLinkedReady: true, isResolvingEmployeeLink: false, employeeLinkReadOnly: false },
  auth: { authReady: true, isAuthenticated: true, authMode: 'demo', profile: null, portalSession: { roleKey: 'employee_portal', accountId: 'account-a', tenantId: 'tenant-a', loginType: 'employee_portal', mustChangePassword: false }, user: { id: 'user-a' }, signOut: vi.fn(), retryProfileBootstrap: vi.fn() },
  receiver: null as React.ComponentType | null,
}));
vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const primitive = (tag: string) => React.forwardRef<any, any>((p, ref) => React.createElement(tag === 'button' && (p.accessibilityRole === 'menu' || p.accessibilityLabel === 'Menü schließen') ? 'div' : tag, { ref, 'data-testid': p.testID, role: p.accessibilityRole, 'aria-label': p.accessibilityLabel, disabled: p.disabled, onClick: (event: any) => { event.stopPropagation(); if (!p.disabled) p.onPress?.({ stopPropagation() {} }); } }, p.children));
  return { ...actual, View: primitive('div'), ScrollView: primitive('div'), Text: primitive('span'), Pressable: primitive('button'), Image: primitive('div'),
    TextInput: React.forwardRef<any, any>((p, ref) => <input ref={ref} aria-label={p.accessibilityLabel} value={p.value ?? ''} disabled={p.editable === false} onInput={event => p.onChangeText?.(event.currentTarget.value)} />),
    Modal: ({ visible, children }: any) => visible ? <div role="dialog">{children}</div> : null,
    Platform: { ...actual.Platform, OS: 'android' }, useWindowDimensions: () => ({ width: h.width, height: 800, scale: 1, fontScale: 1.6 }), findNodeHandle: () => null,
  };
});
vi.mock('expo-router', () => ({ Stack: () => h.path === '/portal/employee/tasks' && h.receiver ? React.createElement(h.receiver) : <span>Heute</span>, usePathname: () => h.path, useRouter: () => ({ push: h.push, replace: h.replace }), useIsFocused: () => true, useNavigation: () => ({ dispatch: vi.fn() }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/lib/auth', async () => ({ useAuth: () => h.auth, ...await import('@/lib/auth/RequireAuth'), ...await import('@/lib/auth/RequireRole'), ...await import('@/lib/auth/RequireEmployeePasswordSetup') }));
vi.mock('@/lib/supabase', () => ({ getSession: vi.fn() }));
vi.mock('@/hooks/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/hooks/useEmployeePortalDashboard', () => ({ useEmployeePortalDashboard: () => ({ dashboard: null, loading: false, error: null, refresh: vi.fn() }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }) }));
vi.mock('@/hooks/usePortalVisualViewport', () => ({ usePortalVisualViewport: () => ({ height: null, width: null, offsetTop: 0, offsetLeft: 0, keyboardVisible: false }) }));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({ threads: [] }) }));
vi.mock('@/hooks/useClientPortalSettings', () => ({ useClientPortalSettings: () => ({ settings: null }) }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: h.width, isPhone: h.width < 600 }) }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({ LiquidBackdrop: ({ children }: any) => <div>{children}</div>, LiquidSurface: ({ children }: any) => <div>{children}</div>, LiquidVisualModeProvider: ({ children }: any) => <>{children}</>, LiquidButton: ({ label, onPress }: any) => <button onClick={onPress}>{label}</button>, LiquidIconButton: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress}>{label}</button>, LiquidGlyph: () => null, LiquidLogo: () => null }));
vi.mock('@/lib/portal/portalMessengerFocusContext', () => ({ PortalMessengerFocusProvider: ({ children }: any) => <>{children}</>, usePortalMessengerFocus: () => ({ active: false }) }));
vi.mock('@/design/tokens/portalPremium', async original => ({ ...await original<object>(), PortalPremiumProvider: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls', () => ({ PortalTextSizeControls: () => null }));
vi.mock('@/components/navigation/NativeWorkflowPage.native', () => ({ withNativeWorkflowPage: (Page: React.ComponentType) => Page }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ title, children }: any) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: any) => <div>{message}</div>, ErrorState: ({ title, message }: any) => <div role="alert">{title}: {message}</div>, PremiumListRow: () => null }));
vi.mock('@/design/components/GlassCard', () => ({ GlassCard: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#173b57', secondary: '#526b85' }) }));
vi.mock('@/lib/office/notes/internalService.native.ts', () => ({ listInternalNotes: h.list, updateInternalDelivery: h.update }));
vi.mock('@/hooks/useUnsavedWebChanges.native.ts', () => ({ useUnsavedWebChanges: () => async () => true }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('react-native-svg', () => ({ default: () => null }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: () => null }));
vi.mock('@/components/layout/NativeSvgPresentation.native', () => ({ NativeSvg: () => null }));
vi.mock('@/components/layout/NativeWorkspaceRange.native', () => ({ NativeWorkspaceRange: () => null }));
vi.mock('@/components/layout/NativeWorkspaceMedia.native', () => ({ NativeWorkspaceMedia: () => null }));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native', () => ({ NativeWorkspacePdfFrame: () => null }));
vi.mock('@/lib/platform/nativeFileDelivery.native', () => ({ shareNativeExistingFile: vi.fn(), shareNativeFile: vi.fn() }));

import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import NativeTasksRoute from '../../../app/portal/employee/tasks/index.native';

const timestamp = '2026-10-26T08:00:00.000Z';
const delivery = { id: 'delivery-a', employeeId: 'employee-a', recipientUserId: 'user-a', displayName: 'Mara', status: 'open', readAt: null, updatedAt: timestamp, revision: 1, response: '' };
const note = { id: 'note-a', tenantId: 'tenant-a', senderUserId: 'office-a', senderName: 'Büro Nord', kind: 'callback', priority: 'high', title: 'Rückruf bei Großmann', body: 'Bitte Ergebnis mitteilen.', dueDate: null, createdAt: timestamp, recipients: [delivery] };
let root: Root, host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<LiquidPortalRouteLayout kind="employee" />)); };
const labelled = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.path = '/portal/employee'; h.width = 360; h.receiver = NativeTasksRoute;
  h.actor.employeeId = 'employee-a'; h.actor.isLinkedReady = true; h.actor.isResolvingEmployeeLink = false; h.actor.employeeLinkReadOnly = false;
  h.auth.portalSession.roleKey = 'employee_portal'; h.auth.portalSession.mustChangePassword = false;
  h.list.mockResolvedValue({ ok: true, data: [note] }); h.update.mockResolvedValue({ ok: true, data: { ...delivery, readAt: timestamp, revision: 2 } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual native employee shell to tasks receiving workflow', () => {
  it.each([360,1280])('exposes the existing announcement and support destinations in the actual shell at width %s',async width=>{
    h.width=width;await render();
    for(const [label,target] of [['Mitteilungen','/portal/employee/announcements'],['Hilfe','/portal/employee/help']]){
      if(width<900)await act(async()=>labelled('Weitere Portalbereiche öffnen')!.click());
      const entry=labelled(label);expect(entry).not.toBeNull();await act(async()=>entry!.click());
      expect(h.push).toHaveBeenLastCalledWith(target);
    }
    expect(labelled('Beratung & Schulungen')).toBeNull();
  });

  it.each([360, 1280])('opens the existing native notes receiver from the actual menu at width %s', async width => {
    h.width = width; await render();
    if (width < 900) await act(async () => labelled('Weitere Portalbereiche öffnen')!.click());
    const tasks = labelled('Aufgaben & Notizen'); expect(tasks).not.toBeNull();
    expect(labelled('Beratung & Schulungen')).toBeNull();
    await act(async () => tasks!.click()); expect(h.push).toHaveBeenCalledExactlyOnceWith('/portal/employee/tasks');
    h.path = '/portal/employee/tasks'; await render();
    expect(host.textContent).toContain('Rückruf bei Großmann');
    expect(h.list).toHaveBeenCalledWith({ tenantId: 'tenant-a', userId: 'user-a', roleKey: 'employee_portal', employeeId: 'employee-a', readOnly: false }, 'inbox');
    const open = [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.includes('Rückruf bei Großmann'))!;
    await act(async () => open.click()); expect(h.update).not.toHaveBeenCalled();
    const acknowledge = [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === 'Als gelesen bestätigen')!;
    await act(async () => acknowledge.click());
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a', employeeId: 'employee-a' }), { deliveryId: 'delivery-a', employeeId: 'employee-a', expectedRevision: 1, action: 'read' });
  });
  it('keeps the existing receiving fallback and avoids data reads without a verified employee link', async () => {
    h.path = '/portal/employee/tasks'; h.actor.isLinkedReady = false; h.actor.employeeId = null; await render();
    expect(host.textContent).toContain('Mitarbeiterzugang nicht zugeordnet'); expect(h.list).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled();
  });
  it('keeps the actual role guard before the native tasks receiver', async () => {
    h.path = '/portal/employee/tasks'; h.auth.portalSession.roleKey = 'client_portal'; await render();
    expect(host.textContent).not.toContain('Rückruf bei Großmann'); expect(h.list).not.toHaveBeenCalled();
    expect(h.replace).toHaveBeenCalledWith('/portal/client');
  });
});
