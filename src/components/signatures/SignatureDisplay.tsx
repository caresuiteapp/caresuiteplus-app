import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle } from 'react-native';
import {
  formatSignatureMetadataLine,
  pickSignatureImageUrl,
} from '@/lib/assist/visitSignatureImageService';
import {
  buildSignatureProofImageStyle,
  needsSignatureOrientationCorrection,
} from '@/lib/signatures/signatureOrientation';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

export type SignatureDisplayProps = {
  signatureDataUrl?: string | null;
  signatureImageUrl?: string | null;
  signerName?: string | null;
  signedAt?: string | null;
  signatureType?: string | null;
  label?: string;
  emptyText?: string;
  compact?: boolean;
  /** State C — signature not required in this context. */
  notRequired?: boolean;
  /** State D — capture refused / impossible with user-facing reason. */
  refusedReason?: string | null;
  /** State E — upstream image resolution failed. */
  imageLoadFailed?: boolean;
};

const DEFAULT_EMPTY = 'Keine gezeichnete Unterschrift gespeichert.';

export function SignatureDisplay({
  signatureDataUrl,
  signatureImageUrl,
  signerName,
  signedAt,
  signatureType,
  label = 'Unterschrift',
  emptyText = DEFAULT_EMPTY,
  compact = false,
  notRequired = false,
  refusedReason,
  imageLoadFailed = false,
}: SignatureDisplayProps) {
  const text = useAuroraAdaptiveText();
  const [imageError, setImageError] = useState(false);
  const [orientationCorrected, setOrientationCorrected] = useState(false);

  const imageUri = pickSignatureImageUrl(signatureImageUrl, signatureDataUrl);
  const metadataLine = formatSignatureMetadataLine({
    signerName,
    signedAt,
    signatureType,
  });
  const hasMetadata = Boolean(metadataLine);
  const showImage = Boolean(imageUri) && !imageError && !imageLoadFailed;

  useEffect(() => {
    setOrientationCorrected(false);
  }, [imageUri]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { gap: spacing.xs, marginTop: spacing.sm },
        label: {
          ...typography.caption,
          color: text.muted,
          fontWeight: '600',
        },
        image: {
          width: '100%',
          maxWidth: compact ? 240 : 320,
          height: compact ? 80 : 120,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.08)',
        },
        status: {
          ...typography.body,
          color: text.secondary,
        },
        meta: {
          ...typography.caption,
          color: text.muted,
          marginTop: 2,
        },
        empty: {
          ...typography.body,
          color: text.muted,
          fontStyle: 'italic',
        },
      }),
    [text, compact],
  );

  const correctedImageStyle = useMemo((): ImageStyle => {
    if (!orientationCorrected) return styles.image;
    const layout = buildSignatureProofImageStyle(100, 200);
    return {
      ...styles.image,
      maxWidth: layout.maxWidth,
      maxHeight: layout.maxHeight,
      transform: [{ rotate: '-90deg' }],
    };
  }, [orientationCorrected, styles.image]);

  let statusMessage: string | null = null;

  if (notRequired) {
    statusMessage = 'Unterschrift nicht erforderlich.';
  } else if (refusedReason?.trim()) {
    statusMessage = `Unterschrift nicht möglich: ${refusedReason.trim()}`;
  } else if (imageLoadFailed || imageError) {
    statusMessage = 'Signaturbild konnte nicht geladen werden.';
  } else if (!showImage && !hasMetadata) {
    statusMessage = emptyText;
  } else if (!showImage && hasMetadata) {
    statusMessage = emptyText;
  }

  return (
    <View style={styles.block} accessibilityRole="summary">
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {showImage ? (
        <Image
          source={{ uri: imageUri! }}
          style={correctedImageStyle}
          resizeMode="contain"
          accessibilityLabel={`Gezeichnete ${label}`}
          onError={() => setImageError(true)}
          onLoad={(event) => {
            const { width, height } = event.nativeEvent.source;
            setOrientationCorrected(needsSignatureOrientationCorrection(width, height));
          }}
        />
      ) : null}

      {statusMessage ? <Text style={styles.empty}>{statusMessage}</Text> : null}

      {hasMetadata ? <Text style={styles.meta}>{metadataLine}</Text> : null}
    </View>
  );
}
