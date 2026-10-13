import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';

export const nativeWorkspaceStyles = StyleSheet.create({
  surface: { backgroundColor: 'rgba(8,22,42,0.94)', borderWidth: 1, borderColor: '#34516e', borderRadius: 22, padding: 20, gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  stack: { gap: 14 },
  title: { color: '#f3f8ff', fontSize: 25, lineHeight: 34, fontFamily: careSuiteAppFontFamily, fontWeight: '700', flexShrink: 1 },
  body: { color: '#e0edfa', fontSize: 16, lineHeight: 24, fontFamily: careSuiteAppFontFamily, flexShrink: 1 },
  muted: { color: '#b8cce1', fontSize: 14, lineHeight: 21, fontFamily: careSuiteAppFontFamily, flexShrink: 1 },
  label: { color: '#ebf5ff', fontSize: 15, lineHeight: 23, fontFamily: careSuiteAppFontFamily, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#54799f', backgroundColor: '#091c31', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 23, color: '#f3f8ff', fontFamily: careSuiteAppFontFamily },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 13, backgroundColor: '#123451', borderWidth: 1, borderColor: '#547fa2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, flexShrink: 1 },
  primary: { backgroundColor: '#195abd', borderColor: '#75b7ff' },
  buttonText: { color: '#f4f9ff', fontSize: 15, lineHeight: 23, fontWeight: '600', textAlign: 'center', fontFamily: careSuiteAppFontFamily, flexShrink: 1 },
  error: { color: '#ffd0d6', fontSize: 15, lineHeight: 23, fontFamily: careSuiteAppFontFamily },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});

export function NativeAction({ label, onPress, disabled, busy, primary, selected, accessibilityLabel }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; primary?: boolean; selected?: boolean; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy, selected }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [nativeWorkspaceStyles.button, (primary || selected) && nativeWorkspaceStyles.primary, (disabled || busy) && nativeWorkspaceStyles.disabled, pressed && nativeWorkspaceStyles.pressed]}>
    {busy ? <ActivityIndicator color="#fff" /> : null}<Text style={nativeWorkspaceStyles.buttonText}>{label}</Text>
  </Pressable>;
}

export function NativeField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={nativeWorkspaceStyles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#9eb8d2" {...props} style={[nativeWorkspaceStyles.input, props.multiline && { minHeight: 140, textAlignVertical: 'top' }, props.style]} /></View>;
}

/** Safe areas and a scrolling keyboard-aware body also cover short landscape screens. */
export function NativeWorkspaceDialog({ visible, title, children, onClose, wide }: { visible: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,7,19,0.8)' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
        <View accessibilityViewIsModal style={[nativeWorkspaceStyles.surface, { width: '100%', maxWidth: wide ? 1100 : 640, maxHeight: '100%', alignSelf: 'center', padding: 16, flexShrink: 1 }]}>
          <View style={[nativeWorkspaceStyles.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={[nativeWorkspaceStyles.title, { flex: 1 }]}>{title}</Text><NativeAction label="Schließen" onPress={onClose} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 16, paddingBottom: 16 }} style={{ flexShrink: 1 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
