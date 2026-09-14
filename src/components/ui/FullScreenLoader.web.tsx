import { StyleSheet, View } from 'react-native';
import { LoadingState } from './StateViews';

/** Opaque light fallback, including before a page's theme has mounted. */
export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <View style={styles.root}>
      <LoadingState message={message} presentation="inline" />
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
    backgroundColor: '#F3F8FF',
  },
});
