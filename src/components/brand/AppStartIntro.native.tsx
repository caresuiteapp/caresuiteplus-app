import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AppStartIntroReadyContext, appStartIntroSession } from './appStartIntroSession';
import { appStartIntroAssets } from './appStartIntroAssets';
import { selectAppStartIntroFormat } from './selectAppStartIntroFormat';

const BACKGROUND = '#040b19';
// Eight seconds of video plus up to four seconds for the local decoder to start.
const MAX_STARTUP_MS = 12_000;
const FADE_MS = 160;

// Keep Android's native splash until our dark, full-screen intro view is laid out.
void SplashScreen.preventAutoHideAsync().catch(() => {});
const hideSplash = () => { void SplashScreen.hideAsync().catch(() => {}); };

export function AppStartIntro({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => !appStartIntroSession.completed);
  const opacity = useRef(new Animated.Value(1)).current;
  const finishing = useRef(false);
  const mounted = useRef(true);

  const finish = useCallback((fade = false) => {
    if (finishing.current || !mounted.current) return;
    finishing.current = true;
    appStartIntroSession.completed = true;
    hideSplash();
    const reveal = () => { if (mounted.current) setVisible(false); };
    if (fade) {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true })
        .start(reveal);
    } else reveal();
  }, [opacity]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; opacity.stopAnimation(); };
  }, [opacity]);

  useEffect(() => {
    if (!visible) return;
    // Decoder/native errors must never strand the user on a startup screen.
    const deadline = setTimeout(() => finish(), MAX_STARTUP_MS);
    const state = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') finish();
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    if (AppState.currentState === 'background') finish();
    return () => { clearTimeout(deadline); state.remove(); back.remove(); };
  }, [finish, visible]);

  return (
    <AppStartIntroReadyContext.Provider value={!visible}>
      <View style={styles.root} onLayout={hideSplash}>
        <View style={styles.content} pointerEvents={visible ? 'none' : 'auto'}
          accessibilityElementsHidden={visible}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {visible ? (
          <Animated.View testID="app-start-intro" style={[styles.overlay, { opacity }]}
            accessibilityViewIsModal accessibilityLabel="CareSuite Health OS startet">
            <StatusBar hidden style="light" />
            <IntroPlaybackBoundary onFailure={finish}>
              <IntroVideo onFinish={finish} />
            </IntroPlaybackBoundary>
          </Animated.View>
        ) : null}
      </View>
    </AppStartIntroReadyContext.Provider>
  );
}

class IntroPlaybackBoundary extends Component<
  { children: ReactNode; onFailure: () => void }, { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function IntroVideo({ onFinish }: { onFinish: (fade?: boolean) => void }) {
  const { width, height } = useWindowDimensions();
  // Select once; rotation resizes the view without restarting the eight-second clip.
  const [source] = useState(() => appStartIntroAssets[selectAppStartIntroFormat(width, height)]);
  const player = useVideoPlayer(source, video => {
    video.loop = false;
    video.muted = false;
    video.volume = 1;
    video.audioMixingMode = 'mixWithOthers';
    video.staysActiveInBackground = false;
    video.showNowPlayingNotification = false;
    video.allowsExternalPlayback = false;
  });

  useEffect(() => {
    let live = true;
    let started = false;
    const stop = () => { try { player.pause(); } catch { /* Already released. */ } };
    const fail = () => { if (live) { stop(); onFinish(); } };
    const start = () => {
      if (!live || started || player.status !== 'readyToPlay') return;
      started = true;
      try { player.play(); } catch { fail(); }
    };
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') fail();
      else start();
    });
    const end = player.addListener('playToEnd', () => {
      if (live) { stop(); onFinish(true); }
    });
    if (player.status === 'error') fail();
    else start();
    return () => { live = false; status.remove(); end.remove(); stop(); };
  }, [onFinish, player]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain"
    nativeControls={false} surfaceType="textureView" allowsPictureInPicture={false}
    fullscreenOptions={{ enable: false }} accessible={false} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0 },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 100_000, backgroundColor: BACKGROUND,
  },
});
