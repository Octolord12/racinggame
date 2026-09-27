import * as THREE from "three";
import { CONFIG } from "../config";

/** Builds a simple low-poly car from primitives. Local forward is +Z, up is +Y. */
export function buildCarMesh(bodyColor = 0xd23c3c): THREE.Group {
  const car = new THREE.Group();
  const { length, width, height } = CONFIG.car;

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.15 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.3, metalness: 0.2 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubcapMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, roughness: 0.35, metalness: 0.6 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffe38a, emissiveIntensity: 0.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x660000, emissive: 0x440000, emissiveIntensity: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.3 });

  const bodyY = height * 0.55 * 0.5 + 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.55, length), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.75, height * 0.45, length * 0.45),
    cabinMat,
  );
  cabin.position.set(0, height * 0.55 + 0.25 + (height * 0.45) / 2 - 0.05, -length * 0.05);
  cabin.castShadow = true;
  car.add(cabin);

  // front splitter and rear bumper trim, for a bit more shape than a plain box
  const bumperGeo = new THREE.BoxGeometry(width * 0.96, height * 0.14, 0.18);
  const frontBumper = new THREE.Mesh(bumperGeo, trimMat);
  frontBumper.position.set(0, bodyY - height * 0.55 * 0.5 + 0.06, length / 2 - 0.06);
  car.add(frontBumper);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = -length / 2 + 0.06;
  car.add(rearBumper);

  // side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.12, 0.12, 0.22);
  for (const x of [width / 2 + 0.1, -(width / 2 + 0.1)]) {
    const mirror = new THREE.Mesh(mirrorGeo, cabinMat);
    mirror.position.set(x, bodyY + height * 0.18, length * 0.08);
    car.add(mirror);
  }

  // rear spoiler on two thin struts
  const spoilerWingGeo = new THREE.BoxGeometry(width * 0.85, 0.06, 0.3);
  const spoiler = new THREE.Mesh(spoilerWingGeo, trimMat);
  spoiler.position.set(0, bodyY + height * 0.5, -length / 2 + 0.35);
  car.add(spoiler);
  const strutGeo = new THREE.BoxGeometry(0.06, height * 0.3, 0.06);
  for (const x of [width * 0.32, -width * 0.32]) {
    const strut = new THREE.Mesh(strutGeo, trimMat);
    strut.position.set(x, bodyY + height * 0.25, -length / 2 + 0.35);
    car.add(strut);
  }

  const wheelRadius = 0.42;
  const wheelWidth = 0.32;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubcapGeo = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, wheelWidth * 0.7, 10);
  hubcapGeo.rotateZ(Math.PI / 2);
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

    const hubOffset = Math.sign(x) * (wheelWidth * 0.5 + 0.01);
    const hubcap = new THREE.Mesh(hubcapGeo, hubcapMat);
    hubcap.position.set(x + hubOffset, wheelRadius, z);
    car.add(hubcap);
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
