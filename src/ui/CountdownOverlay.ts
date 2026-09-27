import { Game } from "../core/Game";

export class CountdownOverlay {
  private root: HTMLDivElement;
  private number: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "overlay hidden";
    this.root.innerHTML = `<div class="countdown-number"></div>`;
    container.appendChild(this.root);
    this.number = this.root.querySelector(".countdown-number")!;
  }

  update(game: Game) {
    if (game.state === "countdown") {
      this.root.classList.remove("hidden");
      this.number.textContent = String(Math.max(1, Math.ceil(game.countdownRemaining)));
    } else if (game.state === "racing" && game.goFlashRemaining > 0) {
      this.root.classList.remove("hidden");
      this.number.textContent = "GO!";
    } else {
      this.root.classList.add("hidden");
    }
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
