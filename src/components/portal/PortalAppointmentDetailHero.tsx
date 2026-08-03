import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { portalPremium } from '@/design/tokens/portalPremium';

type PortalAppointmentDetailHeroProps = {
  appointment: PortalClientAppointmentDetail;
  scope: 'client' | 'employee';
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function durationMinutes(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function PortalAppointmentDetailHero({ appointment, scope }: PortalAppointmentDetailHeroProps) {
  const { isPhone } = useDeviceClass();
  const duration = durationMinutes(appointment.startsAt, appointment.endsAt);
  const scopeLabel = scope === 'client' ? 'KLIENT:INNENPORTAL' : 'MITARBEITERPORTAL';

  return (
    <PremiumListHeroFrame style={isPhone ? styles.framePhone : undefined}>
      <View style={[styles.topRow, isPhone && styles.topRowPhone]}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{scopeLabel} · IHR EINSATZ</Text>
          <Text style={styles.title}>{appointment.title}</Text>
          <Text style={styles.meta}>{appointment.serviceType}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📅</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[appointment.status]}
          variant={statusVariant(appointment.status)}
          dot
        />
      </View>
      <View style={[styles.kpiRow, isPhone && styles.kpiRowPhone]}>
        <PremiumKpiCard
          label="Datum"
          value={formatShortDate(appointment.startsAt)}
          subValue={`${formatTime(appointment.startsAt)} – ${formatTime(appointment.endsAt)}`}
          icon="🗓️"
          accentColor={portalPremium.accent.blue}
          style={isPhone ? styles.kpiItemPhone : styles.kpiItem}
        />
        <PremiumKpiCard
          label="Dauer"
          value={String(duration)}
          subValue={duration === 1 ? 'Minute' : 'Minuten'}
          icon="⏱️"
          accentColor={portalPremium.accent.violet}
          style={isPhone ? styles.kpiItemPhone : styles.kpiItem}
        />
        <PremiumKpiCard
          label={scope === 'client' ? 'Betreuungskraft' : 'Zuständig'}
          value={appointment.caregiverName ?? '—'}
          subValue={appointment.caregiverPhone ?? undefined}
          icon="👤"
          accentColor={portalPremium.accent.teal}
          style={isPhone ? styles.kpiItemPhone : styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const styles = StyleSheet.create({
  framePhone: {
    padding: careSpacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.md,
  },
  topRowPhone: {
    gap: careSpacing.sm,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eyebrow: {
    ...careTypography.caption,
    color: portalPremium.accent.blueDark,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  title: {
    ...careTypography.h2,
    color: portalPremium.text.primary,
    fontWeight: '900',
  },
  meta: {
    ...careTypography.bodyStrong,
    color: portalPremium.text.secondary,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: portalPremium.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    flexShrink: 0,
  },
  iconText: {
    fontSize: 23,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiRowPhone: {
    flexDirection: 'column',
  },
  kpiItem: {
    flex: 1,
    minWidth: 180,
  },
  kpiItemPhone: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    minWidth: 0,
  },
});
