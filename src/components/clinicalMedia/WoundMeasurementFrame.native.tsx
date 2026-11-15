import { useState } from 'react';
import { WebView } from 'react-native-webview';
import { readMeasurementFrameMessage, type WoundMeasurementFrameProps } from './WoundMeasurementFrame.types';

export function WoundMeasurementFrame({ html, onMeasurement }: WoundMeasurementFrameProps) {
  const [height, setHeight] = useState(640);
  return <WebView source={{ html }} style={{ height, borderRadius: 12, backgroundColor: '#f1f7fb' }}
    originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
    setSupportMultipleWindows={false} allowFileAccess={false} domStorageEnabled={false}
    mixedContentMode="never" cacheEnabled={false} incognito scrollEnabled={false} javaScriptEnabled
    onMessage={event => {
      try {
        const message = readMeasurementFrameMessage(JSON.parse(event.nativeEvent.data));
        if (message?.type === 'height') setHeight(message.value);
        if (message?.type === 'measurement') onMeasurement(message.value);
      } catch { /* The editor accepts only structured messages. */ }
    }} />;
}
