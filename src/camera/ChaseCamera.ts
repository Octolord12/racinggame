import * as THREE from "three";
import { CONFIG } from "../config";
import { smoothingFactor } from "../utils/math";

const desiredPosition = new THREE.Vector3();
const forward = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

/** Smoothly follows a point behind and above the car, looking at it. */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private currentLookAt = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 700);
  }

  snapTo(position: THREE.Vector3, heading: number) {
    this.updateDesired(position, heading);
    this.camera.position.copy(desiredPosition);
    this.currentLookAt.copy(position).y += CONFIG.camera.lookAtHeight;
    this.camera.lookAt(this.currentLookAt);
    this.initialized = true;
  }

  update(dt: number, position: THREE.Vector3, heading: number) {
    if (!this.initialized) {
      this.snapTo(position, heading);
      return;
    }
    this.updateDesired(position, heading);
    this.camera.position.lerp(desiredPosition, smoothingFactor(CONFIG.camera.followLerp, dt));

    lookTarget.copy(position);
    lookTarget.y += CONFIG.camera.lookAtHeight;
    this.currentLookAt.lerp(lookTarget, smoothingFactor(CONFIG.camera.lookLerp, dt));
    this.camera.lookAt(this.currentLookAt);
  }

  private updateDesired(position: THREE.Vector3, heading: number) {
    forward.set(Math.sin(heading), 0, Math.cos(heading));
    desiredPosition
      .copy(position)
      .addScaledVector(forward, -CONFIG.camera.distance)
      .setY(position.y + CONFIG.camera.height);
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
