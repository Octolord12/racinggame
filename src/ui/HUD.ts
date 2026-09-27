import type { CarPhysics } from "../car/CarPhysics";
import { Game } from "../core/Game";
import { formatOrdinal, formatTime } from "../utils/math";

export class HUD {
  private root: HTMLDivElement;
  private speedValue: HTMLDivElement;
  private lapLabel: HTMLDivElement;
  private currentTimeLabel: HTMLDivElement;
  private bestTimeLabel: HTMLDivElement;
  private positionLabel: HTMLDivElement;
  private powerupsLabel: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hud-position"></div>
      <div class="hud-speed"><span class="value">0</span><span class="unit"> km/h</span></div>
      <div class="hud-laps">Lap 1 / 3</div>
      <div class="hud-times">
        <div class="current">Time 0:00.000</div>
        <div class="best">Best --:--.---</div>
      </div>
      <div class="hud-powerups"></div>
    `;
    container.appendChild(this.root);

    this.speedValue = this.root.querySelector(".hud-speed .value")!;
    this.lapLabel = this.root.querySelector(".hud-laps")!;
    this.currentTimeLabel = this.root.querySelector(".current")!;
    this.bestTimeLabel = this.root.querySelector(".best")!;
    this.positionLabel = this.root.querySelector(".hud-position")!;
    this.powerupsLabel = this.root.querySelector(".hud-powerups")!;
  }

  update(game: Game, speedMetersPerSecond: number, position: number, totalRacers: number) {
    const kmh = Math.max(0, speedMetersPerSecond * 3.6);
    this.speedValue.textContent = kmh.toFixed(0);
    this.lapLabel.textContent = `Lap ${Math.min(game.lap, game.totalLaps)} / ${game.totalLaps}`;
    this.currentTimeLabel.textContent = `Time ${formatTime(game.lapElapsed)}`;
    this.bestTimeLabel.textContent = `Best ${game.bestLapTime !== null ? formatTime(game.bestLapTime) : "--:--.---"}`;
    this.positionLabel.textContent = `${formatOrdinal(position)} / ${totalRacers}`;
  }

  updatePowerups(physics: CarPhysics) {
    const active: string[] = [];
    if (physics.boostTimeRemaining > 0) active.push(`BOOST ${physics.boostTimeRemaining.toFixed(1)}s`);
    if (physics.isShielded) active.push(`SHIELD ${physics.shieldTimeRemaining.toFixed(1)}s`);
    if (physics.gripBoostTimeRemaining > 0) active.push(`GRIP ${physics.gripBoostTimeRemaining.toFixed(1)}s`);
    this.powerupsLabel.textContent = active.join("   ");
  }

  show() {
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
