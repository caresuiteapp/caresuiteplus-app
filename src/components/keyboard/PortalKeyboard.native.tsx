import type { ReactNode } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
export {
  KeyboardAwareScrollView as PortalKeyboardScrollView,
  KeyboardAvoidingView as PortalKeyboardAvoidingView,
} from 'react-native-keyboard-controller';
export function PortalKeyboardProvider({ children }: { children: ReactNode }) {
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      {children}
    </KeyboardProvider>
  );
}
