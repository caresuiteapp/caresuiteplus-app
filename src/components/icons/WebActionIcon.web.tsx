import type { CSSProperties, ReactNode } from 'react';

/** Sizes describe the control's role; large module artwork has its own renderer. */
export const WEB_ACTION_ICON_SIZES = {
  compact: 16,
  action: 20,
  navigation: 24,
  state: 32,
} as const;

export type WebActionIconProps = {
  children: ReactNode;
  size?: number | keyof typeof WEB_ACTION_ICON_SIZES;
  className?: string;
  style?: CSSProperties;
};

/** Decorative vector icon. The surrounding button, link or text supplies its name. */
export function WebActionIcon({ children, size = 'action', className, style }: WebActionIconProps) {
  const pixels = typeof size === 'number' && Number.isFinite(size) && size > 0
    ? size
    : WEB_ACTION_ICON_SIZES[typeof size === 'string' ? size : 'action'];
  const dimension = `var(--cs-action-icon-size, ${pixels}px)`;

  return <svg
    data-cs-icon="action"
    aria-hidden="true"
    focusable="false"
    className={className}
    width={pixels}
    height={pixels}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style, width: dimension, height: dimension,
      aspectRatio: '1 / 1', flexShrink: 0, strokeWidth: 1.8 }}
  >{children}</svg>;
}
