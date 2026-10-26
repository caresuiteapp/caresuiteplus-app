// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ print: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  ScrollView: ({ children, testID }: { children: React.ReactNode; testID: string }) => <div data-testid={testID}>{children}</div>,
  Image: ({ source, accessibilityLabel }: { source: { uri: string }; accessibilityLabel: string }) => <img src={source.uri} alt={accessibilityLabel} />,
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: any): any => { const merge = (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(merge)) : value ?? {}; return merge(style); } },
}));
vi.mock('react-native-svg', () => ({ SvgXml: ({ xml }: { xml: string }) => <svg data-content={xml} /> }));
vi.mock('expo-print', () => ({ printAsync: f.print }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => <button onClick={onPress}>{title}</button> }));
vi.mock('@/theme', () => ({ spacing: { sm: 8, md: 12 } }));
import { NativeDocumentPreview } from '@/components/office/NativeDocumentHtmlPreview.native';
let root: Root;
let host: HTMLDivElement;
const longHtml = `<html><head><style>body{color:red}</style></head><body><h1>Vereinbarung</h1><p>${'Dokumentinhalt '.repeat(600)}Ende der Vereinbarung</p><ol><li>Erste Regel</li><li>Zweite Regel</li></ol><img src="data:image/png;base64,iVBORw0KGgoAAAA=" alt="Unterschrift" /></body></html>`;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); f.print.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('renders the full document, numbered clauses, and the signature image using native primitives', async () => {
  await act(async () => root.render(<NativeDocumentPreview html={longHtml} height={480} />));
  expect(host.textContent).toContain('Ende der Vereinbarung');
  expect(host.textContent).toContain('1. Erste Regel');
  expect(host.textContent).toContain('2. Zweite Regel');
  expect(host.textContent).not.toContain('body{color:red}');
  expect(host.querySelector('img')?.getAttribute('alt')).toBe('Unterschrift');
  expect(host.querySelector('iframe')).toBeNull();
});
it('opens the complete original layout only after an explicit action and keeps text after failure', async () => {
  await act(async () => root.render(<NativeDocumentPreview html={longHtml} height={480} />));
  expect(f.print).not.toHaveBeenCalled();
  f.print.mockRejectedValue(new Error('print unavailable'));
  await act(async () => host.querySelector('button')!.click());
  expect(f.print).toHaveBeenCalledWith({ html: longHtml });
  expect(host.textContent).toContain('Die Originalansicht konnte nicht geöffnet werden');
  expect(host.textContent).toContain('Ende der Vereinbarung');
});
