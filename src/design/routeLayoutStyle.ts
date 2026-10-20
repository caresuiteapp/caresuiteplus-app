/**
 * Route stack content area — transparent so PlatformShell Aurora or
 * ScreenShell / ScreenShell own the visible surface.
 */
export const routeLayoutContentStyle = {
  flex: 1,
  flexGrow: 1,
  alignSelf: 'stretch',
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  backgroundColor: 'transparent',
} as const;
