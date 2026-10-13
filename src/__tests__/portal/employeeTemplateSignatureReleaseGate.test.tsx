// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ sign: vi.fn(), refresh: vi.fn(), actor: { roleKey: 'employee_portal', employeeId: 'employee', clientId: null, actorId: 'profile', isLinkedReady: true, isResolvingEmployeeLink: false, isResolvingClientLink: false }, item: { id: 'request', title: 'Arbeitsvertrag', status: 'opened', updatedAt: '2026-10-11T09:00:00Z', renderedHtml: '<p>Alle Originalbedingungen bleiben lesbar.</p>', signatures: [], pendingSignatureRoles: ['employee'], dueDate: null, requiredBeforeService: false } }));
vi.mock('react-native', () => ({ View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>, Pressable: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>, StyleSheet: { create: (v: unknown) => v } }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'request' }), useRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: () => ({ data: h.item, loading: false, error: null, refresh: h.refresh }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant' }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'profile', roleKey: 'employee_portal', displayName: 'Testperson' } }) }));
vi.mock('@/lib/documents/csTemplates', () => ({ EMPLOYEE_TEMPLATE_SIGNING_RELEASE_GATE: 'Die Unterzeichnung ist vorübergehend gesperrt. Das Original können Sie weiterhin lesen.', fetchCsDocumentRequestDetail: vi.fn(), fetchPortalCsDocumentRequestDetail: vi.fn(), markCsDocumentRequestOpened: vi.fn(), signCsDocumentRequest: h.sign }));
vi.mock('@/components/portal/ClientSignatureAttentionProvider', () => ({ useClientSignatureAttention: () => ({ refresh: h.refresh }) }));
vi.mock('@/components/office/DocumentHtmlPreview', () => ({ DocumentHtmlPreview: ({ previewHtml }: any) => <div data-original>{previewHtml}</div> }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: ({ visible }: any) => visible ? <div>Signaturdialog</div> : null }));
vi.mock('@/components/signatures/SignatureDisplay', () => ({ SignatureDisplay: () => null }));
vi.mock('@/components/layout/C14vSubpageShell', () => ({ C14vSubpageShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children, actionsSlot }: any) => <main>{actionsSlot}{children}</main> }));
vi.mock('@/components/portal/ClientPortalGuide', () => ({ ClientPortalGuide: ({ message }: any) => <div>{message}</div> }));
vi.mock('@/components/ui', () => ({ InfoBanner: ({ message }: any) => <div>{message}</div>, SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>, PremiumBadge: ({ label }: any) => <span>{label}</span>, PremiumButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>, ErrorState: ({ message }: any) => <div>{message}</div>, EmptyState: ({ message }: any) => <div>{message}</div>, LoadingState: ({ message }: any) => <div>{message}</div>, SuccessState: ({ message }: any) => <div>{message}</div> }));
vi.mock('@/design/tokens/auroraGlass', () => ({ PORTAL_LIGHT_LINK_ORANGE: '#ef7200', useAuroraAdaptiveText: () => ({ muted: '#777' }) }));
vi.mock('@/design/tokens/modules', () => ({ moduleColor: () => '#123' }));
vi.mock('@/theme', () => ({ spacing: { sm: 8, md: 12 }, typography: { caption: {}, body: {} } }));
import { CsDocumentRequestDetailScreen as NativeScreen } from '@/screens/documents/CsDocumentRequestDetailScreen';
import { CsDocumentRequestDetailScreen as WebScreen } from '@/screens/documents/CsDocumentRequestDetailScreen.web';
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe.each([['native', NativeScreen], ['web', WebScreen]] as const)('%s employee template release gate', (_platform, Screen) => {
  it('shows the reason before capture and preserves the complete readable original', async () => {
    await act(async () => root.render(<Screen mode="employee" signerRole="employee" />));
    expect(host.textContent).toContain('Die Unterzeichnung ist vorübergehend gesperrt');
    expect(host.querySelector('[data-original]')?.textContent).toBe(h.item.renderedHtml);
    expect(host.textContent).not.toContain('Jetzt unterschreiben'); expect(host.textContent).not.toContain('Signaturdialog'); expect(h.sign).not.toHaveBeenCalled();
  });
});
