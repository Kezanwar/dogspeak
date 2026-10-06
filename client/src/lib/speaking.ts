// Placeholder speaking source. Voice-activity detection (a Web Audio
// AnalyserNode per stream) lands with the audio milestone; until then nobody is
// ever speaking, but MemberTile's glow is already wired to this.
export const isSpeaking: (id: string) => boolean = () => false;
