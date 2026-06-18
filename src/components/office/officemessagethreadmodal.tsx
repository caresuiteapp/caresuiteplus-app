import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GradientModalHeader } from '@/components/layout/platform';
import { OfficeMessageContextPanel } from '@/components/office/officemessagecontextpanel';
import { OfficeMessageThread } from '@/components/office/officemessagethread';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import { useOfficeMessageThreadDetail } from '@/hooks/useofficemessagethreaddetail';
import { OFFICE_THREAD_STATUS_LABELS } from '@/lib/office/messagestatuslabels';
import {
  resolveOfficeThreadHeaderSubtitle,
  resolveOfficeThreadParticipantName,
} from '@/lib/office/officemessagemappers';
import { spacing, radius } from '@/theme';

type OfficeMessageThreadModalProps = {
  visible: boolean;
  threadId: string | null;
  onClose: () => void;
  onThreadUpdated?: () => void;
  onNewThreadStarted?: (newThreadId: string) => void;
  readOnly?: boolean;
};

type ModalTab = 'chat' | 'context';

const MODAL_MAX_WIDTH = 1280;
const MODAL_MIN_WIDTH = 560;
const SIDE_BY_SIDE_BREAKPOINT = 900;
const CONTEXT_PANEL_WIDTH = 300;

export function OfficeMessageThreadModal({
  visible,
  threadId,
  onClose,
  onThreadUpdated,
  onNewThreadStarted,
  readOnly = false,
}: OfficeMessageThreadModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isDark, c } = useCareLightPalette();
  const officeAccent = moduleColor('office');
  const [tab, setTab] = useState<ModalTab>('chat');
  const showSideBySide = screenWidth >= SIDE_BY_SIDE_BREAKPOINT;

  const { detail, markAsRead, updateStatus, assignSelf, updatePriority, updateCategory, refresh } =
    useOfficeMessageThreadDetail(threadId);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setTab('chat');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && threadId) {
      void markAsRead();
    }
  }, [visible, threadId, markAsRead]);

  const sheetWidth = useMemo(
    () =>
      Math.min(
        screenWidth - spacing.md * 2,
        Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, screenWidth * 0.96)),
      ),
    [screenWidth],
  );

  const sheetMaxHeight = useMemo(
    () => Math.min(screenHeight * 0.94, screenHeight - spacing.md * 2),
    [screenHeight],
  );

  const handleThreadUpdated = () => {
    void refresh();
    onThreadUpdated?.();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: isDark ? 'rgba(4,8,24,0.72)' : 'rgba(7,18,42,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.md,
        },
        sheetHost: {
          width: sheetWidth,
          maxHeight: sheetMaxHeight,
          flex: 1,
          ...Platform.select({
            web: { boxShadow: '0 24px 64px rgba(0,0,0,0.35)' as unknown as undefined },
            default: {},
          }),
        },
        sheetInner: {
          flex: 1,
          minHeight: 0,
        },
        statusRow: {
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        statusText: { color: c.muted, fontSize: 13 },
        tabRow: {
          flexDirection: 'row',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        tabChip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        tabChipActive: { backgroundColor: `${c.violet}22`, borderColor: c.violet },
        tabText: { color: c.muted, fontWeight: '600', fontSize: 13 },
        tabTextActive: { color: c.violet },
        body: {
          flex: 1,
          minHeight: 0,
          flexDirection: showSideBySide ? 'row' : 'column',
        },
        threadPane: {
          flex: 1,
          minWidth: 0,
          minHeight: 0,
        },
        contextPane: {
          width: showSideBySide ? CONTEXT_PANEL_WIDTH : undefined,
          flex: showSideBySide ? undefined : 1,
          minHeight: 0,
          borderLeftWidth: showSideBySide ? 1 : 0,
          borderLeftColor: `${c.border}CC`,
        },
      }),
    [c.border, isDark, showSideBySide],
  );

  if (!threadId) return null;

  const participantLabel = resolveOfficeThreadParticipantName(detail ?? null);
  const statusLabel = detail
    ? OFFICE_THREAD_STATUS_LABELS[detail.status] ?? detail.status
    : 'Wird geladen…';
  const headerSubtitle = resolveOfficeThreadHeaderSubtitle(detail ?? null, statusLabel);

  const tabToggle = !showSideBySide ? (
    <View style={styles.tabRow}>
      <Pressable
        onPress={() => setTab('chat')}
        style={[styles.tabChip, tab === 'chat' && styles.tabChipActive]}
      >
        <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Chat</Text>
      </Pressable>
      <Pressable
        onPress={() => setTab('context')}
        style={[styles.tabChip, tab === 'context' && styles.tabChipActive]}
      >
        <Text style={[styles.tabText, tab === 'context' && styles.tabTextActive]}>Kontext</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface
            radius={careRadius.lg}
            glowColor={officeAccent}
            glowOpacity={isDark ? 0.22 : 0.12}
            elevated
            style={styles.sheetInner}
          >
            <GradientModalHeader title={participantLabel} onClose={onClose} />
            <View style={styles.statusRow}>
              <Text style={styles.statusText} numberOfLines={2}>
                {headerSubtitle}
              </Text>
            </View>
            {tabToggle}
            <View style={styles.body}>
              {showSideBySide || tab === 'chat' ? (
                <View style={styles.threadPane}>
                  <OfficeMessageThread
                    threadId={threadId}
                    hideHeader
                    onNewThreadStarted={(newThreadId) => {
                      onNewThreadStarted?.(newThreadId);
                      handleThreadUpdated();
                    }}
                  />
                </View>
              ) : null}
              {showSideBySide || tab === 'context' ? (
                <View style={styles.contextPane}>
                  <OfficeMessageContextPanel
                    thread={detail ?? null}
                    readOnly={readOnly}
                    sheet={!showSideBySide}
                    onThreadUpdated={handleThreadUpdated}
                    onUpdateStatus={async (status) => {
                      const result = await updateStatus(status);
                      onThreadUpdated?.();
                      return { ok: result.ok, error: result.ok ? undefined : result.error };
                    }}
                    onAssignSelf={async () => {
                      const result = await assignSelf();
                      onThreadUpdated?.();
                      return { ok: result.ok, error: result.ok ? undefined : result.error };
                    }}
                    onUpdatePriority={async (priority) => {
                      const result = await updatePriority(priority);
                      onThreadUpdated?.();
                      return { ok: result.ok, error: result.ok ? undefined : result.error };
                    }}
                    onUpdateCategory={async (categoryId) => {
                      const result = await updateCategory(categoryId);
                      onThreadUpdated?.();
                      return { ok: result.ok, error: result.ok ? undefined : result.error };
                    }}
                  />
                </View>
              ) : null}
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
