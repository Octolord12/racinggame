import * as THREE from "three";
import { CONFIG } from "../config";

const dummy = new THREE.Object3D();

/**
 * Dark tire-mark decals dropped behind a drifting car's rear wheels. Uses a single
 * InstancedMesh as a ring buffer (oldest mark's instance gets reused once the pool
 * is full) so this stays one draw call regardless of how long a race runs.
 */
export class SkidMarks {
  private readonly mesh: THREE.InstancedMesh;
  private nextSlot = 0;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(0.3, 0.9);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, CONFIG.skid.maxMarks);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < CONFIG.skid.maxMarks; i++) this.mesh.setMatrixAt(i, dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);
  }

  addMark(position: THREE.Vector3, heading: number) {
    dummy.position.set(position.x, 0.024, position.z);
    dummy.rotation.set(0, heading, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(this.nextSlot, dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.nextSlot = (this.nextSlot + 1) % CONFIG.skid.maxMarks;
  }

  /** Hides every mark (e.g. on a race restart or track switch) without discarding the pool. */
  reset() {
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < CONFIG.skid.maxMarks; i++) this.mesh.setMatrixAt(i, dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.nextSlot = 0;
  }
}
