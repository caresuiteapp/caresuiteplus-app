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
  const currentPath = pathname;
  if (!currentPath || !isVisitExecutionRoute(currentPath)) return false;
  if (!snapshotRoute) return true;
  return currentPath === snapshotRoute || currentPath.startsWith(`${snapshotRoute}?`);
}
