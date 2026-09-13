// US-22: doble de `AudioMixer` para los tests unitarios del `MusicPlayer`.
// Registra las llamadas de `setTrackGain`/`setSilent` y el `resume` para
// observar el crossfade sin `AudioContext` ni elemento de audio real.
//
//   const mixer = new FakeAudioMixer();
//   const player = createMusicPlayer({ createElement: () => fakeElement, createMixer: () => mixer });
//   player.setTargetVolume(0.5);
//   mixer.lastTrackGain;   // última ganancia de pista
//   mixer.lastSilent;      // último estado de mute
import type { AudioMixer } from "@/adapters/audio/audio-mixer";

export class FakeAudioMixer implements AudioMixer {
  readonly usingWebAudio: boolean;
  readonly trackGains: number[] = [];
  readonly silentStates: boolean[] = [];
  resumeCallCount = 0;

  constructor(usingWebAudio = false) {
    this.usingWebAudio = usingWebAudio;
  }

  get lastTrackGain(): number | undefined {
    return this.trackGains[this.trackGains.length - 1];
  }

  get lastSilent(): boolean | undefined {
    return this.silentStates[this.silentStates.length - 1];
  }

  setTrackGain(value: number): void {
    this.trackGains.push(value);
  }

  setSilent(silent: boolean): void {
    this.silentStates.push(silent);
  }

  resume(): Promise<void> {
    this.resumeCallCount += 1;
    return Promise.resolve();
  }
}
