// Rendering evidence only. Device speech is deliberately unavailable here.
export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: () => false, supportsOnDeviceRecognition: () => false,
  abort() {}, stop() {},
};
export const useSpeechRecognitionEvent = () => {};
export const stop = async () => {};
export const speak = () => { throw new Error('No physical speech output in the browser fixture.'); };
export const createAudioPlayer = () => { throw new Error('No physical audio player in the browser fixture.'); };
