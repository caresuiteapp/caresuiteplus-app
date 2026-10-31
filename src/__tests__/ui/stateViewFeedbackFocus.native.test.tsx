// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  const View = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>;
  return {
    Platform: { OS: 'android' }, View, ScrollView: View,
    Text: ({ children }: any) => <span>{children}</span>,
    Pressable: ({ children, onPress, accessibilityLabel }: any) => <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
    Modal: ({ children, visible }: any) => visible ? <div role="dialog" data-native-modal="true">{children}</div> : null,
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
  };
});
// Use the exact installed context object while avoiding the native SDK barrel in Node.
vi.mock('expo-router/react-navigation', async () => await import('expo-router/build/react-navigation/core/NavigationContext'));
vi.mock('@/components/ui/useStateFeedbackFocus', async () => await import('@/components/ui/useStateFeedbackFocus.native'));
vi.mock('@/design/tokens/auroraGlass', () => ({ useActiveGlassTokens: () => ({}), useAuroraAdaptiveText: () => ({}), useAuroraGlassActive: () => false, useLightLiquidGlassShell: () => false, lightLiquidGlassWebFx: () => ({}) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ colors: { textPrimary: '#173b57', textSecondary: '#526b85', danger: '#b00020', success: '#087f6d' }, typography: { body: {}, h3: {} }, isLight: true }) }));
vi.mock('@/design/tokens/radius', () => ({ careRadius: { lg: 20 } }));
vi.mock('@/theme', () => ({ colors: { info: '#056ce8', success: '#087f6d', warning: '#a86100', danger: '#b00020' }, radius: { md: 12 }, spacing: { lg: 24, md: 16, sm: 8, xs: 4 }, typography: { h3: {}, body: {}, bodyStrong: {}, caption: {} } }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ isPhone: true }) }));
vi.mock('@/components/ui/PremiumButton', () => ({ PremiumButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button> }));
vi.mock('@/components/ui/CareLightButton', () => ({ CareLightButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button> }));
vi.mock('@/components/brand/CareSuiteLoadingIndicator', () => ({ CareSuiteLoadingIndicator: () => <span>CareSuite</span> }));
vi.mock('@/components/brand/appStartIntroSession', () => ({ useAppStartIntroReady: () => true }));
vi.mock('@/components/icons/SemanticArtwork', () => ({ SemanticArtwork: () => null }));
vi.mock('@/design/tokens/spacing', () => ({ careSpacing: { xs: 4, sm: 8, md: 16, lg: 24 } }));
vi.mock('@/design/tokens/spatialCareSuite', () => ({ spatialCare: { radius: { card: 20, control: 12 } } }));
vi.mock('@/design/tokens/portalPremium', () => ({ portalPremium: { text: {}, accent: {} }, usePortalPremiumTheme: () => ({ active: false }), usePortalPremiumRuntimeTheme: () => ({ active: false }) }));
vi.mock('@/design/tokens/surfaceContrast', () => ({ useSurfaceContrastTone: () => 'light' }));
vi.mock('@/lib/dom/workflowFeedbackInteractionLock', () => ({ acquireWorkflowFeedbackInteractionLock: vi.fn() }));

import { NavigationContext } from 'expo-router/react-navigation';
import { LoadingState, ErrorState, SuccessState } from '@/components/ui/StateViews';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { WorkflowToast } from '@/components/ui/WorkflowToast';
import { GlobalWorkflowFeedbackProvider, useWorkflowFeedback, type WorkflowFeedbackApi } from '@/components/ui/GlobalWorkflowFeedback';

