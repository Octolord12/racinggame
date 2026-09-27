import * as THREE from "three";
import { buildCarMesh } from "./CarMesh";
import { CarPhysics } from "./CarPhysics";
import type { CarInput } from "./CarPhysics";
import { CONFIG } from "../config";

const REAR_OFFSET = CONFIG.car.length / 2 - 0.7;
const WHEEL_TRACK = CONFIG.car.width / 2 + 0.02;

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
  /** per-car powerup pad cooldown, tracked here rather than in CarPhysics since it's pad-interaction state, not core physics */
  powerupCooldownRemaining = 0;
  /** throttles how often skid marks are dropped while drifting */
  skidMarkCooldownRemaining = 0;

  constructor(bodyColor?: number) {
    this.mesh = buildCarMesh(bodyColor);
    this.shieldMesh = buildShieldMesh();
    this.mesh.add(this.shieldMesh);
  }

  update(dt: number, input: CarInput) {
    this.physics.update(dt, input);
    this.syncMesh();
  }

  /** Call after directly mutating physics state (e.g. collision response) to keep the mesh in sync. */
  syncMesh() {
    this.mesh.position.copy(this.physics.position);
    this.mesh.rotation.y = this.physics.heading;
    this.shieldMesh.visible = this.physics.isShielded;
  }

  setStart(position: THREE.Vector3, heading: number) {
    this.physics.setTransform(position, heading);
    this.powerupCooldownRemaining = 0;
    this.skidMarkCooldownRemaining = 0;
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
