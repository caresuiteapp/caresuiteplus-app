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
  const scope = JSON.stringify([avatarUrl, avatarVersion]);
  const [resolved, setResolved] = useState<{ scope: string; uri: string | undefined } | null>(null);

  useEffect(() => {
    if (!avatarUrl?.trim()) return;

    let cancelled = false;
    void resolveProfileAvatarDisplayUrl(avatarUrl, avatarVersion).then((url) => {
      if (!cancelled) setResolved({ scope, uri: url });
    }).catch(() => { if (!cancelled) setResolved(null); });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, avatarVersion, scope]);

  return (
    <PremiumAvatar
      name={name}
      imageUri={resolved?.scope === scope ? resolved.uri : undefined}
      size={size}
      accentColor={accentColor}
      style={style}
    />
  );
}
