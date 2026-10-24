import { describe, expect, it } from "vitest";
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
} from "../../src/game/actions";
import { ANIMAL_CAPACITY, CROPS, LIVESTOCK, PETS } from "../../src/game/data";
import { createNewGame, getItemCount } from "../../src/game/state";
import type { GameState, LivestockAnimal, PetAnimal } from "../../src/game/types";

const NOW = 1_000_000;

function newGame(): GameState {
  return createNewGame(NOW);
}

function findLivestock(state: GameState, id = 1): LivestockAnimal {
  const animal = state.animals.find((candidate) => candidate.id === id);
  if (!animal || animal.kind !== "livestock") {
    throw new Error("Expected livestock");
  }
  return animal;
}

function findPet(state: GameState, id = 1): PetAnimal {
  const animal = state.animals.find((candidate) => candidate.id === id);
  if (!animal || animal.kind !== "pet") {
    throw new Error("Expected pet");
  }
  return animal;
}

describe("new game", () => {
  it("starts with coins, one wheat seed, six plots, and no animals", () => {
    const state = newGame();
    expect(state.coins).toBe(100);
    expect(getItemCount(state, "wheatSeed")).toBe(1);
    expect(state.plots).toHaveLength(6);
    expect(state.animals).toHaveLength(0);
    expect(state.lastTickAt).toBe(NOW);
  });
});

describe("crops", () => {
  it("buys seeds and rejects unaffordable purchases", () => {
    const bought = buySeed(newGame(), "carrot", 2);
    expect(bought.ok).toBe(true);
    expect(bought.state.coins).toBe(84);
    expect(getItemCount(bought.state, "carrotSeed")).toBe(2);

    const rejected = buySeed(newGame(), "tomato", 10);
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toEqual(newGame());
  });

  it("plants a seed, waters it, and rejects invalid transitions", () => {
    const planted = plantSeed(newGame(), 0, "wheat");
    expect(planted.ok).toBe(true);
    expect(getItemCount(planted.state, "wheatSeed")).toBe(0);
    expect(planted.state.plots[0]?.crop).toEqual({ species: "wheat", watered: false, growthMs: 0 });

    const noSeed = plantSeed(planted.state, 1, "wheat");
    expect(noSeed.ok).toBe(false);
    expect(noSeed.state).toEqual(planted.state);

    const watered = waterPlot(planted.state, 0);
    expect(watered.ok).toBe(true);
    expect(watered.state.plots[0]?.crop?.watered).toBe(true);

    const doubleWater = waterPlot(watered.state, 0);
    expect(doubleWater.ok).toBe(false);
    expect(doubleWater.state).toEqual(watered.state);
  });

  it("rejects harvesting before growth and harvests the configured yield when ripe", () => {
    let state = waterPlot(plantSeed(newGame(), 0, "wheat").state, 0).state;
    const early = harvestPlot(state, 0);
    expect(early.ok).toBe(false);

    state = {
      ...state,
      plots: state.plots.map((plot) =>
        plot.id === 0 && plot.crop
          ? { ...plot, crop: { ...plot.crop, growthMs: CROPS.wheat.growthMs } }
          : plot
      )
    };

    const harvested = harvestPlot(state, 0);
    expect(harvested.ok).toBe(true);
    expect(harvested.state.plots[0]?.crop).toBeNull();
    expect(getItemCount(harvested.state, "wheat")).toBe(CROPS.wheat.yieldAmount);
  });

  it("sells produce but never seeds", () => {
    const harvested = harvestPlot(
      {
        ...newGame(),
        plots: newGame().plots.map((plot) =>
          plot.id === 0
            ? { id: 0, crop: { species: "wheat" as const, watered: true, growthMs: CROPS.wheat.growthMs } }
            : plot
        )
      },
      0
    ).state;

    const sold = sellItem(harvested, "wheat", 1);
    expect(sold.ok).toBe(true);
    expect(sold.state.coins).toBe(105);
    expect(getItemCount(sold.state, "wheat")).toBe(1);

    const seedSale = sellItem(harvested, "wheatSeed");
    expect(seedSale.ok).toBe(false);
  });
});

describe("animals", () => {
  it("buys livestock and pets while enforcing coins and capacity", () => {
    const cow = buyAnimal(newGame(), "cow");
    expect(cow.ok).toBe(true);
    expect(cow.state.coins).toBe(20);
    expect(findLivestock(cow.state)).toMatchObject({
      species: "cow",
      productionActive: false,
      productReady: false
    });

    const tooPoor = buyAnimal({ ...newGame(), coins: 10 }, "cow");
    expect(tooPoor.ok).toBe(false);

    let full: GameState = { ...newGame(), coins: 1000 };
    for (let index = 0; index < ANIMAL_CAPACITY; index += 1) {
      full = buyAnimal(full, "goat").state;
    }
    const overCapacity = buyAnimal(full, "goat");
    expect(overCapacity.ok).toBe(false);
    expect(overCapacity.state).toEqual(full);
  });

  it("feeds, produces, collects, and prevents feeding while busy", () => {
    let state = buyAnimal(newGame(), "goat").state;
    const fed = feedAnimal(state, 1);
    expect(fed.ok).toBe(true);
    expect(findLivestock(fed.state).productionActive).toBe(true);
    expect(fed.state.coins).toBe(100 - LIVESTOCK.goat.purchaseCost - LIVESTOCK.goat.feedCost);

    const busy = feedAnimal(fed.state, 1);
    expect(busy.ok).toBe(false);

    state = {
      ...fed.state,
      animals: fed.state.animals.map((animal) =>
        animal.kind === "livestock"
          ? { ...animal, productionMs: LIVESTOCK.goat.productionMs, productReady: true, productionActive: false }
          : animal
      )
    };

    const readyFeed = feedAnimal(state, 1);
    expect(readyFeed.ok).toBe(false);

    const collected = collectAnimal(state, 1);
    expect(collected.ok).toBe(true);
    expect(getItemCount(collected.state, "goatMilk")).toBe(1);
    expect(findLivestock(collected.state).productReady).toBe(false);
  });

  it("feeds and pets pets but never collects from them", () => {
    let state = buyAnimal(newGame(), "cat").state;
    expect(findPet(state).happiness).toBe(100);

    state = {
      ...state,
      animals: state.animals.map((animal) =>
        animal.kind === "pet" ? { ...animal, hunger: 10, happiness: 20 } : animal
      )
    };

    const fed = feedAnimal(state, 1);
    expect(fed.ok).toBe(true);
    expect(findPet(fed.state).hunger).toBe(100);
    expect(fed.state.coins).toBe(100 - PETS.cat.purchaseCost - PETS.cat.feedCost);

    const petted = petAnimal(fed.state, 1);
    expect(petted.ok).toBe(true);
    expect(findPet(petted.state).happiness).toBe(100);

    const collected = collectAnimal(petted.state, 1);
    expect(collected.ok).toBe(false);

    const wrongPet = petAnimal(buyAnimal(newGame(), "cow").state, 1);
    expect(wrongPet.ok).toBe(false);
  });
});
