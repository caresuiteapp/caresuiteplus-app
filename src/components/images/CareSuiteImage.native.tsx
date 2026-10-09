import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { StyleSheet, View, type ImageProps, type ImageBackgroundProps, type ImageResizeMode } from 'react-native';

function contentFit(mode?: ImageResizeMode): ExpoImageProps['contentFit'] {
  if (mode === 'contain') return 'contain';
  if (mode === 'center') return 'scale-down';
  if (mode === 'stretch') return 'fill';
  return 'cover';
}

function sourceKey(source: ImageProps['source']): string {
  if (Array.isArray(source)) return JSON.stringify(source);
  if (typeof source === 'number') return `asset:${source}`;
  return JSON.stringify(source ?? null);
}

/** Android uses Glide's view-sized decoding and bounded memory cache. Patient
 * photos, signed URLs and signatures never enter a new persistent disk cache. */
export function CareSuiteImage({ source, resizeMode, resizeMethod: _method,
  defaultSource, loadingIndicatorSource, fadeDuration, onLoad, onError,
  onProgress, ...rest }: ImageProps & { pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only' }) {
  return <ExpoImage {...rest as ExpoImageProps} source={source as ExpoImageProps['source']}
    contentFit={contentFit(resizeMode)} allowDownscaling enforceEarlyResizing
    cachePolicy="memory" recyclingKey={sourceKey(source)} transition={fadeDuration ?? 0}
    placeholder={(defaultSource ?? loadingIndicatorSource) as ExpoImageProps['placeholder']}
    placeholderContentFit={contentFit(resizeMode)}
    onLoad={onLoad ? event => onLoad({ nativeEvent: { source: {
      uri: event.source.url ?? '', width: event.source.width, height: event.source.height,
    } } } as Parameters<NonNullable<ImageProps['onLoad']>>[0]) : undefined}
    onError={onError ? event => onError({ nativeEvent: { error: event.error } } as Parameters<NonNullable<ImageProps['onError']>>[0]) : undefined}
    onProgress={onProgress ? event => onProgress({ nativeEvent: event } as Parameters<NonNullable<ImageProps['onProgress']>>[0]) : undefined}
  />;
}

export function CareSuiteImageBackground({ children, style, imageStyle, imageRef: _imageRef,
  source, resizeMode, testID, ...rest }: ImageBackgroundProps) {
  return <View style={style} testID={testID}>
    <CareSuiteImage {...rest} source={source} resizeMode={resizeMode}
      accessible={false} importantForAccessibility="no-hide-descendants"
      pointerEvents="none" style={[StyleSheet.absoluteFill, imageStyle]} />
    {children}
  </View>;
}
