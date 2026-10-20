// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ push: vi.fn(), permissions: new Set<string>() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => fixture.permissions.has(key) }) }));
vi.mock('@/components/documents/DocumentModuleTemplatesPanel.tsx', () => ({ DocumentModuleTemplatesPanel: (props: { assignmentId?: string | null }) => <div data-testid="workflow-proof" data-assignment={props.assignmentId}>Einsatzabschluss-Dokumente</div> }));
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations.web';
import { DocumentRecommendations as NativeDocumentRecommendations } from '@/components/documents/DocumentRecommendations';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel.web';
let root: Root | undefined; let element: HTMLDivElement;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { fixture.push.mockClear(); fixture.permissions = new Set(['office.documents.view', 'documents.create', 'office.clients.view', 'office.clients.view_sensitive', 'office.employees.view']); element = document.createElement('div'); document.body.append(element); });
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; element.remove(); });
const render = async (props: Parameters<typeof DocumentRecommendations>[0]) => { await act(async () => { root = createRoot(element); root.render(<DocumentRecommendations {...props} />); }); };
describe('document suggestion interactions (DOM checks, no visual layout claim)', () => {
  it('opens the chosen template with the actual employee record', async () => {
    await render({ module: 'office', workflow: 'employee_onboarding', employeeId: 'employee-A' });
    await act(async () => element.querySelector<HTMLButtonElement>('.cs-doc-rec-card')!.click());
    const query = new URL(fixture.push.mock.calls[0][0], 'https://example.test').searchParams;
    expect(query.get('templateKey')).toBe('csdc_personal_001'); expect(query.get('employeeId')).toBe('employee-A'); expect(query.get('clientId')).toBeNull();
  });
  it('opens only the selected client archive through its records route', async () => {
    await render({ workflow: 'client_documents', clientId: 'client-A' });
    await act(async () => element.querySelectorAll<HTMLButtonElement>('.cs-doc-rec-actions button')[1].click());
    expect(fixture.push.mock.calls[0][0]).toContain('clientId=client-A'); expect(fixture.push.mock.calls[0][0]).toContain('tab=records');
  });
  it('hides the whole widget without catalogue permission and generation cards for readers', async () => {
    fixture.permissions.clear(); await render({ workflow: 'company' }); expect(element.children.length).toBe(0);
    await act(async () => root?.unmount()); root = undefined;
    fixture.permissions.add('office.documents.view'); await render({ workflow: 'company' });
    expect(element.querySelectorAll('.cs-doc-rec-card')).toHaveLength(0); expect(element.querySelectorAll('.cs-doc-rec-actions button')).toHaveLength(2);
  });
  it('does not suggest patient documents without sensitive-client permission', async () => {
    fixture.permissions.delete('office.clients.view_sensitive'); await render({ workflow: 'wound', clientId: 'client-A' });
    expect(element.querySelectorAll('.cs-doc-rec-card')).toHaveLength(0);
  });
  it('keeps native portal screens free of the Office widget', () => {
    expect(renderToStaticMarkup(<NativeDocumentRecommendations workflow="company" />)).toBe('');
  });
  it('preserves the assignment completion documents and adds optional drafts', () => {
    const html = renderToStaticMarkup(<DocumentModuleTemplatesPanel tenantId="tenant-A" targetModule="assist" targetArea="visit_complete" assignmentId="visit-A" clientId="client-A" />);
    expect(html).toContain('data-testid="workflow-proof"'); expect(html).toContain('data-assignment="visit-A"'); expect(html).toContain('Leistungsnachweis mit Leistungsbestätigung');
    fixture.permissions.clear();
    const employeeHtml = renderToStaticMarkup(<DocumentModuleTemplatesPanel tenantId="tenant-A" targetModule="assist" targetArea="visit_complete" assignmentId="visit-A" />);
    expect(employeeHtml).toContain('Einsatzabschluss-Dokumente'); expect(employeeHtml).not.toContain('cs-doc-rec');
  });
});
