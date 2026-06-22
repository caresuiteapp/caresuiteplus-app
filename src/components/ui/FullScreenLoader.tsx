import { StyleSheet, View } from 'react-native';
import { SpaceBackground } from '@/design/components';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { LoadingState } from './StateViews';

type FullScreenLoaderProps = {
  message?: string;
};

/** Full-viewport loading shell — transparent on LLGAN root, dark space fallback otherwise. */
export function FullScreenLoader({ message }: FullScreenLoaderProps) {
  const shellHostsAurora = useShellHostsAurora();

  if (shellHostsAurora) {
    return (
      <View style={styles.transparentRoot}>
        <View style={styles.center}>
          <LoadingState message={message} />
        </View>
      </View>
    );
  }

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
  transparentRoot: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
