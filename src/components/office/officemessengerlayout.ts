import { Platform, StyleSheet } from 'react-native';

/** Matches inbox filter chips + search field height for aligned empty states across columns */
export const OFFICE_MESSENGER_INBOX_CHROME_MIN_HEIGHT = 120;
export const OFFICE_MESSENGER_THREAD_HEADER_MIN_HEIGHT = OFFICE_MESSENGER_INBOX_CHROME_MIN_HEIGHT;
export const OFFICE_MESSENGER_COMPOSER_MIN_HEIGHT = 88;
export const OFFICE_MESSENGER_MIN_HEIGHT = 560;

/** Shell chrome above the messenger grid (header, toggles, action row). */
export const OFFICE_MESSENGER_SHELL_CHROME_ESTIMATE = 280;

export function officeMessengerContainerHeight(viewportHeight: number) {
  if (Platform.OS === 'web') {
    return {
      flex: 1,
      minHeight: 'calc(100vh - 220px)' as unknown as number,
    };
  }

  return {
    flex: 1,
    minHeight: Math.max(OFFICE_MESSENGER_MIN_HEIGHT, viewportHeight - OFFICE_MESSENGER_SHELL_CHROME_ESTIMATE),
  };
}

export const officeMessengerColumnStyles = StyleSheet.create({
  column: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  columnRoot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  scrollRegion: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
  },
});

export const officeMessengerEmptyStyles = StyleSheet.create({
  chrome: {
    minHeight: OFFICE_MESSENGER_INBOX_CHROME_MIN_HEIGHT,
  },
  threadHeader: {
    minHeight: OFFICE_MESSENGER_THREAD_HEADER_MIN_HEIGHT,
    justifyContent: 'center',
  },
  emptyPane: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
});
