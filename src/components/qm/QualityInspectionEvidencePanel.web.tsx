import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchQualityInspectionEvidenceSets } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

const levelLabel = { person: 'Personenbezogen', facility: 'Einrichtung', billing: 'Abrechnung' } as const;

export function QualityInspectionEvidencePanel() {
  const tenantId = useServiceTenantId();
  const { roleKey } = usePermissions();
  const query = useAsyncQuery(
    () => tenantId ? fetchQualityInspectionEvidenceSets(tenantId, roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, roleKey],
    { enabled: Boolean(tenantId) },
  );
  if (query.loading && !query.data) return <LoadingState message="Qualitätsprüfungsnachweise werden geladen…" />;
  if (query.error && !query.data) return <ErrorState title="Qualitätsprüfungsnachweise" message={query.error} onRetry={query.refresh} />;
  const sets = query.data ?? [];
  return <SectionPanel title="Qualitätsprüfungsnachweise" subtitle="QPR-Anforderung, konkrete Aktenstelle und offene Lücke getrennt">
    {sets.length === 0 ? <EmptyState title="Keine Prüfzuordnung dokumentiert" message="Eine Prüfzuordnung erscheint erst, wenn eine konkrete QPR-Anforderung mit unveränderlichen Aktenstellen oder einer ausdrücklich offenen Lücke erfasst wurde." /> : sets.map(set => <PremiumCard key={set.evidenceSetId} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={typography.label}>{set.qprProfileCode}</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>Gültig ab {set.qprEffectiveFrom} · erfasst {set.recordedAt} · {set.recordedByName}</Text>
        </View>
        <PremiumBadge label={`${set.openGapCount} offene Lücken`} variant={set.openGapCount ? 'warning' : 'muted'} />
      </View>
      {set.requirements.map(requirement => <View key={requirement.requirementMappingId} style={{ marginTop: spacing.md }}>
        <Text style={typography.bodyStrong}>{requirement.requirementCode} · {requirement.requirementTitle}</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>{levelLabel[requirement.inspectionLevel]}{requirement.clientId ? ` · Pflegefall ${requirement.clientId}` : ''}</Text>
        {requirement.evidence.map(entry => <Text key={entry.evidenceRefId} style={{ ...typography.caption, marginTop: spacing.xs }}>Aktenstelle: {entry.recordLocator} · {entry.sourceType} · Original {entry.sourceEntityId}{entry.sourceVersionId ? ` / Fassung ${entry.sourceVersionId}` : ''}</Text>)}
        {requirement.gaps.map(gap => <Text key={gap.gapId} style={{ ...typography.caption, color: colors.orange, marginTop: spacing.xs }}>Offene Lücke ({gap.severity}): {gap.description} · Verantwortung {gap.responsibleRole}{gap.dueAt ? ` · Frist ${gap.dueAt}` : ''}</Text>)}
      </View>)}
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.md }}>Die Zuordnung dokumentiert vorhandene Quellen und Lücken. Sie bestätigt weder ein Prüfergebnis noch pflegerische Durchführung, Aufgabenabschluss oder rechtliche Freigabe.</Text>
    </PremiumCard>)}
  </SectionPanel>;
}
