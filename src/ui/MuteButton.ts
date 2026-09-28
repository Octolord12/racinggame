/** Small always-visible toggle, independent of menu/race mode, for game audio. */
export class MuteButton {
  private readonly button: HTMLButtonElement;

  constructor(container: HTMLElement, initiallyMuted: boolean, onToggle: (muted: boolean) => void) {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "mute-button";
    this.applyLabel(initiallyMuted);
    container.appendChild(this.button);

    this.button.addEventListener("click", () => {
      const nextMuted = this.button.dataset.muted !== "1";
      this.applyLabel(nextMuted);
      onToggle(nextMuted);
    });
  }

  private applyLabel(muted: boolean) {
    this.button.dataset.muted = muted ? "1" : "0";
    this.button.textContent = muted ? "Sound: Off" : "Sound: On";
  }
}
