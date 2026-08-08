import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { ClientBudgetVisualModel } from '@/lib/assist/clientBudgetVisuals';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { spacing, typography } from '@/theme';

function formatHours(value: number | null): string {
  if (value == null) return 'Stundensatz fehlt';
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Std.`;
}

function visualColors(model: ClientBudgetVisualModel) {
  return model.id === 'entlastung'
    ? { accent: '#3BE7FF', glow: 'rgba(59,231,255,0.25)', reserved: '#8B7CFF' }
    : { accent: '#65F2A7', glow: 'rgba(101,242,167,0.22)', reserved: '#F6C85F' };
}

function bookingBadge(model: ClientBudgetVisualModel) {
  if (model.bookingState === 'booked') {
    return { label: '✓ LEISTUNG GEBUCHT', color: '#65F2A7', background: 'rgba(19,148,106,0.18)' };
  }
  if (model.bookingState === 'preview') {
    return { label: 'VORSCHAU · NOCH NICHT GEBUCHT', color: '#FFD166', background: 'rgba(246,200,95,0.14)' };
  }
  if (model.bookingState === 'not_eligible') {
    return { label: 'DERZEIT NICHT VERFÜGBAR', color: '#B8C7DB', background: 'rgba(184,199,219,0.12)' };
  }
  return { label: 'WIRD AKTUALISIERT', color: '#7DD3FC', background: 'rgba(125,211,252,0.12)' };
}

function BudgetVisualCard({ model }: { model: ClientBudgetVisualModel }) {
  const text = useAuroraAdaptiveText();
  const palette = visualColors(model);
  const booking = bookingBadge(model);
  const isPreview = model.bookingState === 'preview';
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <LinearGradient
        colors={['rgba(5,20,52,0.96)', 'rgba(10,39,78,0.90)', 'rgba(8,24,56,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { shadowColor: palette.accent }]}
      >
        <View style={[styles.glow, { backgroundColor: palette.glow }]} />
        <View style={[styles.bookingBadge, { backgroundColor: booking.background, borderColor: booking.color }]}>
          <Text style={[styles.bookingBadgeText, { color: booking.color }]}>{booking.label}</Text>
        </View>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.legalLabel}>{model.legalLabel}</Text>
            <Text style={styles.title}>{model.title}</Text>
            <Text style={styles.status}>{model.statusLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${model.title} erklären`}
            onPress={() => setShowInfo(true)}
            style={({ pressed }) => [styles.infoButton, pressed && styles.infoButtonPressed]}
          >
            <Text style={styles.infoIcon}>💬</Text>
          </Pressable>
        </View>

        <View style={styles.heroMetric}>
          <Text style={styles.heroAmount}>{formatCurrency(model.availableCents, true)}</Text>
          <Text style={styles.heroLabel}>{isPreview ? 'mögliches Leistungsbudget' : 'noch verfügbar'}</Text>
          <Text style={[styles.hours, { color: palette.accent }]}>{formatHours(model.availableHours)}</Text>
          {model.hourlyRateCents ? (
            <Text style={styles.rate}>bei {formatCurrency(model.hourlyRateCents, true)} je Stunde</Text>
          ) : (
            <Text style={styles.rate}>Für Reststunden bitte einen Stundensatz hinterlegen.</Text>
          )}
        </View>

        {isPreview ? (
          <View style={styles.previewNotice}>
            <Text style={styles.previewNoticeTitle}>Diese Leistung ist noch nicht Bestandteil der Vereinbarung.</Text>
            <Text style={styles.previewNoticeText}>
              Die Werte zeigen unverbindlich, welche zusätzliche Leistung bei einer Erweiterung möglich wäre.
            </Text>
          </View>
        ) : null}

        <View
          accessibilityLabel={`${model.usedPercent} Prozent verbraucht, ${model.reservedPercent} Prozent für geplante Einsätze, ${model.availablePercent} Prozent verfügbar`}
          style={styles.progressTrack}
        >
          {model.usedPercent > 0 ? (
            <View style={[styles.progressSegment, styles.usedSegment, { flexGrow: model.usedPercent }]} />
          ) : null}
          {model.reservedPercent > 0 ? (
            <View
              style={[
                styles.progressSegment,
                { backgroundColor: palette.reserved, flexGrow: model.reservedPercent },
              ]}
            />
          ) : null}
          {model.availablePercent > 0 ? (
            <LinearGradient
              colors={[palette.accent, 'rgba(255,255,255,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressSegment, { flexGrow: model.availablePercent }]}
            />
          ) : null}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.usedSegment]} />
            <Text style={styles.legendText}>Verbraucht {formatCurrency(model.usedCents, true)}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.reserved }]} />
            <Text style={styles.legendText}>Einsätze geplant {formatCurrency(model.reservedCents, true)}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.accent }]} />
            <Text style={styles.legendText}>Gesamt {formatCurrency(model.totalCents, true)}</Text>
          </View>
        </View>

        {model.id === 'umwandlung' && model.fullCareAllowanceCents != null ? (
          <View style={styles.careAllowancePanel}>
            <View>
              <Text style={styles.careAllowanceLabel}>Voraussichtliches Pflegegeld</Text>
              <Text style={styles.careAllowanceMeta}>nach bisher erfasstem Verbrauch</Text>
            </View>
            <Text style={styles.careAllowanceAmount}>
              {formatCurrency(model.remainingCareAllowanceCents ?? 0, true)}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.period}>{model.periodLabel}</Text>
          <Text style={styles.expiry}>{model.expiryLabel}</Text>
        </View>
      </LinearGradient>

      <AppGlassModal
        visible={showInfo}
        title={model.title}
        subtitle={`${model.legalLabel} · verständlich erklärt`}
        onClose={() => setShowInfo(false)}
        footerActions={[{ title: 'Verstanden', variant: 'primary', onPress: () => setShowInfo(false) }]}
      >
        <View style={styles.modalBody}>
          {model.explanation.map((paragraph) => (
            <View key={paragraph} style={styles.explanationRow}>
              <View style={[styles.explanationDot, { backgroundColor: palette.accent }]} />
              <Text style={[styles.explanationText, { color: text.secondary }]}>{paragraph}</Text>
            </View>
          ))}
          <View style={styles.modalNumbers}>
            <Text style={[styles.modalNumberLabel, { color: text.secondary }]}>Gesamtpotenzial</Text>
            <Text style={[styles.modalNumber, { color: text.primary }]}>{formatCurrency(model.totalCents, true)}</Text>
            <Text style={[styles.modalNumberLabel, { color: text.secondary }]}>Noch mögliche Leistung</Text>
            <Text style={[styles.modalNumber, { color: text.primary }]}>
              {formatCurrency(model.availableCents, true)} · {formatHours(model.availableHours)}
            </Text>
          </View>
        </View>
      </AppGlassModal>
    </>
  );
}

