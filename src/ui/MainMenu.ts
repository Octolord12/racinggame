import type { TrackDefinition } from "../track/tracks";
import { BestTimes } from "../storage/BestTimes";
import { GarageState } from "../storage/GarageState";
import { formatTime } from "../utils/math";

export class MainMenu {
  private readonly root: HTMLDivElement;
  private readonly trackButtons: Map<string, HTMLButtonElement> = new Map();
  private readonly bestLabel: HTMLDivElement;
  private readonly coinsLabel: HTMLDivElement;
  private selectedId: string;

  constructor(
    container: HTMLElement,
    tracks: TrackDefinition[],
    onSelect: (trackId: string) => void,
    onStart: (trackId: string) => void,
    onOpenGarage: () => void,
    onOpenMultiplayer: () => void,
  ) {
    this.selectedId = tracks[0].id;

    this.root = document.createElement("div");
    this.root.className = "overlay menu";
    this.root.innerHTML = `
      <div class="menu-panel">
        <h1>Arcade Racer</h1>
        <div class="menu-coins"></div>
        <div class="menu-tracks"></div>
        <div class="menu-best"></div>
        <button type="button" class="menu-start">Start Race</button>
        <div class="menu-secondary-buttons">
          <button type="button" class="menu-secondary garage-open">Garage</button>
          <button type="button" class="menu-secondary multiplayer-open">Multiplayer</button>
        </div>
        <div class="menu-help">
          WASD / Arrows to drive · Space to handbrake · R to reset · Esc to pause
        </div>
      </div>
    `;
    container.appendChild(this.root);

    const trackRow = this.root.querySelector<HTMLDivElement>(".menu-tracks")!;
    for (const track of tracks) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = track.name;
      button.addEventListener("click", () => {
        this.select(track.id);
        onSelect(track.id);
      });
      trackRow.appendChild(button);
      this.trackButtons.set(track.id, button);
    }

    this.bestLabel = this.root.querySelector(".menu-best")!;
    this.coinsLabel = this.root.querySelector(".menu-coins")!;
    this.root.querySelector(".menu-start")!.addEventListener("click", () => onStart(this.selectedId));
    this.root.querySelector(".garage-open")!.addEventListener("click", onOpenGarage);
    this.root.querySelector(".multiplayer-open")!.addEventListener("click", onOpenMultiplayer);

    this.select(this.selectedId);
    onSelect(this.selectedId);
  }

  private select(trackId: string) {
    this.selectedId = trackId;
    for (const [id, button] of this.trackButtons) button.classList.toggle("active", id === trackId);
    const best = BestTimes.get(trackId);
    this.bestLabel.textContent = `Best lap: ${best !== null ? formatTime(best) : "--:--.---"}`;
  }

  /** Refreshes the best-time display for whichever track is currently selected (e.g. after a new best is set). */
  refreshBestTime() {
    this.select(this.selectedId);
  }

  refreshCoins() {
    this.coinsLabel.textContent = `Coins: ${GarageState.get().coins}`;
  }

  show() {
    this.refreshCoins();
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
