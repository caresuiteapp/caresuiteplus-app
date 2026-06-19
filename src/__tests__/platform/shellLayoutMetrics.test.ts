import { describe, expect, it } from 'vitest';
import {
  PLATFORM_MODULE_RAIL_WIDTH,
  PLATFORM_MODULE_NAV_WIDTH,
  PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH,
  resolvePlatformShellSideInsets,
  resolveTopbarCenterZoneInsets,
  resolveTopbarEndZoneInsets,
} from '@/lib/platform/shellLayoutMetrics';

describe('shellLayoutMetrics', () => {
  it('centers Zentrale main column between rail and right panel', () => {
    const width = 1440;
    const shell = resolvePlatformShellSideInsets(width, 'zentrale');
    expect(shell).toEqual({
      left: PLATFORM_MODULE_RAIL_WIDTH,
      right: PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH,
    });

    const topbarPadding = 24;
    const center = resolveTopbarCenterZoneInsets(width, 'zentrale', topbarPadding);
    expect(center).toEqual({ left: 0, right: 0 });

    const contentColumnWidth = width - shell.left - shell.right;
    const mainCenter = shell.left + contentColumnWidth / 2;
    const topbarInnerWidth = contentColumnWidth - topbarPadding * 2;
    const zoneCenter = shell.left + topbarPadding + topbarInnerWidth / 2;

    expect(zoneCenter).toBeCloseTo(mainCenter, 5);
  });

  it('aligns topbar tenant chip with main work area when module nav is visible', () => {
    const width = 1440;
    const topbarPadding = 24;
    const shell = resolvePlatformShellSideInsets(width, 'office');
    const center = resolveTopbarCenterZoneInsets(width, 'office', topbarPadding);

    expect(center).toEqual({ left: PLATFORM_MODULE_NAV_WIDTH, right: 0 });

    const contentColumnWidth = width - shell.left - shell.right;
    const mainWidth = contentColumnWidth - PLATFORM_MODULE_NAV_WIDTH;
    const mainCenter = shell.left + PLATFORM_MODULE_NAV_WIDTH + mainWidth / 2;
    const topbarInnerWidth = contentColumnWidth - topbarPadding * 2;
    const zoneCenter =
      shell.left + topbarPadding + center.left + (topbarInnerWidth - center.left) / 2;

    expect(zoneCenter).toBeCloseTo(mainCenter, 5);
  });

  it('includes module nav for non-Zentrale modules on desktop', () => {
    expect(resolvePlatformShellSideInsets(1440, 'office')).toEqual({
      left: PLATFORM_MODULE_RAIL_WIDTH + PLATFORM_MODULE_NAV_WIDTH,
      right: PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH,
    });
  });

  it('does not offset topbar end actions when right panel is a sibling column', () => {
    const topbarPadding = 24;
    expect(resolveTopbarEndZoneInsets(1440, 'zentrale', topbarPadding)).toEqual({
      marginRight: 0,
    });
    expect(resolveTopbarEndZoneInsets(1279, 'zentrale', topbarPadding)).toEqual({
      marginRight: 0,
    });
  });

  it('drops right panel below desktop context breakpoint', () => {
    expect(resolvePlatformShellSideInsets(1279, 'zentrale')).toEqual({
      left: PLATFORM_MODULE_RAIL_WIDTH,
      right: 0,
    });
  });

  it('drops module nav on phone layout', () => {
    expect(resolvePlatformShellSideInsets(390, 'office')).toEqual({
      left: PLATFORM_MODULE_RAIL_WIDTH,
      right: 0,
    });
  });
});
