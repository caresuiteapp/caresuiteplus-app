import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { formatFileSize } from '@/lib/portal';

import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import type { PortalDocumentDetail } from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalDocumentDetailHeroProps = {
  document: PortalDocumentDetail;
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

function mimeLabel(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Word';
  if (mimeType.includes('image')) return 'Bild';
  return mimeType.split('/').pop()?.toUpperCase() ?? mimeType;
}

export function PortalDocumentDetailHero({ document, scope }: PortalDocumentDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const scopeLabel = scope === 'client' ? 'KLIENT:INNENPORTAL' : 'MITARBEITERPORTAL';

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{scopeLabel} · DOKUMENT</Text>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.meta}>{document.fileName}</Text>
          {document.description ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {document.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📄</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[document.status]}
          variant={statusVariant(document.status)}
          dot
        />
        <PremiumBadge
          label={PORTAL_DOCUMENT_CATEGORY_LABELS[document.category]}
          variant="muted"
        />
        <PremiumBadge label={VISIBILITY_LABELS[document.visibility]} variant="cyan" />
        <PremiumBadge
          label={SENSITIVITY_LABELS[document.sensitivity]}
          variant={document.sensitivity === 'restricted' ? 'red' : 'muted'}
        />
        {document.downloadReady ? (
          <PremiumBadge label="Download bereit" variant="green" />
        ) : (
          <PremiumBadge label="Download vorbereitet" variant="orange" />
        )}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Größe"
          value={formatFileSize(document.fileSizeBytes)}
          icon="💾"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Aktualisiert"
          value={formatShortDate(document.updatedAt)}
          icon="📅"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Typ"
          value={mimeLabel(document.mimeType)}
          subValue={scope === 'employee' ? document.mimeType : undefined}
          icon="📎"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Download"
          value={document.downloadReady ? 'Bereit' : '—'}
          subValue={document.downloadReady ? 'Demo-Download' : 'Derzeit nicht verfügbar'}
          icon={document.downloadReady ? '⬇️' : '🔒'}
          accentColor={document.downloadReady ? colors.success : colors.amber}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

