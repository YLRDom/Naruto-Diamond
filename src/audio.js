export class ActionAudio {
  play(kind, settings) {
    if (!settings?.sound || !settings.volume) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      this.context ||= new Context();
      const context = this.context;
      if (context.state === 'suspended') context.resume().catch(() => {});
      const start = context.currentTime;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = kind === 'fireball' ? 'sawtooth' : 'sine';
      oscillator.frequency.setValueAtTime(kind === 'fireball' ? 180 : 520, start);
      oscillator.frequency.exponentialRampToValueAtTime(100, start + .16);
      gain.gain.setValueAtTime(Math.min(.4, Math.max(0, settings.volume)) * .3, start);
      gain.gain.exponentialRampToValueAtTime(.001, start + .18);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + .2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio support is optional. */ }
  }
}
