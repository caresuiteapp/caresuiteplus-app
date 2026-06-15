import {
  type DeviceClass,
  isDesktopClass,
  isPhoneClass,
  isTabletClass,
  resolveDeviceClass,
  supportsMasterDetail,
} from './breakpoints';

export type PlatformTarget = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export type ShellVariant = 'mobile' | 'tablet' | 'desktop';

export type PlatformLayoutSnapshot = {
  platform: PlatformTarget;
  deviceClass: DeviceClass;
  shellVariant: ShellVariant;
  useMasterDetail: boolean;
  isNativeMobile: boolean;
  isWeb: boolean;
  width: number;
  height: number;
};

export function resolveShellVariant(deviceClass: DeviceClass): ShellVariant {
  if (isPhoneClass(deviceClass)) return 'mobile';
  if (isTabletClass(deviceClass)) return 'tablet';
  return 'desktop';
}

export function buildPlatformLayoutSnapshot(
  width: number,
  height: number,
  platform: PlatformTarget,
): PlatformLayoutSnapshot {
  const deviceClass = resolveDeviceClass(width);

  return {
    platform,
    deviceClass,
    shellVariant: resolveShellVariant(deviceClass),
    useMasterDetail: supportsMasterDetail(width),
    isNativeMobile: platform === 'ios' || platform === 'android',
    isWeb: platform === 'web' || platform === 'windows' || platform === 'macos',
    width,
    height,
  };
}

export function isDesktopShell(deviceClass: DeviceClass): boolean {
  return isDesktopClass(deviceClass);
}

export function detectWebPlatformTarget(userAgent: string): PlatformTarget {
  const ua = userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'web';
}
