import React from 'react';
import { buildSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';
const dependencies: Record<string, unknown> = {
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'expo-image': { Image: 'GlideImage' },
  'react-native': { View: 'View', StyleSheet: { absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } } },
};
const code = buildSync({ entryPoints: ['src/components/images/CareSuiteImage.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const module = { exports: {} as any };
new Function('require', 'module', 'exports', code)((id: string) => dependencies[id], module, module.exports);
const { CareSuiteImage, CareSuiteImageBackground } = module.exports;
describe('native size-aware image renderer', () => {
  it.each(['contain', 'cover'])('decodes %s at the view size without creating a disk cache for private images', mode => {
    const image = CareSuiteImage({ source: { uri: 'https://private.test/photo' }, resizeMode: mode, style: { width: 48, height: 48 } });
    expect(image.type).toBe('GlideImage');
    expect(image.props).toMatchObject({ contentFit: mode, allowDownscaling: true, cachePolicy: 'memory', style: { width: 48, height: 48 } });
  });
  it('resets recycled content when switching people, sources or authorization headers', () => {
    const props = (uri: string, auth: string) => CareSuiteImage({ source: { uri, headers: { Authorization: auth } } }).props;
    expect(props('photo-a', 'a').recyclingKey).not.toBe(props('photo-b', 'a').recyclingKey);
    expect(props('photo-a', 'a').recyclingKey).not.toBe(props('photo-a', 'b').recyclingKey);
  });
  it('preserves error fallback and source-size events used by existing screens', () => {
    const error = vi.fn(), load = vi.fn(); const image = CareSuiteImage({ source: 1, onError: error, onLoad: load });
    image.props.onError({ error: 'not found' }); image.props.onLoad({ source: { url: 'asset', width: 320, height: 160 } });
    expect(error).toHaveBeenCalledWith({ nativeEvent: { error: 'not found' } });
    expect(load).toHaveBeenCalledWith({ nativeEvent: { source: { uri: 'asset', width: 320, height: 160 } } });
  });
  it('keeps foreground navigation, children and root sizing independent from the background bitmap', () => {
    const child = React.createElement('Text', {}, 'Anmelden');
    const background = CareSuiteImageBackground({ source: 1, style: { flex: 1 }, children: child, testID: 'desktop' });
    expect(background.props).toMatchObject({ style: { flex: 1 }, testID: 'desktop' });
    expect(background.props.children[0].props.pointerEvents).toBe('none');
    expect(background.props.children[1]).toBe(child);
  });
});
