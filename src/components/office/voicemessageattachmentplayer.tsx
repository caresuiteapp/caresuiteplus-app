import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';

type VoiceMessageAttachmentPlayerProps = {
  url: string;
  fileName: string;
  onRetry?: () => void;
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceMessageAttachmentPlayer({
  url,
  fileName,
  onRetry,
}: VoiceMessageAttachmentPlayerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: spacing.xs, padding: spacing.sm },
        row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        playButton: {
          width: 36,
          height: 36,
          borderRadius: radius.capsule,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${c.violet}22`,
          borderWidth: 1,
          borderColor: c.violet,
        },
        playLabel: { ...typography.bodyStrong, color: c.violet },
        track: {
          flex: 1,
          height: 4,
          borderRadius: radius.capsule,
          backgroundColor: `${c.muted}33`,
          overflow: 'hidden',
        },
        progress: {
          height: '100%',
          backgroundColor: c.violet,
        },
        time: { ...typography.caption, color: c.muted, minWidth: 72, textAlign: 'right' },
        label: { ...typography.caption, color: c.muted },
        error: { ...typography.caption, color: '#c0392b' },
        retry: { ...typography.caption, color: c.violet, fontWeight: '700' },
        nativeLink: { ...typography.caption, color: c.violet, fontWeight: '600' },
      }),
    [c, typography],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    setReady(false);
    setError(null);

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.preload = 'metadata';

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setReady(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setError('Sprachnachricht konnte nicht abgespielt werden.');
      setReady(false);
      setPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [url]);

  const togglePlayback = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Linking.openURL(url);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    setError(null);
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError('Sprachnachricht konnte nicht abgespielt werden.');
      setPlaying(false);
    }
  }, [url]);

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.root}>
        <Pressable
          onPress={() => void togglePlayback()}
          accessibilityRole="button"
          accessibilityLabel={`Sprachnachricht abspielen: ${fileName}`}
        >
          <Text style={styles.nativeLink}>Sprachnachricht abspielen</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <Text style={styles.error}>{error}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Erneut laden">
            <Text style={styles.retry}>Erneut laden</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable
          style={styles.playButton}
          onPress={() => void togglePlayback()}
          disabled={!ready && !playing}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Sprachnachricht pausieren' : 'Sprachnachricht abspielen'}
        >
          {!ready && !playing ? (
            <ActivityIndicator size="small" color={c.violet} />
          ) : (
            <Text style={styles.playLabel}>{playing ? '❚❚' : '▶'}</Text>
          )}
        </Pressable>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progressRatio * 100}%` }]} />
        </View>
        <Text style={styles.time}>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </Text>
      </View>
      <Text style={styles.label}>Sprachnachricht</Text>
    </View>
  );
}
