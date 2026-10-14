// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientIntakeWizardFormProps } from '@/components/office/clientintakewizardform.web';

const h = vi.hoisted(() => ({
  draftId: undefined as string | undefined,
  formProps: null as ClientIntakeWizardFormProps | null,
  mounted: vi.fn(), replace: vi.fn(), back: vi.fn(),
  completedId: '22222222-2222-4222-8222-222222222222',
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ draftId: h.draftId }) }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ replace: h.replace, back: h.back }) }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ children, title }: { children: ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock('@/design/tokens/surfaceContrast', () => ({ SurfaceContrastProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/office/clientintakewizardform.web', () => ({
  ClientIntakeWizardForm: (props: ClientIntakeWizardFormProps) => {
    h.mounted(); h.formProps = props;
    return <button type="button" onClick={() => props.onCreated?.(h.completedId)}>Aufnahme bestätigen</button>;
  },
}));
import { ClientIntakeWizardScreen } from '@/screens/business/office/ClientIntakeWizardScreen.web';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); h.draftId = undefined; h.formProps = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('saved intake entry route', () => {
  it('resumes the requested UUID in create mode and navigates only after a confirmed completion', async () => {
    h.draftId = '11111111-1111-4111-8111-111111111111';
    await act(async () => root.render(<ClientIntakeWizardScreen />));
    expect(h.formProps).toMatchObject({ mode: 'create', clientId: h.draftId });
    expect(host.querySelector('h1')?.textContent).toBe('Aufnahme fortsetzen');
    expect(h.replace).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(h.replace).toHaveBeenCalledExactlyOnceWith(`/business/office/clients/${h.completedId}`);
  });

  it('shows an invalid-link alert without mounting a fresh intake form', async () => {
    h.draftId = 'not-a-client-uuid';
    await act(async () => root.render(<ClientIntakeWizardScreen />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('keine gültige Aktennummer');
    expect(h.mounted).not.toHaveBeenCalled();
    expect(host.querySelector('button')).toBeNull();
    expect(h.replace).not.toHaveBeenCalled();
  });
});
