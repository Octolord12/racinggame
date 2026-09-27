import * as THREE from "three";

/**
 * Control points for the closed track centerline (x, z in meters).
 * Fed into a closed Catmull-Rom spline. Point 0 is the start/finish line.
 */
export const TRACK_1_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -60),
  new THREE.Vector3(38, 0, -58),
  new THREE.Vector3(66, 0, -32),
  new THREE.Vector3(70, 0, 4),
  new THREE.Vector3(48, 0, 30),
  new THREE.Vector3(20, 0, 20),
  new THREE.Vector3(0, 0, 34),
  new THREE.Vector3(-20, 0, 20),
  new THREE.Vector3(-48, 0, 30),
  new THREE.Vector3(-70, 0, 4),
  new THREE.Vector3(-66, 0, -32),
  new THREE.Vector3(-38, 0, -58),
];
