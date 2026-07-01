const VISIT_EXECUTION_ROUTE =
  /^\/portal\/employee\/assignments\/[^/]+\/execute(?:\/|$|\?)/;

export function isVisitExecutionRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return VISIT_EXECUTION_ROUTE.test(pathname);
}

export function visitExecutionRouteMatchesSnapshot(
  pathname: string | null | undefined,
  snapshotRoute: string | null | undefined,
): boolean {
  if (!isVisitExecutionRoute(pathname)) return false;
  if (!snapshotRoute) return true;
  return pathname === snapshotRoute || pathname.startsWith(`${snapshotRoute}?`);
}
