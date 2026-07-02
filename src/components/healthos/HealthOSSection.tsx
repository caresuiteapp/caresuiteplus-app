import type { ReactNode } from 'react';
import { SectionPanel } from '@/components/ui/SectionPanel';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accentColor?: string;
  headerAlign?: 'left' | 'center';
};

/** HealthOS section — thin wrapper over SectionPanel (no workflow coupling). */
export function HealthOSSection({
  title,
  subtitle,
  children,
  accentColor,
  headerAlign = 'left',
}: Props) {
  return (
    <SectionPanel
      title={title}
      subtitle={subtitle}
      accentColor={accentColor}
      headerAlign={headerAlign}
      viewContext="dashboard"
    >
      {children}
    </SectionPanel>
  );
}
