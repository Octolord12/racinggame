import * as THREE from "three";

/**
 * A large inward-facing sphere with a vertical vertex-color gradient, standing in
 * for a skybox. Ignores scene fog (it IS the backdrop fog fades into, not part of
 * the world) so it stays a crisp gradient regardless of draw distance.
 */
export function buildSky(topColor: number, horizonColor: number, radius = 400): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 24, 16);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(topColor);
  const horizon = new THREE.Color(horizonColor);
  const c = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / radius; // -1 (bottom) .. 1 (top)
    const t = Math.pow(Math.max(y, 0), 0.6);
    c.copy(horizon).lerp(top, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1000;
  return mesh;
}
