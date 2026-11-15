import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PremiumButton } from '@/components/ui';
import { BODY_MAP_PATH, bodyMapMessage, type WoundBodyMapFrameProps } from './WoundBodyMapFrame.types';

const ORIGIN = 'https://www.caresuiteplus.app';
const PAGE = ORIGIN + BODY_MAP_PATH;

export function WoundBodyMapFrame({ marks, canWrite, figure, onMark }: WoundBodyMapFrameProps) {
  const webview = useRef<WebView<object>>(null);
  const [height, setHeight] = useState(760), [error, setError] = useState(false);
  const [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  const publish = () => {
    const state = JSON.stringify({ marks, canWrite, figure }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    webview.current?.injectJavaScript('if (window.setCareWoundContext) window.setCareWoundContext(' + state + '); true;');
  };
  useEffect(() => { if (ready) publish(); }, [ready, marks, canWrite, figure]);
  if (error) return <View><Text>Die Körperkarte konnte nicht geladen werden.</Text><PremiumButton title="Erneut laden" onPress={() => {
    setReady(false); setError(false); setAttempt(value => value + 1);
  }} /></View>;
  return <WebView<object> key={attempt} ref={webview} source={{ uri: PAGE }} style={{ height, borderRadius: 14 }}
    originWhitelist={[ORIGIN]} onShouldStartLoadWithRequest={request => request.url === PAGE}
    onError={() => setError(true)} onHttpError={event => { if (event.nativeEvent.url === PAGE) setError(true); }}
    setSupportMultipleWindows={false} allowFileAccess={false} domStorageEnabled={false}
    mixedContentMode="never" scrollEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
    onMessage={event => {
      if (event.nativeEvent.url !== PAGE) return;
      try {
        const message = bodyMapMessage(JSON.parse(event.nativeEvent.data));
        if (message?.type === 'ready') setReady(true);
        if (message?.type === 'height') setHeight(message.height);
        if (message?.type === 'mark' && canWrite) onMark(message.mark);
      } catch { /* Ignore malformed messages. */ }
    }} />;
}
