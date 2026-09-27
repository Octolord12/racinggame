import * as THREE from "three";
import { TRACK_1_CONTROL_POINTS } from "./TrackData";
import { TRACK_2_CONTROL_POINTS } from "./Track2Data";

export interface TrackDefinition {
  id: string;
  name: string;
  controlPoints: THREE.Vector3[];
  /** where boost pads sit, as fractions (0..1) of the way around the centerline */
  boostPadFractions: number[];
}

export const TRACKS: TrackDefinition[] = [
  {
    id: "sunny-loop",
    name: "Sunny Loop",
    controlPoints: TRACK_1_CONTROL_POINTS,
    boostPadFractions: [0.14, 0.5, 0.82],
  },
  {
    id: "grand-oval",
    name: "Grand Oval",
    controlPoints: TRACK_2_CONTROL_POINTS,
    boostPadFractions: [0.22, 0.62],
  },
];
