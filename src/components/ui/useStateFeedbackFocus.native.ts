import { useCallback, useContext, useSyncExternalStore } from 'react';
import { NavigationContext } from 'expo-router/react-navigation';

/** Retained native pages own feedback only while focused; app-level states have no navigator. */
export function useStateFeedbackFocus(): boolean {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback((notify: () => void) => {
    if (!navigation) return () => {};
    const unsubscribeFocus = navigation.addListener('focus', notify);
    const unsubscribeBlur = navigation.addListener('blur', notify);
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);
  const isFocused = useCallback(() => navigation?.isFocused() ?? true, [navigation]);
  return useSyncExternalStore(subscribe, isFocused, isFocused);
}
