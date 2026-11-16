import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PremiumButton } from '@/components/ui';
import { BODY_MAP_PATH, EMPTY_BODY_MARKS, WOUND_BODY_BRIDGE_VERSION, bodyMapMessage, type WoundBodyMapFrameProps, type WoundBodyMapView } from './WoundBodyMapFrame.types';

const ORIGIN = 'https://www.caresuiteplus.app';

export function WoundBodyMapFrame({ marks = EMPTY_BODY_MARKS, canWrite = false, figure, onMark, view }: WoundBodyMapFrameProps) {
  const [full, setFull] = useState(false);
  const [snapshot, setSnapshot] = useState<WoundBodyMapView>();
  const query = [view ? `view=${view}` : '', full ? 'full=1' : ''].filter(Boolean).join('&');
  const page = ORIGIN + BODY_MAP_PATH + (query ? '?' + query : '');
  const writable = canWrite && view !== 'preview';
  const webview = useRef<WebView<object>>(null);
  const [height, setHeight] = useState(view ? 540 : 760), [error, setError] = useState(false);
  const [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  const publish = () => {
    const state = JSON.stringify({ marks, bridgeVersion: WOUND_BODY_BRIDGE_VERSION, canWrite: writable, figure: snapshot?.figure ?? figure, view: snapshot })
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    webview.current?.injectJavaScript('if (window.setCareWoundContext) window.setCareWoundContext(' + state + '); true;');
  };
  useEffect(() => { if (ready) publish(); }, [ready, marks, writable, figure, snapshot]);
  function expand(open: boolean, next?: WoundBodyMapView) {
    if (open === full) return;
    if (next) setSnapshot(next);
    setReady(false); setError(false); setFull(open);
  }
  const content = error ? <View><Text>Die Körperkarte konnte nicht geladen werden.</Text><PremiumButton title="Erneut laden" onPress={() => {
    setReady(false); setError(false); setAttempt(value => value + 1);
  }} />{full && <PremiumButton title="Vollbild schließen" onPress={() => expand(false)} />}</View> :
  <WebView<object> key={page + ':' + attempt} ref={webview} source={{ uri: page }}
    style={full ? { flex: 1, backgroundColor: '#f5f8fb' } : { height, borderRadius: 12 }}
    originWhitelist={[ORIGIN]} onShouldStartLoadWithRequest={request => request.url === page}
    onError={() => setError(true)} onHttpError={event => { if (event.nativeEvent.url === page) setError(true); }}
    setSupportMultipleWindows={false} allowFileAccess={false} domStorageEnabled={false}
    mixedContentMode="never" scrollEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
    onMessage={event => {
      if (event.nativeEvent.url !== page) return;
      try {
        const message = bodyMapMessage(JSON.parse(event.nativeEvent.data));
        if (message?.type === 'ready') setReady(true);
        if (message?.type === 'height') setHeight(message.height);
        if (message?.type === 'mark' && writable) onMark?.(message.mark);
        if (message?.type === 'expand') expand(message.open, message.view);
      } catch { /* Ignore malformed messages. */ }
    }} />;
  return full ? <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => expand(false)}>
    <View style={{ flex: 1, backgroundColor: '#f5f8fb' }}>{content}</View>
  </Modal> : content;
}
