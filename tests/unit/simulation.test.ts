import { describe, expect, it } from "vitest";
import { buyAnimal, buySeed, feedAnimal, plantSeed, waterPlot } from "../../src/game/actions";
import { CROPS, LIVESTOCK, MINUTE_MS, OFFLINE_CAP_MS } from "../../src/game/data";
import { advanceTime } from "../../src/game/simulation";
import { createNewGame } from "../../src/game/state";
import type { GameState, LivestockAnimal } from "../../src/game/types";

const NOW = 5_000_000;

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

describe("advanceTime", () => {
  it("does not grow dry crops", () => {
    const state = plantSeed(newGame(), 0, "wheat").state;
    const advanced = advanceTime(state, NOW + 60_000);
    expect(advanced.plots[0]?.crop?.growthMs).toBe(0);
  });

  it("grows watered crops to exactly their duration and no further", () => {
    const state = waterPlot(plantSeed(newGame(), 0, "wheat").state, 0).state;
    const half = advanceTime(state, NOW + CROPS.wheat.growthMs / 2);
    expect(half.plots[0]?.crop?.growthMs).toBe(CROPS.wheat.growthMs / 2);

    const ripe = advanceTime(half, NOW + CROPS.wheat.growthMs * 2);
    expect(ripe.plots[0]?.crop?.growthMs).toBe(CROPS.wheat.growthMs);
  });

  it("handles zero, negative, and non-finite timestamps safely", () => {
    const state = waterPlot(plantSeed(newGame(), 0, "wheat").state, 0).state;
    expect(advanceTime(state, NOW)).toBe(state);
    expect(advanceTime(state, Number.NaN)).toBe(state);

    const backwards = advanceTime(state, NOW - 10_000);
    expect(backwards.lastTickAt).toBe(NOW - 10_000);
    expect(backwards.plots[0]?.crop?.growthMs).toBe(0);
  });

  it("caps offline progress at eight hours", () => {
    const state = waterPlot(plantSeed(buySeed(newGame(), "tomato").state, 0, "tomato").state, 0).state;
    const advanced = advanceTime(state, NOW + OFFLINE_CAP_MS * 3);
    expect(advanced.plots[0]?.crop?.growthMs).toBe(CROPS.tomato.growthMs);
    expect(advanced.lastTickAt).toBe(NOW + OFFLINE_CAP_MS * 3);
  });

  it("produces milk when fed and stops when ready", () => {
    const bought = buyAnimal(newGame(), "goat").state;
    const fed = feedAnimal(bought, 1).state;
    const half = advanceTime(fed, NOW + LIVESTOCK.goat.productionMs / 2);
    expect(findLivestock(half).productionMs).toBe(LIVESTOCK.goat.productionMs / 2);
    expect(findLivestock(half).productReady).toBe(false);

    const ready = advanceTime(half, NOW + LIVESTOCK.goat.productionMs * 2);
    expect(findLivestock(ready).productReady).toBe(true);
    expect(findLivestock(ready).productionActive).toBe(false);
    expect(findLivestock(ready).productionMs).toBe(LIVESTOCK.goat.productionMs);
  });

  it("pauses production when hunger reaches zero and resumes after feeding", () => {
    const bought = buyAnimal(newGame(), "goat").state;
    const fed = feedAnimal(bought, 1).state;
    const starving: GameState = {
      ...fed,
      animals: fed.animals.map((animal) =>
        animal.kind === "livestock" ? { ...animal, hunger: 0.5 } : animal
      )
    };

    const paused = advanceTime(starving, NOW + MINUTE_MS);
    expect(findLivestock(paused).hunger).toBe(0);
    expect(findLivestock(paused).productionActive).toBe(false);
    expect(findLivestock(paused).productionMs).toBe(MINUTE_MS / 2);

    const refed = feedAnimal(paused, 1);
    expect(refed.ok).toBe(true);
    expect(findLivestock(refed.state).productionActive).toBe(true);

    const finished = advanceTime(refed.state, NOW + MINUTE_MS + LIVESTOCK.goat.productionMs);
    expect(findLivestock(finished).productReady).toBe(true);
  });

  it("decays pet hunger and happiness without going below zero", () => {
    const pet = buyAnimal(newGame(), "dog").state;
    const decayed = advanceTime(pet, NOW + 10 * MINUTE_MS);
    const dog = decayed.animals[0];
    if (!dog || dog.kind !== "pet") {
      throw new Error("Expected pet");
    }
    expect(dog.hunger).toBe(90);
    expect(dog.happiness).toBe(90);

    const clamped = advanceTime(decayed, NOW + 200 * MINUTE_MS);
    const hungryDog = clamped.animals[0];
    if (!hungryDog || hungryDog.kind !== "pet") {
      throw new Error("Expected pet");
    }
    expect(hungryDog.hunger).toBe(0);
    expect(hungryDog.happiness).toBe(0);
  });
});
