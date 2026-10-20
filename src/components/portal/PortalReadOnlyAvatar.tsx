import { useEffect, useState } from 'react';
import { PremiumAvatar } from '@/components/ui/PremiumAvatar';
import { resolveProfileAvatarDisplayUrl } from '@/lib/auth/profileAvatarUrl';
import type { ViewStyle } from 'react-native';

type PortalReadOnlyAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  avatarVersion?: string | null;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
};

/** Read-only portal avatar — resolves storage URLs, initials fallback when no photo. */
export function PortalReadOnlyAvatar({
  name,
  avatarUrl,
  avatarVersion,
  accentColor,
  size = 'lg',
  style,
}: PortalReadOnlyAvatarProps) {
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!avatarUrl?.trim()) {
      setResolvedUri(undefined);
      return;
    }

    let cancelled = false;
    void resolveProfileAvatarDisplayUrl(avatarUrl, avatarVersion).then((url) => {
      if (!cancelled) setResolvedUri(url);
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, avatarVersion]);

  return (
    <PremiumAvatar
      name={name}
      imageUri={resolvedUri}
      size={size}
      accentColor={accentColor}
      style={style}
    />
  );
}
