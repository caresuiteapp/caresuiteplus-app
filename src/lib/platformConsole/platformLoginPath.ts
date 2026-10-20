export function buildPlatformLoginPath(redirectPath?: string | null): string {
  const redirect = redirectPath?.trim();
  if (!redirect || redirect.startsWith('/platform/login')) {
    return '/platform/login';
  }
  return `/platform/login?redirect=${encodeURIComponent(redirect)}`;
}

export function resolvePlatformAuthRedirectPath(pathname: string): string {
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const locationPath = (globalThis as Window & typeof globalThis).location?.pathname ?? '';
    if (
      locationPath.startsWith('/platform') &&
      !locationPath.startsWith('/platform/login') &&
      !locationPath.startsWith('/platform/forbidden')
    ) {
      return locationPath;
    }
  }

  if (
    pathname.startsWith('/platform') &&
    !pathname.startsWith('/platform/login') &&
    !pathname.startsWith('/platform/forbidden')
  ) {
    return pathname;
  }

  return '/platform/dashboard';
}
