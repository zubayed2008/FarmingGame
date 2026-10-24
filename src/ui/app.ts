import {
  buyAnimal,
  buySeed,
  collectAnimal,
  feedAnimal,
  harvestPlot,
  petAnimal,
  plantSeed,
  sellItem,
  waterPlot
} from "../game/actions";
import {
  ANIMAL_CAPACITY,
  CROPS,
  CROP_SPECIES_LIST,
  ITEMS,
  LIVESTOCK_SPECIES_LIST,
  PET_SPECIES_LIST,
  getAnimalCost,
  getAnimalEmoji,
  getAnimalFeedCost,
  getAnimalName
} from "../game/data";
import {
  formatDuration,
  getAnimalProgress,
  getAnimalStatus,
  getCropStage,
  getInventoryEntries,
  getPlotLabel
} from "../game/selectors";
import { advanceTime } from "../game/simulation";
import { createNewGame } from "../game/state";
import type { ActionResult, AnimalSpecies, CropSpecies, GameState, ItemId } from "../game/types";
import { loadGame, resetGame, saveGame } from "../persistence/storage";
import { createFarmScene } from "../render/scene3d";
import { createLiveRegion, createPlotControls } from "./accessibility";
import { element, makeButton, makeProgress } from "./panels";

const SIMULATION_INTERVAL_MS = 250;

