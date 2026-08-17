import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuroraBadge, AuroraGlassCard } from '@/components/aurora';
import {
  ClientWorkspaceLiveBadge,
  ClientWorkspacePanel,
} from './ClientWorkspacePrimitives';
import type { ClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type ClientRecordOverviewPanelProps = {
  overview: ClientRecordOverview;
  onNavigateTab: (tab: ClientRecordTabKey) => void;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function FocusCard({ icon, label, value, variant = 'cyan' }: {
  icon: string;
  label: string;
  value: string;
  variant?: 'cyan' | 'pink' | 'green';
}) {
  return (
    <AuroraGlassCard style={styles.focusCard}>
      <View style={styles.focusHeader}>
        <Text style={styles.focusIcon}>{icon}</Text>
        <AuroraBadge label={label} variant={variant} />
      </View>
      <Text style={styles.focusValue}>{value}</Text>
    </AuroraGlassCard>
  );
}

export function ClientRecordOverviewPanel({ overview, onNavigateTab }: ClientRecordOverviewPanelProps) {
  const { isDesktopOrWide } = useDeviceClass();

  return (
    <View style={styles.root}>
      <ClientWorkspacePanel
        eyebrow="Versorgungsradar"
        title="Heute wichtig"
        subtitle="Aktuelle Termine, offene Punkte und Dokumentenstatus auf einen Blick"
        accessory={<ClientWorkspaceLiveBadge label="Akte aktuell" />}
      >
        <View style={styles.focusGrid}>
          <FocusCard icon="◷" label="Nächster Termin" value={overview.nextAppointment} />
          <FocusCard icon="!" label="Offene Punkte" value={overview.openItemsSummary} variant="pink" />
          <FocusCard
            icon="✓"
            label="Signierte Dokumente"
            value={`${overview.signedDocuments.length} vollständig`}
            variant="green"
          />
        </View>
      </ClientWorkspacePanel>

      <View style={[styles.workspace, isDesktopOrWide && styles.workspaceWide]}>
        <View style={styles.mainColumn}>
          <ClientWorkspacePanel
            eyebrow="Stammdaten-Kurzüberblick"
            title="Versorgungsprofil"
            subtitle="Wichtigste Angaben auf einen Blick"
          >
            <View style={styles.summaryGrid}>
              <View style={styles.summaryColumn}>
                <SummaryRow label="Name" value={overview.fullName} />
                <SummaryRow label="Geburtsdatum" value={overview.dateOfBirth} />
                <SummaryRow label="Adresse" value={overview.address} />
                <SummaryRow label="Telefon" value={overview.phone} />
                <SummaryRow label="Aufnahmedatum" value={overview.admissionDate} />
              </View>
              <View style={styles.summaryColumn}>
                <SummaryRow label="Pflegegrad" value={overview.careLevel} />
                <SummaryRow label="Leistungsart" value={overview.serviceTypes} />
                <SummaryRow label="Kostenträger" value={overview.primaryCostBearer} />
                <SummaryRow label="Letzte Aktivität" value={overview.lastActivity} />
              </View>
            </View>
          </ClientWorkspacePanel>

          <ClientWorkspacePanel
            eyebrow="Dokumentenstatus"
            title="Unterschriebene Dokumente"
            subtitle="Verträge und Einwilligungen aus Aufnahme und Akte"
          >
            {overview.signedDocuments.length > 0 ? (
              <View style={styles.documentList}>
                {overview.signedDocuments.map((doc) => (
                  <Pressable key={doc.id} style={styles.documentRow} onPress={() => onNavigateTab('dokumente')}>
                    <View style={styles.documentIcon}><Text style={styles.documentIconText}>✓</Text></View>
                    <View style={styles.documentText}>
                      <Text style={styles.documentTitle}>{doc.title}</Text>
                      <Text style={styles.documentDate}>Unterzeichnet am {formatDate(doc.signedAt)}</Text>
                    </View>
                    <Text style={styles.arrow}>→</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyDocuments}>
                <Text style={styles.emptyDocumentsTitle}>Keine signierten Dokumente</Text>
                <Text style={styles.emptyDocumentsText}>
                  Einwilligungen und Verträge erscheinen hier direkt nach der Unterzeichnung.
                </Text>
              </View>
            )}
          </ClientWorkspacePanel>
        </View>

        {overview.quickLinks.length > 0 ? (
          <ClientWorkspacePanel
            eyebrow="Direktzugriff"
            title="Schnellaktionen"
            subtitle="Häufig genutzte Bereiche"
            style={styles.sidePanel}
          >
            <View style={styles.quickLinks}>
              {overview.quickLinks.map((link, index) => (
                <Pressable key={link.tab} style={styles.quickLink} onPress={() => onNavigateTab(link.tab)}>
                  <View style={styles.quickLinkNumber}><Text style={styles.quickLinkNumberText}>{index + 1}</Text></View>
                  <Text style={styles.quickLinkLabel}>{link.label}</Text>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </ClientWorkspacePanel>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
  focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  focusCard: { flex: 1, minWidth: 180, minHeight: 108 },
  focusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.sm },
  focusIcon: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 22, fontWeight: '900' },
  focusValue: { color: careSuiteAuroraTheme.text.primary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  workspace: { gap: careSpacing.md },
  workspaceWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0, gap: careSpacing.md },
  sidePanel: { width: '100%', maxWidth: 360, flexShrink: 0 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md },
  summaryColumn: { flex: 1, minWidth: 240 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: careSuiteAuroraTheme.glass.border,
  },
  summaryLabel: { flex: 0.8, color: careSuiteAuroraTheme.text.muted, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  summaryValue: { flex: 1.2, color: careSuiteAuroraTheme.text.primary, fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'right' },
  documentList: { gap: 7 },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    padding: careSpacing.sm,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  documentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.accent.cyan,
    backgroundColor: 'rgba(105,232,255,0.10)',
  },
  documentIconText: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 14, fontWeight: '900' },
  documentText: { flex: 1, minWidth: 0, gap: 2 },
  documentTitle: { color: careSuiteAuroraTheme.text.primary, fontSize: 13, fontWeight: '800' },
  documentDate: { color: careSuiteAuroraTheme.text.muted, fontSize: 11, fontWeight: '600' },
  emptyDocuments: { gap: 4, paddingVertical: careSpacing.sm },
  emptyDocumentsTitle: { color: careSuiteAuroraTheme.text.primary, fontSize: 14, fontWeight: '900' },
  emptyDocumentsText: { color: careSuiteAuroraTheme.text.muted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  quickLinks: { gap: 7 },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    padding: careSpacing.sm,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  quickLinkNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(105,232,255,0.10)',
  },
  quickLinkNumberText: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 12, fontWeight: '900' },
  quickLinkLabel: { flex: 1, color: careSuiteAuroraTheme.text.primary, fontSize: 13, fontWeight: '800' },
  arrow: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 18, fontWeight: '900' },
});
