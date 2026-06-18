import { View, type ViewStyle } from 'react-native';

type ShimmerProps = {
  style?: ViewStyle;
};

export function Shimmer({ style }: ShimmerProps) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
}
