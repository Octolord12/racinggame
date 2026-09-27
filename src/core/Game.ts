import * as THREE from "three";
import { CONFIG } from "../config";
import type { FinishLine } from "../track/TrackBuilder";
import { lateralOffsetFromLine, signedDistanceAlongLine } from "../track/FinishLineMath";

export type RaceState = "countdown" | "racing" | "finished";

const LAP_WRAP_GUARD_SECONDS = 3;
const GO_FLASH_SECONDS = 0.8;

/**
 * Race state machine: countdown -> racing -> finished. Also tracks lap/race
 * timers and detects lap completion by the car crossing the finish-line plane
 * (within the road's width) in the forward direction. This is more robust than
 * tracking progress around the centerline, which a tight low-speed spin near
 * the start can fool.
 */
export class Game {
  state: RaceState = "countdown";
  countdownRemaining = CONFIG.race.countdownSeconds;
  goFlashRemaining = 0;

  lap = 1;
  readonly totalLaps = CONFIG.race.totalLaps;
  lapElapsed = 0;
  raceElapsed = 0;

  lastLapTime: number | null = null;
  bestLapTime: number | null = null;
  finalTime: number | null = null;

  private readonly finishLine: FinishLine;
  private readonly onNewBestLap?: (seconds: number) => void;
  private prevSigned = 0;
  /** the first forward crossing of the line is the launch, not a completed lap */
  private hasCrossedStart = false;
  private sinceLastLapCompletion = Infinity;

  constructor(finishLine: FinishLine, onNewBestLap?: (seconds: number) => void) {
    this.finishLine = finishLine;
    this.onNewBestLap = onNewBestLap;
  }

  /** Seeds the best-lap display (e.g. from localStorage) without treating it as a just-set record. */
  seedBestLapTime(seconds: number | null) {
    this.bestLapTime = seconds;
  }

  get isInputEnabled(): boolean {
    return this.state === "racing";
  }

  update(dt: number) {
    if (this.state === "countdown") {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.countdownRemaining = 0;
        this.state = "racing";
        this.goFlashRemaining = GO_FLASH_SECONDS;
      }
      return;
    }

    if (this.goFlashRemaining > 0) this.goFlashRemaining = Math.max(0, this.goFlashRemaining - dt);

    if (this.state === "racing") {
      this.lapElapsed += dt;
      this.raceElapsed += dt;
      this.sinceLastLapCompletion += dt;
    }
  }

  /** Call once per physics step with the car's current position. */
  checkLapCrossing(currentPosition: THREE.Vector3) {
    if (this.state !== "racing") {
      this.prevSigned = signedDistanceAlongLine(this.finishLine, currentPosition);
      return;
    }

    const nowSigned = signedDistanceAlongLine(this.finishLine, currentPosition);
    const lateral = lateralOffsetFromLine(this.finishLine, currentPosition);
    const crossedForward = this.prevSigned <= 0 && nowSigned > 0;

    if (crossedForward && Math.abs(lateral) < this.finishLine.halfWidth) {
      if (!this.hasCrossedStart) {
        this.hasCrossedStart = true;
      } else if (this.sinceLastLapCompletion > LAP_WRAP_GUARD_SECONDS) {
        this.completeLap();
      }
    }

    this.prevSigned = nowSigned;
  }

  private completeLap() {
    this.sinceLastLapCompletion = 0;
    this.lastLapTime = this.lapElapsed;
    if (this.bestLapTime === null || this.lapElapsed < this.bestLapTime) {
      this.bestLapTime = this.lapElapsed;
      this.onNewBestLap?.(this.bestLapTime);
    }
    if (this.lap >= this.totalLaps) {
      this.finalTime = this.raceElapsed;
      this.state = "finished";
    } else {
      this.lap += 1;
      this.lapElapsed = 0;
    }
  }

  /** Restarts the race. Best lap time intentionally persists across restarts. */
  reset() {
    this.state = "countdown";
    this.countdownRemaining = CONFIG.race.countdownSeconds;
    this.goFlashRemaining = 0;
    this.lap = 1;
    this.lapElapsed = 0;
    this.raceElapsed = 0;
    this.lastLapTime = null;
    this.finalTime = null;
    this.prevSigned = 0;
    this.hasCrossedStart = false;
    this.sinceLastLapCompletion = Infinity;
  }
}
