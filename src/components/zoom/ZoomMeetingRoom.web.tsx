import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner, LoadingState, PremiumButton } from '@/components/ui';
import type { ZoomJoinContext } from '@/lib/zoom/zoomService';
import { colors, spacing, typography } from '@/theme';

type Props = {
  context: ZoomJoinContext;
  onLeave: () => void;
};

export function ZoomMeetingRoom({ context, onLeave }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<{ leaveMeeting: (userId?: number) => unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    async function start() {
      if (!rootRef.current) return;
      try {
        const module = await import('@zoom/meetingsdk/embedded');
        const client = module.default.createClient();
        clientRef.current = client;
        await client.init({
          zoomAppRoot: rootRef.current,
          language: 'de-DE',
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: {
                default: { width: 1080, height: 620 },
                ribbon: { width: 360, height: 160 },
              },
            },
          },
        });
        await client.join({
          sdkKey: context.sdkKey,
          signature: context.signature,
          meetingNumber: context.meetingNumber,
          password: context.passcode,
          userName: context.userName,
          userEmail: context.userEmail,
          zak: context.zak,
        });
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Das Zoom-Meeting konnte nicht gestartet werden.');
        }
      } finally {
        if (active) setStarting(false);
      }
    }
    void start();
    return () => {
      active = false;
      try {
        clientRef.current?.leaveMeeting();
      } catch {
        // Meeting ist beim Unmount möglicherweise bereits beendet.
      }
    };
  }, [context]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GESCHÜTZTER VIDEOTERMIN</Text>
          <Text style={styles.title}>{context.topic}</Text>
        </View>
        <PremiumButton
          title="Meeting verlassen"
          variant="ghost"
          onPress={() => {
            try {
              clientRef.current?.leaveMeeting();
            } finally {
              onLeave();
            }
          }}
        />
      </View>
      {error ? (
        <>
          <InfoBanner variant="danger" title="Zoom-Meeting" message={error} />
          <PremiumButton title="Im Zoom-Client öffnen" onPress={() => window.open(context.joinUrl, '_blank', 'noopener,noreferrer')} />
        </>
      ) : null}
      {starting ? <LoadingState message="Der sichere Zoom-Arbeitsraum wird vorbereitet…" /> : null}
      <div ref={rootRef} style={styles.zoomRoot as React.CSSProperties} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md, width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.caption, color: colors.cyanSoft, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.h2, color: colors.textPrimary },
  zoomRoot: {
    width: '100%',
    minHeight: 640,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#080D1E',
  },
});
