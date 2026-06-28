/** True when pathname is under the authenticated portal route tree. */
export function isPortalRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return path === '/portal' || path.startsWith('/portal/');
}

/** True when pathname is under the public auth route tree (login, first-login, etc.). */
export function isAuthRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return path === '/auth' || path.startsWith('/auth/');
}
