import { COLOR_CATALOG, GarageState, MAX_UPGRADE_LEVEL, UPGRADE_COSTS, getUpgradeLevel } from "../storage/GarageState";
import type { UpgradeCategory } from "../storage/GarageState";

const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  engine: "Engine",
  grip: "Grip",
  brake: "Brakes",
};

const CATEGORIES: UpgradeCategory[] = ["engine", "grip", "brake"];

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** Spend-your-coins screen: upgrade levels (engine/grip/brakes) and paint colors, Hill-Climb-style. */
export class Garage {
  private readonly root: HTMLDivElement;
  private readonly coinsLabel: HTMLDivElement;
  private readonly upgradeRows: Record<UpgradeCategory, { levelLabel: HTMLDivElement; buyButton: HTMLButtonElement }>;
  private readonly colorSwatches: Map<number, HTMLButtonElement> = new Map();
  private readonly onChange: () => void;

  constructor(container: HTMLElement, onBack: () => void, onChange: () => void) {
    this.onChange = onChange;

    this.root = document.createElement("div");
    this.root.className = "overlay menu hidden";
    this.root.innerHTML = `
      <div class="menu-panel garage-panel">
        <h1>Garage</h1>
        <div class="garage-coins"></div>
        <div class="garage-upgrades"></div>
        <div class="garage-colors-label">Paint</div>
        <div class="garage-colors"></div>
        <button type="button" class="menu-start garage-back">Back to Menu</button>
      </div>
    `;
    container.appendChild(this.root);

    this.coinsLabel = this.root.querySelector(".garage-coins")!;
    const upgradesContainer = this.root.querySelector(".garage-upgrades")!;
    const colorsContainer = this.root.querySelector(".garage-colors")!;
    this.root.querySelector(".garage-back")!.addEventListener("click", onBack);

    this.upgradeRows = {} as Record<UpgradeCategory, { levelLabel: HTMLDivElement; buyButton: HTMLButtonElement }>;
    for (const category of CATEGORIES) {
      const row = document.createElement("div");
      row.className = "upgrade-row";
      row.innerHTML = `
        <div class="upgrade-name">${CATEGORY_LABELS[category]}</div>
        <div class="upgrade-level"></div>
        <button type="button" class="upgrade-buy"></button>
      `;
      upgradesContainer.appendChild(row);
      const levelLabel = row.querySelector(".upgrade-level") as HTMLDivElement;
      const buyButton = row.querySelector(".upgrade-buy") as HTMLButtonElement;
      buyButton.addEventListener("click", () => {
        if (GarageState.buyUpgrade(category)) {
          this.refresh();
          this.onChange();
        }
      });
      this.upgradeRows[category] = { levelLabel, buyButton };
    }

    for (const option of COLOR_CATALOG) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.style.background = hexToCss(option.hex);
      swatch.title = option.cost > 0 ? `${option.name} (${option.cost})` : option.name;
      swatch.addEventListener("click", () => {
        const owned = GarageState.get().unlockedColors.includes(option.hex);
        const result = owned ? GarageState.selectColor(option.hex) : GarageState.buyColor(option.hex);
        if (result) {
          this.refresh();
          this.onChange();
        }
      });
      colorsContainer.appendChild(swatch);
      this.colorSwatches.set(option.hex, swatch);
    }

    this.refresh();
  }

  refresh() {
    const state = GarageState.get();
    this.coinsLabel.textContent = `Coins: ${state.coins}`;

    for (const category of CATEGORIES) {
      const level = getUpgradeLevel(state, category);
      const { levelLabel, buyButton } = this.upgradeRows[category];
      levelLabel.textContent = `Lv ${level} / ${MAX_UPGRADE_LEVEL}`;
      if (level >= MAX_UPGRADE_LEVEL) {
        buyButton.textContent = "Maxed";
        buyButton.disabled = true;
      } else {
        const cost = UPGRADE_COSTS[category][level];
        buyButton.textContent = `Upgrade (${cost})`;
        buyButton.disabled = state.coins < cost;
      }
    }

    for (const option of COLOR_CATALOG) {
      const swatch = this.colorSwatches.get(option.hex)!;
      const owned = state.unlockedColors.includes(option.hex);
      swatch.classList.toggle("selected", state.selectedColor === option.hex);
      swatch.classList.toggle("locked", !owned);
      swatch.textContent = owned || option.cost === 0 ? "" : String(option.cost);
    }
  }

  show() {
    this.refresh();
    this.root.classList.remove("hidden");
  }

  hide() {
    this.root.classList.add("hidden");
  }
}
