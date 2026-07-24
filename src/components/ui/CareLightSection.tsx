import { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SectionPanel } from './SectionPanel';

type CareLightSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: ViewStyle;
};

export function CareLightSection({ title, subtitle, children, style }: CareLightSectionProps) {
  return (
    <View style={style}>
      <SectionPanel title={title} subtitle={subtitle} viewContext="dashboard">
        {children}
      </SectionPanel>
    </View>
  );
}
