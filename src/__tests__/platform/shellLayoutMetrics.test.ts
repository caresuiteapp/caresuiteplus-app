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
    const contentWidth = width - shell.left - shell.right;
    const mainCenter = shell.left + contentWidth / 2;
    const topbarInnerWidth = width - PLATFORM_MODULE_RAIL_WIDTH - topbarPadding * 2;
    const zoneWidth = topbarInnerWidth - center.left - center.right;
    const zoneCenter =
      PLATFORM_MODULE_RAIL_WIDTH + topbarPadding + center.left + zoneWidth / 2;

    expect(zoneCenter).toBeCloseTo(mainCenter, 5);
  });

  it('includes module nav for non-Zentrale modules on desktop', () => {
    expect(resolvePlatformShellSideInsets(1440, 'office')).toEqual({
      left: PLATFORM_MODULE_RAIL_WIDTH + PLATFORM_MODULE_NAV_WIDTH,
      right: PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH,
    });
  });

  it('offsets topbar end actions before right context panel', () => {
    const topbarPadding = 24;
    expect(resolveTopbarEndZoneInsets(1440, 'zentrale', topbarPadding)).toEqual({
      marginRight: PLATFORM_RIGHT_CONTEXT_PANEL_WIDTH - topbarPadding,
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
