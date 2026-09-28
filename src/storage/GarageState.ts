const STORAGE_KEY = "arcade-racer-garage";

export type UpgradeCategory = "engine" | "grip" | "brake";

export const MAX_UPGRADE_LEVEL = 5;

/** Coins required to go from level index i to i+1, per category. */
export const UPGRADE_COSTS: Record<UpgradeCategory, number[]> = {
  engine: [80, 150, 260, 420, 650],
  grip: [80, 150, 260, 420, 650],
  brake: [70, 130, 230, 380, 600],
};

export interface ColorOption {
  hex: number;
  name: string;
  cost: number;
}

/** The default color is free and always owned; the rest are purchasable. */
export const COLOR_CATALOG: ColorOption[] = [
  { hex: 0xd23c3c, name: "Racing Red", cost: 0 },
  { hex: 0x2e6fd1, name: "Cobalt Blue", cost: 150 },
  { hex: 0x2e9e4f, name: "Pit Green", cost: 150 },
  { hex: 0xe0b530, name: "Taxi Yellow", cost: 150 },
  { hex: 0x8a4fd1, name: "Grape Purple", cost: 250 },
  { hex: 0xe0752e, name: "Sunset Orange", cost: 250 },
  { hex: 0x1c1c1c, name: "Midnight Black", cost: 300 },
  { hex: 0xe8e8e8, name: "Pearl White", cost: 300 },
];

export interface GarageData {
  coins: number;
  engineLevel: number;
  gripLevel: number;
  brakeLevel: number;
  unlockedColors: number[];
  selectedColor: number;
}

export function getUpgradeLevel(state: GarageData, category: UpgradeCategory): number {
  return state[levelKey(category)];
}

function defaultState(): GarageData {
  return {
    coins: 0,
    engineLevel: 0,
    gripLevel: 0,
    brakeLevel: 0,
    unlockedColors: [COLOR_CATALOG[0].hex],
    selectedColor: COLOR_CATALOG[0].hex,
  };
}

function load(): GarageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const fallback = defaultState();
    return {
      coins: typeof parsed.coins === "number" ? parsed.coins : fallback.coins,
      engineLevel: typeof parsed.engineLevel === "number" ? parsed.engineLevel : fallback.engineLevel,
      gripLevel: typeof parsed.gripLevel === "number" ? parsed.gripLevel : fallback.gripLevel,
      brakeLevel: typeof parsed.brakeLevel === "number" ? parsed.brakeLevel : fallback.brakeLevel,
      unlockedColors: Array.isArray(parsed.unlockedColors) ? parsed.unlockedColors : fallback.unlockedColors,
      selectedColor: typeof parsed.selectedColor === "number" ? parsed.selectedColor : fallback.selectedColor,
    };
  } catch {
    return defaultState();
  }
}

function save(state: GarageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable - progress just won't persist
  }
}

function levelKey(category: UpgradeCategory): "engineLevel" | "gripLevel" | "brakeLevel" {
  return `${category}Level` as const;
}

export const GarageState = {
  get(): GarageData {
    return load();
  },

  addCoins(amount: number): GarageData {
    const state = load();
    state.coins += amount;
    save(state);
    return state;
  },

  /** Cost to go from the current level to the next, or null if already maxed. */
  nextUpgradeCost(category: UpgradeCategory): number | null {
    const state = load();
    const level = state[levelKey(category)];
    if (level >= MAX_UPGRADE_LEVEL) return null;
    return UPGRADE_COSTS[category][level];
  },

  /** Attempts to buy the next level of a category. Returns the new state, or null if it couldn't afford it or is maxed. */
  buyUpgrade(category: UpgradeCategory): GarageData | null {
    const state = load();
    const key = levelKey(category);
    const level = state[key];
    if (level >= MAX_UPGRADE_LEVEL) return null;
    const cost = UPGRADE_COSTS[category][level];
    if (state.coins < cost) return null;
    state.coins -= cost;
    state[key] = level + 1;
    save(state);
    return state;
  },

  /** Attempts to unlock (and select) a color. Returns the new state, or null if it couldn't afford it. */
  buyColor(hex: number): GarageData | null {
    const state = load();
    const option = COLOR_CATALOG.find((c) => c.hex === hex);
    if (!option) return null;
    if (!state.unlockedColors.includes(hex)) {
      if (state.coins < option.cost) return null;
      state.coins -= option.cost;
      state.unlockedColors.push(hex);
    }
    state.selectedColor = hex;
    save(state);
    return state;
  },

  selectColor(hex: number): GarageData | null {
    const state = load();
    if (!state.unlockedColors.includes(hex)) return null;
    state.selectedColor = hex;
    save(state);
    return state;
  },
};
