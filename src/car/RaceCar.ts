import * as THREE from "three";
import { WHEEL_RADIUS, buildCarMesh } from "./CarMesh";
import { CarPhysics } from "./CarPhysics";
import type { CarInput } from "./CarPhysics";
import { CONFIG } from "../config";
import { smoothingFactor } from "../utils/math";

const REAR_OFFSET = CONFIG.car.length / 2 - 0.7;
const WHEEL_TRACK = CONFIG.car.width / 2 + 0.02;
const MAX_STEER_VISUAL_ANGLE = 0.5;

function buildShieldMesh(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(2.6, 14, 10);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd966,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 1.0;
  mesh.visible = false;
  return mesh;
}

/** Pairs a physics body with its mesh. Used for both the player and AI opponents. */
export class RaceCar {
  readonly physics = new CarPhysics();
  readonly mesh: THREE.Group;
  private readonly shieldMesh: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial | null;
  private readonly wheelPivots: THREE.Group[];
  private readonly wheelSpins: THREE.Mesh[];
  private readonly frontWheelCount: number;
  private steerVisualAngle = 0;
  /** per-car powerup pad cooldown, tracked here rather than in CarPhysics since it's pad-interaction state, not core physics */
  powerupCooldownRemaining = 0;
  /** throttles how often skid marks are dropped while drifting */
  skidMarkCooldownRemaining = 0;

  constructor(bodyColor?: number) {
    const built = buildCarMesh(bodyColor);
    this.mesh = built.group;
    this.wheelPivots = built.wheelPivots;
    this.wheelSpins = built.wheelSpins;
    this.frontWheelCount = built.frontWheelCount;
    this.shieldMesh = buildShieldMesh();
    this.mesh.add(this.shieldMesh);
    const body = this.mesh.getObjectByName("carBody") as THREE.Mesh | undefined;
    this.bodyMaterial = (body?.material as THREE.MeshStandardMaterial) ?? null;
  }

  /** Recolors the car body in place (e.g. after a garage color purchase). */
  setBodyColor(hex: number) {
    this.bodyMaterial?.color.setHex(hex);
  }

  update(dt: number, input: CarInput) {
    this.physics.update(dt, input);
    this.syncMesh(dt);
  }

  /**
   * Call after directly mutating physics state (e.g. collision response) to keep the
   * mesh in sync. dt drives the purely cosmetic wheel roll/steer animation; pass 0 to
   * skip it (e.g. an instantaneous reposition where nothing should visibly spin).
   */
  syncMesh(dt = 0) {
    this.mesh.position.copy(this.physics.position);
    this.mesh.rotation.y = this.physics.heading;
    this.shieldMesh.visible = this.physics.isShielded;

    if (dt > 0) {
      const rollDelta = (this.physics.forwardSpeed * dt) / WHEEL_RADIUS;
      for (const spin of this.wheelSpins) spin.rotation.x += rollDelta;

      const targetSteerAngle = this.physics.lastSteerInput * MAX_STEER_VISUAL_ANGLE;
      this.steerVisualAngle += (targetSteerAngle - this.steerVisualAngle) * smoothingFactor(10, dt);
      for (let i = 0; i < this.frontWheelCount; i++) this.wheelPivots[i].rotation.y = this.steerVisualAngle;
    }
  }

  setStart(position: THREE.Vector3, heading: number) {
    this.physics.setTransform(position, heading);
    this.powerupCooldownRemaining = 0;
    this.skidMarkCooldownRemaining = 0;
    this.steerVisualAngle = 0;
    for (const pivot of this.wheelPivots) pivot.rotation.y = 0;
    this.syncMesh();
  }

  /** World positions of the left/right rear wheel contact points, for skid marks. */
  getRearWheelPositions(): [THREE.Vector3, THREE.Vector3] {
    const h = this.physics.heading;
    const forward = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    const rearCenter = this.physics.position.clone().addScaledVector(forward, -REAR_OFFSET);
    return [
      rearCenter.clone().addScaledVector(right, -WHEEL_TRACK),
      rearCenter.clone().addScaledVector(right, WHEEL_TRACK),
    ];
  }
}
