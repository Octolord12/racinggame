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

/**
 * Procedural car paint texture: a near-white base (so material.color still tints it
 * correctly — texture * color, standard PBR albedo multiply) with a soft radial
 * falloff toward the edges for a cheap fake sheen/AO, plus fine metallic-fleck
 * speckle. Shared across every car; each car's own body color comes from
 * material.color, not this texture.
 */
export function createCarPaintTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size);

  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.32, size * 0.08, size * 0.5, size * 0.5, size * 0.72);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#c7c7cc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.4 + Math.random() * 0.8;
    ctx.fillStyle = `rgba(255,255,255,${(0.2 + Math.random() * 0.35).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural tire texture: dark rubber with circumferential tread grooves and a
 * touch of grain. Wraps around the wheel cylinder's circumference (U axis).
 */
export function createTireTexture(): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#161616";
  ctx.fillRect(0, 0, size, size);

  const grooves = 20;
  for (let i = 0; i < grooves; i++) {
    const x = (i / grooves) * size;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, 0, (size / grooves) * 0.35, size);
  }
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.06).toFixed(2)})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  return texture;
}

/** Procedural bark texture: vertical brown streaks of varying width and shade. */
export function createBarkTexture(): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#5a3d24";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 45; i++) {
    const x = Math.random() * size;
    const w = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(28,17,10,0.35)" : "rgba(130,98,64,0.22)";
    ctx.fillRect(x, 0, w, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

/** Procedural foliage texture: mottled green blotches so canopies don't read as flat color. */
export function createFoliageTexture(): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#2b6b34";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 550; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(14,42,19,0.3)" : "rgba(96,158,75,0.25)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}
