import type { TextProps, TextStyle } from 'react-native';

export type SemanticArtworkProps = TextProps & {
  /** Web-only decorative slot size. Native keeps the original Text rendering. */
  webSize?: number;
  /** Optional web-only tint for vector symbols; native Text styles stay unchanged. */
  webColor?: TextStyle['color'];
};
