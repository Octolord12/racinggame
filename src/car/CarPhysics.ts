import * as THREE from "three";
import { CONFIG } from "../config";
import { clamp, lerp } from "../utils/math";

export interface CarInput {
  accelerate: boolean;
  brake: boolean;
  /** -1 (left) .. 1 (right) */
  steer: number;
  handbrake: boolean;
}

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

/**
 * Simple arcade car model: a signed forward speed along the car's heading, plus a
 * separate lateral "slip" velocity that builds up under hard cornering (more so with
 * the handbrake) and decays back toward zero (grip). No full rigid-body simulation.
 * Wall/car collisions are resolved externally (see race/Collisions.ts) by reading and
 * writing this state through getWorldVelocity/setWorldVelocity.
 */
export class CarPhysics {
  readonly position = new THREE.Vector3();
  /** radians; forward vector = (sin(heading), 0, cos(heading)) */
  heading = 0;
  /** signed, m/s, positive = forward */
  forwardSpeed = 0;
  /** signed, m/s along the car's right vector */
  lateralVelocity = 0;
  /** seconds left of a boost pad's top-speed bonus */
  boostTimeRemaining = 0;

  setTransform(position: THREE.Vector3, heading: number) {
    this.position.copy(position);
    this.heading = heading;
    this.forwardSpeed = 0;
    this.lateralVelocity = 0;
    this.boostTimeRemaining = 0;
  }

  /** Instant speed kick plus a temporarily raised top speed, from a boost pad. */
  triggerBoost() {
    const c = CONFIG.car;
    this.boostTimeRemaining = c.boostDuration;
    this.forwardSpeed = Math.max(this.forwardSpeed, c.maxSpeed * c.boostMultiplier * 0.92);
  }

  get speed(): number {
    return Math.hypot(this.forwardSpeed, this.lateralVelocity);
  }

  /** World-space (x/z) velocity, decomposed from forwardSpeed/lateralVelocity via the current heading. */
  getWorldVelocity(): THREE.Vector3 {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    return new THREE.Vector3(fx * this.forwardSpeed + rx * this.lateralVelocity, 0, fz * this.forwardSpeed + rz * this.lateralVelocity);
  }

  /** Re-projects a world-space velocity back onto forwardSpeed/lateralVelocity using the current heading. */
  setWorldVelocity(v: THREE.Vector3) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    this.forwardSpeed = v.x * fx + v.z * fz;
    this.lateralVelocity = v.x * rx + v.z * rz;
  }

  update(dt: number, input: CarInput) {
    const c = CONFIG.car;

    if (input.accelerate) {
      this.forwardSpeed += c.acceleration * dt;
    } else if (input.brake) {
      if (this.forwardSpeed > 0.05) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - c.brakeDeceleration * dt);
      } else {
        this.forwardSpeed -= c.reverseAcceleration * dt;
      }
    } else {
      const decel = c.rollingResistance + Math.abs(this.forwardSpeed) * c.dragCoefficient;
      if (this.forwardSpeed > 0) this.forwardSpeed = Math.max(0, this.forwardSpeed - decel * dt);
      else if (this.forwardSpeed < 0) this.forwardSpeed = Math.min(0, this.forwardSpeed + decel * dt);
    }

    if (input.handbrake && this.forwardSpeed > 0) {
      this.forwardSpeed = Math.max(0, this.forwardSpeed - c.handbrakeDeceleration * dt);
    }

    if (this.boostTimeRemaining > 0) this.boostTimeRemaining = Math.max(0, this.boostTimeRemaining - dt);
    const effectiveMaxSpeed = this.boostTimeRemaining > 0 ? c.maxSpeed * c.boostMultiplier : c.maxSpeed;
    this.forwardSpeed = clamp(this.forwardSpeed, -c.maxReverseSpeed, effectiveMaxSpeed);

    const speedRatio = clamp(Math.abs(this.forwardSpeed) / c.maxSpeed, 0, 1);
    const turnRate = lerp(c.maxTurnRate, c.minTurnRate, speedRatio);
    let appliedTurn = 0;
    if (Math.abs(this.forwardSpeed) > c.minSpeedToTurn) {
      const directionSign = this.forwardSpeed >= 0 ? 1 : -1;
      // Negated: with forward = (sin(heading), 0, cos(heading)), increasing heading
      // sweeps the nose toward world -X, which is screen-left given how ChaseCamera
      // sits behind the car looking down +forward. Flip so steer > 0 (right) turns right.
      appliedTurn = -turnRate * input.steer * directionSign;
      this.heading += appliedTurn * dt;
    }

    const driftFactor = input.handbrake ? c.handbrakeDriftFactor : c.driftFactor;
    const gripRecovery = input.handbrake ? c.handbrakeGripRecovery : c.gripRecovery;
    this.lateralVelocity -= appliedTurn * this.forwardSpeed * driftFactor * dt;
    this.lateralVelocity -= this.lateralVelocity * Math.min(1, gripRecovery * dt);

    FORWARD.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    RIGHT.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.position.addScaledVector(FORWARD, this.forwardSpeed * dt);
    this.position.addScaledVector(RIGHT, this.lateralVelocity * dt);
  }
}
