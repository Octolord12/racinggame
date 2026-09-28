import type { TrackDefinition } from "../track/tracks";
import type { PeerInfo } from "../net/NetworkClient";

export interface MultiplayerMenuCallbacks {
  onConnect: (serverUrl: string, room: string, name: string) => void;
  onSelectTrack: (trackId: string) => void;
  onStart: () => void;
  onBack: () => void;
}

/** Room-code multiplayer lobby: connect, see who's in the room, agree on a track, go. */
export class MultiplayerMenu {
  private readonly root: HTMLDivElement;
  private readonly serverInput: HTMLInputElement;
  private readonly roomInput: HTMLInputElement;
  private readonly nameInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly statusLabel: HTMLDivElement;
  private readonly rosterList: HTMLDivElement;
  private readonly trackSection: HTMLDivElement;
  private readonly trackButtons: Map<string, HTMLButtonElement> = new Map();
  private readonly startButton: HTMLButtonElement;
  private trackLocked = false;

  constructor(container: HTMLElement, tracks: TrackDefinition[], callbacks: MultiplayerMenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "overlay menu hidden";
    this.root.innerHTML = `
      <div class="menu-panel mp-panel">
        <h1>Multiplayer</h1>
        <div class="mp-field"><label>Server</label><input class="mp-server" value="ws://localhost:8787" /></div>
        <div class="mp-field"><label>Room code</label><input class="mp-room" placeholder="e.g. friends123" maxlength="24" /></div>
        <div class="mp-field"><label>Name</label><input class="mp-name" placeholder="Racer" maxlength="16" /></div>
        <button type="button" class="menu-start mp-connect">Connect</button>
        <div class="mp-status"></div>
        <div class="mp-roster"></div>
        <div class="mp-track-section hidden">
          <div class="mp-track-label">Track</div>
          <div class="menu-tracks mp-tracks"></div>
        </div>
        <button type="button" class="menu-start mp-start hidden">Start Race</button>
        <button type="button" class="menu-secondary mp-back">Back</button>
      </div>
    `;
    container.appendChild(this.root);

    this.serverInput = this.root.querySelector(".mp-server")!;
    this.roomInput = this.root.querySelector(".mp-room")!;
    this.nameInput = this.root.querySelector(".mp-name")!;
    this.connectButton = this.root.querySelector(".mp-connect")!;
    this.statusLabel = this.root.querySelector(".mp-status")!;
    this.rosterList = this.root.querySelector(".mp-roster")!;
    this.trackSection = this.root.querySelector(".mp-track-section")!;
    this.startButton = this.root.querySelector(".mp-start")!;

    this.connectButton.addEventListener("click", () => {
      const server = this.serverInput.value.trim() || "ws://localhost:8787";
      const room = this.roomInput.value.trim() || "default";
      const name = this.nameInput.value.trim() || "Racer";
      callbacks.onConnect(server, room, name);
    });

    const trackRow = this.root.querySelector<HTMLDivElement>(".mp-tracks")!;
    for (const track of tracks) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = track.name;
      button.addEventListener("click", () => {
        if (this.trackLocked) return;
        this.highlightTrack(track.id);
        callbacks.onSelectTrack(track.id);
      });
      trackRow.appendChild(button);
      this.trackButtons.set(track.id, button);
    }

    this.startButton.addEventListener("click", callbacks.onStart);
    this.root.querySelector(".mp-back")!.addEventListener("click", callbacks.onBack);
  }

  private highlightTrack(trackId: string) {
    for (const [id, button] of this.trackButtons) button.classList.toggle("active", id === trackId);
  }

  setStatus(text: string) {
    this.statusLabel.textContent = text;
  }

  setRoster(players: PeerInfo[], selfId: string | null) {
    this.rosterList.innerHTML = "";
    for (const player of players) {
      const row = document.createElement("div");
      row.className = "mp-roster-row";
      row.textContent = player.id === selfId ? `${player.name} (you)` : player.name;
      row.style.color = `#${player.color.toString(16).padStart(6, "0")}`;
      this.rosterList.appendChild(row);
    }
    this.trackSection.classList.remove("hidden");
  }

  /** Called once a track is settled for this room, either by us picking or the host having already picked. */
  setTrack(trackId: string, locked: boolean) {
    this.trackLocked = locked;
    this.highlightTrack(trackId);
    for (const [id, button] of this.trackButtons) button.disabled = locked && id !== trackId;
    this.startButton.classList.remove("hidden");
  }

  reset() {
    this.trackLocked = false;
    this.rosterList.innerHTML = "";
    this.trackSection.classList.add("hidden");
    this.startButton.classList.add("hidden");
    for (const button of this.trackButtons.values()) {
      button.disabled = false;
      button.classList.remove("active");
    }
    this.setStatus("");
  }

  show() {
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
