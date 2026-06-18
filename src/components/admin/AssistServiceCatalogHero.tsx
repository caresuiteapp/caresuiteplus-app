import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import type { AssistServiceCatalogItem } from '@/types/assistServiceCatalog';
import { ASSIST_SERVICE_AREA_LABELS } from '@/types/assistServiceCatalog';
import { spacing } from '@/theme';

type AssistServiceCatalogHeroProps = {
  services: AssistServiceCatalogItem[];
  isLiveReady: boolean;
  preparedMessage: string;
};

export function AssistServiceCatalogHero({
  services,
  isLiveReady,
  preparedMessage,
}: AssistServiceCatalogHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: { ...typography.caption, color: colors.orange },
        title: { ...typography.h2 },
        meta: { ...typography.caption, color: colors.textMuted },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        hint: { ...typography.caption, color: colors.textMuted },
        preview: { gap: spacing.xs, marginTop: spacing.sm },
        previewTitle: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
        previewRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSoft,
        },
        previewKey: { ...typography.caption, color: colors.orange, width: 72 },
        previewLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
        previewCategory: { ...typography.caption, color: colors.textMuted, maxWidth: 120 },
      }),
    [colors, typography],
  );

  const activeCount = services.filter((service) => service.status === 'active').length;
  const billableCount = services.filter((service) => service.billable).length;
  const categories = new Set(services.map((service) => service.category)).size;

  const kpis = [
    { id: 'total', label: 'Leistungen', value: String(services.length), subValue: 'konfiguriert' },
    { id: 'active', label: 'Aktiv', value: String(activeCount), subValue: 'freigegeben' },
    { id: 'billable', label: 'Abrechenbar', value: String(billableCount), subValue: 'Positionen' },
    { id: 'areas', label: 'Bereiche', value: String(categories), subValue: 'genutzt' },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ASSIST · LEISTUNGSKATALOG</Text>
          <Text style={styles.title}>Leistungen & Aufgaben</Text>
          <Text style={styles.meta}>Mandantenscharfe Leistungen, Aufgabenpakete und Stundensätze</Text>
        </View>
      </View>

      <View style={styles.badges}>
        <PremiumBadge label="Verwaltung" variant="orange" dot />
        {isLiveReady ? (
          <PremiumBadge label="Live bereit" variant="cyan" />
        ) : (
          <PremiumBadge label="preparedOnly" variant="muted" />
        )}
      </View>

      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>

      <Text style={styles.hint}>{preparedMessage}</Text>

      {services.length > 0 ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Leistungsübersicht</Text>
          {services.slice(0, 5).map((service) => (
            <View key={service.id} style={styles.previewRow}>
              <Text style={styles.previewKey}>{service.serviceKey}</Text>
              <Text style={styles.previewLabel} numberOfLines={1}>
                {service.title}
              </Text>
              <Text style={styles.previewCategory}>
                {ASSIST_SERVICE_AREA_LABELS[service.category]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </PremiumListHeroFrame>
  );
}
