/** SpeechSynthesisVoice has no gender field. Only documented male German names
 * are eligible; unknown/default voices must never become Neo's fallback.
 * https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices
 * https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
 */
const maleNames = ['Conrad', 'Florian', 'Stefan', 'Bernd', 'Christoph', 'Kasper', 'Killian', 'Klaus', 'Ralf'];
type VoiceDescriptor = {name:string;voiceURI:string;lang:string};
export function selectNeoVoice<T extends VoiceDescriptor>(voices:T[]):T|undefined {
  return voices.map(voice=>({voice,rank:maleNames.findIndex(name=>new RegExp(`(?:^|[\\s_-])${name}(?:MultilingualNeural|Neural|[\\s_-]|$)`,'i').test(`${voice.name} ${voice.voiceURI}`))}))
    .filter(item=>/^de(?:-|_|$)/i.test(item.voice.lang)&&item.rank>=0)
    .sort((a,b)=>a.rank-b.rank)[0]?.voice;
}
