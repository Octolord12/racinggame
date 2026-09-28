import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

/**
 * Minimal room-code multiplayer relay: no auth, no persistence, no physics
 * authority. Clients simulate their own car locally and broadcast position/
 * heading/speed/lap to everyone else in the same room; this server just
 * fans messages out to the right room. Good enough for a few friends racing
 * together, not for anything competitive or public-facing.
 */

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const wss = new WebSocketServer({ port: PORT });

/** roomCode -> { clients: Map<clientId, {ws, name, color}>, trackId: string | null } */
const rooms = new Map();

function getOrCreateRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { clients: new Map(), trackId: null };
    rooms.set(code, room);
  }
  return room;
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcastRoster(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = [...room.clients.entries()].map(([id, c]) => ({ id, name: c.name, color: c.color }));
  for (const client of room.clients.values()) send(client.ws, { type: "roster", players });
}

function broadcastToRoom(roomCode, payload, exceptId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  for (const [id, client] of room.clients) {
    if (id !== exceptId) send(client.ws, payload);
  }
}

wss.on("connection", (ws) => {
  let clientId = null;
  let roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      roomCode = String(msg.room || "default")
        .trim()
        .toLowerCase()
        .slice(0, 32);
      clientId = randomUUID().slice(0, 8);
      const room = getOrCreateRoom(roomCode);
      room.clients.set(clientId, {
        ws,
        name: String(msg.name || "Racer").slice(0, 20),
        color: Number.isFinite(msg.color) ? msg.color : 0xffffff,
      });
      send(ws, { type: "joined", id: clientId, trackId: room.trackId });
      broadcastRoster(roomCode);
      return;
    }

    if (!roomCode || !clientId) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    if (msg.type === "setTrack") {
      if (!room.trackId) {
        room.trackId = String(msg.trackId);
        broadcastToRoom(roomCode, { type: "track", trackId: room.trackId });
      }
      return;
    }

    if (msg.type === "state") {
      broadcastToRoom(
        roomCode,
        {
          type: "peerState",
          id: clientId,
          position: msg.position,
          heading: msg.heading,
          speed: msg.speed,
          lap: msg.lap,
        },
        clientId,
      );
      return;
    }
  });

  ws.on("close", () => {
    if (!roomCode || !clientId) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.clients.delete(clientId);
    broadcastToRoom(roomCode, { type: "peerLeft", id: clientId });
    broadcastRoster(roomCode);
    if (room.clients.size === 0) rooms.delete(roomCode);
  });
});

console.log(`Multiplayer relay listening on ws://localhost:${PORT}`);
