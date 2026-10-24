import type { ImageSourcePropType } from 'react-native';
import { DESKTOP_ARTWORK_ASSETS, type DesktopArtworkAsset } from './desktopArtworkAssets.web';
import { DESKTOP_ARTWORK_FILL, desktopArtworkResolution } from './desktopArtworkGeometry.web';

type ArtworkImages = { small: ImageSourcePropType; medium: ImageSourcePropType; large: ImageSourcePropType };

/** Expo Web normally exports a URI object; numeric assets use React Native's resolver. */
export function desktopArtworkUri(
  source: ImageSourcePropType,
  resolve?: (source: ImageSourcePropType) => { uri?: string } | null | undefined,
): string | undefined {
  if (typeof source === 'object' && source !== null && !Array.isArray(source) &&
      'uri' in source && typeof source.uri === 'string' && source.uri.length > 0) return source.uri;
  if (typeof source === 'number' && resolve) {
    const resolved = resolve(source);
    if (typeof resolved?.uri === 'string' && resolved.uri.length > 0) return resolved.uri;
  }
  return undefined;
}

const assetsBySource = new Map<ImageSourcePropType, DesktopArtworkAsset>();
const assetsByUri = new Map<string, DesktopArtworkAsset>();
for (const asset of DESKTOP_ARTWORK_ASSETS) {
  assetsBySource.set(asset.source, asset);
  const uri = desktopArtworkUri(asset.source);
  if (uri) assetsByUri.set(uri, asset);
}

/** Match the bundled asset itself or its exact URI; never infer from filenames. */
export function desktopArtworkAsset(source: ImageSourcePropType): DesktopArtworkAsset | undefined {
  const direct = assetsBySource.get(source);
  if (direct) return direct;
  const uri = desktopArtworkUri(source);
  return uri ? assetsByUri.get(uri) : undefined;
}

/** Choose by visible motif pixels, because wide "large" canvases add no detail. */
export function selectDesktopArtworkAsset(images: ArtworkImages, size: number | string): DesktopArtworkAsset | undefined {
  const preferred = typeof size === 'number' && size <= 48 ? images.small : images.medium;
  // A custom image remains authoritative, even if another variant uses stock art.
  if (!desktopArtworkAsset(preferred)) return undefined;
  const candidates = [...new Set([images.small, images.medium, images.large])]
    .map(desktopArtworkAsset).filter((asset): asset is DesktopArtworkAsset => Boolean(asset));
  const byResolution = candidates.sort((a, b) => desktopArtworkResolution(a) - desktopArtworkResolution(b) || a.bytes - b.bytes);
  const requiredPixels = typeof size === 'number' && Number.isFinite(size) && size > 0
    ? size * DESKTOP_ARTWORK_FILL * 2
    : Infinity;
  const sufficient = byResolution.find(asset => desktopArtworkResolution(asset) >= requiredPixels);
  if (sufficient) return sufficient;
  const bestResolution = Math.max(...byResolution.map(desktopArtworkResolution));
  return byResolution.find(asset => desktopArtworkResolution(asset) === bestResolution);
}
