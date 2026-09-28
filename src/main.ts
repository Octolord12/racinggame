import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./style.css";
import { Track } from "./track/TrackBuilder";
import { TRACKS } from "./track/tracks";
import { RaceCar } from "./car/RaceCar";
import type { CarInput } from "./car/CarPhysics";
import { InputManager } from "./core/InputManager";
import { ChaseCamera } from "./camera/ChaseCamera";
import { Game } from "./core/Game";
import { HUD } from "./ui/HUD";
import { CountdownOverlay } from "./ui/CountdownOverlay";
import { FinishScreen } from "./ui/FinishScreen";
import { Minimap } from "./ui/Minimap";
import { MainMenu } from "./ui/MainMenu";
import { PauseMenu } from "./ui/PauseMenu";
import { Garage } from "./ui/Garage";
import { MultiplayerMenu } from "./ui/MultiplayerMenu";
import { MuteButton } from "./ui/MuteButton";
import { AIDriver } from "./ai/AIDriver";
import { RaceManager } from "./race/RaceManager";
import { resolveCarCollision, resolveWallCollision } from "./race/Collisions";
import { SkidMarks } from "./effects/SkidMarks";
import { EngineSound } from "./audio/EngineSound";
import { BestTimes } from "./storage/BestTimes";
import { GarageState } from "./storage/GarageState";
import { AudioSettings } from "./storage/AudioSettings";
import { NetworkClient } from "./net/NetworkClient";
import type { PeerInfo } from "./net/NetworkClient";
import { buildSky } from "./utils/sky";
import { normalizeAngle, smoothingFactor } from "./utils/math";
import { CONFIG } from "./config";

const NEUTRAL_INPUT: CarInput = { accelerate: false, brake: false, steer: 0, handbrake: false };
/** coin reward by finishing place (index 0 = 1st) */
const COIN_REWARDS = [120, 70, 40, 15];

const container = document.querySelector<HTMLDivElement>("#app")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.classList.add("scene-canvas");
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const HORIZON_COLOR = 0xcdeaf5;
const ZENITH_COLOR = 0x2f6fa3;
scene.background = new THREE.Color(HORIZON_COLOR);
scene.fog = new THREE.Fog(HORIZON_COLOR, 130, 420);
scene.add(buildSky(ZENITH_COLOR, HORIZON_COLOR));

// Gives the cars' own reflective materials (paint, chrome hubcaps, glass) something
// plausible to reflect — without this, metalness/roughness alone still reads as flat
// and plasticky. RoomEnvironment is a small procedurally-lit room three.js ships for
// exactly this, no HDRI file needed. Deliberately passed only to car materials (see
// CarMesh.ts) rather than set as scene.environment, which would also relight the
// track's grass/asphalt/walls — those were never meant to reflect anything and washed
// out into a bright haze when this was tried as a global setting.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const carEnvMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

