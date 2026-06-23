import type { ReactNode } from 'react';

import {
  PlatformModal,
  type PlatformModalAction,
  type PlatformModalProps,
  type PlatformModalVariant,
} from './platformmodal';

export type CarePopupShellProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  subtitle?: string;
  onBack?: () => void;
  headerActions?: ReactNode;
  footerActions?: PlatformModalAction[];
  variant?: PlatformModalVariant;
  maxWidth?: number;
  minWidth?: number;
  maxHeightRatio?: number;
  glowColor?: string;
  dismissOnBackdrop?: boolean;
  bodyStyle?: PlatformModalProps['bodyStyle'];
  sheetStyle?: PlatformModalProps['sheetStyle'];
  lockBodyScroll?: boolean;
  animationType?: PlatformModalProps['animationType'];
};

/**
 * Canonical CareSuite+ popup shell — gradient header, circular close, pill tabs via
 * `CarePopupTabPills`, scrollable body, optional footer actions.
 *
 * Wraps `PlatformModal` so all module modals inherit the Benachrichtigungen design.
 */
export function CarePopupShell({
  visible,
  title,
  onClose,
  children,
  subtitle,
  onBack,
  headerActions,
  footerActions,
  variant = 'center',
  maxWidth,
  minWidth,
  maxHeightRatio,
  glowColor,
  dismissOnBackdrop,
  bodyStyle,
  sheetStyle,
  lockBodyScroll,
  animationType,
}: CarePopupShellProps) {
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
      minWidth={minWidth}
      maxHeightRatio={maxHeightRatio}
      glowColor={glowColor}
      dismissOnBackdrop={dismissOnBackdrop}
      bodyStyle={bodyStyle}
      sheetStyle={sheetStyle}
      lockBodyScroll={lockBodyScroll}
      animationType={animationType}
    >
      {children}
    </PlatformModal>
  );
}
