import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SectionPanel, EmptyState } from '@/components/ui';
import {
  createCareLightContentStyles,
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import type { ClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type ClientRecordOverviewPanelProps = {
  overview: ClientRecordOverview;
  onNavigateTab: (tab: ClientRecordTabKey) => void;
};

function SummaryRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ClientRecordOverviewPanel({ overview, onNavigateTab }: ClientRecordOverviewPanelProps) {
  const { isDesktopOrWide } = useDeviceClass();
  const { c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.root, isDesktopOrWide && styles.rootWide]}>
      <View style={styles.main}>
        <SectionPanel title="Stammdaten-Kurzüberblick" subtitle="Wichtigste Angaben auf einen Blick">
          <SummaryRow label="Name" value={overview.fullName} styles={styles} />
          <SummaryRow label="Geburtsdatum" value={overview.dateOfBirth} styles={styles} />
          <SummaryRow label="Adresse" value={overview.address} styles={styles} />
          <SummaryRow label="Telefon" value={overview.phone} styles={styles} />
          <SummaryRow label="Kostenträger" value={overview.primaryCostBearer} styles={styles} />
          <SummaryRow label="Pflegegrad" value={overview.careLevel} styles={styles} />
          <SummaryRow label="Leistungsart" value={overview.serviceTypes} styles={styles} />
          <SummaryRow label="Letzte Aktivität" value={overview.lastActivity} styles={styles} />
          <SummaryRow label="Aufnahmedatum" value={overview.admissionDate} styles={styles} />
        </SectionPanel>

        <SectionPanel title="Nächster Termin" subtitle="Planung & Einsätze">
          <Text style={styles.highlightValue}>{overview.nextAppointment}</Text>
        </SectionPanel>

        <SectionPanel title="Offene Punkte" subtitle="Aufgaben, Einwilligungen, Aufnahme">
          <Text style={styles.bodyValue}>{overview.openItemsSummary}</Text>
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
          <SectionPanel title="Schnellaktionen" subtitle="Häufig genutzte Bereiche">
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

function makeStyles(c: CareLightResolved) {
  const text = createCareLightContentStyles(c);

  return StyleSheet.create({
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
      borderBottomColor: c.border,
    },
    rowLabel: {
      ...text.label,
      flex: 1,
    },
    rowValue: {
      ...text.body,
      flex: 1.2,
      textAlign: 'right',
    },
    highlightValue: {
      ...text.bodyStrong,
    },
    bodyValue: {
      ...text.body,
    },
    docRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: careSpacing.sm,
      paddingVertical: careSpacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    docTitle: {
      ...text.body,
      flex: 1,
    },
    docDate: {
      ...text.caption,
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
      borderColor: c.border,
      backgroundColor: c.isDark ? c.surfaceAlt : c.page,
    },
    quickLinkLabel: {
      ...text.bodyStrong,
    },
    quickLinkArrow: {
      ...text.body,
      color: c.orange,
      fontWeight: '700',
    },
  });
}
