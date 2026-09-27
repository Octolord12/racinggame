export const CONFIG = {
  car: {
    // top speed on-track / in reverse, m/s (40 m/s ~= 144 km/h)
    maxSpeed: 40,
    maxReverseSpeed: 12,

    acceleration: 18, // m/s^2 while accelerating
    brakeDeceleration: 30, // m/s^2 while braking with forward speed
    reverseAcceleration: 14, // m/s^2 while accelerating backward from a stop
    handbrakeDeceleration: 22, // extra m/s^2 removed from forward speed while handbraking

    rollingResistance: 4, // constant m/s^2 decel with no input
    dragCoefficient: 0.6, // speed-proportional decel with no input

    // steering tightens (higher rad/s) at low speed, loosens at top speed for stability
    maxTurnRate: 2.6, // rad/s at ~0 speed
    minTurnRate: 1.0, // rad/s at max speed
    // m/s below which steering has no effect. Kept low: at 0.6 a car pinned dead against a
    // wall (forwardSpeed reset near 0 by the wall collision every frame) could never cross
    // this gate and would be stuck facing the wall forever, unable to steer away.
    minSpeedToTurn: 0.15,

    driftFactor: 0.9, // how much cornering converts forward speed into slide
    handbrakeDriftFactor: 1.3,
    gripRecovery: 6.0, // 1/s, how fast slide decays back to zero (normal grip)
    handbrakeGripRecovery: 2.8, // slower recovery than normal grip = more slide while handbraking

    length: 4.2,
    width: 1.9,
    height: 1.1,
    collisionRadius: 1.15, // circle approximation used for car-car and car-wall collision

    boostMultiplier: 1.35, // top-speed multiplier while boosted
    boostDuration: 1.2, // seconds a boost pad's effect lasts
  },

  track: {
    width: 12,
    wallHeight: 0.6,
    wallThickness: 0.4,
    sampleCount: 240,
  },

  collision: {
    wallRestitution: 0.35, // bounce strength off the curb walls
    wallImpactDrag: 0.45, // multiplies the car's ENTIRE velocity on wall impact (not just the bounce) — the real "that hurt"
    carRestitution: 0.5, // bounce strength between two cars
    carImpactDrag: 0.6, // multiplies both cars' ENTIRE velocity on a car-car hit
  },

  camera: {
    distance: 9,
    height: 3.6,
    lookAtHeight: 1.1,
    followLerp: 6, // higher = camera catches up to the car faster
    lookLerp: 8,
  },

  race: {
    totalLaps: 3,
    countdownSeconds: 3,
    aiCount: 3,
  },

  boost: {
    padHalfLengthSamples: 4, // how many centerline samples on either side of center count as "on the pad"
    cooldownSeconds: 1.5, // per car, so idling on a pad doesn't re-trigger every frame
  },

  skid: {
    lateralSpeedThreshold: 3.0, // m/s of slide before marks start laying down
    minForwardSpeed: 3.0, // don't lay marks while basically stopped
    markIntervalSeconds: 0.045, // ~22/s per wheel while drifting
    maxMarks: 600,
  },

  audio: {
    minPitchHz: 65,
    maxPitchHz: 220,
    idleVolume: 0.035,
    throttleVolume: 0.14,
  },

  ai: {
    steerLookaheadMeters: 14, // how far ahead along the centerline the AI aims its steering
    curveLookaheadMeters: 32, // how far ahead the AI "sees" to slow down for upcoming curves
    steerGain: 2.2, // proportional gain from heading error to steering input
    curveSlowdownStrength: 0.65, // fraction of speed shed for the sharpest curves
    // radians of tangent turn (over the curve lookahead) treated as "sharpest".
    // Measured against Track 1's own centerline: median turn ~0.68 rad, 90th pct ~1.35 rad
    // over a 32m lookahead, so 0.9 (below the median!) had AI braking hard almost everywhere.
    curveAngleForMinSpeed: 1.4,
    speedHysteresis: 1.5, // m/s dead zone between throttle and brake to avoid flickering
    // per-AI tuning: a top-speed fraction and a constant lateral offset from centerline (meters)
    // so the three opponents don't drive identically.
    drivers: [
      { speedFactor: 0.93, lateralOffset: -2.5, color: 0x3d6fd8 },
      { speedFactor: 0.88, lateralOffset: 0, color: 0xe0b530 },
      { speedFactor: 0.9, lateralOffset: 2.5, color: 0x3fae5c },
    ],
  },
};
