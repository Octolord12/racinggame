import * as THREE from "three";
import { CONFIG } from "../config";

/** Builds a simple low-poly car from primitives. Local forward is +Z, up is +Y. */
export function buildCarMesh(bodyColor = 0xd23c3c): THREE.Group {
  const car = new THREE.Group();
  const { length, width, height } = CONFIG.car;

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.1 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.3, metalness: 0.2 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffe38a, emissiveIntensity: 0.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x660000, emissive: 0x440000, emissiveIntensity: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.55, length), bodyMat);
  body.position.y = height * 0.55 * 0.5 + 0.25;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.75, height * 0.45, length * 0.45),
    cabinMat,
  );
  cabin.position.set(0, height * 0.55 + 0.25 + (height * 0.45) / 2 - 0.05, -length * 0.05);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelRadius = 0.42;
  const wheelWidth = 0.32;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelOffsets: [number, number][] = [
    [width / 2 + 0.02, length / 2 - 0.7],
    [-(width / 2 + 0.02), length / 2 - 0.7],
    [width / 2 + 0.02, -length / 2 + 0.7],
    [-(width / 2 + 0.02), -length / 2 + 0.7],
  ];
  for (const [x, z] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, wheelRadius, z);
    wheel.castShadow = true;
    car.add(wheel);
  }

  const headlightGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
  for (const x of [width / 2 - 0.25, -(width / 2 - 0.25)]) {
    const headlight = new THREE.Mesh(headlightGeo, lightMat);
    headlight.position.set(x, height * 0.55 * 0.5 + 0.25, length / 2 - 0.05);
    car.add(headlight);

    const taillight = new THREE.Mesh(headlightGeo, tailMat);
    taillight.position.set(x, height * 0.55 * 0.5 + 0.25, -length / 2 + 0.05);
    car.add(taillight);
  }

  return car;
}
