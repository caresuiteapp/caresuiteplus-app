import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  popupShellColors,
  popupShellHeaderGradientDark,
  popupShellHeaderGradientLight,
  popupShellLayout,
  resolvePopupShellColors,
  resolvePopupShellHeaderGradient,
} from '@/design/tokens/popupShellTokens';

const root = path.join(__dirname, '..', '..');

describe('popupShell tokens', () => {
  it('defines light header gradient stops from Benachrichtigungen spec', () => {
    expect(popupShellHeaderGradientLight).toEqual(['#056CE8', '#1683FF', '#3597FF']);
    expect(resolvePopupShellHeaderGradient('light')).toEqual(popupShellHeaderGradientLight);
  });

  it('defines dark header gradient fallback', () => {
    expect(popupShellHeaderGradientDark.length).toBeGreaterThanOrEqual(3);
    expect(resolvePopupShellHeaderGradient('dark')).toEqual(popupShellHeaderGradientDark);
  });

  it('uses rounded container radius in 20–24px range', () => {
    expect(popupShellLayout.borderRadius).toBeGreaterThanOrEqual(20);
    expect(popupShellLayout.borderRadius).toBeLessThanOrEqual(24);
  });

  it('tab tokens use gray inactive and purple active states', () => {
    expect(popupShellColors.light.tab.inactiveBackground).toContain('rgba');
    expect(popupShellColors.light.tab.activeBorder).toContain('53, 151, 255');
    expect(popupShellColors.light.tab.activeText).toBe('#F8F6FF');
  });

  it('close button tokens use semi-transparent fill', () => {
    expect(popupShellColors.light.closeButton.background).toContain('rgba');
    expect(popupShellLayout.closeButtonSize).toBe(40);
  });

  it('resolvePopupShellColors returns mode-specific palette', () => {
    expect(resolvePopupShellColors('light').body.background).toContain('rgba');
    expect(resolvePopupShellColors('dark').body.background).toContain('rgba');
    expect(resolvePopupShellColors('light')).toBe(resolvePopupShellColors('dark'));
  });
});

describe('popup shell components wired', () => {
  it('PlatformModal consumes popup shell layout tokens', () => {
    const source = readFileSync(
      path.join(root, 'components', 'layout', 'platform', 'platformmodal.tsx'),
      'utf8',
    );
    expect(source).toContain('popupShellLayout');
    expect(source).toContain('resolvePopupShellColors');
  });

  it('GradientModalHeader uses popup shell gradient and close button', () => {
    const source = readFileSync(
      path.join(root, 'components', 'layout', 'platform', 'gradientmodalheader.tsx'),
      'utf8',
    );
    expect(source).toContain('resolvePopupShellHeaderGradient');
    expect(source).toContain('resolvePopupShellCloseButtonStyle');
    expect(source).not.toContain('resolveGalaxyGradientColors');
  });

  it('CarePopupShell wraps PlatformModal', () => {
    const source = readFileSync(
      path.join(root, 'components', 'layout', 'platform', 'CarePopupShell.tsx'),
      'utf8',
    );
    expect(source).toContain('PlatformModal');
  });

  it('NotificationCenter uses CarePopupShell and CarePopupTabPills', () => {
    const source = readFileSync(
      path.join(root, 'components', 'notifications', 'notificationcenter.tsx'),
      'utf8',
    );
    expect(source).toContain('CarePopupShell');
    expect(source).toContain('CarePopupTabPills');
  });

  it('popupShell style helpers define tab and close button resolvers', () => {
    const source = readFileSync(path.join(root, 'design', 'tokens', 'popupShell.ts'), 'utf8');
    expect(source).toContain('resolvePopupShellCloseButtonStyle');
    expect(source).toContain('resolvePopupShellTabStyle');
    expect(source).toContain('borderRadius: size / 2');
  });
});
