import { StyleSheet, View } from 'react-native';
import { SpaceBackground } from '@/design/components';
import { LoadingState } from './StateViews';

type FullScreenLoaderProps = {
  message?: string;
};

/** Full-viewport loading shell — visible on web (never blank white). */
export function FullScreenLoader({ message }: FullScreenLoaderProps) {
  return (
    <SpaceBackground style={styles.root}>
      <View style={styles.center}>
        <LoadingState message={message} />
      </View>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
