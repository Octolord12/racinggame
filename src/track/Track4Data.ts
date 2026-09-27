import * as THREE from "three";

/** A large, fast loop of sweeping curves with no sharp turns, for a high-speed character. */
export const TRACK_4_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -110),
  new THREE.Vector3(50, 0, -100),
  new THREE.Vector3(90, 0, -50),
  new THREE.Vector3(95, 0, 20),
  new THREE.Vector3(60, 0, 80),
  new THREE.Vector3(0, 0, 60),
  new THREE.Vector3(-60, 0, 80),
  new THREE.Vector3(-95, 0, 20),
  new THREE.Vector3(-90, 0, -50),
  new THREE.Vector3(-50, 0, -100),
];
