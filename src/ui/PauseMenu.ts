export class PauseMenu {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement, onResume: () => void, onMainMenu: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay hidden";
    this.root.innerHTML = `
      <div class="finish-panel">
        <h1>Paused</h1>
        <div class="pause-buttons">
          <button type="button" class="resume">Resume</button>
          <button type="button" class="quit">Main Menu</button>
        </div>
      </div>
    `;
    container.appendChild(this.root);
    this.root.querySelector(".resume")!.addEventListener("click", onResume);
    this.root.querySelector(".quit")!.addEventListener("click", onMainMenu);
  }

  show() {
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
