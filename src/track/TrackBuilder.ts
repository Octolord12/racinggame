import * as THREE from "three";
import { CONFIG } from "../config";

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
}

export interface TrackQueryResult {
  /** index of the nearest centerline sample */
  index: number;
  /** signed distance from centerline along the sample's right vector */
  lateral: number;
  /** unsigned distance to the nearest centerline sample point */
  distance: number;
  /** true if within the paved road width */
  onTrack: boolean;
}

export interface FinishLine {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  halfWidth: number;
}

export type PowerupType = "boost" | "shield" | "grip";

export interface PowerupPadDefinition {
  /** where the pad sits, as a fraction (0..1) of the way around the centerline */
  fraction: number;
  type: PowerupType;
}

const START_OFFSET_BEHIND_LINE = 8;

const POWERUP_PAD_COLORS: Record<PowerupType, { color: number; emissive: number }> = {
  boost: { color: 0x1fb6c9, emissive: 0x36e0f5 },
  shield: { color: 0xcfa227, emissive: 0xffd966 },
  grip: { color: 0x2e8b4f, emissive: 0x4fe08a },
};

/**
 * Builds a closed race track from a loop of control points: a paved road ribbon,
 * low curb walls along both edges, a checkered start/finish line, a grass plane,
 * and scattered procedural scenery. Also answers nearest-centerline queries used
 * for off-track slowdown, soft boundary clamping, and lap-progress tracking.
 */
export class Track {
  readonly group = new THREE.Group();
  readonly samples: TrackSample[] = [];
  readonly halfWidth = CONFIG.track.width / 2;
  readonly totalLength: number;
  private readonly powerupPads: { index: number; type: PowerupType }[];
  private readonly powerupPadMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(controlPoints: THREE.Vector3[], powerupPadDefinitions: PowerupPadDefinition[] = []) {
    const curve = new THREE.CatmullRomCurve3(controlPoints, true, "catmullrom", 0.5);
    this.totalLength = curve.getLength();

    const n = CONFIG.track.sampleCount;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const point = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      this.samples.push({ point, tangent, right });
    }

    this.powerupPads = powerupPadDefinitions.map((def) => ({
      index: Math.round((((def.fraction % 1) + 1) % 1) * n),
      type: def.type,
    }));

