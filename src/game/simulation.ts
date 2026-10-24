import {
  CROPS,
  LIVESTOCK,
  MAX_STAT,
  MINUTE_MS,
  OFFLINE_CAP_MS,
  STAT_DECAY_PER_MINUTE
} from "./data";
import { cloneState } from "./state";
import type { GameState } from "./types";

export function advanceTime(
  state: GameState,
  now: number,
  maxElapsedMs = OFFLINE_CAP_MS
): GameState {
  if (!Number.isFinite(now) || !Number.isFinite(state.lastTickAt)) {
    return state;
  }

  const rawDelta = now - state.lastTickAt;
  if (rawDelta <= 0) {
    if (rawDelta < 0) {
      return { ...cloneState(state), lastTickAt: now };
    }
    return state;
  }

  const delta = Math.min(rawDelta, maxElapsedMs);
  const next = cloneState(state);
  next.lastTickAt = now;

  const decay = (delta / MINUTE_MS) * STAT_DECAY_PER_MINUTE;

  next.plots = next.plots.map((plot) => {
    if (!plot.crop?.watered) {
      return plot;
    }

    const cropConfig = CROPS[plot.crop.species];
    if (plot.crop.growthMs >= cropConfig.growthMs) {
      return plot;
    }

    return {
      id: plot.id,
      crop: {
        ...plot.crop,
        growthMs: Math.min(cropConfig.growthMs, plot.crop.growthMs + delta)
      }
    };
  });

  next.animals = next.animals.map((animal) => {
    if (animal.kind === "pet") {
      return {
        ...animal,
        hunger: Math.max(0, animal.hunger - decay),
        happiness: Math.max(0, animal.happiness - decay)
      };
    }

    const config = LIVESTOCK[animal.species];
    const hunger = Math.max(0, animal.hunger - decay);
    let productionMs = animal.productionMs;
    let productionActive = animal.productionActive;
    let productReady = animal.productReady;

    if (productionActive && !productReady) {
      const timeUntilHungry = animal.hunger > 0 ? (animal.hunger / STAT_DECAY_PER_MINUTE) * MINUTE_MS : 0;
      const productiveMs = Math.min(delta, timeUntilHungry);
      productionMs = Math.min(config.productionMs, productionMs + productiveMs);

      if (productionMs >= config.productionMs) {
        productReady = true;
        productionActive = false;
      } else if (hunger <= 0) {
        productionActive = false;
      }
    }

    return {
      ...animal,
      hunger: Math.min(MAX_STAT, hunger),
      productionMs,
      productionActive,
      productReady
    };
  });

  return next;
}
