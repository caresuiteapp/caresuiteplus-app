// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WorkflowFeedbackOverlay', () => {
  const source = readFileSync('src/components/ui/WorkflowFeedbackOverlay.tsx', 'utf8');
  const payroll = readFileSync('src/screens/portal/EmployeePayrollMonthScreen.tsx', 'utf8');

  it('rendert im Browser in einem eigenen obersten Body-Portal', () => {
    expect(source).toContain("import { createPortal } from 'react-dom'");
    expect(source).toContain('WORKFLOW_FEEDBACK_Z_INDEX = 2147483647');
    expect(source).toContain("host.setAttribute('data-caresuite-workflow-feedback', testID)");
    expect(source).toContain('document.body.appendChild(host)');
    expect(source).toContain('return createPortal(content, portalHost)');
  });

  it('verwendet auf nativen Plattformen weiterhin eine modale Viewport-Ebene', () => {
    expect(source).toContain('<Modal');
    expect(source).toContain('visible={visible}');
    expect(source).toContain('presentationStyle="overFullScreen"');
    expect(source).toContain('transparent');
  });

  it('zeigt laufende Vorgänge auf einer hellen, begrenzten Ladefläche ohne doppelten Markentext', () => {
    expect(source).toContain('<CareSuiteLoadingIndicator');
    expect(source).not.toContain('CareSuite lädt');
    expect(source).toContain('styles.loadingDialog');
    expect(source).toContain("color: '#123251'");
    expect(source).toContain("loadingBackdrop: { backgroundColor: 'rgba(225, 236, 248, 0.65)' }");
    expect(source).toContain('Bitte warten und diese Seite nicht schließen.');
    expect(source).toContain('setMessageVisible(false)');
  });

  it('migriert Upload, Speichern, Fehler und Erfolg im Auslagenablauf', () => {
    expect(payroll).toContain('<WorkflowFeedbackOverlay');
    expect(payroll).toContain("setBusyMessage('Beleg wird sicher hochgeladen…')");
    expect(payroll).toContain("kind: 'error'");
    expect(payroll).toContain("kind: refreshed === false ? 'warning' : 'success'");
    expect(payroll).toContain('Die Monatsübersicht konnte noch nicht aktualisiert werden.');
    expect(payroll).not.toContain('{message ? <InfoBanner message={message} /> : null}');
  });
});

const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const h = React.createElement;
let introReady = true;
const View = (p: any) => h('div', { 'data-feedback-style': JSON.stringify(flatten(p.style)), 'data-testid': p.testID, role: p.accessibilityRole }, p.children);
const Text = (p: any) => h('span', {}, p.children);
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-dom': await import('react-dom'),
  'react-native': {
    View, Text, Platform: { OS: 'android' }, StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
    Modal: (p: any) => p.visible ? h('div', { role: 'dialog' }, p.children) : null,
    ScrollView: (p: any) => h('div', { 'data-feedback-scroll': true, 'data-feedback-style': JSON.stringify(flatten(p.style)) }, h('div', { 'data-feedback-content': true }, p.children)),
    Pressable: (p: any) => h('button', { 'aria-label': p.accessibilityLabel, 'data-feedback-style': JSON.stringify(flatten(p.style)), onClick: p.onPress }, p.children),
  },
  '@/components/icons/SemanticArtwork': { SemanticArtwork: Text },
  '@/components/brand/CareSuiteLoadingIndicator': { CareSuiteLoadingIndicator: () => h('span', {}, 'CareSuite HealthOS') },
  '@/components/brand/appStartIntroSession': { useAppStartIntroReady: () => introReady },
  '@/design/tokens/spacing': { careSpacing: { xs: 4, sm: 8, md: 16, lg: 24 } },
  '@/design/tokens/spatialCareSuite': { spatialCare: { radius: { card: 20, control: 12 }, textOnNight: '#fff', border: '#8ca2bf' } },
  '@/design/tokens/portalPremium': { usePortalPremiumRuntimeTheme: () => ({ active: false }), portalPremium: { text: {}, accent: {} } },
  '@/theme': { typography: { h3: { fontSize: 20 }, body: { fontSize: 16 }, caption: { fontSize: 12 } } },
  '@/lib/dom/workflowFeedbackInteractionLock': { acquireWorkflowFeedbackInteractionLock: vi.fn() },
};
const compiled = buildSync({ entryPoints: ['src/components/ui/WorkflowFeedbackOverlay.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => { if (!(id in dependencies)) throw new Error('Unexpected feedback dependency ' + id); return dependencies[id]; }, loaded, loaded.exports);
const ActualOverlay = loaded.exports.WorkflowFeedbackOverlay;

describe('actual native workflow feedback layout and actions', () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; introReady = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const message = 'Lokaler Prüffehler: Mandantendaten konnten nicht geladen werden.';
  const style = (element: Element) => JSON.parse(element.getAttribute('data-feedback-style') ?? '{}');

  it.each([320, 360])('gives the description the full content row and padded, wrapping actions at width %s', async width => {
    host.style.width = width + 'px'; const retry = vi.fn(), dismiss = vi.fn();
    await act(async () => root.render(h(ActualOverlay, { kind: 'error', title: 'Mandant nicht gefunden', message, actionLabel: 'Erneut versuchen', onAction: retry, onDismiss: dismiss })));
    const title = [...host.querySelectorAll('span')].find(node => node.textContent === 'Mandant nicht gefunden')!;
    const description = [...host.querySelectorAll('span')].find(node => node.textContent === message)!;
    const content = host.querySelector('[data-feedback-content]')!;
    expect(description.parentElement).toBe(content);
    expect(title.parentElement?.parentElement).not.toBe(description.parentElement);
    expect(content.closest('[data-feedback-scroll]')).toBeTruthy();
    const actions = [...host.querySelectorAll('button')].filter(button => ['Erneut versuchen', 'Schließen'].includes(button.textContent ?? ''));
    expect(actions).toHaveLength(2);
    for (const button of actions) expect(style(button)).toMatchObject({ flexBasis: 160, paddingHorizontal: 16, paddingVertical: 8 });
    await act(async () => actions[0].click()); expect(retry).toHaveBeenCalledOnce(); expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () => actions[1].click()); expect(dismiss).toHaveBeenCalledOnce(); expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps loading and pending-intro behavior intact', async () => {
    introReady = false;
    await act(async () => root.render(h(ActualOverlay, { loading: true, loadingMessage: 'Sitzung wird geprüft…' })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    introReady = true;
    await act(async () => root.render(h(ActualOverlay, { loading: true, loadingMessage: 'Sitzung wird geprüft…' })));
    expect(host.textContent).toContain('Sitzung wird geprüft'); expect(host.textContent).toContain('Bitte warten');
    expect(host.querySelector('button')).toBeNull();
  });
});