export function ClientBudgetVisualCards({ models }: { models: ClientBudgetVisualModel[] }) {
  const { width } = useWindowDimensions();
  const compact = width < 980;
  if (models.length === 0) {
    return (
      <View style={styles.unavailable} accessibilityRole="alert">
        <Text style={styles.unavailableTitle}>Budgetdaten derzeit nicht verfügbar</Text>
        <Text style={styles.unavailableText}>
          Sobald geprüfte Budgetdaten vorliegen, werden sie hier angezeigt. Es werden keine
          Ersatzbeträge oder Beispielwerte berechnet.
        </Text>
      </View>
    );
  }
  const bookedModels = models.filter((model) => model.bookingState === 'booked');
  const opportunityModels = models.filter((model) => model.bookingState !== 'booked');
  return (
    <View style={styles.sections}>
      {bookedModels.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionKicker}>AKTUELL VEREINBART</Text>
            <Text style={styles.sectionTitle}>Gebuchte Leistungen</Text>
            <Text style={styles.sectionSubtitle}>Diese Leistungen sind für die Klient:in hinterlegt und können entsprechend der Vereinbarung genutzt werden.</Text>
          </View>
          <View style={[styles.grid, compact && styles.gridCompact]}>
            {bookedModels.map((model) => (
              <View key={model.id} style={[styles.cardSlot, compact && styles.cardSlotCompact]}>
                <BudgetVisualCard model={model} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {opportunityModels.length > 0 ? (
        <View style={[styles.section, styles.opportunitySection]}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionKicker, styles.opportunityKicker]}>ERWEITERUNGSMÖGLICHKEITEN</Text>
            <Text style={styles.sectionTitle}>Noch nicht gebuchte Leistungen</Text>
            <Text style={styles.sectionSubtitle}>Unverbindliche Vorschau: Diese zusätzlichen Möglichkeiten können im Beratungsgespräch erläutert und bei Zustimmung ergänzt werden.</Text>
          </View>
          <View style={[styles.grid, compact && styles.gridCompact]}>
            {opportunityModels.map((model) => (
              <View key={model.id} style={[styles.cardSlot, compact && styles.cardSlotCompact]}>
                <BudgetVisualCard model={model} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.xl },
  unavailable: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.26)',
    backgroundColor: 'rgba(8,31,65,0.82)',
  },
  unavailableTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '900' },
  unavailableText: { color: 'rgba(226,242,255,0.74)', fontSize: 13, lineHeight: 19 },
  section: { gap: spacing.md },
  opportunitySection: { padding: spacing.lg, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(246,200,95,0.24)', backgroundColor: 'rgba(246,200,95,0.04)' },
  sectionHeading: { gap: 3, maxWidth: 820 },
  sectionKicker: { color: '#65F2A7', fontSize: 11, lineHeight: 16, fontWeight: '900', letterSpacing: 1.2 },
  opportunityKicker: { color: '#FFD166' },
  sectionTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { color: 'rgba(226,242,255,0.70)', fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', gap: spacing.lg, width: '100%', alignItems: 'stretch' },
  gridCompact: { flexDirection: 'column' },
  cardSlot: { flex: 1, minWidth: 0 },
  cardSlotCompact: { width: '100%' },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.25)',
    padding: spacing.xl,
    minHeight: 430,
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 15 },
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    right: -90,
    top: -110,
  },
  bookingBadge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6, marginBottom: spacing.sm },
  bookingBadgeText: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.75 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1, gap: 4 },
  legalLabel: { color: 'rgba(186,230,253,0.78)', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  status: { color: 'rgba(226,242,255,0.72)', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  infoIcon: { fontSize: 19 },
  heroMetric: { alignItems: 'center', paddingVertical: spacing.xl, gap: 2 },
  heroAmount: { color: '#FFFFFF', fontSize: 38, lineHeight: 46, fontWeight: '900', letterSpacing: -1.4 },
  heroLabel: { color: 'rgba(226,242,255,0.70)', fontSize: 13, fontWeight: '700' },
  hours: { fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: spacing.xs },
  rate: { color: 'rgba(226,242,255,0.58)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  previewNotice: { marginBottom: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(246,200,95,0.28)', backgroundColor: 'rgba(246,200,95,0.08)', gap: 4 },
  previewNoticeTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  previewNoticeText: { color: 'rgba(226,242,255,0.72)', fontSize: 11, lineHeight: 17 },
  progressTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  progressSegment: { minWidth: 1, flexBasis: 0 },
  usedSegment: { backgroundColor: '#355070' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendText: { color: 'rgba(226,242,255,0.68)', fontSize: 11, fontWeight: '600' },
  careAllowancePanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(101,242,167,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(101,242,167,0.20)',
  },
  careAllowanceLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  careAllowanceMeta: { color: 'rgba(226,242,255,0.58)', fontSize: 10, marginTop: 3 },
  careAllowanceAmount: { color: '#65F2A7', fontSize: 20, fontWeight: '900' },
  footer: { marginTop: 'auto', paddingTop: spacing.lg, gap: 4 },
  period: { color: 'rgba(226,242,255,0.76)', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  expiry: { color: 'rgba(226,242,255,0.52)', fontSize: 11, lineHeight: 16 },
  modalBody: { gap: spacing.md },
  explanationRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  explanationDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },
  explanationText: { flex: 1, fontSize: typography.body.fontSize, lineHeight: 22 },
  modalNumbers: { padding: spacing.lg, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.08)', gap: 4 },
  modalNumberLabel: { fontSize: 11, fontWeight: '700', marginTop: spacing.xs },
  modalNumber: { fontSize: 18, fontWeight: '900' },
});
