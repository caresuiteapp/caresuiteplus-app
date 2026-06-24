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
  EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES,
  type EmployeeAvatarPending,
  validateEmployeeAvatarFile,
} from '@/lib/office/employeeAvatarService';
import type { EmployeeProfilePhotoValue } from '@/types/forms/employeeForm';
import { spacing, typography } from '@/theme';

const AVATAR_SIZE = 140;

type Props = {
  firstName: string;
  lastName: string;
  value: EmployeeProfilePhotoValue;
  onChange: (value: EmployeeProfilePhotoValue) => void;
  disabled?: boolean;
  style?: ViewStyle;
  error?: string | null;
};

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim()[0] ?? '';
  const last = lastName.trim()[0] ?? '';
  const combined = `${first}${last}`.toUpperCase();
  return combined || '?';
}

async function readPickedImage(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<{ ok: true; data: EmployeeAvatarPending } | { ok: false; error: string }> {
  const mimeType = asset.mimeType ?? '';
  const initialSize = asset.size ?? 0;
  const typeCheck = validateEmployeeAvatarFile(mimeType, initialSize || 1);
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
    const sizeCheck = validateEmployeeAvatarFile(mimeType, sizeBytes);
    if (!sizeCheck.ok) {
      return { ok: false, error: sizeCheck.error };
    }

    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }

    return {
      ok: true,
      data: {
        localUri: asset.uri,
        fileName: asset.name ?? `avatar.${typeCheck.data === 'image/png' ? 'png' : 'jpg'}`,
        mimeType: typeCheck.data,
        sizeBytes,
        contentBase64: btoa(binary),
      },
    };
  } catch {
    return { ok: false, error: 'Datei konnte nicht gelesen werden.' };
  }
}

export function EmployeeProfilePhotoPicker({
  firstName,
  lastName,
  value,
  onChange,
  disabled = false,
  style,
  error,
}: Props) {
  const { colors } = useLegacyTheme();
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const initials = useMemo(() => getInitials(firstName, lastName), [firstName, lastName]);
  const imageUri = value.removed ? null : value.pending?.localUri ?? value.displayUri;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: 'center', gap: spacing.sm },
        label: { ...typography.label, color: colors.textPrimary },
        hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
        pressable: { borderRadius: AVATAR_SIZE / 2 },
        ring: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          borderWidth: 3,
          borderColor: `${colors.orange}80`,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        image: {
          width: AVATAR_SIZE - 6,
          height: AVATAR_SIZE - 6,
          borderRadius: (AVATAR_SIZE - 6) / 2,
        },
        fallback: {
          width: AVATAR_SIZE - 6,
          height: AVATAR_SIZE - 6,
          borderRadius: (AVATAR_SIZE - 6) / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        initials: {
          ...typography.h2,
          color: colors.textPrimary,
          fontSize: 40,
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
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...EMPLOYEE_AVATAR_ALLOWED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const read = await readPickedImage(result.assets[0]);
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
      <Text style={styles.label}>Profilbild</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profilbild ändern"
        onPress={handlePick}
        disabled={disabled || picking}
        style={({ pressed }) => [styles.pressable, pressed ? { opacity: 0.85 } : null]}
      >
        <View style={styles.ring}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel="Profilbild" />
          ) : (
            <LinearGradient colors={['#252A35', '#1E2330']} style={styles.fallback}>
              <Text style={styles.initials}>{initials}</Text>
            </LinearGradient>
          )}
          {!disabled ? (
            <View style={styles.overlayHint} pointerEvents="none">
              <Text style={styles.overlayText}>{picking ? 'Lädt…' : 'Tippen zum Ändern'}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Text style={styles.hint}>JPEG, PNG oder WebP · max. 5 MB</Text>
      {showRemove ? (
        <PremiumButton
          title="Bild entfernen"
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
