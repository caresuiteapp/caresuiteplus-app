import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const morphology = useMemo(() => ({
    ear: profile.speciesIndex % 5,
    head: Math.floor(profile.speciesIndex / 5) % 5,
    marking: Math.floor(profile.speciesIndex / 25) % 4,
    eyes: Math.floor(profile.speciesIndex / 100) % 2,
  }), [profile.speciesIndex]);
  const earWidth = innerSize * ([0.25, 0.2, 0.29, 0.18, 0.32][morphology.ear] ?? 0.25);
  const earHeight = innerSize * ([0.34, 0.45, 0.25, 0.39, 0.22][morphology.ear] ?? 0.34);
  const headWidth = innerSize * ([0.68, 0.73, 0.64, 0.78, 0.7][morphology.head] ?? 0.68);
  const headHeight = innerSize * ([0.64, 0.7, 0.72, 0.61, 0.76][morphology.head] ?? 0.64);
  const eyeSize = Math.max(2, innerSize * (morphology.eyes === 0 ? 0.075 : 0.1));

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImageUri]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={showImage
        ? `Profilfoto von ${clientName}`
        : `Comic-Profilbild von ${clientName}: ${profile.animal} in der Farbwelt ${profile.palette.label}`}
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
          <View
            style={[
              styles.ear,
              {
                width: earWidth,
                height: earHeight,
                left: innerSize * 0.12,
                top: innerSize * 0.1,
                borderRadius: morphology.ear === 3 ? 3 : earWidth / 2,
                backgroundColor: profile.palette.colors[0],
              },
            ]}
          >
            <View style={[styles.innerEar, { backgroundColor: profile.palette.colors[1] }]} />
          </View>
          <View
            style={[
              styles.ear,
              {
                width: earWidth,
                height: earHeight,
                right: innerSize * 0.12,
                top: innerSize * 0.1,
                borderRadius: morphology.ear === 3 ? 3 : earWidth / 2,
                backgroundColor: profile.palette.colors[0],
              },
            ]}
          >
            <View style={[styles.innerEar, { backgroundColor: profile.palette.colors[1] }]} />
          </View>
          <View
            style={[
              styles.head,
              {
                width: headWidth,
                height: headHeight,
                borderRadius: morphology.head === 3 ? headWidth * 0.36 : headWidth / 2,
              },
            ]}
          >
            {morphology.marking === 0 ? (
              <View style={[styles.foreheadPatch, { backgroundColor: profile.palette.colors[1] }]} />
            ) : null}
            {morphology.marking === 1 ? (
              <View style={[styles.foreheadStripe, { backgroundColor: profile.palette.colors[0] }]} />
            ) : null}
            {morphology.marking === 2 ? (
              <>
                <View style={[styles.spot, styles.spotLeft, { backgroundColor: profile.palette.colors[1] }]} />
                <View style={[styles.spot, styles.spotRight, { backgroundColor: profile.palette.colors[1] }]} />
              </>
            ) : null}
            {morphology.marking === 3 ? (
              <View style={[styles.eyeMask, { backgroundColor: profile.palette.colors[0] }]} />
            ) : null}
            <View style={styles.eyesRow}>
              <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
              <View style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }]} />
            </View>
            <View style={[styles.muzzle, { width: headWidth * 0.42, height: headHeight * 0.29 }]}>
              <View style={[styles.nose, { width: eyeSize * 1.25, height: eyeSize * 0.82 }]} />
              <View style={styles.mouth} />
            </View>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    backgroundColor: '#071A33',
  },
  portrait: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  highlight: {
    position: 'absolute',
    top: '8%',
    left: '16%',
    width: '44%',
    height: '28%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    transform: [{ rotate: '-18deg' }],
  },
  ear: {
    position: 'absolute',
    alignItems: 'center',
    paddingTop: '18%',
  },
  innerEar: {
    width: '48%',
    height: '58%',
    borderRadius: 999,
    opacity: 0.68,
  },
  head: {
    position: 'absolute',
    bottom: '7%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF8EA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(4,25,52,0.20)',
  },
  foreheadPatch: {
    position: 'absolute',
    top: '-9%',
    width: '43%',
    height: '38%',
    borderRadius: 999,
    opacity: 0.75,
  },
  foreheadStripe: {
    position: 'absolute',
    top: '-4%',
    width: '17%',
    height: '42%',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.75,
  },
  spot: { position: 'absolute', width: '17%', height: '14%', borderRadius: 999, opacity: 0.75 },
  spotLeft: { top: '15%', left: '14%', transform: [{ rotate: '-20deg' }] },
  spotRight: { top: '10%', right: '17%', transform: [{ rotate: '24deg' }] },
  eyeMask: {
    position: 'absolute',
    top: '29%',
    width: '82%',
    height: '26%',
    borderRadius: 999,
    opacity: 0.7,
  },
  eyesRow: {
    position: 'absolute',
    top: '38%',
    width: '54%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eye: { backgroundColor: '#08213E', borderWidth: 1, borderColor: '#FFFFFF' },
  muzzle: {
    position: 'absolute',
    bottom: '9%',
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#F4DFC0',
  },
  nose: {
    marginTop: '10%',
    borderRadius: 999,
    backgroundColor: '#102742',
  },
  mouth: {
    width: '24%',
    height: '17%',
    borderBottomWidth: 1,
    borderColor: '#7A4C3C',
    borderRadius: 999,
  },
});
