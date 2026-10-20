import { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SuccessState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrim } from '@/design/tokens/lightTheme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { OfficeMessage } from '@/types/office/messaging';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { confirmAction } from '@/lib/platform/confirmAction';
import {
  archiveOfficeMessage,
  hardDeleteOfficeMessage,
} from '@/lib/office/messagelifecycle';

type OfficeMessageActionsMenuProps = {
  message: OfficeMessage;
  disabled?: boolean;
  onChanged?: () => void;
  children: ReactNode;
};

type MenuAction = 'archive' | 'delete';

export function OfficeMessageActionsMenu({
  message,
  disabled = false,
  onChanged,
  children,
}: OfficeMessageActionsMenuProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check } = usePermissions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canArchive = can('office.messages.archive');
  const canDelete = can('office.messages.delete');
  const actionable = !disabled && !message.isSystemMessage && (canArchive || canDelete);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: careSuiteModalScrim,
          justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
          alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
          padding: spacing.lg,
        },
        sheet: {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.xs,
          minWidth: Platform.OS === 'web' ? 280 : undefined,
          borderWidth: 1,
          borderColor: c.border,
        },
        title: { ...typography.caption, color: c.muted, marginBottom: spacing.xs },
        item: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.md,
        },
        itemPressed: { backgroundColor: c.surfaceAlt },
        itemDanger: { color: '#c0392b' },
        itemText: { ...typography.body, color: c.text },
        itemDisabled: { opacity: 0.45 },
        cancel: {
          marginTop: spacing.sm,
          paddingVertical: spacing.sm,
          alignItems: 'center',
        },
        cancelText: { ...typography.body, color: c.muted },
        feedbackWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
        errorText: { ...typography.caption, color: '#c0392b', paddingHorizontal: spacing.md },
        triggerRow: {
          flexDirection: 'row',
          justifyContent: message.senderType === 'office_profile' ? 'flex-end' : 'flex-start',
          paddingHorizontal: spacing.lg,
          marginTop: -4,
          marginBottom: spacing.xs,
        },
        trigger: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: radius.capsule,
        },
        triggerText: { ...typography.caption, color: c.muted, fontWeight: '700' },
      }),
    [c, message.senderType, typography],
  );

  function openMenu() {
    if (!actionable || loading) return;
    setError(null);
    setOpen(true);
  }

  function closeMenu() {
    if (loading) return;
    setOpen(false);
  }

  async function runAction(action: MenuAction) {
    if (!tenantId) {
      setError('Kein Mandant verfügbar.');
      closeMenu();
      return;
    }

    if (action === 'archive' && !canArchive) {
      setError(check('office.messages.archive').reason ?? 'Keine Berechtigung.');
      closeMenu();
      return;
    }

    if (action === 'delete' && !canDelete) {
      setError(check('office.messages.delete').reason ?? 'Keine Berechtigung.');
      closeMenu();
      return;
    }

    if (action === 'delete') {
      const confirmed = await confirmAction({
        title: 'Nachricht vollständig löschen?',
        message: 'Nachricht wird für alle Teilnehmer unwiderruflich gelöscht.',
        confirmLabel: 'Vollständig löschen',
        cancelLabel: 'Abbrechen',
      });
      if (!confirmed) {
        closeMenu();
        return;
      }
    }

    setLoading(true);
    setError(null);

    const result =
      action === 'archive'
        ? await archiveOfficeMessage(
            tenantId,
            message.id,
            profile?.roleKey,
            profile?.id,
            profile?.displayName,
          )
        : await hardDeleteOfficeMessage(
            tenantId,
            message.id,
            profile?.roleKey,
            profile?.id,
            profile?.displayName,
          );

    setLoading(false);
    closeMenu();

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFeedback(action === 'archive' ? 'Nachricht archiviert.' : 'Nachricht vollständig gelöscht.');
    onChanged?.();
    setTimeout(() => setFeedback(null), 2500);
  }

  return (
    <>
      {feedback ? (
        <View style={styles.feedbackWrap}>
          <SuccessState message={feedback} />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable
        disabled={!actionable}
        onLongPress={openMenu}
        delayLongPress={450}
        {...(Platform.OS === 'web'
          ? {
              onContextMenu: (event: GestureResponderEvent & { preventDefault?: () => void }) => {
                if (!actionable) return;
                event.preventDefault?.();
                openMenu();
              },
            }
          : {})}
        accessibilityRole="button"
        accessibilityLabel="Nachrichtenaktionen"
      >
        {children}
      </Pressable>
      {actionable ? (
        <View style={styles.triggerRow}>
          <Pressable
            style={styles.trigger}
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="Nachricht verwalten"
          >
            <Text style={styles.triggerText}>••• Verwalten</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityRole="button">
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Nachricht</Text>
            {canArchive ? (
              <Pressable
                style={({ pressed }) => [styles.item, pressed ? styles.itemPressed : null]}
                onPress={() => void runAction('archive')}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={styles.itemText}>Archivieren</Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                style={({ pressed }) => [
                  styles.item,
                  pressed ? styles.itemPressed : null,
                  loading ? styles.itemDisabled : null,
                ]}
                onPress={() => void runAction('delete')}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={[styles.itemText, styles.itemDanger]}>Vollständig löschen</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.cancel} onPress={closeMenu} accessibilityRole="button">
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
