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

export interface CarUpgrades {
  /** 0..MAX_UPGRADE_LEVEL; raises acceleration and top speed */
  engineLevel: number;
  /** 0..MAX_UPGRADE_LEVEL; less drift, faster grip recovery */
  gripLevel: number;
  /** 0..MAX_UPGRADE_LEVEL; stronger braking and handbrake */
  brakeLevel: number;
}

const NO_UPGRADES: CarUpgrades = { engineLevel: 0, gripLevel: 0, brakeLevel: 0 };

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

/**
 * Simple arcade car model: a signed forward speed along the car's heading, plus a
 * separate lateral "slip" velocity that builds up under hard cornering (more so with
 * the handbrake) and decays back toward zero (grip). No full rigid-body simulation.
 * Wall/car collisions are resolved externally (see race/Collisions.ts) by reading and
 * writing this state through getWorldVelocity/setWorldVelocity.
 *
 * Garage upgrades (see storage/GarageState.ts) are applied per-instance via
 * setUpgrades — only ever called for the player's car, so AI opponents and remote
 * multiplayer puppets stay at the stock NO_UPGRADES baseline regardless of what the
 * player has purchased.
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
  /** seconds left of a shield pad's collision immunity */
  shieldTimeRemaining = 0;
  /** seconds left of a grip pad's extra traction */
  gripBoostTimeRemaining = 0;
  /** most recent steer input, -1..1; purely cosmetic (front wheel turn visual), no physics reads it back */
  lastSteerInput = 0;

  private upgrades: CarUpgrades = NO_UPGRADES;

  setUpgrades(upgrades: CarUpgrades) {
    this.upgrades = upgrades;
  }

  setTransform(position: THREE.Vector3, heading: number) {
    this.position.copy(position);
    this.heading = heading;
    this.forwardSpeed = 0;
    this.lateralVelocity = 0;
    this.boostTimeRemaining = 0;
    this.shieldTimeRemaining = 0;
    this.gripBoostTimeRemaining = 0;
  }

  /** Instant speed kick plus a temporarily raised top speed, from a boost pad. */
  triggerBoost() {
    const c = CONFIG.car;
    this.boostTimeRemaining = c.boostDuration;
    const engineSpeedMult = 1 + this.upgrades.engineLevel * 0.05;
    this.forwardSpeed = Math.max(this.forwardSpeed, c.maxSpeed * engineSpeedMult * c.boostMultiplier * 0.92);
  }

  /** Collisions stop hurting (see race/Collisions.ts) for a while, from a shield pad. */
  activateShield() {
    this.shieldTimeRemaining = CONFIG.car.shieldDuration;
  }

  /** Much stickier tires for a while, from a grip pad. Doesn't override an active handbrake drift. */
  activateGripBoost() {
    this.gripBoostTimeRemaining = CONFIG.car.gripBoostDuration;
  }

  get isShielded(): boolean {
    return this.shieldTimeRemaining > 0;
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
    this.lastSteerInput = input.steer;
    const c = CONFIG.car;
    const engineAccelMult = 1 + this.upgrades.engineLevel * 0.07;
    const engineSpeedMult = 1 + this.upgrades.engineLevel * 0.05;
    const brakeMult = 1 + this.upgrades.brakeLevel * 0.08;
    const gripDriftMult = Math.max(0.25, 1 - this.upgrades.gripLevel * 0.13);
    const gripRecoveryMult = 1 + this.upgrades.gripLevel * 0.22;

    if (input.accelerate) {
      this.forwardSpeed += c.acceleration * engineAccelMult * dt;
    } else if (input.brake) {
      if (this.forwardSpeed > 0.05) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - c.brakeDeceleration * brakeMult * dt);
      } else {
        this.forwardSpeed -= c.reverseAcceleration * dt;
      }
    } else {
      const decel = c.rollingResistance + Math.abs(this.forwardSpeed) * c.dragCoefficient;
      if (this.forwardSpeed > 0) this.forwardSpeed = Math.max(0, this.forwardSpeed - decel * dt);
      else if (this.forwardSpeed < 0) this.forwardSpeed = Math.min(0, this.forwardSpeed + decel * dt);
    }

    if (input.handbrake && this.forwardSpeed > 0) {
      this.forwardSpeed = Math.max(0, this.forwardSpeed - c.handbrakeDeceleration * brakeMult * dt);
    }

    if (this.boostTimeRemaining > 0) this.boostTimeRemaining = Math.max(0, this.boostTimeRemaining - dt);
    if (this.shieldTimeRemaining > 0) this.shieldTimeRemaining = Math.max(0, this.shieldTimeRemaining - dt);
    if (this.gripBoostTimeRemaining > 0) this.gripBoostTimeRemaining = Math.max(0, this.gripBoostTimeRemaining - dt);
    const baseMaxSpeed = c.maxSpeed * engineSpeedMult;
    const effectiveMaxSpeed = this.boostTimeRemaining > 0 ? baseMaxSpeed * c.boostMultiplier : baseMaxSpeed;
    this.forwardSpeed = clamp(this.forwardSpeed, -c.maxReverseSpeed, effectiveMaxSpeed);

    const speedRatio = clamp(Math.abs(this.forwardSpeed) / baseMaxSpeed, 0, 1);
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

    let driftFactor = input.handbrake ? c.handbrakeDriftFactor : c.driftFactor;
    let gripRecovery = input.handbrake ? c.handbrakeGripRecovery : c.gripRecovery;
    if (!input.handbrake && this.gripBoostTimeRemaining > 0) {
      driftFactor = c.gripBoostDriftFactor;
      gripRecovery = c.gripBoostGripRecovery;
    }
    driftFactor *= gripDriftMult;
    gripRecovery *= gripRecoveryMult;
    this.lateralVelocity -= appliedTurn * this.forwardSpeed * driftFactor * dt;
    this.lateralVelocity -= this.lateralVelocity * Math.min(1, gripRecovery * dt);

    FORWARD.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    RIGHT.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.position.addScaledVector(FORWARD, this.forwardSpeed * dt);
    this.position.addScaledVector(RIGHT, this.lateralVelocity * dt);
  }
}
