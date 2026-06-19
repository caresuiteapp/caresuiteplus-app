import { VoiceOrbCore, type VoiceOrbProps } from './VoiceOrbCore';

export function VoiceOrb(props: VoiceOrbProps) {
  return <VoiceOrbCore {...props} />;
}

export { useVoiceOrbPlacement } from './VoiceOrbCore';
export type { VoiceOrbProps } from './VoiceOrbCore';
