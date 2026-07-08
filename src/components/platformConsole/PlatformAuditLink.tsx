import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { PLATFORM_COLORS } from './PlatformShellLayout';
import { buildPlatformAuditPath } from '@/lib/platformConsole/platformFormat';

type PlatformAuditLinkProps = {
  tenantId?: string;
  action?: string;
  label?: string;
};

export function PlatformAuditLink({ tenantId, action, label = 'Audit anzeigen' }: PlatformAuditLinkProps) {
  const router = useRouter();
  const href = buildPlatformAuditPath({ tenantId, action });

  return (
    <Pressable onPress={() => router.push(href as never)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600', fontSize: 13 },
});
