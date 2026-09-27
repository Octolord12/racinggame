export class InputManager {
  private keys = new Set<string>();
  /** one-shot flags consumed via consumeReset() */
  private resetRequested = false;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyR") this.resetRequested = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  get accelerate(): boolean {
    return this.isDown("KeyW", "ArrowUp");
  }

  get brake(): boolean {
    return this.isDown("KeyS", "ArrowDown");
  }

  get steer(): number {
    const left = this.isDown("KeyA", "ArrowLeft");
    const right = this.isDown("KeyD", "ArrowRight");
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  get handbrake(): boolean {
    return this.isDown("Space");
  }

  /** Returns true once per R press, then resets until the next press. */
  consumeReset(): boolean {
    if (this.resetRequested) {
      this.resetRequested = false;
      return true;
    }
    return false;
  }
}
