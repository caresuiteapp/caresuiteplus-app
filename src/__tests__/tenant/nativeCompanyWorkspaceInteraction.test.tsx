// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TENANT_MODULES, EMPTY_TENANT_BRANDING, EMPTY_TENANT_COMPANY, EMPTY_TENANT_LEGAL, EMPTY_TENANT_PAYMENT, EMPTY_TENANT_REGISTER, EMPTY_TENANT_TAX, type TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import type { CompanyWorkspaceViewProps } from '@/components/company/companyWorkspaceView.types';

const Box = (p: any) => <div data-testid={p.testID}>{p.children}</div>;
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': {
    Platform: { OS: 'android' }, View: Box, Text: (p: any) => <span>{p.children}</span>,
    TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={event => p.onChangeText(event.currentTarget.value)} />,
    Pressable: (p: any) => <button aria-label={p.accessibilityLabel} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>,
    StyleSheet: { create: (s: unknown) => s }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }), Linking: { openURL: vi.fn() },
  },
  'expo-linear-gradient': { LinearGradient: Box },
  'react-native-svg': { __esModule: true, default: () => null, Path: () => null },
  '@/components/images/CareSuiteImage': { CareSuiteImage: () => null },
};
const compiled = buildSync({ entryPoints: ['src/components/company/CompanyWorkspaceView.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const CompanyView = loaded.exports.CompanyWorkspaceView as React.ComponentType<CompanyWorkspaceViewProps>;
const snapshot: TenantCenterSnapshot = {
  tenantId: 'tenant-one', updatedAt: '2026-10-24T08:00:00Z',
  company: { ...EMPTY_TENANT_COMPANY, name: 'Beispiel GmbH', legalName: 'Beispiel Verwaltung GmbH', street: 'Hauptstraße', houseNumber: '12', zip: '10115', city: 'Berlin', email: 'info@example.invalid', phone: '030 123456' },
  tax: { ...EMPTY_TENANT_TAX }, legal: { ...EMPTY_TENANT_LEGAL }, register: { ...EMPTY_TENANT_REGISTER }, payment: { ...EMPTY_TENANT_PAYMENT }, branding: { ...EMPTY_TENANT_BRANDING }, modules: { ...DEFAULT_TENANT_MODULES },
  contact: { billingEmail: 'rechnung@example.invalid', supportEmail: '', supportPhone: '', contactPersons: [] }, representatives: [], bankAccounts: [], customFields: [], catalogItems: [], auditLogs: [], sections: [], catalogSummary: '', assistDefaultHourlyRate: '',
};
const actions = { onOpen: vi.fn(), onCopy: vi.fn(), onDocuments: vi.fn(), onCustomField: vi.fn(), onRefresh: vi.fn() };
let host: HTMLDivElement, root: Root;
function Harness(props: Partial<CompanyWorkspaceViewProps>) {
  const [tab, onTab] = useState<CompanyWorkspaceViewProps['tab']>('overview');
  return <CompanyView snapshot={snapshot} activeAreas={['Office']} canEdit canDocuments canInventory refreshing={false} {...actions} {...{ tab, onTab }} {...props} />;
}
const render = async (props: Partial<CompanyWorkspaceViewProps> = {}) => { await act(async () => root.render(<Harness {...props} />)); };
const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
};
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.clearAllMocks(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Native company record actions', () => {
  it('opens the same company editor and copies the current contact identity', async () => {
    await render();
    await press('Stammdaten bearbeiten');
    expect(actions.onOpen).toHaveBeenCalledWith('company');
    await press('Kontaktdaten kopieren');
    expect(actions.onCopy).toHaveBeenCalledWith(expect.stringContaining('Beispiel Verwaltung GmbH'), 'Kontaktdaten kopiert.');
    expect(actions.onCopy.mock.calls[0][0]).toContain('info@example.invalid');
    await press('Unternehmensdaten für Ihre Dokumente');
    expect(actions.onDocuments).toHaveBeenCalledOnce();
  });
  it('shows finance and finds sections across the company tabs', async () => {
    await render();
    await press('Abrechnung');
    expect(host.textContent).toContain('Bankverbindungen');
    const input = host.querySelector('input')!;
    await act(async () => { input.value = 'Hauptvertretung'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.textContent).toContain('Suchergebnisse');
    expect(host.textContent).toContain('Geschäftsführung & Vertretung');
    expect(host.textContent).not.toContain('Bankverbindungen bearbeiten');
    await press('Vertretung bearbeiten');
    expect(actions.onOpen).toHaveBeenCalledWith('representatives');
  });
  it('keeps stale data visible after a refresh failure and exposes retry', async () => {
    await render({ refreshError: 'Verbindung unterbrochen' });
    expect(host.textContent).toContain('Beispiel GmbH');
    expect(host.textContent).toContain('Verbindung unterbrochen');
    await press('Erneut versuchen');
    expect(actions.onRefresh).toHaveBeenCalledOnce();
  });
  it('hides editing and document actions when access does not permit them', async () => {
    await render({ canEdit: false, canDocuments: false, canInventory: false });
    expect(host.querySelector('[aria-label="Stammdaten bearbeiten"]')).toBeNull();
    expect(host.querySelector('[aria-label="Inventar"]')).toBeNull();
    expect(host.textContent).not.toContain('Unternehmensdaten für Ihre Dokumente');
  });
});
