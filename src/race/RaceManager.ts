import type { CarPhysics } from "../car/CarPhysics";
import type { Track } from "../track/TrackBuilder";
import { lateralOffsetFromLine, signedDistanceAlongLine } from "../track/FinishLineMath";

interface Racer {
  id: string;
  physics: CarPhysics;
  lapsCompleted: number;
  prevSigned: number;
}

/**
 * Tracks every car's progress around the track (independent of the player-facing
 * race state machine in core/Game.ts) purely to order 1st..Nth for the position HUD
 * and minimap. Uses the same finish-line-crossing technique as Game, but without its
 * countdown/finish bookkeeping.
 */
export class RaceManager {
  private readonly racers: Racer[] = [];
  private readonly track: Track;

  constructor(track: Track) {
    this.track = track;
  }

  register(id: string, physics: CarPhysics) {
    const finishLine = this.track.getFinishLine();
    this.racers.push({
      id,
      physics,
      lapsCompleted: 0,
      prevSigned: signedDistanceAlongLine(finishLine, physics.position),
    });
  }

  update() {
    const finishLine = this.track.getFinishLine();
    for (const racer of this.racers) {
      const nowSigned = signedDistanceAlongLine(finishLine, racer.physics.position);
      const lateral = lateralOffsetFromLine(finishLine, racer.physics.position);
      const crossedForward = racer.prevSigned <= 0 && nowSigned > 0;
      if (crossedForward && Math.abs(lateral) < finishLine.halfWidth) {
        racer.lapsCompleted += 1;
      }
      racer.prevSigned = nowSigned;
    }
  }

  /** Ordered array of racer ids, 1st place first. */
  getStandings(): string[] {
    return [...this.racers].sort((a, b) => this.progress(b) - this.progress(a)).map((r) => r.id);
  }

  /** 1-based position of the given racer id, or null if not registered. */
  getPosition(id: string): number | null {
    const standings = this.getStandings();
    const index = standings.indexOf(id);
    return index === -1 ? null : index + 1;
  }

  private progress(racer: Racer): number {
    const query = this.track.sampleAt(racer.physics.position);
    return racer.lapsCompleted * this.track.samples.length + query.index;
  }
}
