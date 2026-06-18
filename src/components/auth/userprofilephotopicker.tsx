import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  USER_AVATAR_ALLOWED_MIME_TYPES,
  type UserAvatarPending,
  validateUserAvatarFile,
} from '@/lib/auth/useravatarservice';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';

type Size = 'sm' | 'md';

const SIZE_MAP: Record<Size, number> = {
  sm: 32,
  md: 56,
};

type Props = {
  initial: string;
  avatarUrl?: string | null;
  accentColor?: string;
  size?: Size;
  disabled?: boolean;
  onPick: (pending: UserAvatarPending) => Promise<boolean>;
  style?: ViewStyle;
  error?: string | null;
};

async function readPickedImage(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<{ ok: true; data: UserAvatarPending } | { ok: false; error: string }> {
  const mimeType = asset.mimeType ?? '';
  const initialSize = asset.size ?? 0;
  const typeCheck = validateUserAvatarFile(mimeType, initialSize || 1);
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
    const sizeCheck = validateUserAvatarFile(mimeType, sizeBytes);
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

export function UserProfilePhotoPicker({
  initial,
  avatarUrl,
  accentColor,
  size = 'md',
  disabled = false,
  onPick,
  style,
  error,
}: Props) {
  const { colors, typography, isDark } = useLegacyTheme();
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl?.trim()) {
      setPreviewUri(null);
    }
  }, [avatarUrl]);

  const dimension = SIZE_MAP[size];
  const resolvedAccent = accentColor ?? colors.violet;
  const imageUri = previewUri ?? (avatarUrl?.trim() || null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          borderRadius: dimension / 2,
        },
        avatar: {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(resolvedAccent, isDark ? 0.85 : 0.75),
          overflow: 'hidden',
        },
        image: {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
        avatarText: {
          fontSize: size === 'sm' ? 14 : 22,
          fontWeight: '800',
          color: '#FFFFFF',
        },
        overlayHint: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          paddingVertical: 2,
          alignItems: 'center',
        },
        overlayText: {
          ...typography.caption,
          color: '#fff',
          fontSize: 9,
        },
        error: {
          ...typography.caption,
          color: colors.error,
          marginTop: 4,
        },
      }),
    [colors, dimension, isDark, resolvedAccent, size, typography],
  );

  const handlePick = async () => {
    if (disabled || picking) return;
    setPickError(null);
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...USER_AVATAR_ALLOWED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const read = await readPickedImage(result.assets[0]);
      if (!read.ok) {
        setPickError(read.error);
        return;
      }

      setPreviewUri(read.data.localUri);
      const success = await onPick(read.data);
      if (!success) {
        setPreviewUri(null);
      }
    } catch {
      setPickError('Datei konnte nicht verarbeitet werden.');
      setPreviewUri(null);
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profilbild ändern"
        accessibilityHint="JPEG, PNG oder WebP, maximal 5 MB"
        onPress={handlePick}
        disabled={disabled || picking}
        style={({ pressed }) => [styles.pressable, pressed ? { opacity: 0.85 } : null]}
      >
        <View style={styles.avatar}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              accessibilityLabel="Profilbild"
            />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
          {!disabled ? (
            <View style={styles.overlayHint} pointerEvents="none">
              <Text style={styles.overlayText}>{picking ? 'Lädt…' : 'Ändern'}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {error || pickError ? (
        <Text style={styles.error}>{error ?? pickError}</Text>
      ) : null}
    </View>
  );
}
