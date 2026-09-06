import type { ReactNode } from 'react';
export { ScrollView as PortalKeyboardScrollView, KeyboardAvoidingView as PortalKeyboardAvoidingView } from 'react-native';
export function PortalKeyboardProvider({ children }: { children: ReactNode }) { return children; }