const ambient = new THREE.HemisphereLight(0xdcf0fb, 0x2f7a3c, 0.75);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff3d6, 1.7);
sun.position.set(90, 140, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -160;
sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;
sun.shadow.camera.bottom = -160;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

// Soft cool fill from the opposite side so shadowed faces aren't pitch black; casts no shadow of its own.
const fill = new THREE.DirectionalLight(0xaecdf0, 0.35);
fill.position.set(-70, 60, -90);
scene.add(fill);

// Both tracks are built once up front and kept alive for the whole session; switching
// tracks just swaps which one's group is in the scene, so no rebuild/dispose is needed.
const trackInstances = new Map<string, Track>(
  TRACKS.map((def) => [def.id, new Track(def.controlPoints, def.powerupPads)]),
);

let activeTrackId = TRACKS[0].id;
let activeTrack = trackInstances.get(activeTrackId)!;
scene.add(activeTrack.group);

// Cars are likewise built once and just repositioned/hidden between races and tracks.
let currentPlayerColor = GarageState.get().selectedColor;
const player = new RaceCar(currentPlayerColor, carEnvMap);
player.mesh.visible = false;
scene.add(player.mesh);

interface Opponent {
  id: string;
  car: RaceCar;
  driver: AIDriver;
  /** how far behind the start line this car's grid slot sits */
  gridDistance: number;
}

const opponents: Opponent[] = CONFIG.ai.drivers.map((driverConfig, i) => {
  const car = new RaceCar(driverConfig.color, carEnvMap);
  car.mesh.visible = false;
  scene.add(car.mesh);
  return { id: `ai-${i}`, car, driver: new AIDriver(driverConfig), gridDistance: 14 + i * 6 };
});

const allCars = [player, ...opponents.map((o) => o.car)];

interface RemotePlayer {
  car: RaceCar;
  color: number;
}
const remotePlayers = new Map<string, RemotePlayer>();
const remoteTargets = new Map<string, { position: { x: number; z: number }; heading: number; speed: number }>();

const skidMarks = new SkidMarks(scene);

const input = new InputManager();
const chaseCamera = new ChaseCamera(window.innerWidth / window.innerHeight);
{
  const preview = activeTrack.getStartTransform();
  chaseCamera.snapTo(preview.position, preview.heading);
}

// Bloom makes emissive bits (headlights, taillights, powerup pads, the shield bubble)
// actually glow instead of just being a flat bright color. Threshold is high enough
// that the sunlit scene itself doesn't bloom, only genuinely emissive materials.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, chaseCamera.camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.86);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const hud = new HUD(container);
const countdownOverlay = new CountdownOverlay(container);
const minimap = new Minimap(container, activeTrack);
const pauseMenu = new PauseMenu(
  container,
  () => setPaused(false),
  () => returnToMenu(),
);
const finishScreen = new FinishScreen(
  container,
  () => fullReset(),
  () => returnToMenu(),
);
hud.hide();
minimap.hide();

let userMuted = AudioSettings.isMuted();
new MuteButton(container, userMuted, (muted) => {
  userMuted = muted;
  AudioSettings.setMuted(muted);
});

let engineSound: EngineSound | null = null;

let game: Game;
let raceManager: RaceManager;

let appMode: "menu" | "race" = "menu";
let paused = false;
let onlineMode = false;
let onlineTrackId: string | null = null;
let latestRoster: PeerInfo[] = [];
let hasAwardedCoinsThisRace = false;
let stateSendAccumulator = 0;
const STATE_SEND_INTERVAL = 1 / 15;

/** simulation seconds since the current race's grid was set; drives the boost pad pulse, freezes on pause */
let raceClock = 0;

function activateTrack(trackId: string) {
  if (trackId === activeTrackId) return;
  scene.remove(activeTrack.group);
  activeTrackId = trackId;
  activeTrack = trackInstances.get(trackId)!;
  scene.add(activeTrack.group);
  minimap.setTrack(activeTrack);

  const preview = activeTrack.getStartTransform();
  chaseCamera.snapTo(preview.position, preview.heading);
}

function applyGarageStateToPlayer() {
  const garage = GarageState.get();
  player.physics.setUpgrades({ engineLevel: garage.engineLevel, gripLevel: garage.gripLevel, brakeLevel: garage.brakeLevel });
  currentPlayerColor = garage.selectedColor;
  player.setBodyColor(currentPlayerColor);
}

function addRemotePlayer(peer: PeerInfo) {
  if (remotePlayers.has(peer.id)) return;
  const car = new RaceCar(peer.color, carEnvMap);
  car.mesh.visible = true;
  scene.add(car.mesh);
  const grid = activeTrack.getGridTransform(14 + remotePlayers.size * 6, 0);
  car.setStart(grid.position, grid.heading);
  remotePlayers.set(peer.id, { car, color: peer.color });
  raceManager?.register(peer.id, car.physics);
}

function removeRemotePlayer(id: string) {
  const entry = remotePlayers.get(id);
  if (!entry) return;
  scene.remove(entry.car.mesh);
  remotePlayers.delete(id);
  remoteTargets.delete(id);
}

function syncRemotePlayers(players: PeerInfo[]) {
  if (!onlineMode) return;
  const selfId = netClient.selfId;
  const activeIds = new Set(players.filter((p) => p.id !== selfId).map((p) => p.id));
  for (const id of [...remotePlayers.keys()]) {
    if (!activeIds.has(id)) removeRemotePlayer(id);
  }
  for (const peer of players) {
    if (peer.id !== selfId) addRemotePlayer(peer);
  }
}

function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
}

const netClient = new NetworkClient();
netClient.onOpen = () => multiplayerMenu.setStatus("Connected — waiting for the room to agree on a track.");
netClient.onClose = () => multiplayerMenu.setStatus("Disconnected.");
netClient.onErrorMsg = (message) => multiplayerMenu.setStatus(message);
netClient.onRoster = (players) => {
  latestRoster = players;
  multiplayerMenu.setRoster(players, netClient.selfId);
  syncRemotePlayers(players);
};
netClient.onTrack = (trackId) => {
  onlineTrackId = trackId;
  multiplayerMenu.setTrack(trackId, true);
};
netClient.onPeerState = (state) => {
  remoteTargets.set(state.id, { position: state.position, heading: state.heading, speed: state.speed });
};
netClient.onPeerLeft = (id) => removeRemotePlayer(id);

const mainMenu = new MainMenu(
  container,
  TRACKS,
  (trackId) => activateTrack(trackId),
  (trackId) => startRace(trackId, false),
  () => {
    mainMenu.hide();
    garage.show();
  },
  () => {
    mainMenu.hide();
    multiplayerMenu.reset();
    multiplayerMenu.show();
  },
);

