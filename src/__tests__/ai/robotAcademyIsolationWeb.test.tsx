// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '@/lib/auth/context';

const state = vi.hoisted(() => ({
  auth: {} as Pick<AuthContextValue, 'authReady' | 'isAuthenticated' | 'user' | 'profile' | 'portalSession' | 'session'>,
  permissions: vi.fn(), tenant: vi.fn(), mount: vi.fn(), unmount: vi.fn(), speech: vi.fn(), dispose: vi.fn(), clients: vi.fn(),
}));
vi.mock('react-native', () => ({ Image: {} }));
vi.mock('expo-router', () => ({ usePathname: () => '/desktop' }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: vi.fn(), back: vi.fn(), canGoBack: () => false }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => state.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: state.permissions }));
vi.mock('@/lib/navigation/businessHome', () => ({ WEB_DESKTOP_ROUTE: '/desktop' }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: state.clients }));
vi.mock('@/components/brand/brandassets', () => ({ CARESUITE_ROBOT_LOGO: 'robot-test.svg' }));
vi.mock('@/components/brand/appStartIntroSession', () => ({ useAppStartIntroReady: () => true }));
vi.mock('@/components/brand/WebStartDestination.web', () => ({ useWebStartChoiceVisible: () => false }));
vi.mock('@/ai/robot/robotAssistantDom', () => ({ mountRobotAssistant: state.mount }));
vi.mock('@/ai/robot/neoSpeech.web', () => ({ createNeoSpeech: state.speech }));
vi.mock('@/ai/robot/neoCommands', () => ({ neoProfileName: () => 'Eigene Person' }));
vi.mock('@/ai/robot/neoWeather.web', () => ({ getNeoWeather: vi.fn() }));
vi.mock('@/ai/robot/voiceCommands', () => ({ matchVoiceClients: vi.fn() }));

import { RobotNavigationAssistant } from '@/ai/robot/RobotNavigationAssistant.web';

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.auth = {
    authReady: true, isAuthenticated: true, portalSession: null, session: null,
    user: { id: 'office-user', email: 'office@example.invalid', displayName: 'Office', roleKey: 'business_admin' },
    profile: { roleKey: 'business_admin' } as AuthContextValue['profile'],
  };
  state.permissions.mockReturnValue({ can: () => true, hasModuleGate: () => true });
  state.tenant.mockReturnValue('tenant');
  state.mount.mockReturnValue(state.unmount);
  state.speech.mockReturnValue({ loadVoice: vi.fn(), prepare: vi.fn(), dispose: state.dispose });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(<RobotNavigationAssistant />));

describe('academy-only family isolation from the global desktop robot', () => {
  it.each(['user', 'portal', 'jwt'] as const)('does not mount permission, care or speech hooks for family detected through %s', async source => {
    if (source === 'user') state.auth.user = { ...state.auth.user!, portalType: 'academy_family', accessScope: 'academy' };
    if (source === 'portal') state.auth.portalSession = { portalType: 'academy_family' } as AuthContextValue['portalSession'];
    if (source === 'jwt') state.auth.session = {
      accessToken: `test.${btoa(JSON.stringify({ app_metadata: { portal_type: 'academy_family' } }))}.test`,
    } as AuthContextValue['session'];
    await render();
    expect(state.permissions).not.toHaveBeenCalled();
    expect(state.tenant).not.toHaveBeenCalled();
    expect(state.mount).not.toHaveBeenCalled();
    expect(state.speech).not.toHaveBeenCalled();
    expect(state.clients).not.toHaveBeenCalled();
  });

  it('retains the normal desktop assistant and disposes it when switching to an academy-only family', async () => {
    await render();
    expect(state.permissions).toHaveBeenCalledOnce();
    expect(state.mount).toHaveBeenCalledOnce();
    expect(state.speech).toHaveBeenCalledOnce();
    state.auth.user = { ...state.auth.user!, portalType: 'academy_family', accessScope: 'academy' };
    await render();
    expect(state.permissions).toHaveBeenCalledOnce();
    expect(state.mount).toHaveBeenCalledOnce();
    expect(state.unmount).toHaveBeenCalledOnce();
    expect(state.dispose).toHaveBeenCalledOnce();
    expect(state.clients).not.toHaveBeenCalled();
  });
});
