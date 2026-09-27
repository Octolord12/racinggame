import * as THREE from "three";

/**
 * A tighter, technical loop: three hairpin-style direction reversals on the
 * outbound leg (kept within a right-of-center corridor), then a wide return leg
 * well clear to the west so it can't pass close to the hairpins after smoothing.
 */
export const TRACK_3_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -90),
  new THREE.Vector3(35, 0, -85),
  new THREE.Vector3(45, 0, -50),
  new THREE.Vector3(20, 0, -30),
  new THREE.Vector3(-15, 0, -40),
  new THREE.Vector3(-20, 0, -10),
  new THREE.Vector3(0, 0, 5),
  new THREE.Vector3(25, 0, 15),
  new THREE.Vector3(40, 0, 45),
  new THREE.Vector3(15, 0, 70),
  new THREE.Vector3(-30, 0, 65),
  new THREE.Vector3(-70, 0, 30),
  new THREE.Vector3(-75, 0, -30),
  new THREE.Vector3(-45, 0, -75),
];