const garage = new Garage(
  container,
  () => {
    garage.hide();
    mainMenu.show();
  },
  () => {},
);

const multiplayerMenu = new MultiplayerMenu(container, TRACKS, {
  onConnect: (serverUrl, room, name) => {
    multiplayerMenu.setStatus("Connecting…");
    netClient.connect(serverUrl, room, name, GarageState.get().selectedColor);
  },
  onSelectTrack: (trackId) => netClient.setTrack(trackId),
  onStart: () => {
    if (onlineTrackId) startRace(onlineTrackId, true);
  },
  onBack: () => {
    netClient.disconnect();
    multiplayerMenu.hide();
    mainMenu.show();
  },
});

mainMenu.show(); // populate coins/best-time on first load, since the panel starts visible without going through show()

function fullReset() {
  const playerStart = activeTrack.getStartTransform();
  player.setStart(playerStart.position, playerStart.heading);

  if (!onlineMode) {
    for (const opponent of opponents) {
      const start = activeTrack.getGridTransform(opponent.gridDistance, opponent.driver.config.lateralOffset);
      opponent.car.setStart(start.position, start.heading);
    }
  }

  game.reset();
  raceClock = 0;
  hasAwardedCoinsThisRace = false;
  skidMarks.reset();
  chaseCamera.snapTo(player.physics.position, player.physics.heading);
}

function startRace(trackId: string, online: boolean) {
  onlineMode = online;
  activateTrack(trackId);
  applyGarageStateToPlayer();

  game = new Game(activeTrack.getFinishLine(), (seconds) => {
    BestTimes.set(activeTrackId, seconds);
    mainMenu.refreshBestTime();
  });
  game.seedBestLapTime(BestTimes.get(activeTrackId));

  raceManager = new RaceManager(activeTrack);
  raceManager.register("player", player.physics);

  if (onlineMode) {
    for (const opponent of opponents) opponent.car.mesh.visible = false;
    clearRemotePlayers();
    syncRemotePlayers(latestRoster);
  } else {
    for (const opponent of opponents) {
      opponent.car.mesh.visible = true;
      raceManager.register(opponent.id, opponent.car.physics);
    }
  }

  player.mesh.visible = true;

  fullReset();

  appMode = "race";
  paused = false;
  mainMenu.hide();
  multiplayerMenu.hide();
  pauseMenu.hide();
  hud.show();
  minimap.show();

  if (!engineSound) engineSound = new EngineSound();
  engineSound.resume();
}

function returnToMenu() {
  appMode = "menu";
  paused = false;
  player.mesh.visible = false;
  for (const opponent of opponents) opponent.car.mesh.visible = false;

  if (onlineMode) {
    netClient.disconnect();
    clearRemotePlayers();
    onlineMode = false;
    onlineTrackId = null;
  }

  pauseMenu.hide();
  countdownOverlay.hide();
  finishScreen.hide();
  hud.hide();
  minimap.hide();
  mainMenu.show();
}

function setPaused(value: boolean) {
  if (appMode !== "race" || game.state === "finished") return;
  paused = value;
  if (paused) pauseMenu.show();
  else pauseMenu.hide();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") setPaused(!paused);
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  chaseCamera.setAspect(window.innerWidth / window.innerHeight);
});

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
let accumulator = 0;
let lastTime = performance.now();

