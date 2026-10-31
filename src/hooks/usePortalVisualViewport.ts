import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

type PortalVisualViewport = {
  height: number | null;
  width: number | null;
  offsetTop: number;
  offsetLeft: number;
  keyboardVisible: boolean;
};

/** Android/iOS own the viewport; the shared portal chrome follows their keyboard. */
export function usePortalVisualViewport(): PortalVisualViewport {
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible?.() ?? false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return { height: null, width: null, offsetTop: 0, offsetLeft: 0, keyboardVisible };
}
