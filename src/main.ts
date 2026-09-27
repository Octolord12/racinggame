import * as THREE from "three";
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
import { AIDriver } from "./ai/AIDriver";
import { RaceManager } from "./race/RaceManager";
import { resolveCarCollision, resolveWallCollision } from "./race/Collisions";
import { SkidMarks } from "./effects/SkidMarks";
import { EngineSound } from "./audio/EngineSound";
import { BestTimes } from "./storage/BestTimes";
import { CONFIG } from "./config";

const PLAYER_COLOR = 0xd23c3c;
const NEUTRAL_INPUT: CarInput = { accelerate: false, brake: false, steer: 0, handbrake: false };

const container = document.querySelector<HTMLDivElement>("#app")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.classList.add("scene-canvas");
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x8fd0ef);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor.getHex(), 120, 420);

const ambient = new THREE.HemisphereLight(0xbfe3ff, 0x2f7a3c, 0.7);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
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

// Both tracks are built once up front and kept alive for the whole session; switching
// tracks just swaps which one's group is in the scene, so no rebuild/dispose is needed.
const trackInstances = new Map<string, Track>(
  TRACKS.map((def) => [def.id, new Track(def.controlPoints, def.boostPadFractions)]),
);

let activeTrackId = TRACKS[0].id;
let activeTrack = trackInstances.get(activeTrackId)!;
scene.add(activeTrack.group);

// Cars are likewise built once and just repositioned/hidden between races and tracks.
const player = new RaceCar(PLAYER_COLOR);
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
  const car = new RaceCar(driverConfig.color);
  car.mesh.visible = false;
  scene.add(car.mesh);
  return { id: `ai-${i}`, car, driver: new AIDriver(driverConfig), gridDistance: 14 + i * 6 };
});

const allCars = [player, ...opponents.map((o) => o.car)];

const skidMarks = new SkidMarks(scene);

const input = new InputManager();
const chaseCamera = new ChaseCamera(window.innerWidth / window.innerHeight);
{
  const preview = activeTrack.getStartTransform();
  chaseCamera.snapTo(preview.position, preview.heading);
}

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

let engineSound: EngineSound | null = null;

let game: Game;
let raceManager: RaceManager;

let appMode: "menu" | "race" = "menu";
let paused = false;
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

const mainMenu = new MainMenu(
  container,
  TRACKS,
  (trackId) => activateTrack(trackId),
  (trackId) => startRace(trackId),
);

function fullReset() {
  const playerStart = activeTrack.getStartTransform();
  player.setStart(playerStart.position, playerStart.heading);

  for (const opponent of opponents) {
    const start = activeTrack.getGridTransform(opponent.gridDistance, opponent.driver.config.lateralOffset);
    opponent.car.setStart(start.position, start.heading);
  }

  game.reset();
  raceClock = 0;
  skidMarks.reset();
  chaseCamera.snapTo(player.physics.position, player.physics.heading);
}

function startRace(trackId: string) {
  activateTrack(trackId);

  game = new Game(activeTrack.getFinishLine(), (seconds) => {
    BestTimes.set(activeTrackId, seconds);
    mainMenu.refreshBestTime();
  });
  game.seedBestLapTime(BestTimes.get(activeTrackId));

  raceManager = new RaceManager(activeTrack);
  raceManager.register("player", player.physics);
  for (const opponent of opponents) raceManager.register(opponent.id, opponent.car.physics);

  player.mesh.visible = true;
  for (const opponent of opponents) opponent.car.mesh.visible = true;

  fullReset();

  appMode = "race";
  paused = false;
  mainMenu.hide();
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

  for (const opponent of opponents) {
    const query = activeTrack.sampleAt(opponent.car.physics.position);
    const aiInput = raceActive ? opponent.driver.computeInput(opponent.car.physics, activeTrack, query) : NEUTRAL_INPUT;
    opponent.car.physics.update(dt, aiInput);
  }

  resolveWallCollision(player.physics, activeTrack, activeTrack.sampleAt(player.physics.position));
  for (const opponent of opponents) {
    resolveWallCollision(opponent.car.physics, activeTrack, activeTrack.sampleAt(opponent.car.physics.position));
  }

  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      resolveCarCollision(allCars[i].physics, allCars[j].physics);
    }
  }

  for (const car of allCars) car.syncMesh();

  for (const car of allCars) {
    car.boostCooldownRemaining = Math.max(0, car.boostCooldownRemaining - dt);
    if (car.boostCooldownRemaining <= 0) {
      const query = activeTrack.sampleAt(car.physics.position);
      const padIndex = activeTrack.getBoostPadIndexAt(query);
      if (padIndex !== null) {
        car.physics.triggerBoost();
        car.boostCooldownRemaining = CONFIG.boost.cooldownSeconds;
      }
    }
  }

  for (const car of allCars) {
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

  activeTrack.updateBoostPadGlow(raceClock);

  if (appMode === "race") {
    sun.target.position.copy(player.mesh.position);
    chaseCamera.update(frameDt, player.physics.position, player.physics.heading);

    const playerPosition = raceManager.getPosition("player") ?? 1;
    hud.update(game, player.physics.speed, playerPosition, opponents.length + 1);
    countdownOverlay.update(game);
    finishScreen.update(game);
    minimap.update([
      { position: player.physics.position, color: new THREE.Color(PLAYER_COLOR).getStyle(), isPlayer: true },
      ...opponents.map((o) => ({
        position: o.car.physics.position,
        color: new THREE.Color(o.driver.config.color).getStyle(),
      })),
    ]);

    if (engineSound) {
      const engineActive = !paused && game.state === "racing";
      if (engineActive) engineSound.update(player.physics.speed / CONFIG.car.maxSpeed, input.accelerate);
      else engineSound.setMuted(true);
    }
  }

  renderer.render(scene, chaseCamera.camera);
}

requestAnimationFrame(frame);
