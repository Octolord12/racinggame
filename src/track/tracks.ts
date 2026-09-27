import * as THREE from "three";
import { TRACK_1_CONTROL_POINTS } from "./TrackData";
import { TRACK_2_CONTROL_POINTS } from "./Track2Data";
import { TRACK_3_CONTROL_POINTS } from "./Track3Data";
import { TRACK_4_CONTROL_POINTS } from "./Track4Data";
import type { PowerupPadDefinition } from "./TrackBuilder";

export interface TrackDefinition {
  id: string;
  name: string;
  controlPoints: THREE.Vector3[];
  powerupPads: PowerupPadDefinition[];
}

export const TRACKS: TrackDefinition[] = [
  {
    id: "sunny-loop",
    name: "Sunny Loop",
    controlPoints: TRACK_1_CONTROL_POINTS,
    powerupPads: [
      { fraction: 0.14, type: "boost" },
      { fraction: 0.5, type: "shield" },
      { fraction: 0.82, type: "grip" },
    ],
  },
  {
    id: "grand-oval",
    name: "Grand Oval",
    controlPoints: TRACK_2_CONTROL_POINTS,
    powerupPads: [
      { fraction: 0.18, type: "grip" },
      { fraction: 0.45, type: "boost" },
      { fraction: 0.68, type: "shield" },
      { fraction: 0.88, type: "boost" },
    ],
  },
  {
    id: "switchback-canyon",
    name: "Switchback Canyon",
    controlPoints: TRACK_3_CONTROL_POINTS,
    powerupPads: [
      { fraction: 0.18, type: "grip" },
      { fraction: 0.4, type: "grip" },
      { fraction: 0.58, type: "boost" },
      { fraction: 0.61, type: "grip" },
      { fraction: 0.85, type: "shield" },
    ],
  },
  {
    id: "coastal-sprint",
    name: "Coastal Sprint",
    controlPoints: TRACK_4_CONTROL_POINTS,
    powerupPads: [
      { fraction: 0.1, type: "boost" },
      { fraction: 0.35, type: "shield" },
      { fraction: 0.6, type: "boost" },
      { fraction: 0.85, type: "boost" },
    ],
  },
];
