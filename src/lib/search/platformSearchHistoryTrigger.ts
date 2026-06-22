/** Native long-press opens search history; web uses context menu instead. */
export function supportsNativeSearchHistoryLongPress(platformOs: string): boolean {
  return platformOs === 'ios' || platformOs === 'android';
}
