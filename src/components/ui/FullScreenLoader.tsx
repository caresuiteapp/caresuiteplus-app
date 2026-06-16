import { StyleSheet, View } from 'react-native';
import { LoadingState } from './StateViews';

type FullScreenLoaderProps = {
  message?: string;
};

/** Full-viewport loading shell — avoids blank screens during auth redirects on web. */
export function FullScreenLoader({ message }: FullScreenLoaderProps) {
  return (
    <View style={styles.root}>
      <LoadingState message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