    this.group.add(this.buildGround());
    this.group.add(this.buildRoad());
    this.group.add(this.buildWall(1));
    this.group.add(this.buildWall(-1));
    this.group.add(this.buildFinishLine());
    this.group.add(this.buildScenery());
    for (const pad of this.powerupPads) this.group.add(this.buildPowerupPad(pad.index, pad.type));
  }

  /** Returns the powerup type at this position, or null. Cooldowns are the caller's job. */
  getPowerupPadAt(query: TrackQueryResult): PowerupType | null {
    if (!query.onTrack) return null;
    const n = this.samples.length;
    for (const pad of this.powerupPads) {
      const raw = Math.abs(query.index - pad.index);
      const circularDistance = Math.min(raw, n - raw);
      if (circularDistance <= CONFIG.powerups.padHalfLengthSamples) return pad.type;
    }
    return null;
  }

  /** Call once a frame with elapsed seconds to pulse the powerup pad glow. */
  updatePowerupPadGlow(elapsedSeconds: number) {
    const pulse = 0.55 + 0.45 * Math.sin(elapsedSeconds * 5);
    for (const material of this.powerupPadMaterials) material.emissiveIntensity = pulse;
  }

  /**
   * World-space transform for placing a car at the grid, a little behind the start
   * line and facing the first tangent, so the launch across the line is a genuine
   * forward crossing rather than starting the car sitting exactly on top of it.
   */
  getStartTransform(): { position: THREE.Vector3; heading: number } {
    return this.getGridTransform(START_OFFSET_BEHIND_LINE, 0);
  }

  /** Like getStartTransform, but with a configurable distance behind the line and lateral offset, for grid slots. */
  getGridTransform(distanceBehindLine: number, lateralOffset: number): { position: THREE.Vector3; heading: number } {
    const s = this.samples[0];
    const heading = Math.atan2(s.tangent.x, s.tangent.z);
    const position = s.point
      .clone()
      .addScaledVector(s.tangent, -distanceBehindLine)
      .addScaledVector(s.right, lateralOffset);
    return { position, heading };
  }

  getFinishLine(): FinishLine {
    const s = this.samples[0];
    return { point: s.point, tangent: s.tangent, right: s.right, halfWidth: this.halfWidth };
  }

  /** Finds the nearest centerline sample to a world position and the car's lateral offset from it. */
  sampleAt(position: THREE.Vector3): TrackQueryResult {
    let bestIndex = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const dx = position.x - this.samples[i].point.x;
      const dz = position.z - this.samples[i].point.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }
    const s = this.samples[bestIndex];
    const dx = position.x - s.point.x;
    const dz = position.z - s.point.z;
    const lateral = dx * s.right.x + dz * s.right.z;
    return {
      index: bestIndex,
      lateral,
      distance: Math.sqrt(bestDistSq),
      onTrack: Math.abs(lateral) <= this.halfWidth,
    };
  }

  private buildGround(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(500, 500);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x2f7a3c, roughness: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRoad(): THREE.Mesh {
    const n = this.samples.length;
    const positions = new Float32Array(n * 2 * 3);
    const normals = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const left = s.point.clone().addScaledVector(s.right, -this.halfWidth);
      const rightPt = s.point.clone().addScaledVector(s.right, this.halfWidth);

      const vi = i * 2;
      positions.set([left.x, 0.02, left.z], vi * 3);
      positions.set([rightPt.x, 0.02, rightPt.z], (vi + 1) * 3);
      normals.set([0, 1, 0], vi * 3);
      normals.set([0, 1, 0], (vi + 1) * 3);
      const v = i / n;
      uvs.set([0, v], vi * 2);
      uvs.set([1, v], (vi + 1) * 2);

      const ni = (i + 1) % n;
      const a = vi;
      const b = vi + 1;
      const c = ni * 2;
      const d = ni * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.9, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  /** side: 1 for the right edge wall, -1 for the left edge wall. */
  private buildWall(side: 1 | -1): THREE.Mesh {
    const n = this.samples.length;
    const h = CONFIG.track.wallHeight;
    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    const indices: number[] = [];

    const red = new THREE.Color(0xd23c3c);
    const white = new THREE.Color(0xf2f2f2);

    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const base = s.point.clone().addScaledVector(s.right, side * this.halfWidth);
      const vi = i * 2;
      positions.set([base.x, 0.02, base.z], vi * 3);
      positions.set([base.x, 0.02 + h, base.z], (vi + 1) * 3);

      const stripe = Math.floor(i / 4) % 2 === 0 ? red : white;
      colors.set([stripe.r, stripe.g, stripe.b], vi * 3);
      colors.set([stripe.r, stripe.g, stripe.b], (vi + 1) * 3);

      const ni = (i + 1) % n;
      const a = vi;
      const b = vi + 1;
      const c = ni * 2;
      const d = ni * 2 + 1;
      if (side === 1) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildFinishLine(): THREE.Mesh {
    const s = this.samples[0];
    const cols = 8;
    const rowDepth = 2;
    const cellWidth = (this.halfWidth * 2) / cols;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const black = new THREE.Color(0x111111);
    const white = new THREE.Color(0xf5f5f5);

    for (let col = 0; col < cols; col++) {
      const offsetA = -this.halfWidth + col * cellWidth;
      const offsetB = offsetA + cellWidth;
      const p0 = s.point.clone().addScaledVector(s.right, offsetA).addScaledVector(s.tangent, -rowDepth / 2);
      const p1 = s.point.clone().addScaledVector(s.right, offsetB).addScaledVector(s.tangent, -rowDepth / 2);
      const p2 = s.point.clone().addScaledVector(s.right, offsetB).addScaledVector(s.tangent, rowDepth / 2);
      const p3 = s.point.clone().addScaledVector(s.right, offsetA).addScaledVector(s.tangent, rowDepth / 2);

      const vi = positions.length / 3;
      for (const p of [p0, p1, p2, p3]) positions.push(p.x, 0.03, p.z);
      const c = col % 2 === 0 ? white : black;
      for (let k = 0; k < 4; k++) colors.push(c.r, c.g, c.b);
      indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildPowerupPad(sampleIndex: number, type: PowerupType): THREE.Mesh {
    const s = this.samples[sampleIndex];
    const padWidth = this.halfWidth * 2 * 0.7;
    const padLength = 6;
    const colors = POWERUP_PAD_COLORS[type];

    const geometry = new THREE.PlaneGeometry(padWidth, padLength);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: colors.color,
      emissive: colors.emissive,
      emissiveIntensity: 0.7,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    this.powerupPadMaterials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(s.point);
    mesh.position.y = 0.025;
    mesh.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
    return mesh;
  }

  private buildScenery(): THREE.Group {
    const group = new THREE.Group();
    const maxTrees = 90;
    const placed: { x: number; z: number }[] = [];
    const minSpacing = 9;

    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.2, 6);
    const foliageGeo = new THREE.ConeGeometry(2.4, 4.5, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1f6b34, roughness: 1 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
    const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, maxTrees);
    trunks.castShadow = true;
    foliage.castShadow = true;

    const dummy = new THREE.Object3D();
    let count = 0;
    let attempts = 0;
    const bound = 130;

    while (count < maxTrees && attempts < maxTrees * 40) {
      attempts++;
      const x = (Math.random() * 2 - 1) * bound;
      const z = (Math.random() * 2 - 1) * bound;
      const query = this.sampleAt(new THREE.Vector3(x, 0, z));
      if (query.distance < this.halfWidth + 14 || query.distance > 60) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)) continue;
      placed.push({ x, z });

      dummy.position.set(x, 1.1, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(count, dummy.matrix);

      dummy.position.set(x, 3.4, z);
      dummy.updateMatrix();
      foliage.setMatrixAt(count, dummy.matrix);
      count++;
    }

    trunks.count = count;
    foliage.count = count;
    group.add(trunks, foliage);
    return group;
  }
}
