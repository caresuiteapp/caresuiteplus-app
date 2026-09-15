import 'react-native';

// React Native Web forwards dataSet entries to DOM data-* attributes.
// Native components ignore this optional web-only prop.
declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string | number | boolean | null | undefined>;
  }
}
