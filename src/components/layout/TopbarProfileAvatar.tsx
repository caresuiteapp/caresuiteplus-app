import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { PremiumAvatar } from '@/components/ui/PremiumAvatar';
import { useAuth } from '@/lib/auth/context';
import { pickUserAvatarFile } from '@/lib/auth/pickUserAvatarFile';
import { saveUserProfileAvatar } from '@/lib/auth/useravatarservice';

type TopbarProfileAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  accentColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null;

function showUploadError(message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }
  Alert.alert('Profilbild', message);
}

export function TopbarProfileAvatar({
  name,
  avatarUrl,
  accentColor,
  size = 'md',
  style,
}: TopbarProfileAvatarProps) {
  const { profile, session, updateProfile } = useAuth();
  const authUserId = session?.user.id ?? null;
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!avatarUrl?.trim()) {
      setPreviewUri(null);
    }
  }, [avatarUrl]);

  const canUpload = Boolean(profile?.tenantId && authUserId);
  const displayUri = previewUri ?? (avatarUrl?.trim() || undefined);
  const showOverlay = canUpload && (hovered || uploading);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          position: 'relative',
        },
        overlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.42)',
        },
        overlayText: {
          fontSize: 12,
          lineHeight: 14,
          color: '#FFFFFF',
          fontWeight: '700',
        },
      }),
    [],
  );

  const handlePress = async () => {
    if (!canUpload || uploading || !profile || !authUserId) return;

    const picked = await pickUserAvatarFile();
    if (!picked.ok) {
      if (!picked.cancelled) {
        showUploadError(picked.error);
      }
      return;
    }

    setPreviewUri(picked.data.localUri);
    setUploading(true);

    const result = await saveUserProfileAvatar(profile, authUserId, picked.data);
    setUploading(false);

    if (!result.ok) {
      setPreviewUri(null);
      showUploadError(result.error);
      return;
    }

    updateProfile(result.data);
  };

  return (
    <Pressable
      onPress={() => void handlePress()}
      disabled={!canUpload || uploading}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel="Profilbild ändern"
      accessibilityHint="JPEG, PNG oder WebP, maximal 5 MB"
      accessibilityState={{ disabled: !canUpload || uploading, busy: uploading }}
      style={({ pressed }) => [
        styles.root,
        style,
        webCursor,
        canUpload && pressed ? { opacity: 0.88 } : null,
        !canUpload ? { opacity: 1 } : null,
      ]}
    >
      <PremiumAvatar
        name={name}
        imageUri={displayUri}
        size={size}
        accentColor={accentColor}
      />
      {showOverlay ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>{uploading ? '…' : '📷'}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
