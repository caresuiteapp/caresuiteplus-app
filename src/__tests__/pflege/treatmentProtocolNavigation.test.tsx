// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TreatmentWorkspaceScreen } from '@/screens/pflege/TreatmentWorkspaceScreen.web';

const fixture = vi.hoisted(() => ({
  tenant: '11111111-1111-4111-8111-111111111111',
  profile: '22222222-2222-4222-8222-222222222222',
  protocolAllowed: true,
  correctionDenied: true,
  view: undefined as string | undefined,
  push: vi.fn(),
  from: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ view: fixture.view }),
  useRouter: () => ({ push: fixture.push }),
}));
vi.mock('@/components/layout', () => ({
  ScreenShell: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock('@/components/ui', () => ({
  ErrorState: ({ message, presentation = 'overlay', onRetry }: { message: string; presentation?: string; onRetry?: () => void }) => (
    <div role={presentation === 'inline' ? 'alert' : 'dialog'}>{message}<button onClick={onRetry}>Erneut versuchen</button></div>
  ),
  LoadingState: ({ presentation = 'overlay' }: { presentation?: string }) => <div role={presentation === 'inline' ? 'status' : 'dialog'}>Nachweise laden</div>,
  InfoBanner: ({ message }: { message: string }) => <div>{message}</div>,
  PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => <button onClick={onPress}>{title}</button>,
  PremiumInput: ({ accessibilityLabel }: { accessibilityLabel: string }) => <input aria-label={accessibilityLabel} />,
  SectionPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ profile: { id: fixture.profile, tenantId: fixture.tenant, roleKey: 'business_admin' } }),
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => fixture.tenant }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({
  useCareRuntimePermissions: () => ({
    tenantId: fixture.tenant,
    roleKey: 'business_admin',
    can: (key: string) => key === 'pflege.treatment.view' || (key === 'pflege.documentation.view' && fixture.protocolAllowed),
  }),
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: fixture.from }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/pflege/woundCareService', () => ({ fetchWoundCareContext: vi.fn() }));
vi.mock('@/screens/pflege/TreatmentCorrectionScreen.web', () => ({
  TreatmentCorrectionScreen: () => null,
  TreatmentCorrectionHistory: () => null,
  OriginalTreatmentSection: () => null,
  treatmentOutcome: (v: string) => v,
  useTreatmentCorrectionStyles: () => ({}),
}));
vi.mock('@/screens/pflege/ControlSourceLaunchButton.web', () => ({ ControlSourceLaunchButton: () => null }));
vi.mock('@/screens/pflege/StructuredTreatmentSourcePanel.web', () => ({ StructuredTreatmentSourcePanel: () => null }));
vi.mock('@/screens/pflege/DailyProtocolScreen.web', () => ({ DailyProtocolScreen: () => <h1>Pflegeprotokolle</h1> }));
vi.mock('@/screens/pflege/ClinicalControlScreen.web', () => ({ ClinicalControlScreen: () => null }));
vi.mock('@/screens/pflege/InfusionCourseScreen.web', () => ({ InfusionCourseScreen: () => null }));
vi.mock('@/screens/pflege/TreatmentCareWorkspaceScreen.web', () => ({ TreatmentCareWorkspaceScreen: () => null }));

let host: HTMLDivElement;
let root: Root;
const render = () => act(async () => root.render(<TreatmentWorkspaceScreen />));
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((element) => element.textContent === label);
const protocolLabel = 'Trink-, Mahlzeiten- und Ausscheidungsprotokolle öffnen';

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  fixture.view = undefined;
  fixture.protocolAllowed = fixture.correctionDenied = true;
  fixture.from.mockImplementation((table: string) => {
    const denied = table === 'clinical_treatment_corrections' && fixture.correctionDenied;
    const response = Promise.resolve(denied
      ? { data: null, error: { code: '42501', message: 'permission denied for table clinical_treatment_corrections' } }
      : { data: [], error: null });
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      then: response.then.bind(response),
    };
    return query;
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('opens the protocol workspace when PostgREST rejects the correction history', async () => {
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Für den Berichtigungsverlauf fehlt die Lesefreigabe.');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('input')).toBeNull();

  fixture.push.mockImplementationOnce(({ params }) => { fixture.view = params.view; });
  await act(async () => button(protocolLabel)!.click());
  expect(fixture.push).toHaveBeenCalledWith({ pathname: '/pflege/behandlungspflege', params: { view: 'protocols' } });
  fixture.from.mockClear();
  await render();
  expect(host.querySelector('h1')?.textContent).toBe('Pflegeprotokolle');
  expect(fixture.from).not.toHaveBeenCalled();
});

it('reloads the normal treatment list when history becomes readable', async () => {
  await render();
  fixture.correctionDenied = false;
  await act(async () => button('Erneut versuchen')!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[aria-label="Durchführungsnachweise suchen"]')).not.toBeNull();
  expect(host.textContent).toContain('Noch keine zugänglichen Durchführungsnachweise');
});

it('only offers the protocol navigation with the documentation permission', async () => {
  fixture.protocolAllowed = false;
  await render();
  expect(button(protocolLabel)).toBeUndefined();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
