import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CLIENT_ANIMAL_IMAGES } from '@/lib/clients/clientAnimalAssets';
import { resolveClientAnimalAvatar } from '@/lib/clients/clientAnimalAvatar';
import { useLiquidVisualMode } from '@/liquid-command/components/LiquidPrimitives';

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
  const orbit = useLiquidVisualMode() === 'orbit';
  const profile = useMemo(() => resolveClientAnimalAvatar(clientId), [clientId]);
  const normalizedImageUri = imageUri?.trim() || null;
  const showImage = Boolean(normalizedImageUri && !imageFailed);
  const ringWidth = orbit ? Math.max(1, Math.round(size * 0.025)) : Math.max(2, Math.round(size * 0.045));
  const innerSize = size - ringWidth * 2;
  const artworkSize = Math.round(innerSize * (orbit ? 0.74 : 0.84));

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
        orbit && styles.orbitRing,
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
          colors={orbit ? ['#F8FBFF', '#DCE9F7', '#C5D9EE'] : [...profile.palette.colors]}
          start={{ x: 0.12, y: 0.06 }}
          end={{ x: 0.88, y: 1 }}
          style={[
            styles.portrait,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        >
          {orbit ? <View style={styles.orbitHalo} /> : null}
          <View style={styles.highlight} />
          {orbit ? <View style={styles.portraitInset} /> : null}
          {orbit ? (
            <Image
              source={CLIENT_ANIMAL_IMAGES[profile.speciesIndex]}
              resizeMode="contain"
              style={[styles.animalArtworkShadow, { width: artworkSize, height: artworkSize }]}
            />
          ) : null}
          <Image
            source={CLIENT_ANIMAL_IMAGES[profile.speciesIndex]}
            resizeMode="contain"
            style={[orbit && styles.animalArtwork, { width: artworkSize, height: artworkSize }]}
          />
          {orbit ? <View style={styles.statusNode} /> : null}
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
  orbitRing: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B63F3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: 'rgba(255,255,255,0.62)',
    transform: [{ rotate: '-18deg' }],
  },
  orbitHalo: {
    position: 'absolute',
    right: '-28%',
    bottom: '-30%',
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  portraitInset: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
  },
  animalArtworkShadow: {
    position: 'absolute',
    tintColor: '#3B82F6',
    opacity: 0.18,
    transform: [{ translateX: 1 }, { translateY: 2 }, { scale: 1.06 }],
  },
  animalArtwork: {
    tintColor: '#0B2B4E',
  },
  statusNode: {
    position: 'absolute',
    right: '9%',
    bottom: '9%',
    width: '14%',
    height: '14%',
    minWidth: 6,
    minHeight: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#F8FBFF',
    backgroundColor: '#2DD4BF',
  },
});
