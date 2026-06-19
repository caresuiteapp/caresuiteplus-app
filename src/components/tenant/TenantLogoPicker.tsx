import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumButton } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import {
  EMPTY_TENANT_LOGO,
  TENANT_LOGO_ALLOWED_MIME_TYPES,
  type TenantLogoPending,
  type TenantLogoValue,
  validateTenantLogoFile,
} from '@/lib/tenant/tenantLogoService';
import { spacing, typography } from '@/theme';

const LOGO_WIDTH = 220;
const LOGO_HEIGHT = 120;

type Props = {
  companyName: string;
  value?: TenantLogoValue;
  onChange: (value: TenantLogoValue) => void;
  onPickingChange?: (picking: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  error?: string | null;
};

async function readPickedLogo(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<{ ok: true; data: TenantLogoPending } | { ok: false; error: string }> {
  const mimeType = asset.mimeType ?? '';
  const initialSize = asset.size ?? 0;
  const typeCheck = validateTenantLogoFile(mimeType, initialSize || 1);
  if (!typeCheck.ok) {
    return { ok: false, error: typeCheck.error };
  }

  if (!asset.uri) {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' };
  }

  try {
    const response = await fetch(asset.uri);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sizeBytes = initialSize || bytes.length;
    const sizeCheck = validateTenantLogoFile(mimeType, sizeBytes);
    if (!sizeCheck.ok) {
      return { ok: false, error: sizeCheck.error };
    }

    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }

    const ext =
      typeCheck.data === 'image/jpeg'
        ? 'jpg'
        : typeCheck.data === 'image/png'
          ? 'png'
          : typeCheck.data === 'image/webp'
            ? 'webp'
            : 'svg';

    return {
      ok: true,
      data: {
        localUri: asset.uri,
        fileName: asset.name ?? `logo.${ext}`,
        mimeType: typeCheck.data,
        sizeBytes,
        contentBase64: btoa(binary),
      },
    };
  } catch {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' };
  }
}

export function TenantLogoPicker({
  companyName,
  value = EMPTY_TENANT_LOGO,
  onChange,
  onPickingChange,
  disabled = false,
  style,
  error,
}: Props) {
  const { colors } = useLegacyTheme();
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const fallbackLabel = useMemo(() => {
    const trimmed = companyName.trim();
    if (!trimmed) return 'Logo';
    return trimmed.length > 18 ? `${trimmed.slice(0, 16)}…` : trimmed;
  }, [companyName]);

  const imageUri = value.removed ? null : value.pending?.localUri ?? value.displayUri;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: 'center', gap: spacing.sm },
        label: { ...typography.label, color: colors.textPrimary, alignSelf: 'flex-start' },
        hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
        pressable: { borderRadius: spacing.sm },
        frame: {
          width: LOGO_WIDTH,
          height: LOGO_HEIGHT,
          borderRadius: spacing.sm,
          borderWidth: 2,
          borderColor: `${colors.orange}80`,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bgElevated,
        },
        image: {
          width: LOGO_WIDTH - 8,
          height: LOGO_HEIGHT - 8,
          resizeMode: 'contain',
        },
        fallback: {
          width: LOGO_WIDTH - 8,
          height: LOGO_HEIGHT - 8,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
        },
        fallbackText: {
          ...typography.body,
          color: colors.textMuted,
          textAlign: 'center',
        },
        overlayHint: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          paddingVertical: spacing.xs,
          alignItems: 'center',
        },
        overlayText: {
          ...typography.caption,
          color: '#fff',
          fontSize: 11,
        },
        error: { ...typography.caption, color: colors.error, textAlign: 'center' },
        removeBtn: { marginTop: spacing.xs },
      }),
    [colors],
  );

  const handlePick = async () => {
    if (disabled || picking) return;
    setPickError(null);
    setPicking(true);
    onPickingChange?.(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...TENANT_LOGO_ALLOWED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const read = await readPickedLogo(result.assets[0]);
      if (!read.ok) {
        setPickError(read.error);
        return;
      }

      onChange({
        displayUri: read.data.localUri,
        pending: read.data,
        removed: false,
      });
    } finally {
      setPicking(false);
      onPickingChange?.(false);
    }
  };

  const handleRemove = () => {
    setPickError(null);
    onChange({
      displayUri: null,
      pending: null,
      removed: true,
    });
  };

  const showRemove = Boolean(imageUri);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>Firmenlogo</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Logo hochladen"
        onPress={handlePick}
        disabled={disabled || picking}
        style={({ pressed }) => [styles.pressable, pressed ? { opacity: 0.85 } : null]}
      >
        <View style={styles.frame}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel="Firmenlogo" />
          ) : (
            <LinearGradient colors={['#252A35', '#1E2330']} style={styles.fallback}>
              <Text style={styles.fallbackText}>{fallbackLabel}</Text>
            </LinearGradient>
          )}
          {!disabled ? (
            <View style={styles.overlayHint} pointerEvents="none">
              <Text style={styles.overlayText}>
                {picking ? 'Lädt…' : 'Tippen zum Hochladen'}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Text style={styles.hint}>JPEG, PNG, SVG oder WebP · max. 5 MB</Text>
      {showRemove ? (
        <PremiumButton
          title="Logo entfernen"
          variant="ghost"
          size="sm"
          onPress={handleRemove}
          disabled={disabled || picking}
          style={styles.removeBtn}
        />
      ) : null}
      {pickError || error ? (
        <Text style={styles.error}>{pickError ?? error}</Text>
      ) : null}
    </View>
  );
}
