import type { TextProps } from 'react-native';

export type SemanticIconLabelProps = Omit<TextProps, 'children'> & {
  symbol: string;
  label: string;
  webSize?: number;
};
