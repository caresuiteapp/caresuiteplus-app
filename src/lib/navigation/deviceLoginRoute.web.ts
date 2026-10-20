/** Device pairing owns its complete Web surface, including phone confirmation. */
export function isWebDeviceLoginRoute(routePattern: string): boolean {
  const pathname = routePattern.replace(/(?:^|\/)\([^/]+\)(?=\/|$)/g, '').replace(/^\/+|\/+$/g, '');
  return pathname === 'device/tv' || pathname === 'device/confirm';
}
