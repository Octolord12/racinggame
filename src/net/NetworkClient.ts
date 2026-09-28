export interface PeerInfo {
  id: string;
  name: string;
  color: number;
}

export interface PeerState {
  id: string;
  position: { x: number; z: number };
  heading: number;
  speed: number;
  lap: number;
}

/**
 * Thin wrapper around a WebSocket connection to the multiplayer relay server
 * (see server/index.js). No reconnect logic, no message queuing while
 * disconnected — this is the "simple room-code play with friends" tier, not a
 * production networking stack.
 */
export class NetworkClient {
  private ws: WebSocket | null = null;
  private myId: string | null = null;

  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  onErrorMsg: (message: string) => void = () => {};
  onRoster: (players: PeerInfo[]) => void = () => {};
  onTrack: (trackId: string) => void = () => {};
  onPeerState: (state: PeerState) => void = () => {};
  onPeerLeft: (id: string) => void = () => {};

  get selfId(): string | null {
    return this.myId;
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect(serverUrl: string, room: string, name: string, color: number) {
    this.disconnect();

    let ws: WebSocket;
    try {
      ws = new WebSocket(serverUrl);
    } catch {
      this.onErrorMsg(`Couldn't open a connection to ${serverUrl}`);
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "join", room, name, color }));
      this.onOpen();
    });

    ws.addEventListener("message", (event) => {
      let msg: any;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      switch (msg.type) {
        case "joined":
          this.myId = msg.id;
          if (msg.trackId) this.onTrack(msg.trackId);
          break;
        case "roster":
          this.onRoster(msg.players);
          break;
        case "track":
          this.onTrack(msg.trackId);
          break;
        case "peerState":
          this.onPeerState(msg);
          break;
        case "peerLeft":
          this.onPeerLeft(msg.id);
          break;
      }
    });

    ws.addEventListener("close", () => {
      this.onClose();
    });

    ws.addEventListener("error", () => {
      this.onErrorMsg("Connection error");
    });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // already closed/closing
      }
      this.ws = null;
    }
    this.myId = null;
  }

  setTrack(trackId: string) {
    this.send({ type: "setTrack", trackId });
  }

  sendState(position: { x: number; z: number }, heading: number, speed: number, lap: number) {
    this.send({ type: "state", position, heading, speed, lap });
  }

  private send(payload: unknown) {
    if (this.isConnected) this.ws!.send(JSON.stringify(payload));
  }
}
