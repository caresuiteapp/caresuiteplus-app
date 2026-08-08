import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CLIENT_ANIMAL_IMAGES } from '@/lib/clients/clientAnimalAssets';
import { resolveClientAnimalAvatar } from '@/lib/clients/clientAnimalAvatar';

type ClientAnimalAvatarProps = {
  clientId: string;
  clientName: string;
  imageUri?: string | null;
  size?: number;
  ringColor?: string;
  style?: ViewStyle;
};

export function ClientAnimalAvatar({
  clientId,
  clientName,
  imageUri,
  size = 48,
  ringColor = '#3597FF',
  style,
}: ClientAnimalAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const profile = useMemo(() => resolveClientAnimalAvatar(clientId), [clientId]);
  const normalizedImageUri = imageUri?.trim() || null;
  const showImage = Boolean(normalizedImageUri && !imageFailed);
  const ringWidth = Math.max(2, Math.round(size * 0.045));
  const innerSize = size - ringWidth * 2;
  const artworkSize = Math.round(innerSize * 0.84);

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImageUri]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={showImage
        ? `Profilfoto von ${clientName}`
        : `Tier-Profilbild von ${clientName}: ${profile.animal} in der Farbwelt ${profile.palette.label}`}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: ringColor,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: normalizedImageUri! }}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
        />
      ) : (
        <LinearGradient
          colors={[...profile.palette.colors]}
          start={{ x: 0.08, y: 0.05 }}
          end={{ x: 0.92, y: 1 }}
          style={[
            styles.portrait,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        >
          <View style={styles.highlight} />
          <Image
            source={CLIENT_ANIMAL_IMAGES[profile.speciesIndex]}
            resizeMode="contain"
            style={{ width: artworkSize, height: artworkSize }}
          />
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#071A33',
  },
  portrait: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: '-18%',
    left: '-8%',
    width: '78%',
    height: '58%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    transform: [{ rotate: '-18deg' }],
  },
});
