import { CONFIG } from "../config";
import type { CarPhysics, CarInput } from "../car/CarPhysics";
import type { Track, TrackQueryResult } from "../track/TrackBuilder";
import { clamp, normalizeAngle } from "../utils/math";

export interface AIDriverConfig {
  /** fraction of CONFIG.car.maxSpeed this driver targets on straights */
  speedFactor: number;
  /** constant offset from the centerline (meters, +right/-left) this driver holds */
  lateralOffset: number;
  color: number;
}

/**
 * Simple pure-pursuit AI: steers toward a point a fixed distance ahead on the
 * centerline (offset by this driver's preferred line), and throttles toward a
 * target speed that drops for sharper upcoming curves. No pathfinding, no
 * awareness of other cars beyond the collision response applied externally.
 */
export class AIDriver {
  readonly config: AIDriverConfig;

  constructor(config: AIDriverConfig) {
    this.config = config;
  }

  computeInput(physics: CarPhysics, track: Track, query: TrackQueryResult): CarInput {
    const n = track.samples.length;
    const spacing = track.totalLength / n;
    const steerAheadSamples = Math.max(1, Math.round(CONFIG.ai.steerLookaheadMeters / spacing));
    const curveAheadSamples = Math.max(1, Math.round(CONFIG.ai.curveLookaheadMeters / spacing));

    const targetSample = track.samples[(query.index + steerAheadSamples) % n];
    const targetX = targetSample.point.x + targetSample.right.x * this.config.lateralOffset;
    const targetZ = targetSample.point.z + targetSample.right.z * this.config.lateralOffset;

    const desiredHeading = Math.atan2(targetX - physics.position.x, targetZ - physics.position.z);
    const headingError = normalizeAngle(desiredHeading - physics.heading);
    // See CarPhysics.update: steer > 0 must map to a *decreasing* heading to turn right on screen.
    const steer = clamp(-headingError * CONFIG.ai.steerGain, -1, 1);

    const tangentNow = track.samples[query.index].tangent;
    const tangentAhead = track.samples[(query.index + curveAheadSamples) % n].tangent;
    const angleNow = Math.atan2(tangentNow.x, tangentNow.z);
    const angleAhead = Math.atan2(tangentAhead.x, tangentAhead.z);
    const curveAngle = Math.abs(normalizeAngle(angleAhead - angleNow));
    const curveFactor = 1 - clamp(curveAngle / CONFIG.ai.curveAngleForMinSpeed, 0, 1) * CONFIG.ai.curveSlowdownStrength;

    const targetSpeed = CONFIG.car.maxSpeed * this.config.speedFactor * curveFactor;
    const hysteresis = CONFIG.ai.speedHysteresis;

    return {
      accelerate: physics.forwardSpeed < targetSpeed - hysteresis,
      brake: physics.forwardSpeed > targetSpeed + hysteresis,
      steer,
      handbrake: false,
    };
  }
}