function fixedStep(dt: number) {
  const raceActive = game.isInputEnabled;

  const playerInput: CarInput = raceActive
    ? { accelerate: input.accelerate, brake: input.brake, steer: input.steer, handbrake: input.handbrake }
    : NEUTRAL_INPUT;
  player.physics.update(dt, playerInput);

  if (!onlineMode) {
    for (const opponent of opponents) {
      const query = activeTrack.sampleAt(opponent.car.physics.position);
      const aiInput = raceActive ? opponent.driver.computeInput(opponent.car.physics, activeTrack, query) : NEUTRAL_INPUT;
      opponent.car.physics.update(dt, aiInput);
    }
  }

  resolveWallCollision(player.physics, activeTrack, activeTrack.sampleAt(player.physics.position));
  if (!onlineMode) {
    for (const opponent of opponents) {
      resolveWallCollision(opponent.car.physics, activeTrack, activeTrack.sampleAt(opponent.car.physics.position));
    }
  }

  // remote players are kinematic puppets driven by network data, not simulated locally,
  // but the local player still physically collides with wherever we last placed them
  const collidableCars = onlineMode ? [player, ...[...remotePlayers.values()].map((r) => r.car)] : allCars;
  for (let i = 0; i < collidableCars.length; i++) {
    for (let j = i + 1; j < collidableCars.length; j++) {
      resolveCarCollision(collidableCars[i].physics, collidableCars[j].physics);
    }
  }

  for (const car of collidableCars) car.syncMesh(dt);

  if (onlineMode) {
    for (const [id, entry] of remotePlayers) {
      const target = remoteTargets.get(id);
      if (!target) continue;
      const t = smoothingFactor(12, dt);
      const p = entry.car.physics.position;
      p.x += (target.position.x - p.x) * t;
      p.z += (target.position.z - p.z) * t;
      entry.car.physics.heading += normalizeAngle(target.heading - entry.car.physics.heading) * t;
      entry.car.physics.forwardSpeed = target.speed;
      entry.car.syncMesh(dt);
    }
  }

  // powerup pads and skid marks only apply to physics we actually simulate locally;
  // remote players' own clients handle their own pad pickups and skid trails
  const locallySimulatedCars = onlineMode ? [player] : allCars;

  for (const car of locallySimulatedCars) {
    car.powerupCooldownRemaining = Math.max(0, car.powerupCooldownRemaining - dt);
    if (car.powerupCooldownRemaining <= 0) {
      const query = activeTrack.sampleAt(car.physics.position);
      const padType = activeTrack.getPowerupPadAt(query);
      if (padType !== null) {
        if (padType === "boost") car.physics.triggerBoost();
        else if (padType === "shield") car.physics.activateShield();
        else if (padType === "grip") car.physics.activateGripBoost();
        car.powerupCooldownRemaining = CONFIG.powerups.cooldownSeconds;
      }
    }
  }

  for (const car of locallySimulatedCars) {
    car.skidMarkCooldownRemaining = Math.max(0, car.skidMarkCooldownRemaining - dt);
    const drifting =
      Math.abs(car.physics.lateralVelocity) > CONFIG.skid.lateralSpeedThreshold &&
      Math.abs(car.physics.forwardSpeed) > CONFIG.skid.minForwardSpeed;
    if (drifting && car.skidMarkCooldownRemaining <= 0) {
      const [left, right] = car.getRearWheelPositions();
      skidMarks.addMark(left, car.physics.heading);
      skidMarks.addMark(right, car.physics.heading);
      car.skidMarkCooldownRemaining = CONFIG.skid.markIntervalSeconds;
    }
  }

  raceManager.update();
  game.update(dt);
  game.checkLapCrossing(player.physics.position);
  raceClock += dt;

  if (game.state === "finished" && !hasAwardedCoinsThisRace) {
    hasAwardedCoinsThisRace = true;
    const totalRacers = onlineMode ? remotePlayers.size + 1 : opponents.length + 1;
    const place = raceManager.getPosition("player") ?? totalRacers;
    const reward = COIN_REWARDS[place - 1] ?? 0;
    GarageState.addCoins(reward);
    finishScreen.setReward(reward);
  }

  if (onlineMode && netClient.isConnected) {
    stateSendAccumulator += dt;
    if (stateSendAccumulator >= STATE_SEND_INTERVAL) {
      stateSendAccumulator = 0;
      netClient.sendState(
        { x: player.physics.position.x, z: player.physics.position.z },
        player.physics.heading,
        player.physics.forwardSpeed,
        game.lap,
      );
    }
  }
}

function frame(now: number) {
  requestAnimationFrame(frame);

  const frameDt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;

  if (appMode === "race" && !paused) {
    if (input.consumeReset()) fullReset();

    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      fixedStep(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
  } else {
    input.consumeReset();
    accumulator = 0;
  }

  activeTrack.updatePowerupPadGlow(raceClock);

  if (appMode === "race") {
    sun.target.position.copy(player.mesh.position);
    chaseCamera.update(frameDt, player.physics.position, player.physics.heading);

    const totalRacers = onlineMode ? remotePlayers.size + 1 : opponents.length + 1;
    const playerPosition = raceManager.getPosition("player") ?? 1;
    hud.update(game, player.physics.speed, playerPosition, totalRacers);
    hud.updatePowerups(player.physics);
    countdownOverlay.update(game);
    finishScreen.update(game);

    const otherEntries = onlineMode
      ? [...remotePlayers.values()].map((r) => ({ position: r.car.physics.position, color: new THREE.Color(r.color).getStyle() }))
      : opponents.map((o) => ({ position: o.car.physics.position, color: new THREE.Color(o.driver.config.color).getStyle() }));
    minimap.update([
      { position: player.physics.position, color: new THREE.Color(currentPlayerColor).getStyle(), isPlayer: true },
      ...otherEntries,
    ]);

    if (engineSound) {
      const engineActive = !paused && game.state === "racing" && !userMuted;
      if (engineActive) engineSound.update(player.physics.speed / CONFIG.car.maxSpeed, input.accelerate);
      else engineSound.setMuted(true);
    }
  }

  composer.render();
}

requestAnimationFrame(frame);
