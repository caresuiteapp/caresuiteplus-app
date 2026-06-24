import { FlatList, ScrollView, SectionList } from 'react-native';

const INVISIBLE_SCROLL_PROPS = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const;

type ScrollPrimitiveWithDefaults = {
  defaultProps?: Record<string, unknown>;
};

function patchScrollDefaults(component: ScrollPrimitiveWithDefaults): void {
  component.defaultProps = {
    ...component.defaultProps,
    ...INVISIBLE_SCROLL_PROPS,
  };
}

/** Hide native scroll indicators app-wide; scrolling remains enabled. */
export function applyInvisibleScrollIndicators(): void {
  patchScrollDefaults(ScrollView as unknown as ScrollPrimitiveWithDefaults);
  patchScrollDefaults(FlatList as unknown as ScrollPrimitiveWithDefaults);
  patchScrollDefaults(SectionList as unknown as ScrollPrimitiveWithDefaults);
}
