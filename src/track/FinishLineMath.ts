import * as THREE from "three";
import type { FinishLine } from "./TrackBuilder";

/** Signed distance of a point from the finish line's plane, along its tangent (forward = positive). */
export function signedDistanceAlongLine(finishLine: FinishLine, pos: THREE.Vector3): number {
  const t = finishLine.tangent;
  const p = finishLine.point;
  return (pos.x - p.x) * t.x + (pos.z - p.z) * t.z;
}

/** Signed offset of a point from the finish line's centerpoint, along its right vector. */
export function lateralOffsetFromLine(finishLine: FinishLine, pos: THREE.Vector3): number {
  const r = finishLine.right;
  const p = finishLine.point;
  return (pos.x - p.x) * r.x + (pos.z - p.z) * r.z;
}
