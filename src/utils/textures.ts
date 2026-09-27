import * as THREE from "three";

/** Small helper: a fresh offscreen canvas at the given size with its 2D context. */
function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/**
 * Procedural grass texture: a flat green base speckled with darker/lighter blotches
 * so the ground doesn't read as a single flat color up close. No external assets —
 * drawn once to a canvas and used as a repeating texture.
 */
export function createGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#2f7a3c";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(18,58,26,0.22)" : "rgba(104,176,92,0.16)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  return texture;
}

/**
 * Procedural asphalt texture: dark base with fine light/dark speckle for an
 * aggregate look, plus a faint centerline-adjacent darkening for tire-worn lanes.
 * repeatAlongLength should be set per-track from its actual centerline length so
 * the grain reads at a consistent physical scale regardless of track size.
 */
export function createAsphaltTexture(repeatAlongLength: number): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#38383d";
  ctx.fillRect(0, 0, size, size);

  // faint worn-lane darkening either side of center
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(size * 0.22, 0, size * 0.14, size);
  ctx.fillRect(size * 0.64, 0, size * 0.14, size);

  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 1.3;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, Math.max(1, Math.round(repeatAlongLength)));
  return texture;
}
