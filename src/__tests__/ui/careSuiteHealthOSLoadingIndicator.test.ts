import { describe, expect, it, vi } from 'vitest';
import { CareSuiteLoadingIndicator } from '@/components/brand/CareSuiteLoadingIndicator';
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/hooks/useprefersreducedmotion', () => ({ usePrefersReducedMotion: () => motion.reduced }));
vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const style = (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));
describe('bounded light loading mark', () => {
  it.each([120, 240, 360, 600, Number.NaN])('keeps the animation inside its own frame at width %s', (width) => {
    motion.reduced = false;
    const tree = nodes(CareSuiteLoadingIndicator({ width }));
    expect(style(tree[0].props.style).width).toBeLessThanOrEqual(360);
    expect(style(tree[0].props.style).maxWidth).toBe('100%');
    expect(style(tree[0].props.style).overflow).toBe('hidden');
    const frame = tree.find((n) => n.props.testID === 'caresuite-loading-motion');
    expect(style(frame.props.style).width).toBe(style(frame.props.style).height);
    expect(tree.some((n) => n.type === 'ActivityIndicator')).toBe(true);
    expect(tree[0].props.accessibilityState.busy).toBe(true);
  });
  it('provides a stationary mark for reduced motion', () => {
    motion.reduced = true;
    const tree = nodes(CareSuiteLoadingIndicator({}));
    expect(tree.some((n) => n.type === 'ActivityIndicator')).toBe(false);
    expect(tree.some((n) => n.props.testID === 'caresuite-loading-reduced-motion')).toBe(true);
  });
});
