// @vitest-environment happy-dom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WebActionIcon, type WebActionIconProps } from '@/components/icons/WebActionIcon.web';

function renderIcon(props: Omit<WebActionIconProps, 'children'> = {}) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<button type="button" aria-label="Aktualisieren">
    <WebActionIcon {...props}><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" /></WebActionIcon>
    Aktualisieren
  </button>);
  return { button: host.querySelector('button')!, icon: host.querySelector('svg')! };
}

// Verify the shared rendering contract, not browser geometry or visual quality.
describe('Web action icon frame', () => {
  it('keeps the action label on its control and hides the decorative SVG from assistive technology', () => {
    const { button, icon } = renderIcon();
    expect(button.getAttribute('aria-label')).toBe('Aktualisieren');
    expect(button.textContent).toBe('Aktualisieren');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('focusable')).toBe('false');
    expect(icon.hasAttribute('tabindex')).toBe(false);
    expect(icon.hasAttribute('aria-label')).toBe(false);
    expect(icon.querySelector('title')).toBeNull();
  });

  it('keeps the caller motif and inherits the active or disabled control color', () => {
    const { icon } = renderIcon({ style: { color: '#526174' } });
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon.getAttribute('fill')).toBe('none');
    expect(icon.getAttribute('stroke')).toBe('currentColor');
    expect(icon.getAttribute('stroke-width')).toBe('1.8');
    expect(icon.getAttribute('stroke-linecap')).toBe('round');
    expect(icon.getAttribute('stroke-linejoin')).toBe('round');
    expect(icon.querySelectorAll('path')).toHaveLength(1);
    expect(icon.querySelector('path')!.getAttribute('d')).toBe('M20 7v5h-5M20 12a8 8 0 1 0-2 5');
    expect(icon.style.color).toBe('#526174');
  });

  it.each([
    ['compact', 16], ['action', 20], ['navigation', 24], ['state', 32],
  ] as const)('uses the %s role without stretching or shrinking its square frame', (size, pixels) => {
    const { icon } = renderIcon({ size });
    expect(icon.getAttribute('width')).toBe(String(pixels));
    expect(icon.getAttribute('height')).toBe(String(pixels));
    expect(icon.style.width).toBe(`var(--cs-action-icon-size, ${pixels}px)`);
    expect(icon.style.height).toBe(icon.style.width);
    expect(icon.style.flexShrink).toBe('0');
    expect(icon.style.aspectRatio).toBe('1 / 1');
  });

  it('retains spinner classes, color and effects while rejecting accidental rectangular dimensions', () => {
    const { icon } = renderIcon({ className: 'refresh-spin', style: {
      width: 70, height: 9, aspectRatio: '7 / 1', flexShrink: 1, strokeWidth: 4,
      opacity: 0.45, transform: 'rotate(90deg)', animation: 'refresh-spin 1s linear infinite',
    } });
    expect(icon.getAttribute('class')).toBe('refresh-spin');
    expect(icon.style.opacity).toBe('0.45');
    expect(icon.style.transform).toBe('rotate(90deg)');
    expect(icon.style.animation).toBe('refresh-spin 1s linear infinite');
    expect(icon.style.width).toBe('var(--cs-action-icon-size, 20px)');
    expect(icon.style.height).toBe(icon.style.width);
    expect(icon.style.aspectRatio).toBe('1 / 1');
    expect(icon.style.flexShrink).toBe('0');
    expect(icon.style.strokeWidth).toBe('1.8');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('keeps invalid numeric size %s visible at the default action size', size => {
    const { icon } = renderIcon({ size });
    expect(icon.getAttribute('width')).toBe('20');
    expect(icon.getAttribute('height')).toBe('20');
  });

  it('preserves explicit legacy illustration sizes instead of forcing them into action controls', () => {
    const { icon } = renderIcon({ size: 48 });
    expect(icon.getAttribute('width')).toBe('48');
    expect(icon.getAttribute('height')).toBe('48');
    expect(icon.style.width).toBe('var(--cs-action-icon-size, 48px)');
  });
});
