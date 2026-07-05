import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAuroraAdaptiveText, lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { AdaptiveKpiGrid, type KpiGridItem } from '@/components/adaptive';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  PremiumListRow,
  SectionPanel,
} from '@/components/ui';
import { EmployeePortalClientDocumentPreviewSheet } from '@/components/portal/EmployeePortalClientDocumentPreviewSheet';
import {
  dialPhoneNumber,
  PhoneActionRow,
} from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecordDetail } from '@/hooks/useEmployeePortalClientRecords';
import type { EmployeePortalClientRecordDetail } from '@/lib/portal/employeePortalClientRecordsService';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildAddress(record: EmployeePortalClientRecordDetail): string {
  const streetLine = [record.street, record.houseNumber].filter(Boolean).join(' ');
  const cityLine = [record.zip, record.city].filter(Boolean).join(' ');
  const unit = [record.floor ? `Etage ${record.floor}` : null, record.apartmentNumber ? `Whg. ${record.apartmentNumber}` : null]
    .filter(Boolean)
    .join(' · ');
  return [streetLine, cityLine, unit].filter(Boolean).join(', ');
}

function InfoBlock({ label, value }: { label: string; value: string | null | undefined }) {
  const text = lightSurfaceText;
  if (!value?.trim()) return null;
  return (
    <View style={styles.infoBlock}>
      <Text style={[styles.infoLabel, { color: text.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: text.primary }]}>{value}</Text>
    </View>
  );
}

function ClientRecordHero({ record }: { record: EmployeePortalClientRecordDetail }) {
  const text = lightSurfaceText;
  const address = buildAddress(record);

  const kpiItems = useMemo((): KpiGridItem[] => {
    const items: KpiGridItem[] = [];
    if (record.careGradeLabel) {
      items.push({
        id: 'care',
        node: (
          <View style={styles.kpiTile}>
            <Text style={[styles.kpiLabel, { color: text.muted }]}>Pflegegrad</Text>
            <Text style={[styles.kpiValue, { color: text.primary }]}>{record.careGradeLabel}</Text>
          </View>
        ),
      });
    }
    if (record.nextAssignmentAt) {
      items.push({
        id: 'next',
        node: (
          <View style={styles.kpiTile}>
            <Text style={[styles.kpiLabel, { color: text.muted }]}>Nächster Einsatz</Text>
            <Text style={[styles.kpiValue, { color: text.primary }]}>
              {formatDate(record.nextAssignmentAt)}
            </Text>
          </View>
        ),
      });
    }
    items.push({
      id: 'docs',
      node: (
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiLabel, { color: text.muted }]}>Dokumente</Text>
          <Text style={[styles.kpiValue, { color: text.primary }]}>{record.portalDocuments.length}</Text>
        </View>
      ),
    });
    items.push({
      id: 'active',
      node: (
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiLabel, { color: text.muted }]}>Aktive Einsätze</Text>
          <Text style={[styles.kpiValue, { color: text.primary }]}>{record.activeAssignmentCount}</Text>
        </View>
      ),
    });
    return items;
  }, [record, text.muted, text.primary]);

  return (
    <PremiumCard style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroTextCol}>
          <Text style={[styles.heroEyebrow, { color: text.muted }]}>Klientenakte</Text>
          <Text style={[styles.heroTitle, { color: text.primary }]}>{record.displayName}</Text>
          {address ? <Text style={[styles.heroSubtitle, { color: text.secondary }]}>{address}</Text> : null}
        </View>
        {record.careGradeLabel ? (
          <PremiumBadge label={record.careGradeLabel} variant="cyan" />
        ) : null}
      </View>
      <AdaptiveKpiGrid columns={{ phone: 2, tablet: 4, desktop: 4, wide: 4 }} items={kpiItems} />
    </PremiumCard>
  );
}

type EmployeePortalClientRecordDetailScreenProps = {
  clientId: string | undefined;
};

