import * as THREE from "three";
import type { Track } from "../track/TrackBuilder";

export interface MinimapEntry {
  position: THREE.Vector3;
  color: string;
  isPlayer?: boolean;
}

const SIZE = 170;
const MARGIN = 16;

/** Small top-down canvas overlay: draws the active track's outline, redraws car dots each frame. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private trackPoints: { x: number; y: number }[] = [];

  private scale = 1;
  private offsetX = 0;
  private offsetZ = 0;

  constructor(container: HTMLElement, track: Track) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.className = "minimap";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.setTrack(track);
  }

  /** Recomputes the outline for a different track (e.g. after switching tracks in the menu). */
  setTrack(track: Track) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.point.x);
      maxX = Math.max(maxX, s.point.x);
      minZ = Math.min(minZ, s.point.z);
      maxZ = Math.max(maxZ, s.point.z);
    }

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const available = SIZE - MARGIN * 2;
    this.scale = available / Math.max(spanX, spanZ);
    this.offsetX = MARGIN - minX * this.scale + (available - spanX * this.scale) / 2;
    this.offsetZ = MARGIN - minZ * this.scale + (available - spanZ * this.scale) / 2;

    this.trackPoints = track.samples.map((s) => this.toCanvas(s.point.x, s.point.z));
  }

  private toCanvas(x: number, z: number): { x: number; y: number } {
    return { x: x * this.scale + this.offsetX, y: z * this.scale + this.offsetZ };
  }

  update(entries: MinimapEntry[]) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "rgba(8, 18, 12, 0.55)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.beginPath();
    this.trackPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();

    for (const entry of entries) {
      const p = this.toCanvas(entry.position.x, entry.position.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, entry.isPlayer ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = entry.color;
      ctx.fill();
      if (entry.isPlayer) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }
  }

  show() {
    this.canvas.classList.remove("hidden");
  }

  hide() {
    this.canvas.classList.add("hidden");
  }
}
