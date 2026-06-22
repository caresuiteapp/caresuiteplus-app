import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  auroraGlass,
  useAuroraAdaptiveText,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useActiveGlassTokens,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { resolveLlganViewGlass } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

export type CollapsibleSidebarItemContext = {
  closeMenu: () => void;
};

export type CollapsibleSidebarSectionProps<T> = {
  title: string;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, context?: CollapsibleSidebarItemContext) => React.ReactNode;
  initialVisibleCount?: number;
  moreLabel?: string;
  titleStyle?: TextStyle;
  containerStyle?: ViewStyle;
  itemsContainerStyle?: ViewStyle;
  moreButtonStyle?: ViewStyle;
};

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** Sidebar section showing `initialVisibleCount` items with a Mehr dropdown for overflow. */
export function CollapsibleSidebarSection<T>({
  title,
  items,
  getItemKey,
  renderItem,
  initialVisibleCount = 2,
  moreLabel = 'Mehr',
  titleStyle,
  containerStyle,
  itemsContainerStyle,
  moreButtonStyle,
}: CollapsibleSidebarSectionProps<T>) {
  const text = useAuroraAdaptiveText();
  const { isPhone } = useDeviceClass();
  const { typography, isLight } = useLegacyTheme();
  const glass = useActiveGlassTokens();
  const auroraActive = useAuroraGlassActive();
  const formGlass = resolveLlganViewGlass('form', 'default');
  const lightFormModal = isLight && auroraActive;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const moreButtonRef = useRef<View>(null);

  const hasOverflow = items.length > initialVisibleCount;
  const visibleItems = useMemo(
    () => items.slice(0, initialVisibleCount),
    [initialVisibleCount, items],
  );
  const overflowItems = useMemo(
    () => (hasOverflow ? items.slice(initialVisibleCount) : []),
    [hasOverflow, initialVisibleCount, items],
  );

  const closeMenu = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (Platform.OS === 'web' && !isPhone) {
      moreButtonRef.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      });
      return;
    }
    setAnchor(null);
    setOpen(true);
  }, [isPhone]);

  const toggleMenu = useCallback(() => {
    if (open) {
      closeMenu();
      return;
    }
    openMenu();
  }, [closeMenu, open, openMenu]);

  const useWebOverlay = Platform.OS === 'web' && !isPhone;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: careSpacing.sm,
        },
        title: {
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        items: {
          gap: careSpacing.xs,
        },
        moreButton: {
          minHeight: 36,
          borderRadius: careRadius.capsule,
          borderWidth: 1,
          borderColor: isLight ? lightLiquidGlass.borderAccent : glass.border,
          backgroundColor: isLight ? lightLiquidGlass.chip : glass.chip,
          ...(isLight ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light) : webGlassBlur ?? {}),
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: careSpacing.xs,
          alignSelf: 'stretch',
        },
        moreButtonPressed: {
          opacity: 0.88,
          backgroundColor: isLight ? lightLiquidGlass.chipActive : glass.chipActive,
        },
        moreLabel: {
          ...typography.caption,
          color: text.secondary,
          fontWeight: '700',
        },
        chevron: {
          ...typography.caption,
          color: text.muted,
          fontWeight: '700',
        },
        dropdownItem: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isLight ? lightLiquidGlass.innerBorder : glass.innerBorder,
        },
        dropdownItemLast: {
          borderBottomWidth: 0,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: lightFormModal ? 'rgba(15, 27, 51, 0.16)' : 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: careSpacing.lg,
        },
        modalSheet: {
          width: '100%',
          maxWidth: 420,
          backgroundColor: lightFormModal ? formGlass.modal : isLight ? lightLiquidGlass.modal : glass.modal,
          borderRadius: careRadius.lg,
          padding: careSpacing.md,
          gap: careSpacing.sm,
          borderWidth: 1,
          borderColor: lightFormModal ? formGlass.borderWhite : isLight ? lightLiquidGlass.borderAccent : glass.borderStrong,
          overflow: 'hidden',
          ...(lightFormModal
            ? {
                ...lightLiquidGlassWebFx(formGlass.blurDesktop, formGlass.saturate),
                boxShadow: `${formGlass.shadow}, ${formGlass.shadowInset}`,
              }
            : isLight
              ? lightLiquidGlassWebFx(lightLiquidGlass.blur.heavy)
              : webGlassBlur ?? {}),
        },
        modalTitle: {
          ...typography.caption,
          color: text.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: careSpacing.xs,
        },
        modalClose: {
          alignSelf: 'center',
          paddingVertical: careSpacing.sm,
        },
        modalCloseText: {
          ...typography.bodyStrong,
          color: text.secondary,
          fontWeight: '700',
        },
        webDropdownPortal: {
          position: 'absolute',
          borderRadius: careRadius.lg,
          borderWidth: 1,
          borderColor: isLight ? lightLiquidGlass.borderAccent : glass.borderStrong,
          backgroundColor: isLight ? lightLiquidGlass.elevated : glass.elevated,
          overflow: 'hidden',
          ...(isLight ? lightLiquidGlassWebFx(lightLiquidGlass.blur.medium) : webGlassBlur ?? {}),
        },
      }),
    [formGlass, glass, isLight, lightFormModal, text.muted, text.secondary, typography.bodyStrong, typography.caption],
  );

  const renderOverflowList = (itemStyle?: ViewStyle) =>
    overflowItems.map((item, index) => (
      <View
        key={getItemKey(item)}
        style={[
          itemStyle,
          index === overflowItems.length - 1 ? styles.dropdownItemLast : null,
        ]}
      >
        {renderItem(item, { closeMenu })}
      </View>
    ));

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <View style={[styles.items, itemsContainerStyle]}>
        {visibleItems.map((item) => (
          <View key={getItemKey(item)}>{renderItem(item)}</View>
        ))}
      </View>

      {hasOverflow ? (
        <View ref={moreButtonRef} collapsable={false}>
          <Pressable
            onPress={toggleMenu}
            style={({ pressed }) => [
              styles.moreButton,
              moreButtonStyle,
              pressed ? styles.moreButtonPressed : null,
              webCursor,
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={moreLabel}
          >
            <Text style={styles.moreLabel}>{moreLabel}</Text>
            <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
          </Pressable>
        </View>
      ) : null}

      {useWebOverlay ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityRole="button">
            {anchor ? (
              <Pressable
                style={[
                  styles.webDropdownPortal,
                  {
                    top: anchor.y + anchor.height + careSpacing.xs,
                    left: anchor.x,
                    width: anchor.width,
                    minWidth: anchor.width,
                  },
                ]}
                onPress={(event) => event.stopPropagation()}
              >
                {renderOverflowList(styles.dropdownItem)}
              </Pressable>
            ) : null}
          </Pressable>
        </Modal>
      ) : (
        <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
          <Pressable style={styles.modalBackdrop} onPress={closeMenu}>
            <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>{title}</Text>
              {renderOverflowList()}
              <Pressable onPress={closeMenu} style={styles.modalClose} accessibilityRole="button">
                <Text style={styles.modalCloseText}>Schließen</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
