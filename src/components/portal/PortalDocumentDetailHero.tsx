import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid, type KpiGridItem } from '@/components/adaptive';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { formatOfficeDocumentSizeDisplay } from '@/lib/office/officeDocumentDisplay';
import { isDemoMode } from '@/lib/supabase/config';
import { useDeviceClass } from '@/hooks/useDeviceClass';

import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import type { PortalDocumentDetail } from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalDocumentDetailHeroProps = {
  document: PortalDocumentDetail;
  scope: 'client' | 'employee';
};

function formatShortDate(iso: string, compact = false): string {
  if (compact) {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
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

function mimeLabel(mimeType: string, compact = false): string {
  if (mimeType.includes('html')) return compact ? 'HTML' : 'HTML-Dokument';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return compact ? 'Word' : 'Word-Dokument';
  if (mimeType.includes('image')) return 'Bild';
  return mimeType.split('/').pop()?.toUpperCase() ?? mimeType;
}

function downloadSubLabel(downloadReady: boolean, viewReady: boolean): string | undefined {
  if (downloadReady) return isDemoMode() ? 'Demo-Download' : undefined;
  if (viewReady) return 'Dokument im Portal lesbar';
  return 'Derzeit nicht verfügbar';
}

function downloadValue(downloadReady: boolean, viewReady: boolean): string {
  if (downloadReady) return 'Bereit';
  if (viewReady) return 'Im Portal';
  return '—';
}

export function PortalDocumentDetailHero({ document, scope }: PortalDocumentDetailHeroProps) {
  const { colors } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const { isPhone } = useDeviceClass();
  const compact = isPhone;
  const labelCase = compact ? 'normal' : 'uppercase';

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
          minWidth: 0,
        },
        eyebrow: heroText.eyebrow,
        title: heroText.title,
        meta: {
          ...heroText.meta,
          fontWeight: '600',
        },
        subtitle: heroText.subtitle,
        iconBadge: {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(98,243,255,0.35)',
          flexShrink: 0,
        },
        iconText: {
          fontSize: 22,
        },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
      }),
    [colors, heroText.meta, heroText.subtitle, heroText.title],
  );

  const kpiItems = useMemo((): KpiGridItem[] => {
    const sizeValue =
      formatOfficeDocumentSizeDisplay(document.sizeLabel, document.fileSizeBytes) ?? '—';
    const updatedLabel = compact ? 'Stand' : 'Aktualisiert';

    return [
      {
        id: 'size',
        node: (
          <PremiumKpiCard
            label="Größe"
            value={sizeValue}
            icon="💾"
            accentColor={colors.violet}
            labelCase={labelCase}
            valueLines={2}
          />
        ),
      },
      {
        id: 'updated',
        node: (
          <PremiumKpiCard
            label={updatedLabel}
            value={formatShortDate(document.updatedAt, compact)}
            icon="📅"
            accentColor={colors.cyan}
            labelCase={labelCase}
            valueLines={2}
          />
        ),
      },
      {
        id: 'type',
        node: (
          <PremiumKpiCard
            label="Typ"
            value={mimeLabel(document.mimeType, compact)}
            subValue={scope === 'employee' ? document.mimeType : undefined}
            icon="📎"
            accentColor={colors.orange}
            labelCase={labelCase}
            valueLines={2}
          />
        ),
      },
      {
        id: 'download',
        node: (
          <PremiumKpiCard
            label="Download"
            value={downloadValue(document.downloadReady, document.viewReady)}
            subValue={downloadSubLabel(document.downloadReady, document.viewReady)}
            icon={document.downloadReady || document.viewReady ? '⬇️' : '🔒'}
            accentColor={
              document.downloadReady || document.viewReady ? colors.success : colors.amber
            }
            labelCase={labelCase}
            valueLines={2}
          />
        ),
      },
    ];
  }, [colors, compact, document, labelCase, scope]);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{document.title}</Text>
          {document.displayFileName ? (
            <Text style={styles.meta}>{document.displayFileName}</Text>
          ) : null}
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
        {document.viewReady ? (
          <PremiumBadge label="Inhalt verfügbar" variant="green" />
        ) : document.downloadReady ? (
          <PremiumBadge label="Download bereit" variant="green" />
        ) : (
          <PremiumBadge label="Inhalt ausstehend" variant="orange" />
        )}
      </View>
      <AdaptiveKpiGrid
        columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
        items={kpiItems}
      />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
