// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  actor: { tenantId: 'tenant-a', employeeId: 'employee-a' as string | null, isReady: true, isResolvingEmployeeLink: false },
  permitted: true, form: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, ScrollView: ({ children }: any) => <div>{children}</div>, StyleSheet: { create: (styles: any) => styles } }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => h.permitted, check: () => ({ reason: 'Nicht freigegeben' }), roleLabel: 'Mitarbeitende' }) }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: ({ message }: any) => <div role="alert">{message}</div> }));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: any) => <p role="status">{message}</p>, ErrorState: ({ title, message }: any) => <div role="alert">{title}: {message}</div> }));
vi.mock('@/components/portal/EmployeeMobilitySettingsForm', () => ({ EmployeeMobilitySettingsForm: (props: any) => { h.form(props); return <div data-testid="scoped-form" />; } }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
import { EmployeeMobilitySettingsScreen } from '@/screens/portal/EmployeeMobilitySettingsScreen';
let root: Root, host: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); Object.assign(h.actor, { tenantId: 'tenant-a', employeeId: 'employee-a', isReady: true, isResolvingEmployeeLink: false }); h.permitted = true; h.form.mockClear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<EmployeeMobilitySettingsScreen />)); };
describe('actual mobility direct entry before the scoped form', () => {
  it('waits while the employee link is resolving', async () => { h.actor.employeeId = null; h.actor.isResolvingEmployeeLink = true; await render(); expect(host.querySelector('[role="status"]')).not.toBeNull(); expect(h.form).not.toHaveBeenCalled(); });
  it('ends loading with an explicit error when a settled employee link is missing', async () => { h.actor.employeeId = null; await render(); expect(host.querySelector('[role="status"]')).toBeNull(); expect(host.querySelector('[role="alert"]')?.textContent).toContain('noch nicht vollständig verknüpft'); expect(h.form).not.toHaveBeenCalled(); });
  it('passes only the resolved tenant and employee to the existing form', async () => { await render(); expect(h.form).toHaveBeenCalledWith({ tenantId: 'tenant-a', employeeId: 'employee-a' }); });
  it('keeps the existing profile permission before the form', async () => { h.permitted = false; await render(); expect(host.textContent).toContain('Nicht freigegeben'); expect(h.form).not.toHaveBeenCalled(); });
});
