import { Game } from "../core/Game";
import { formatTime } from "../utils/math";

export class FinishScreen {
  private root: HTMLDivElement;
  private stats: HTMLDivElement;
  private wasFinished = false;

  constructor(container: HTMLElement, onRestart: () => void, onMainMenu: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay hidden";
    this.root.innerHTML = `
      <div class="finish-panel">
        <h1>Finished!</h1>
        <div class="stats"></div>
        <div class="pause-buttons">
          <button type="button" class="restart">Restart</button>
          <button type="button" class="quit">Main Menu</button>
        </div>
      </div>
    `;
    container.appendChild(this.root);
    this.stats = this.root.querySelector(".stats")!;
    this.root.querySelector(".restart")!.addEventListener("click", onRestart);
    this.root.querySelector(".quit")!.addEventListener("click", onMainMenu);
  }

  update(game: Game) {
    const finished = game.state === "finished";
    this.root.classList.toggle("hidden", !finished);
    if (finished && !this.wasFinished) {
      this.stats.innerHTML = `
        Total time: ${formatTime(game.finalTime ?? 0)}<br />
        Best lap: ${game.bestLapTime !== null ? formatTime(game.bestLapTime) : "--:--.---"}
      `;
    }
    this.wasFinished = finished;
  }

  hide() {
    this.root.classList.add("hidden");
    this.wasFinished = false;
  }
}
