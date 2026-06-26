/** True when pathname is under the authenticated portal route tree. */
export function isPortalRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return path === '/portal' || path.startsWith('/portal/');
}
