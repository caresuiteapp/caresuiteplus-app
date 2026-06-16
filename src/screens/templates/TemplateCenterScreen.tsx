import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner, TemplateCenterHero } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ModuleTile,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getTemplateDashboardStats } from '@/lib/templates';
import { colors, spacing, typography } from '@/theme';

const QUICK_ACTIONS = [
  { title: 'Neue Vorlage', route: '/business/templates/create', icon: '➕' },
  { title: 'Systemvorlagen', route: '/business/templates/system', icon: '🏛️' },
  { title: 'Kataloge', route: '/business/templates/catalogs', icon: '📚' },
  { title: 'Textbausteine', route: '/business/templates/text-blocks', icon: '📝' },
  { title: 'Platzhalter', route: '/business/templates/placeholders', icon: '🔤' },
  { title: 'CI & Layout', route: '/business/templates/ci-layout', icon: '🎨' },
  { title: 'Live-Vorschau', route: '/business/templates/live-preview', icon: '👁️' },
  { title: 'HTML-Vorlagen', route: '/business/templates/document-templates-html', icon: '📄' },
  { title: 'Dokumenteneingang', route: '/business/templates/document-inbox', icon: '📥' },
  { title: 'Nachrichten', route: '/business/templates/message-templates', icon: '💬' },
  { title: 'Pflege', route: '/business/templates/care-templates', icon: '❤️' },
  { title: 'Beratung', route: '/business/templates/counseling-templates', icon: '📋' },
  { title: 'Akademie', route: '/business/templates/academy-templates', icon: '🎓' },
];

export function TemplateCenterScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getTemplateDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!can('office.catalogs.view')) {
    return (
      <CareLightPageShell title="Template Center" subtitle={roleLabel ?? 'Vorlagen'} showBack={false}>
        <LockedActionBanner
          message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Template Center" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="KPIs werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Template Center" subtitle="Fehler" showBack={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const stats = query.data!;

  return (
    <CareLightPageShell title="Template Center" subtitle="Zentrale Vorlagen & Kataloge" showBack={false}>
      <PreparedTemplateBanner />
      {profile?.roleKey ? (
        <TemplateCenterHero stats={stats} roleKey={profile.roleKey} />
      ) : null}

      {stats.topTemplates.length > 0 ? (
        <PremiumCard>
          <Text style={styles.sectionTitle}>Meistgenutzt</Text>
          {stats.topTemplates.map((t) => (
            <Text key={t.id} style={styles.row}>
              {t.title} · {t.usageCount}×
            </Text>
          ))}
        </PremiumCard>
      ) : (
        <EmptyState title="Noch keine Nutzungsstatistik" message="Vorlagen werden nach erster Nutzung angezeigt." />
      )}

      <SectionPanel title="Schnellaktionen" subtitle="Vorlagenbereiche öffnen">
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <ModuleTile
              key={action.route}
              icon={action.icon}
              title={action.title}
              description="Öffnen"
              accentColor={colors.cyan}
              isActive
              onPress={() => router.push(action.route as never)}
            />
          ))}
        </View>
      </SectionPanel>

      <PremiumButton
        title="Einstellungen"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/business/templates/settings' as never)}
      />
      <PremiumButton
        title="Kategorien"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/business/templates/categories' as never)}
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  grid: { gap: spacing.sm },
});
