import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSurfaceContrastTone } from '@/design/tokens/surfaceContrast';
import { usePortalPremiumTheme } from '@/design/tokens/portalPremium.web';

export type TabOption = { key: string; label: string };
type Props = { tabs: TabOption[]; activeKey: string; onSelect: (key: string) => void; style?: ViewStyle;
  layout?: 'scroll' | 'wrap'; rows?: number };
export function SegmentedTabs({ tabs, activeKey, onSelect, style, layout = 'scroll', rows }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const tone = useSurfaceContrastTone();
  const portal = usePortalPremiumTheme();
  const dark = tone === 'dark' || (tone === 'adaptive' && !portal.active);
  useEffect(() => {
    if (layout !== 'scroll') return;
    const parent = host.current, button = buttons.current.get(activeKey);
    if (!parent || !button) return;
    const containerRect = parent.getBoundingClientRect(), rect = button.getBoundingClientRect();
    if (rect.left < containerRect.left) parent.scrollLeft -= containerRect.left - rect.left + 4;
    else if (rect.right > containerRect.right) parent.scrollLeft += rect.right - containerRect.right + 4;
  }, [activeKey, layout]);
  const rowCount = layout === 'wrap' ? Math.min(tabs.length || 1, Math.max(1, Math.floor(rows ?? 1))) : 1;
  const chunkSize = Math.max(1, Math.ceil(tabs.length / rowCount));
  return <View style={[styles.root, style]} dataSet={{ csWorkspaceComponent: 'tabs', csWorkspaceTone: dark ? 'dark' : 'light' }}>
    <div ref={host} role="tablist" aria-label="Bereiche" style={{ display: 'flex', flexWrap: layout === 'wrap' ? 'wrap' : 'nowrap', gap: 8,
      minWidth: 0, maxWidth: '100%', overflowX: layout === 'scroll' ? 'auto' : undefined, padding: '4px 2px 8px', scrollbarWidth: 'thin' }}>
      {tabs.map((tab, index) => <button key={tab.key} ref={node => { if (node) buttons.current.set(tab.key, node); else buttons.current.delete(tab.key); }}
        type="button" role="tab" aria-selected={activeKey === tab.key}
        tabIndex={activeKey === tab.key || (!tabs.some(item => item.key === activeKey) && index === 0) ? 0 : -1}
        onClick={() => onSelect(tab.key)} onKeyDown={event => {
          let next: number | undefined;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = tabs.length - 1;
          if (next != null) { event.preventDefault(); buttons.current.get(tabs[next].key)?.focus(); }
        }} style={{ fontFamily: 'inherit', fontSize: 'calc(15px * var(--app-font-scale, 1))', lineHeight: '1.5', fontWeight: activeKey === tab.key ? 750 : 600,
          minHeight: 44, minWidth: 0, maxWidth: '100%', flexShrink: 0, padding: '10px 16px', borderRadius: 11, cursor: 'pointer',
          flexBasis: layout === 'wrap' && rows && rowCount > 1 ? `calc(${100 / chunkSize}% - 8px)` : undefined,
          whiteSpace: layout === 'wrap' ? 'normal' : 'nowrap', overflowWrap: 'anywhere',
          border: `1px solid ${activeKey === tab.key ? (dark ? '#69D7FF' : '#1477D6') : (dark ? '#31526E' : '#CCDBEA')}`,
          color: dark ? '#EAF4FF' : (activeKey === tab.key ? '#075EB8' : '#38546F'),
          background: dark ? (activeKey === tab.key ? '#16446B' : '#102D4A') : (activeKey === tab.key ? '#DFEDFF' : '#FFFFFF') }}>
        {tab.label}
      </button>)}
    </div>
  </View>;
}
const styles = StyleSheet.create({ root: { minWidth: 0, width: '100%', flexShrink: 0 } });
