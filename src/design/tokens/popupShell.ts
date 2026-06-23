import { careRadius } from './radius';
import { careSpacing } from './spacing';
import { careTypography } from './typography';
import {
  popupShellLayout,
  resolvePopupShellColors,
  resolvePopupShellHeaderGradient,
  type PopupShellColorMode,
} from './popupShellTokens';

export {
  popupShellColors,
  popupShellHeaderGradientDark,
  popupShellHeaderGradientLight,
  popupShellLayout,
  resolvePopupShellColors,
  resolvePopupShellHeaderGradient,
  type PopupShellColorMode,
} from './popupShellTokens';

type PopupShellViewStyle = Record<string, unknown>;
type PopupShellTextStyle = Record<string, unknown>;

export function resolvePopupShellCloseButtonStyle(
  mode: PopupShellColorMode = 'light',
): PopupShellViewStyle {
  const { closeButton } = resolvePopupShellColors(mode);
  const size = popupShellLayout.closeButtonSize;
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: closeButton.border,
    backgroundColor: closeButton.background,
  };
}

export function resolvePopupShellCloseIconStyle(
  mode: PopupShellColorMode = 'light',
): PopupShellTextStyle {
  const { closeButton } = resolvePopupShellColors(mode);
  return {
    ...careTypography.bodyStrong,
    fontSize: 20,
    lineHeight: 22,
    color: closeButton.icon,
  };
}

export function resolvePopupShellTitleStyle(
  mode: PopupShellColorMode = 'light',
): PopupShellTextStyle {
  return {
    ...careTypography.h3,
    fontWeight: '700',
    color: resolvePopupShellColors(mode).headerTitle,
  };
}

export function resolvePopupShellContainerShadow(
  mode: PopupShellColorMode = 'light',
): PopupShellViewStyle | undefined {
  if (typeof document === 'undefined') return undefined;
  return {
    boxShadow:
      mode === 'light' ? popupShellLayout.shadowWebLight : popupShellLayout.shadowWebDark,
  };
}

export function resolvePopupShellHeaderGlow(
  mode: PopupShellColorMode = 'light',
): PopupShellViewStyle | undefined {
  if (typeof document === 'undefined') return undefined;
  return {
    boxShadow:
      mode === 'light' ? popupShellLayout.headerGlowWebLight : popupShellLayout.headerGlowWebDark,
  };
}

export function resolvePopupShellTabRowStyle(): PopupShellViewStyle {
  return {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    marginBottom: careSpacing.md,
  };
}

export function resolvePopupShellTabStyle(
  active: boolean,
  mode: PopupShellColorMode = 'light',
): PopupShellViewStyle {
  const tab = resolvePopupShellColors(mode).tab;
  return {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    borderColor: active ? tab.activeBorder : tab.inactiveBorder,
    backgroundColor: active ? tab.activeBackground : tab.inactiveBackground,
  };
}

export function resolvePopupShellTabTextStyle(
  active: boolean,
  mode: PopupShellColorMode = 'light',
): PopupShellTextStyle {
  const tab = resolvePopupShellColors(mode).tab;
  return {
    ...careTypography.caption,
    fontWeight: '600',
    color: active ? tab.activeText : tab.inactiveText,
  };
}
