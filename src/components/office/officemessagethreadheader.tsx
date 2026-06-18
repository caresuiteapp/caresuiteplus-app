import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { galaxyGradients } from '@/design/tokens/galaxy';
import { glassFx, neonGlow } from '@/design/tokens/motion';
import { moduleColor } from '@/design/tokens/modules';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { OfficeMessageThreadDetail } from '@/types/office/messaging';
import {
  OFFICE_THREAD_STATUS_LABELS,
} from '@/lib/office/messagestatuslabels';
import {
  resolveOfficeThreadHeaderSubtitle,
  resolveOfficeThreadParticipantName,
} from '@/lib/office/officemessagemappers';

type OfficeMessageThreadHeaderProps = {
  detail: OfficeMessageThreadDetail | null;
};

export function OfficeMessageThreadHeader({ detail }: OfficeMessageThreadHeaderProps) {
  const { isDark, c } = useCareLightPalette();
  const officeAccent = moduleColor('office');
  const useHero = isDark;

  const participantLabel = resolveOfficeThreadParticipantName(detail);
  const statusLabel = detail
    ? OFFICE_THREAD_STATUS_LABELS[detail.status] ?? detail.status
    : 'Wird geladen…';
  const subtitle = resolveOfficeThreadHeaderSubtitle(detail, statusLabel);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        heroHeader: {
          overflow: 'hidden',
          borderBottomWidth: 0,
          ...Platform.select({
            web: neonGlow(officeAccent, 0.22, 20, 8) as object,
            default: {},
          }),
        },
        heroSheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
        },
        titleRow: {
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.sm,
        },
        title: {
          ...careTypography.h3,
          color: c.text,
        },
        heroTitle: {
          color: '#FFFFFF',
        },
        statusRow: {
          paddingHorizontal: careSpacing.md,
          paddingBottom: careSpacing.sm,
          borderTopWidth: useHero ? 0 : 1,
          borderTopColor: `${c.border}CC`,
        },
        statusText: {
          ...careTypography.caption,
          color: c.muted,
          lineHeight: 18,
        },
        heroStatusText: {
          color: 'rgba(255,255,255,0.82)',
        },
      }),
    [c, officeAccent, useHero],
  );

  const titleBlock = (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.title, useHero && styles.heroTitle]} numberOfLines={1}>
          {participantLabel}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, useHero && styles.heroStatusText]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </>
  );

  if (useHero) {
    return (
      <View style={[styles.header, styles.heroHeader]}>
        <LinearGradient
          colors={[...galaxyGradients.dashboardHero]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={glassFx.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={styles.heroSheen}
          pointerEvents="none"
        />
        {titleBlock}
      </View>
    );
  }

  return <View style={styles.header}>{titleBlock}</View>;
}
