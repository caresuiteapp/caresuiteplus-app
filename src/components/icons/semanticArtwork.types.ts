import type { TextProps, TextStyle } from 'react-native';

export type SemanticArtworkProps = TextProps & {
  /** Decorative slot size shared by Web and native. */
  webSize?: number;
  /** Optional tint shared by vector symbols on all platforms. */
  webColor?: TextStyle['color'];
};
