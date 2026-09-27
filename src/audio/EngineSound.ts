import { CONFIG } from "../config";
import { clamp, lerp } from "../utils/math";

/**
 * A small synthesized engine drone: two detuned oscillators through a lowpass
 * filter, pitched and opened up with speed. No audio assets. Browsers block
 * audio until a user gesture, so the AudioContext is created suspended and
 * resume() must be called from a click/keydown handler.
 */
export class EngineSound {
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly oscA: OscillatorNode;
  private readonly oscB: OscillatorNode;

  constructor() {
    this.ctx = new AudioContext();

    this.oscA = this.ctx.createOscillator();
    this.oscA.type = "sawtooth";
    this.oscB = this.ctx.createOscillator();
    this.oscB.type = "square";

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.oscA.connect(this.filter);
    this.oscB.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    this.oscA.start();
    this.oscB.start();
  }

  /** Must be called from within a user-gesture event handler (click/keydown). */
  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** speedRatio: 0..1 of top speed. throttleEngaged: true while accelerating, for a slightly louder rev. */
  update(speedRatio: number, throttleEngaged: boolean) {
    const t = this.ctx.currentTime;
    const ratio = clamp(speedRatio, 0, 1);
    const pitch = lerp(CONFIG.audio.minPitchHz, CONFIG.audio.maxPitchHz, ratio);

    this.oscA.frequency.setTargetAtTime(pitch, t, 0.06);
    this.oscB.frequency.setTargetAtTime(pitch * 1.5 + 4, t, 0.06);
    this.filter.frequency.setTargetAtTime(300 + ratio * 2200, t, 0.06);

    const targetVolume = throttleEngaged ? CONFIG.audio.throttleVolume : CONFIG.audio.idleVolume;
    this.gain.gain.setTargetAtTime(targetVolume, t, 0.08);
  }

  setMuted(muted: boolean) {
    this.gain.gain.setTargetAtTime(muted ? 0 : CONFIG.audio.idleVolume, this.ctx.currentTime, 0.05);
  }
}
