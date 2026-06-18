import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionPanel, EmptyState } from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { ClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type ClientRecordOverviewPanelProps = {
  overview: ClientRecordOverview;
  onNavigateTab: (tab: ClientRecordTabKey) => void;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ClientRecordOverviewPanel({ overview, onNavigateTab }: ClientRecordOverviewPanelProps) {
  const { isDesktopOrWide } = useDeviceClass();

  return (
    <View style={[styles.root, isDesktopOrWide && styles.rootWide]}>
      <View style={styles.main}>
        <SectionPanel title="Stammdaten" subtitle="Kurzüberblick">
          <SummaryRow label="Name" value={overview.fullName} />
          <SummaryRow label="Geburtsdatum" value={overview.dateOfBirth} />
          <SummaryRow label="Adresse" value={overview.address} />
          <SummaryRow label="Telefon" value={overview.phone} />
          <SummaryRow label="Kostenträger" value={overview.primaryCostBearer} />
          <SummaryRow label="Pflegegrad" value={overview.careLevel} />
          <SummaryRow label="Leistungsart" value={overview.serviceTypes} />
          <SummaryRow label="Letzte Aktivität" value={overview.lastActivity} />
          <SummaryRow label="Aufnahmedatum" value={overview.admissionDate} />
        </SectionPanel>

        <SectionPanel title="Unterschriebene Dokumente" subtitle="Aus Aufnahme & Akte">
          {overview.signedDocuments.length > 0 ? (
            overview.signedDocuments.map((doc) => (
              <Pressable
                key={doc.id}
                style={styles.docRow}
                onPress={() => onNavigateTab('dokumente')}
              >
                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docDate}>{formatDate(doc.signedAt)}</Text>
              </Pressable>
            ))
          ) : (
            <EmptyState
              title="Keine signierten Dokumente"
              message="Einwilligungen und Verträge aus der Aufnahme erscheinen hier nach Unterzeichnung."
            />
          )}
        </SectionPanel>
      </View>

      {overview.quickLinks.length > 0 ? (
        <View style={styles.side}>
          <SectionPanel title="Schnellzugriff" subtitle="Häufig genutzte Bereiche">
            <View style={styles.quickLinks}>
              {overview.quickLinks.map((link) => (
                <Pressable
                  key={link.tab}
                  style={styles.quickLink}
                  onPress={() => onNavigateTab(link.tab)}
                >
                  <Text style={styles.quickLinkLabel}>{link.label}</Text>
                  <Text style={styles.quickLinkArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </SectionPanel>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.md,
  },
  rootWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: careSpacing.md,
  },
  side: {
    width: '100%',
    maxWidth: 320,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: careLightColors.border,
  },
  rowLabel: {
    ...careTypography.caption,
    color: careLightColors.muted,
    flex: 1,
    fontWeight: '600',
  },
  rowValue: {
    ...careTypography.body,
    color: careLightColors.text,
    flex: 1.2,
    textAlign: 'right',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: careLightColors.border,
  },
  docTitle: {
    ...careTypography.body,
    color: careLightColors.text,
    flex: 1,
  },
  docDate: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  quickLinks: {
    gap: careSpacing.xs,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: careLightColors.border,
    backgroundColor: careLightColors.page,
  },
  quickLinkLabel: {
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
  },
  quickLinkArrow: {
    ...careTypography.body,
    color: careLightColors.orange,
    fontWeight: '700',
  },
});