export function startApp(root: HTMLElement): void {
  const storage = window.localStorage;
  const loadResult = loadGame(storage, Date.now());
  let state: GameState = loadResult.state;
  let selectedSpecies: CropSpecies = "wheat";
  let message =
    loadResult.warning ??
    (loadResult.status === "loaded"
      ? "Welcome back to Sunny Acres. Your farm was restored."
      : "Welcome to Sunny Acres. Buy seeds, plant them, and water your crops.");
  let milestone = "";
  let lastSavedAt = Date.now();

  root.replaceChildren();

  const shell = element("div", "game-shell");
  const header = element("header", "topbar");
  const titleGroup = element("div");
  titleGroup.append(
    element("h1", undefined, "Sunny Acres"),
    element("p", "tagline", "Grow crops, raise animals, and care for pets.")
  );
  const wallet = element("p", "wallet");
  const coinValue = element("strong", undefined, `${state.coins}`);
  wallet.append(element("span", undefined, "🪙 Coins: "), coinValue);

  const resetButton = makeButton("Start over", () => {
    if (!window.confirm("Start over? This deletes your saved farm.")) {
      return;
    }
    resetGame(storage);
    state = createNewGame(Date.now());
    message = "Started a fresh farm.";
    saveNow();
    renderAll();
  });
  const walletGroup = element("div", "wallet-group");
  walletGroup.append(wallet, resetButton);
  header.append(titleGroup, walletGroup);

  const main = element("main", "game-grid");
  const farmCard = element("section", "panel farm-card");
  const sceneHost = element("div", "farm-canvas");
  sceneHost.setAttribute("role", "img");
  sceneHost.setAttribute(
    "aria-label",
    "3D farm view. Drag to rotate and scroll to zoom. Use the plot controls below to plant, water, and harvest with a keyboard."
  );
  const sceneHint = element("p", "scene-hint", "Drag to rotate · scroll to zoom · click a plot");
  const plotControlsHost = element("div", "plot-controls-host");
  farmCard.append(element("h2", undefined, "Farm plots"), sceneHost, sceneHint, plotControlsHost);

  const sidebar = element("div", "sidebar");
  const helpPanel = element("section", "panel");
  const shopPanel = element("section", "panel");
  const inventoryPanel = element("section", "panel");
  const animalPanel = element("section", "panel");
  helpPanel.append(
    element("h2", undefined, "How to play"),
    (() => {
      const steps = element("ol", "help-list");
      steps.append(
        element("li", undefined, "Buy a seed, select that crop, then click an empty plot."),
        element("li", undefined, "Water the crop and wait for it to ripen."),
        element("li", undefined, "Harvest it, then sell produce from your inventory."),
        element("li", undefined, "Buy a cow or goat, feed it, and collect milk."),
        element("li", undefined, "Adopt a dog or cat, then feed and pet them.")
      );
      return steps;
    })()
  );
  sidebar.append(helpPanel, shopPanel, inventoryPanel, animalPanel);
  main.append(farmCard, sidebar);

  const messageBanner = element("p", "message-banner");
  const liveRegion = createLiveRegion();
  shell.append(header, messageBanner, main, liveRegion);
  root.append(shell);

  const scene = createFarmScene(sceneHost, (plotId) => handlePlot(plotId));

  function saveNow(): void {
    const result = saveGame(storage, state, Date.now());
    lastSavedAt = Date.now();
    if (!result.ok && result.message) {
      message = result.message;
    }
  }

  function dispatch(result: ActionResult): void {
    state = result.state;
    message = result.message;
    if (result.ok) {
      saveNow();
    }
    renderAll();
  }

  function handlePlot(plotId: number): void {
    const plot = state.plots.find((candidate) => candidate.id === plotId);
    if (!plot) {
      return;
    }

    const stage = getCropStage(plot);
    if (stage === "empty") {
      dispatch(plantSeed(state, plotId, selectedSpecies));
      return;
    }
    if (stage === "dry") {
      dispatch(waterPlot(state, plotId));
      return;
    }
    if (stage === "ripe") {
      dispatch(harvestPlot(state, plotId));
      return;
    }
    message = `${getPlotLabel(plot)}. Come back when it is ripe.`;
    renderMessage();
  }

  function computeMilestone(): string {
    const plots = state.plots.map((plot) => `${plot.id}:${getCropStage(plot)}`).join("|");
    const animals = state.animals
      .map((animal) =>
        animal.kind === "livestock"
          ? `${animal.id}:${animal.species}:${animal.productionActive}:${animal.productReady}`
          : `${animal.id}:${animal.species}`
      )
      .join("|");
    return `${plots}#${animals}#${state.animals.length}`;
  }

  function renderStatus(): void {
    coinValue.textContent = `${state.coins}`;
  }

  function renderShop(): void {
    shopPanel.replaceChildren(element("h2", undefined, "Seed shop"));
    shopPanel.append(
      element("p", "panel-help", "Select a crop, then click an empty plot or use the plot controls.")
    );

    for (const species of CROP_SPECIES_LIST) {
      const config = CROPS[species];
      const row = element("div", "shop-row");
      const info = element("div", "shop-info");
      info.append(
        element("strong", undefined, `${config.emoji} ${config.displayName}`),
        element(
          "span",
          "shop-meta",
          `${config.seedCost} coins · ${formatDuration(config.growthMs)} · sells for ${config.salePrice}`
        )
      );

      const controls = element("div", "button-row");
      const selectButton = makeButton("Select", () => {
        selectedSpecies = species;
        message = `${config.displayName} selected.`;
        renderAll();
      });
      selectButton.setAttribute("aria-pressed", `${selectedSpecies === species}`);
      selectButton.className = selectedSpecies === species ? "selected" : "";
      controls.append(
        selectButton,
        makeButton(`Buy seed (${config.seedCost})`, () => dispatch(buySeed(state, species)), {
          disabled: state.coins < config.seedCost,
          ariaLabel: `Buy ${config.displayName} seed for ${config.seedCost} coins`
        })
      );
      row.append(info, controls);
      shopPanel.append(row);
    }
  }

  function renderInventory(): void {
    inventoryPanel.replaceChildren(element("h2", undefined, "Inventory"));
    const entries = getInventoryEntries(state);
    if (entries.length === 0) {
      inventoryPanel.append(element("p", "panel-help", "Your barn is empty. Harvest something!"));
      return;
    }

    const list = element("ul", "inventory-list");
    for (const entry of entries) {
      const item = ITEMS[entry.itemId];
      const row = element("li");
      row.append(element("span", undefined, `${item.emoji} ${item.displayName} × ${entry.count}`));

      if (item.category === "produce") {
        row.append(
          makeButton(
            `Sell 1 (${item.salePrice})`,
            () => dispatch(sellItem(state, entry.itemId as ItemId)),
            { ariaLabel: `Sell one ${item.displayName} for ${item.salePrice} coins` }
          )
        );
      }
      list.append(row);
    }
    inventoryPanel.append(list);
  }

  function renderAnimals(): void {
    animalPanel.replaceChildren(
      element("h2", undefined, "Animals"),
      element("p", "panel-help", `Animal spaces used: ${state.animals.length} of ${ANIMAL_CAPACITY}.`)
    );

    const buyGrid = element("div", "buy-grid");
    const allSpecies: AnimalSpecies[] = [...LIVESTOCK_SPECIES_LIST, ...PET_SPECIES_LIST];
    for (const species of allSpecies) {
      const cost = getAnimalCost(species);
      const label = getAnimalName(species);
      const disabled = state.coins < cost || state.animals.length >= ANIMAL_CAPACITY;
      buyGrid.append(
        makeButton(
          `${getAnimalEmoji(species)} Buy ${label} (${cost})`,
          () => dispatch(buyAnimal(state, species)),
          { disabled, ariaLabel: `Buy ${label} for ${cost} coins` }
        )
      );
    }
    animalPanel.append(buyGrid);

    if (state.animals.length === 0) {
      animalPanel.append(
        element("p", "panel-help", "No animals yet. A cow or goat produces milk; pets need care.")
      );
      return;
    }

    const list = element("ul", "animal-list");
    for (const animal of state.animals) {
      const item = element("li", "animal-card");
      const status = element("p", "animal-status", getAnimalStatus(animal));
      status.dataset.live = `animal-status-${animal.id}`;
      const progress = makeProgress(getAnimalProgress(animal), `${getAnimalName(animal.species)} progress`);
      progress.dataset.live = `animal-progress-${animal.id}`;
      item.append(
        element("h3", undefined, `${getAnimalEmoji(animal.species)} ${getAnimalName(animal.species)}`),
        status,
        progress
      );

      const controls = element("div", "button-row");
      const feedCost = getAnimalFeedCost(animal.species);
      controls.append(
        makeButton(`Feed (${feedCost})`, () => dispatch(feedAnimal(state, animal.id)), {
          disabled:
            state.coins < feedCost ||
            (animal.kind === "livestock" && (animal.productionActive || animal.productReady)),
          ariaLabel: `Feed ${getAnimalName(animal.species)} for ${feedCost} coins`
        })
      );

      if (animal.kind === "livestock") {
        controls.append(
          makeButton("Collect", () => dispatch(collectAnimal(state, animal.id)), {
            disabled: !animal.productReady,
            ariaLabel: `Collect milk from ${getAnimalName(animal.species)}`
          })
        );
      } else {
        controls.append(
          makeButton("Pet", () => dispatch(petAnimal(state, animal.id)), {
            ariaLabel: `Pet ${getAnimalName(animal.species)}`
          })
        );
      }

      item.append(controls);
      list.append(item);
    }
    animalPanel.append(list);
  }

  function renderPlots(): void {
    plotControlsHost.replaceChildren(
      element("h3", undefined, "Plot controls"),
      createPlotControls(state, handlePlot)
    );

    plotControlsHost.querySelectorAll("button").forEach((button, index) => {
      button.dataset.live = `plot-${index}`;
    });
  }

  function renderMessage(): void {
    messageBanner.textContent = message;
    liveRegion.textContent = message;
  }

  function updateLiveValues(): void {
    for (const plot of state.plots) {
      const button = plotControlsHost.querySelector<HTMLButtonElement>(`[data-live="plot-${plot.id}"]`);
      if (button) {
        const stage = getCropStage(plot);
        const action =
          stage === "empty" ? "Plant" : stage === "dry" ? "Water" : stage === "ripe" ? "Harvest" : "Check";
        button.textContent = `${action} · ${getPlotLabel(plot)}`;
        button.setAttribute("aria-label", `${action} ${getPlotLabel(plot)}`);
      }
    }

    for (const animal of state.animals) {
      const status = animalPanel.querySelector<HTMLElement>(`[data-live="animal-status-${animal.id}"]`);
      if (status) {
        status.textContent = getAnimalStatus(animal);
      }
      const progress = animalPanel.querySelector<HTMLProgressElement>(
        `[data-live="animal-progress-${animal.id}"]`
      );
      if (progress) {
        progress.value = getAnimalProgress(animal);
      }
    }
  }

  function renderAll(): void {
    renderStatus();
    renderShop();
    renderInventory();
    renderAnimals();
    renderPlots();
    renderMessage();
    scene.setGameState(state);
    milestone = computeMilestone();
  }

  function tick(): void {
    state = advanceTime(state, Date.now());
    if (Date.now() - lastSavedAt >= 5000) {
      saveNow();
    }
    if (computeMilestone() !== milestone) {
      renderAll();
    } else {
      renderStatus();
      updateLiveValues();
      scene.setGameState(state);
    }
  }

  const simulationTimer = window.setInterval(tick, SIMULATION_INTERVAL_MS);

  window.__SUNNY_ACRES__ = {
    getState: () => state,
    advance: (elapsedMs: number) => {
      state = advanceTime(state, Date.now() + elapsedMs);
      saveNow();
      renderAll();
    },
    reset: () => {
      resetGame(storage);
      state = createNewGame(Date.now());
      message = "Started a fresh farm.";
      saveNow();
      renderAll();
    }
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      saveNow();
    } else {
      state = advanceTime(state, Date.now());
      renderAll();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  renderAll();
  scene.resize();

  window.addEventListener("beforeunload", () => {
    saveNow();
    window.clearInterval(simulationTimer);
    scene.dispose();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
}
