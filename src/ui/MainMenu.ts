import type { TrackDefinition } from "../track/tracks";
import { BestTimes } from "../storage/BestTimes";
import { formatTime } from "../utils/math";

export class MainMenu {
  private readonly root: HTMLDivElement;
  private readonly trackButtons: Map<string, HTMLButtonElement> = new Map();
  private readonly bestLabel: HTMLDivElement;
  private selectedId: string;

  constructor(
    container: HTMLElement,
    tracks: TrackDefinition[],
    onSelect: (trackId: string) => void,
    onStart: (trackId: string) => void,
  ) {
    this.selectedId = tracks[0].id;

    this.root = document.createElement("div");
    this.root.className = "overlay menu";
    this.root.innerHTML = `
      <div class="menu-panel">
        <h1>Arcade Racer</h1>
        <div class="menu-tracks"></div>
        <div class="menu-best"></div>
        <button type="button" class="menu-start">Start Race</button>
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
    this.root.querySelector(".menu-start")!.addEventListener("click", () => onStart(this.selectedId));

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

  show() {
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
