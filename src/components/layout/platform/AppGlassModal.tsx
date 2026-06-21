import type { ReactNode } from 'react';
import { moduleColor } from '@/design/tokens/modules';
import {
  PlatformModal,
  type PlatformModalAction,
  type PlatformModalVariant,
} from './platformmodal';

export type AppGlassModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  footerActions?: PlatformModalAction[];
  variant?: PlatformModalVariant;
  maxWidth?: number;
  moduleKey?: 'office' | 'assist' | 'portal' | 'admin';
  headerActions?: ReactNode;
};

/** Unified glass modal shell for record section edits and Office dialogs. */
export function AppGlassModal({
  visible,
  title,
  subtitle,
  onClose,
  onBack,
  children,
  footerActions,
  variant = 'center',
  maxWidth = 720,
  moduleKey = 'office',
  headerActions,
}: AppGlassModalProps) {
  return (
    <PlatformModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onBack={onBack}
      headerActions={headerActions}
      footerActions={footerActions}
      variant={variant}
      maxWidth={maxWidth}
      maxHeightRatio={0.92}
      glowColor={moduleColor(moduleKey)}
    >
      {children}
    </PlatformModal>
  );
}
