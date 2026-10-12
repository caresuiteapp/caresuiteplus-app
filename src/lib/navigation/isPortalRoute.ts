/** True when pathname is under the authenticated portal route tree. */
export function isPortalRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return path === '/portal' || path.startsWith('/portal/');
}

/** The client and employee portal shells use light surfaces in every theme. */
export function isLightPortalRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return /^\/portal\/(?:client|employee)(?:\/|$)/.test(path);
}

/** True when pathname is under the public auth route tree (login, first-login, etc.). */
export function isAuthRoutePath(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return path === '/auth' || path.startsWith('/auth/');
}
