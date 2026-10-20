import { Image, StyleSheet, View } from 'react-native';

export function ClinicalBodyMapPreview() {
  return (
    <View
      accessible
      accessibilityLabel="Klinische BodyMap mit Vorderansicht, Rückansicht, Werkzeugen und Befundmarkern"
      style={styles.frame}
    >
      <Image
        resizeMode="contain"
        source={require('../../../assets/brand/clinical-bodymap-orbit-light-v1.png')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 327 / 418,
    overflow: 'hidden',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.16)',
    backgroundColor: '#F7FBFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
