import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import {
  createVoicePreviewUrl,
  revokeBlobPlaybackUrl,
} from '@/lib/office/voicemessageutils';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { spacing, radius } from '@/theme';

type VoicePendingPreviewProps = {
  attachment: PendingMessageAttachment;
  onDarkSurface?: boolean;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoicePendingPreview({ attachment, onDarkSurface = false }: VoicePendingPreviewProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: spacing.xs,
          paddingTop: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: `${c.muted}33`,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        playButton: {
          width: 32,
          height: 32,
          borderRadius: radius.capsule,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${c.violet}22`,
          borderWidth: 1,
          borderColor: c.violet,
        },
        playLabel: { ...typography.caption, color: c.violet, fontWeight: '700' },
        label: {
          ...typography.caption,
          color: onDarkSurface ? c.text : c.muted,
          flex: 1,
        },
        meta: { ...typography.caption, color: c.muted },
      }),
    [c, onDarkSurface, typography],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    revokeBlobPlaybackUrl(previewUrlRef.current);
    previewUrlRef.current = createVoicePreviewUrl(attachment.fileData, attachment.mimeType);
    const url = previewUrlRef.current;
    if (!url) return;

    setPlaying(false);
    setReady(false);
    setDuration(0);

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.preload = 'metadata';

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setReady(true);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('canplay', onLoaded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('canplay', onLoaded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
      revokeBlobPlaybackUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, [attachment.fileData, attachment.mimeType]);

  const togglePlayback = async () => {
    if (Platform.OS !== 'web') return;
    const audio = audioRef.current;
    if (!audio || !ready) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Vorschau: {attachment.fileName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          style={styles.playButton}
          onPress={() => void togglePlayback()}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel="Sprachnachricht-Vorschau abspielen"
        >
          <Text style={styles.playLabel}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Text style={styles.label}>Vorschau vor dem Senden</Text>
        <Text style={styles.meta}>
          {ready ? formatDuration(duration) : '…'} ·{' '}
          {Math.max(1, Math.round(attachment.fileSizeBytes / 1024))} KB
        </Text>
      </View>
    </View>
  );
}