export function EmployeePortalClientRecordDetailScreen({
  clientId,
}: EmployeePortalClientRecordDetailScreenProps) {
  const text = useAuroraAdaptiveText();
  const { record, loading, error, refresh, notFound } = useEmployeePortalClientRecordDetail(clientId);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);

  if (loading) {
    return <LoadingState message="Klientenakte wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <ErrorState
        title="Klientenakte"
        message={error ?? 'Klient:in nicht gefunden oder kein Zugriff.'}
        onRetry={refresh}
      />
    );
  }

  if (!record || !clientId) return null;

  const openMaps = () => {
    const address = buildAddress(record);
    if (!address.trim()) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.readOnlyHint, { color: text.muted }]}>
          Nur-Lese-Ansicht — Bearbeitung erfolgt im Office.
        </Text>

        <ClientRecordHero record={record} />

        <SectionPanel title="Kontakt & Erreichbarkeit">
          {record.phone ? <PhoneActionRow label="Telefon" value={record.phone} /> : null}
          {record.mobile ? <PhoneActionRow label="Mobil" value={record.mobile} icon="📱" /> : null}
          {!record.phone && !record.mobile ? (
            <Text style={[styles.emptyLine, { color: text.muted }]}>Keine Telefonnummer hinterlegt.</Text>
          ) : null}
          {buildAddress(record) ? (
            <Pressable onPress={openMaps} style={[styles.mapsRow, webCursor]}>
              <Text style={[styles.infoLabel, { color: text.muted }]}>Navigation</Text>
              <Text style={[styles.mapsLink, { color: '#0F766E' }]}>Route in Karten öffnen</Text>
            </Pressable>
          ) : null}
        </SectionPanel>

        <SectionPanel title="Stammdaten">
          <InfoBlock label="Geburtsdatum" value={record.dateOfBirth} />
          <InfoBlock label="Geschlecht" value={record.gender} />
          <InfoBlock label="Adresse" value={buildAddress(record)} />
          <InfoBlock label="Klingel" value={record.doorbellName} />
        </SectionPanel>

        {(record.accessHint ||
          record.keyManagementNotes ||
          record.employeeNotes ||
          record.emergencyNotes) && (
          <SectionPanel title="Hinweise für den Einsatz">
            <InfoBlock label="Zugang" value={record.accessHint} />
            <InfoBlock label="Schlüssel / Zugang" value={record.keyManagementNotes} />
            <InfoBlock label="Hinweise aus der Akte" value={record.employeeNotes} />
            <InfoBlock label="Notfallhinweise" value={record.emergencyNotes} />
            <InfoBlock label="Besonderheiten aus Einsätzen" value={record.hints} />
          </SectionPanel>
        )}

        {(record.allergies || record.mobilityNotes || record.pets) && (
          <SectionPanel title="Gesundheit & Alltag">
            <InfoBlock label="Allergien" value={record.allergies} />
            <InfoBlock label="Mobilität" value={record.mobilityNotes} />
            <InfoBlock label="Haustiere" value={record.pets} />
          </SectionPanel>
        )}

        {record.contacts.length > 0 ? (
          <SectionPanel title="Ansprechpartner">
            {record.contacts.map((contact, index) => {
              const phone = contact.phone ?? contact.mobile;
              const badges = [
                contact.isPrimaryContact ? 'Hauptkontakt' : null,
                contact.isEmergencyContact ? 'Notfall' : null,
                contact.relationship,
              ].filter(Boolean);

              return (
                <View key={contact.id} style={styles.contactBlock}>
                  <PremiumListRow
                    title={contact.displayName}
                    subtitle={badges.join(' · ') || undefined}
                    multiline
                    showDivider={index < record.contacts.length - 1}
                    trailing={
                      phone ? (
                        <Pressable
                          onPress={() => dialPhoneNumber(phone)}
                          style={[styles.callChip, webCursor]}
                          accessibilityLabel={`${contact.displayName} anrufen`}
                        >
                          <Text style={styles.callChipText}>Anrufen</Text>
                        </Pressable>
                      ) : undefined
                    }
                  />
                  {contact.phone && contact.mobile && contact.phone !== contact.mobile ? (
                    <View style={styles.contactPhones}>
                      <PhoneActionRow label="Telefon" value={contact.phone} />
                      <PhoneActionRow label="Mobil" value={contact.mobile} icon="📱" />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </SectionPanel>
        ) : null}

        <SectionPanel title="Freigegebene Dokumente">
          {record.portalDocuments.length === 0 ? (
            <EmptyState title="Keine Dokumente" message="Für diese:n Klient:in sind keine Portal-Dokumente freigegeben." />
          ) : (
            record.portalDocuments.map((doc, index) => (
              <PremiumListRow
                key={doc.id}
                title={doc.title}
                subtitle={[doc.categoryLabel, formatDate(doc.createdAt)].filter(Boolean).join(' · ')}
                multiline
                showChevron
                showDivider={index < record.portalDocuments.length - 1}
                onPress={() => setPreviewDocumentId(doc.id)}
              />
            ))
          )}
        </SectionPanel>

        <SectionPanel title="Einsatzhistorie">
          {record.assignmentHistory.length === 0 ? (
            <EmptyState title="Keine Einsätze" message="Noch keine Einsätze für diese:n Klient:in." />
          ) : (
            record.assignmentHistory.map((entry) => (
              <View key={entry.assignmentId} style={styles.historyRow}>
                <Text style={[styles.historyTitle, { color: text.primary }]}>{entry.title}</Text>
                <Text style={[styles.historyMeta, { color: text.muted }]}>
                  {formatDateTime(entry.plannedStartAt)} · {entry.status}
                </Text>
              </View>
            ))
          )}
        </SectionPanel>
      </ScrollView>

      <EmployeePortalClientDocumentPreviewSheet
        clientId={clientId}
        documentId={previewDocumentId}
        visible={previewDocumentId != null}
        onClose={() => setPreviewDocumentId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  readOnlyHint: { ...careTypography.caption, fontStyle: 'italic' },
  heroCard: { gap: careSpacing.md },
  heroTop: { flexDirection: 'row', gap: careSpacing.md, alignItems: 'flex-start' },
  heroTextCol: { flex: 1, gap: 4, minWidth: 0 },
  heroEyebrow: { ...careTypography.caption, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { ...careTypography.h2 },
  heroSubtitle: { ...careTypography.body },
  kpiTile: { gap: 4, padding: careSpacing.sm },
  kpiLabel: { ...careTypography.caption },
  kpiValue: { ...careTypography.bodyStrong },
  infoBlock: { gap: 4, marginBottom: careSpacing.sm },
  infoLabel: { ...careTypography.caption },
  infoValue: { ...careTypography.body },
  emptyLine: { ...careTypography.body, fontStyle: 'italic' },
  mapsRow: { marginTop: careSpacing.sm, gap: 4 },
  mapsLink: { ...careTypography.bodyStrong },
  contactBlock: { gap: careSpacing.xs },
  contactPhones: { paddingLeft: careSpacing.sm },
  callChip: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(98,243,255,0.14)',
  },
  callChipText: { ...careTypography.caption, fontWeight: '700', color: '#0F766E' },
  historyRow: { gap: 2, marginBottom: careSpacing.sm },
  historyTitle: { ...careTypography.bodyStrong },
  historyMeta: { ...careTypography.caption },
});
