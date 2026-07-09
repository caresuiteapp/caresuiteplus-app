import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { pickUserAvatarFile } from '@/lib/auth/pickUserAvatarFile';
import type { UserAvatarPending } from '@/lib/auth/useravatarservice';
import { careSuiteModalScrim } from '@/design/tokens/lightTheme';
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
          backgroundColor: careSuiteModalScrim,
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
      const picked = await pickUserAvatarFile();
      if (!picked.ok) {
        if (!picked.cancelled) {
          setPickError(picked.error);
        }
        return;
      }

      setPreviewUri(picked.data.localUri);
      const success = await onPick(picked.data);
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