function scene(initialFocus: boolean) {
  let focused = initialFocus;
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  const navigation = {
    isFocused: () => focused,
    addListener: (event: 'focus' | 'blur', listener: () => void) => {
      listeners[event].add(listener);
      return () => { listeners[event].delete(listener); };
    },
  };
  return {
    navigation: navigation as NonNullable<React.ContextType<typeof NavigationContext>>,
    focus(value: boolean) { focused = value; for (const listener of listeners[value ? 'focus' : 'blur']) listener(); },
    subscriptions: () => listeners.focus.size + listeners.blur.size,
  };
}
let host: HTMLDivElement, root: Root;
const modal = () => host.querySelector('[data-native-modal]');
const render = async (children: React.ReactNode) => { await act(async () => root.render(<GlobalWorkflowFeedbackProvider>{children}</GlobalWorkflowFeedbackProvider>)); };
const states = { loading: <LoadingState message="Klientenakten werden geladen…" />, error: <ErrorState message="Klientenakten konnten nicht geladen werden." />, success: <SuccessState message="Datensatz gespeichert." /> };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual native StateViews global feedback ownership', () => {
  it('preserves the Web/default platform registration contract', async () => {
    const web = await vi.importActual<typeof import('@/components/ui/useStateFeedbackFocus')>('@/components/ui/useStateFeedbackFocus');
    expect(web.useStateFeedbackFocus()).toBe(true);
  });
  it.each(['loading', 'error', 'success'] as const)('does not publish %s from an authorized retained inactive scene', async kind => {
    const retained = scene(false);
    await render(<NavigationContext.Provider value={retained.navigation}><span>Authorized page remains mounted</span>{states[kind]}</NavigationContext.Provider>);
    expect(host.textContent).toContain('Authorized page remains mounted');
    expect(modal()).toBeNull();
  });

  it.each(['danger', 'error', 'success'] as const)('owns actual automatic %s banner feedback only while focused', async variant => {
    const retained = scene(false);
    await render(<NavigationContext.Provider value={retained.navigation}><span>Authorized page remains mounted</span><InfoBanner variant={variant} message="Rückmeldung der erhaltenen Seite" /></NavigationContext.Provider>);
    expect(modal()).toBeNull(); expect(host.textContent).toContain('Authorized page remains mounted');
    await act(async () => retained.focus(true)); expect(modal()?.textContent).toContain('Rückmeldung der erhaltenen Seite');
    await act(async () => retained.focus(false)); expect(modal()).toBeNull();
    await act(async () => retained.focus(true)); expect(modal()?.textContent).toContain('Rückmeldung der erhaltenen Seite');
  });

  it('keeps automatic info/warning and explicit inline banners visible inside an inactive scene', async () => {
    const retained = scene(false), action = vi.fn();
    await render(<NavigationContext.Provider value={retained.navigation}><InfoBanner message="Inline Information" /><InfoBanner variant="warning" message="Inline Warnung" /><InfoBanner variant="danger" presentation="inline" message="Inline Fehlerbanner" actionLabel="Lokal erneut versuchen" onAction={action} /></NavigationContext.Provider>);
    expect(modal()).toBeNull(); for (const copy of ['Inline Information', 'Inline Warnung', 'Inline Fehlerbanner']) expect(host.textContent).toContain(copy);
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Lokal erneut versuchen')!.click());
    expect(action).toHaveBeenCalledOnce();
  });

  it('keeps the latest focused banner action and explicit overlay presentation intact', async () => {
    const retained = scene(true), previousAction = vi.fn(), currentAction = vi.fn();
    const banner = (onAction: () => void) => <NavigationContext.Provider value={retained.navigation}><InfoBanner presentation="overlay" message="Fokussierte Information" actionLabel="Fortsetzen" onAction={onAction} /></NavigationContext.Provider>;
    await render(banner(previousAction)); await render(banner(currentAction));
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Fortsetzen')!.click());
    expect(previousAction).not.toHaveBeenCalled(); expect(currentAction).toHaveBeenCalledOnce();
  });

  it('owns actual declarative toast feedback only while focused and does not dismiss page state on blur', async () => {
    const retained = scene(false), dismiss = vi.fn();
    await render(<NavigationContext.Provider value={retained.navigation}><WorkflowToast message="Rückmeldung der erhaltenen Seite" kind="error" onDismiss={dismiss} /></NavigationContext.Provider>);
    expect(modal()).toBeNull();
    await act(async () => retained.focus(true)); expect(modal()?.textContent).toContain('Rückmeldung der erhaltenen Seite');
    await act(async () => retained.focus(false)); expect(modal()).toBeNull(); expect(dismiss).not.toHaveBeenCalled();
    await act(async () => retained.focus(true)); expect(modal()?.textContent).toContain('Rückmeldung der erhaltenen Seite');
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Meldung schließen"]')!.click());
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('retains an actual root toast outside navigation and its latest dismissal callback', async () => {
    const previousDismiss = vi.fn(), currentDismiss = vi.fn();
    await render(<WorkflowToast message="Globaler Abschluss" onDismiss={previousDismiss} />);
    await render(<WorkflowToast message="Globaler Abschluss" onDismiss={currentDismiss} />);
    expect(modal()?.textContent).toContain('Globaler Abschluss');
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Meldung schließen"]')!.click());
    expect(previousDismiss).not.toHaveBeenCalled(); expect(currentDismiss).toHaveBeenCalledOnce();
  });

  it('does not publish an empty root toast', async () => {
    await render(<WorkflowToast message={null} />); expect(modal()).toBeNull();
  });

  it.each(['loading', 'error', 'success'] as const)('dismisses actual %s feedback on blur, retains the page and restores feedback on focus', async kind => {
    const retained = scene(true), mounted = vi.fn(), unmounted = vi.fn();
    function Page() { React.useEffect(() => { mounted(); return unmounted; }, []); return <><span>Authorized page remains mounted</span>{states[kind]}</>; }
    await render(<NavigationContext.Provider value={retained.navigation}><Page /></NavigationContext.Provider>);
    expect(modal()).not.toBeNull();
    await act(async () => retained.focus(false));
    expect(modal()).toBeNull(); expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Authorized page remains mounted');
    await act(async () => retained.focus(true));
    expect(modal()).not.toBeNull(); expect(mounted).toHaveBeenCalledOnce();
    await render(null); expect(retained.subscriptions()).toBe(0);
  });

  it('does not let inactive errors cover the focused page loading modal', async () => {
    const foreground = scene(true), background = scene(false);
    await render(<><NavigationContext.Provider value={foreground.navigation}>{states.loading}</NavigationContext.Provider><NavigationContext.Provider value={background.navigation}>{states.error}</NavigationContext.Provider></>);
    expect(modal()?.textContent).toContain('Klientenakten werden geladen');
    expect(modal()?.textContent).not.toContain('konnten nicht geladen');
    await act(async () => foreground.focus(false)); expect(modal()).toBeNull();
    await act(async () => background.focus(true)); expect(modal()?.textContent).toContain('konnten nicht geladen');
  });

  it('keeps AppStartup-style loading and current retry callbacks outside a navigator working', async () => {
    await render(states.loading); expect(modal()?.textContent).toContain('Klientenakten werden geladen');
    const firstRetry = vi.fn(), currentRetry = vi.fn();
    await render(<ErrorState message="Aktueller Fehler" onRetry={firstRetry} />);
    await render(<ErrorState message="Aktueller Fehler" onRetry={currentRetry} />);
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Erneut versuchen')!.click());
    expect(firstRetry).not.toHaveBeenCalled(); expect(currentRetry).toHaveBeenCalledOnce();
  });

  it('preserves inline states and explicit global operation errors independently of scene focus', async () => {
    const retained = scene(false); let feedback!: WorkflowFeedbackApi;
    function GlobalOperation() { feedback = useWorkflowFeedback(); return null; }
    await render(<><GlobalOperation /><NavigationContext.Provider value={retained.navigation}><LoadingState presentation="inline" message="Inline Laden" /><ErrorState presentation="inline" message="Inline Fehler" /><SuccessState presentation="inline" message="Inline Erfolg" /></NavigationContext.Provider></>);
    expect(modal()).toBeNull(); expect(host.textContent).toContain('Inline Laden'); expect(host.textContent).toContain('Inline Fehler'); expect(host.textContent).toContain('Inline Erfolg');
    await act(async () => { feedback.showError('Globaler Speichervorgang fehlgeschlagen.'); });
    expect(modal()?.textContent).toContain('Globaler Speichervorgang fehlgeschlagen.');
    await act(async () => retained.focus(true)); await act(async () => retained.focus(false));
    expect(modal()?.textContent).toContain('Globaler Speichervorgang fehlgeschlagen.');
  });

  it.each([states.error, <InfoBanner variant="error" message="Fehlerbanner der erhaltenen Seite" />, <WorkflowToast kind="error" message="Fehlertoast der erhaltenen Seite" />])('removes a blurred page error from the queue without dismissing an explicit global error (%#)', async pageError => {
    const retained = scene(true); let feedback!: WorkflowFeedbackApi;
    function GlobalOperation() { feedback = useWorkflowFeedback(); return null; }
    await render(<GlobalOperation />);
    await act(async () => { feedback.showError('Globaler Speichervorgang fehlgeschlagen.'); });
    await render(<><GlobalOperation /><NavigationContext.Provider value={retained.navigation}>{pageError}</NavigationContext.Provider></>);
    expect(modal()?.textContent).toContain('Globaler Speichervorgang fehlgeschlagen.');
    await act(async () => retained.focus(false));
    expect(modal()?.textContent).toContain('Globaler Speichervorgang fehlgeschlagen.');
    await act(async () => feedback.dismiss());
    expect(modal()).toBeNull();
  });
});
