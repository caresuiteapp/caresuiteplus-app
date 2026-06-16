import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import {
  defaultDeveloperVisibility,
  resolveUiEnvironment,
  userFriendlyLabel,
  type UiVisibility,
} from '@/lib/ui/uiVisibility';
import { isDemoMode } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import { colors, spacing, typography } from '@/theme';

type AuthInfoCardProps = {
  visibility?: UiVisibility;
};

/** Collapsible system diagnostics — developer/admin only, never in production for normal flows. */
export function AuthInfoCard({ visibility = defaultDeveloperVisibility() }: AuthInfoCardProps) {
  const [open, setOpen] = useState(false);

  if (!visibility.showDeveloperDiagnostics) return null;

  const environment = resolveUiEnvironment();
  const serviceMode = getServiceMode();

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleText}>Systemdiagnose {open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          <View style={styles.badges}>
            <PremiumBadge label={`Env: ${environment}`} variant="muted" />
            <PremiumBadge label={`Service: ${serviceMode}`} variant="muted" />
            {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
            {visibility.showRlsInfo ? (
              <PremiumBadge label={userFriendlyLabel('RLS')} variant="cyan" />
            ) : null}
            {visibility.showPrototypeInfo ? (
              <PremiumBadge label={userFriendlyLabel('Prototyp')} variant="orange" />
            ) : null}
          </View>
          <Text style={styles.hint}>
            Nur für Entwickler und Administratoren — nicht für Endbenutzer sichtbar.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  toggle: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  toggleText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
