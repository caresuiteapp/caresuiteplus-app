// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal';

const state = vi.hoisted(() => ({ platform: 'web', path: '/office/employees?employee=one', push: vi.fn(), closeSection: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('react-native', () => ({
  Platform: { get OS() { return state.platform; }, select: (values: Record<string, unknown>) => values[state.platform] ?? values.default },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pressable: ({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) => <button onClick={onPress}>{accessibilityLabel}</button>,
  Modal: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? <section>{children}</section> : null,
  useWindowDimensions: () => ({ width: 1366, height: 900 }),
}));
vi.mock('@/components/office/EmployeeDetailSummaryPanel', () => ({ EmployeeDetailSummaryPanel: ({ onOpenFullRecord }: { onOpenFullRecord: () => void }) => <button onClick={onOpenFullRecord}>Personalakte öffnen</button> }));
vi.mock('@/components/office/EmployeeSectionEditModal', () => ({ EmployeeSectionEditModal: () => null }));
vi.mock('@/components/office/employeeoffboardingmodal', () => ({ EmployeeOffboardingModal: () => null }));
vi.mock('@/components/office/EmployeePersonnelFilePanel', () => ({ EmployeePersonnelFilePanel: () => null }));
vi.mock('@/hooks/useSectionEditModal', () => ({ useSectionEditModal: () => ({ activeSection: null, isOpen: false, openSection: vi.fn(), closeSection: state.closeSection }) }));
vi.mock('@/components/layout/platform', () => ({ GradientModalHeader: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Fenster schließen</button> }));
vi.mock('@/components/layout/AutoScrollView', () => ({ AutoScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/effects', () => ({ GlassSurface: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ isDark: false }) }));
vi.mock('@/design/tokens/modules', () => ({ moduleColor: () => '#1689ff' }));
vi.mock('@/components/office/PersonalWorkspaceSurface', () => ({ PERSONAL_SURFACE_DATASET: {} }));
vi.mock('@/theme', () => ({ spacing: { md: 16, lg: 24 } }));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.platform = 'web'; state.path = '/office/employees?employee=one'; state.push.mockReset();
  state.push.mockImplementation((path: string) => { state.path = path; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('opening a child page cannot be undone by an asynchronous close/back from its preview', async () => {
  const close = vi.fn(() => { setTimeout(() => { state.path = '/office/employees'; }, 0); });
  await act(async () => root.render(<EmployeeDetailModal visible employeeId="one" onClose={close} />));
  await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Personalakte öffnen')!.click(); });
  await act(async () => { await vi.runAllTimersAsync(); });
  expect(state.path).toBe('/business/office/employees/one/personnel');
  expect(close).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledOnce();
});

it('explicit Web close still closes the preview', async () => {
  const close = vi.fn();
  await act(async () => root.render(<EmployeeDetailModal visible employeeId="one" onClose={close} />));
  await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Fenster schließen')!.click(); });
  expect(close).toHaveBeenCalledOnce(); expect(state.push).not.toHaveBeenCalled();
});

it('native keeps closing the preview before its existing forward navigation', async () => {
  state.platform = 'android';
  const calls: string[] = [];
  state.push.mockImplementation(() => calls.push('push'));
  await act(async () => root.render(<EmployeeDetailModal visible employeeId="one" onClose={() => calls.push('close')} />));
  await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Personalakte öffnen')!.click(); });
  expect(calls).toEqual(['close', 'push']);
});
