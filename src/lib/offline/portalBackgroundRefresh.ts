/** Web uses the existing visibility/realtime refresh, not native OS tasks. */
export async function configurePortalBackgroundRefresh(_enabled: boolean): Promise<void> {}
export async function portalBackgroundRefreshStatus(): Promise<
  'available' | 'restricted' | 'unsupported'
> {
  return 'unsupported';
}
