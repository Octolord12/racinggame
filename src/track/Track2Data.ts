import * as THREE from "three";

/** A wider, longer loop than Track 1, with a kink on the back straight instead of an S-chicane. */
export const TRACK_2_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -80),
  new THREE.Vector3(45, 0, -75),
  new THREE.Vector3(75, 0, -40),
  new THREE.Vector3(75, 0, 10),
  new THREE.Vector3(45, 0, 45),
  new THREE.Vector3(10, 0, 40),
  new THREE.Vector3(-10, 0, 55),
  new THREE.Vector3(-45, 0, 45),
  new THREE.Vector3(-75, 0, 10),
  new THREE.Vector3(-75, 0, -40),
  new THREE.Vector3(-45, 0, -75),
];
