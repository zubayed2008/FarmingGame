import { PLOT_COUNT, STARTING_COINS, STARTING_INVENTORY } from "./data";
import type { ActionResult, GameState, ItemId, Plot } from "./types";

export function createNewGame(now: number): GameState {
  const plots: Plot[] = Array.from({ length: PLOT_COUNT }, (_, id) => ({ id, crop: null }));

  return {
    version: 1,
    coins: STARTING_COINS,
    inventory: { ...STARTING_INVENTORY },
    plots,
    animals: [],
    nextAnimalId: 1,
    lastTickAt: now
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    inventory: { ...state.inventory },
    plots: state.plots.map((plot) => ({
      id: plot.id,
      crop: plot.crop ? { ...plot.crop } : null
    })),
    animals: state.animals.map((animal) => ({ ...animal }))
  };
}

export function ok(state: GameState, message: string): ActionResult {
  return { ok: true, state, message };
}

export function fail(state: GameState, message: string): ActionResult {
  return { ok: false, state, message };
}

export function getItemCount(state: GameState, itemId: ItemId): number {
  return state.inventory[itemId] ?? 0;
}

export function addItem(state: GameState, itemId: ItemId, amount: number): void {
  state.inventory[itemId] = getItemCount(state, itemId) + amount;
}

export function removeItem(state: GameState, itemId: ItemId, amount: number): void {
  const remaining = getItemCount(state, itemId) - amount;
  if (remaining <= 0) {
    delete state.inventory[itemId];
    return;
  }
  state.inventory[itemId] = remaining;
}
