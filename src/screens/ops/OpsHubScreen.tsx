import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { OpsHubHero } from '@/components/ops';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { OPS_HUB_MODULES } from '@/lib/ops/opsHubModules';
import { isOpsLiveReady, OPS_PREPARED_MESSAGE } from '@/lib/ops/opsModuleConfig';
import { colors, spacing, typography } from '@/theme';

/** Betrieb Hub — Einstieg WP 521+ */
export function OpsHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';

  return (
    <ScreenShell title="Betrieb" subtitle="TI · Release · Security · QA · Roadmap" showBack={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <OpsHubHero roleKey={roleKey} />

        {!isOpsLiveReady() ? (
          <InfoBanner title="Live-Orchestrierung in Vorbereitung" message={OPS_PREPARED_MESSAGE} />
        ) : null}

        <Text style={styles.intro}>
          Operations-Module für Telematik, Release, Compliance, Qualitätssicherung und strategische Planung.
        </Text>

        {OPS_HUB_MODULES.map((module) => (
          <PremiumCard key={module.href} accentColor={module.color} onPress={() => router.push(module.href as never)}>
            <Text style={styles.title}>{module.title}</Text>
            <Text style={styles.meta}>{module.desc}</Text>
          </PremiumCard>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
});
