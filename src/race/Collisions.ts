import * as THREE from "three";
import { CONFIG } from "../config";
import type { CarPhysics } from "../car/CarPhysics";
import type { Track, TrackQueryResult } from "../track/TrackBuilder";

const scratchVelocity = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();

/**
 * Pushes a car back inside the curb walls, bounces the velocity component driving
 * it into the wall, and then applies an overall impact drag to the *whole*
 * velocity (including the tangential/along-wall part) so scraping or ramming a
 * wall costs real speed rather than just being redirected. This used to only
 * touch the normal component, to stop a car pinned dead against a wall from
 * getting its forward speed erased every frame before it could ever cross the
 * turn-speed gate and steer away (a permanent soft-lock). That's now handled by
 * CONFIG.car.minSpeedToTurn being low enough that even the reduced speed left
 * after this drag still clears it, so the stronger, more punishing drag is safe.
 */
export function resolveWallCollision(car: CarPhysics, track: Track, query: TrackQueryResult) {
  const limit = track.halfWidth - CONFIG.car.collisionRadius;
  if (Math.abs(query.lateral) <= limit) return;

  const sign = Math.sign(query.lateral);
  const excess = Math.abs(query.lateral) - limit;
  const sample = track.samples[query.index];

  car.position.addScaledVector(sample.right, -sign * excess);

  scratchNormal.copy(sample.right).multiplyScalar(sign);
  scratchVelocity.copy(car.getWorldVelocity());
  const normalSpeed = scratchVelocity.dot(scratchNormal);
  if (normalSpeed > 0) {
    scratchVelocity.addScaledVector(scratchNormal, -normalSpeed * (1 + CONFIG.collision.wallRestitution));
    scratchVelocity.multiplyScalar(CONFIG.collision.wallImpactDrag);
    car.setWorldVelocity(scratchVelocity);
  }
}

const relativeVelocity = new THREE.Vector3();
const collisionNormal = new THREE.Vector3();
const velocityA = new THREE.Vector3();
const velocityB = new THREE.Vector3();

/**
 * Circle-circle collision between two cars: separates overlap, bounces both
 * along the contact normal, then applies an overall impact drag to each car's
 * full velocity (see resolveWallCollision for why the drag covers the whole
 * vector rather than just the normal impulse).
 */
export function resolveCarCollision(a: CarPhysics, b: CarPhysics) {
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  const distSq = dx * dx + dz * dz;
  const minDist = CONFIG.car.collisionRadius * 2;
  if (distSq >= minDist * minDist || distSq < 1e-8) return;

  const dist = Math.sqrt(distSq);
  collisionNormal.set(dx / dist, 0, dz / dist);
  const overlap = minDist - dist;

  a.position.addScaledVector(collisionNormal, -overlap * 0.5);
  b.position.addScaledVector(collisionNormal, overlap * 0.5);

  velocityA.copy(a.getWorldVelocity());
  velocityB.copy(b.getWorldVelocity());
  relativeVelocity.subVectors(velocityB, velocityA);
  const closingSpeed = relativeVelocity.dot(collisionNormal);
  if (closingSpeed >= 0) return; // already separating

  const impulse = (-(1 + CONFIG.collision.carRestitution) * closingSpeed) / 2;
  velocityA.addScaledVector(collisionNormal, -impulse);
  velocityB.addScaledVector(collisionNormal, impulse);
  velocityA.multiplyScalar(CONFIG.collision.carImpactDrag);
  velocityB.multiplyScalar(CONFIG.collision.carImpactDrag);

  a.setWorldVelocity(velocityA);
  b.setWorldVelocity(velocityB);
}
