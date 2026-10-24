import {
  ANIMAL_CAPACITY,
  CROPS,
  ITEMS,
  LIVESTOCK,
  MAX_STAT,
  PETS,
  getAnimalCost,
  getAnimalFeedCost,
  getAnimalName,
  isLivestockSpecies
} from "./data";
import { addItem, cloneState, fail, getItemCount, ok, removeItem } from "./state";
import type {
  ActionResult,
  Animal,
  AnimalSpecies,
  CropSpecies,
  GameState,
  ItemId
} from "./types";

function validQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

export function buySeed(state: GameState, species: CropSpecies, quantity = 1): ActionResult {
  if (!validQuantity(quantity)) {
    return fail(state, "Choose a whole number of seeds to buy.");
  }

  const crop = CROPS[species];
  const totalCost = crop.seedCost * quantity;

  if (state.coins < totalCost) {
    return fail(state, `You need ${totalCost} coins to buy ${quantity} ${crop.displayName} seed(s).`);
  }

  const next = cloneState(state);
  next.coins -= totalCost;
  addItem(next, crop.seedItem, quantity);
  return ok(next, `Bought ${quantity} ${crop.displayName} seed(s).`);
}

export function plantSeed(state: GameState, plotId: number, species: CropSpecies): ActionResult {
  const plot = state.plots.find((candidate) => candidate.id === plotId);

  if (!plot) {
    return fail(state, "That plot does not exist.");
  }

  if (plot.crop) {
    return fail(state, "That plot already has a crop.");
  }

  const crop = CROPS[species];
  if (getItemCount(state, crop.seedItem) < 1) {
    return fail(state, `You have no ${crop.displayName} seeds. Buy some in the shop first.`);
  }

  const next = cloneState(state);
  removeItem(next, crop.seedItem, 1);
  const target = next.plots.find((candidate) => candidate.id === plotId);
  if (!target) {
    return fail(state, "That plot does not exist.");
  }
  target.crop = { species, watered: false, growthMs: 0 };
  return ok(next, `Planted ${crop.displayName}. Water it to start growing.`);
}

export function waterPlot(state: GameState, plotId: number): ActionResult {
  const plot = state.plots.find((candidate) => candidate.id === plotId);

  if (!plot?.crop) {
    return fail(state, "There is nothing to water in that plot.");
  }

  if (plot.crop.watered) {
    return fail(state, "That crop is already watered.");
  }

  const next = cloneState(state);
  const target = next.plots.find((candidate) => candidate.id === plotId);
  if (!target?.crop) {
    return fail(state, "There is nothing to water in that plot.");
  }
  target.crop.watered = true;
  return ok(next, `Watered the ${CROPS[target.crop.species].displayName}.`);
}

export function harvestPlot(state: GameState, plotId: number): ActionResult {
  const plot = state.plots.find((candidate) => candidate.id === plotId);

  if (!plot?.crop) {
    return fail(state, "There is nothing to harvest in that plot.");
  }

  const crop = CROPS[plot.crop.species];
  if (!plot.crop.watered || plot.crop.growthMs < crop.growthMs) {
    return fail(state, `The ${crop.displayName} is not ready yet.`);
  }

  const next = cloneState(state);
  addItem(next, crop.produceItem, crop.yieldAmount);
  const target = next.plots.find((candidate) => candidate.id === plotId);
  if (!target) {
    return fail(state, "That plot does not exist.");
  }
  target.crop = null;
  return ok(next, `Harvested ${crop.yieldAmount} ${crop.displayName}.`);
}

export function sellItem(state: GameState, itemId: ItemId, quantity = 1): ActionResult {
  if (!validQuantity(quantity)) {
    return fail(state, "Choose a whole number of items to sell.");
  }

  const item = ITEMS[itemId];
  if (item.category !== "produce") {
    return fail(state, "Seeds cannot be sold.");
  }

  const owned = getItemCount(state, itemId);
  if (owned < quantity) {
    return fail(state, `You only have ${owned} ${item.displayName}.`);
  }

  const next = cloneState(state);
  removeItem(next, itemId, quantity);
  next.coins += item.salePrice * quantity;
  return ok(next, `Sold ${quantity} ${item.displayName} for ${item.salePrice * quantity} coins.`);
}

export function buyAnimal(state: GameState, species: AnimalSpecies): ActionResult {
  if (state.animals.length >= ANIMAL_CAPACITY) {
    return fail(state, "All animal spaces are full.");
  }

  const cost = getAnimalCost(species);
  const name = getAnimalName(species);

  if (state.coins < cost) {
    return fail(state, `You need ${cost} coins to welcome a ${name}.`);
  }

  const next = cloneState(state);
  next.coins -= cost;

  let animal: Animal;
  if (isLivestockSpecies(species)) {
    animal = {
      id: next.nextAnimalId,
      kind: "livestock",
      species,
      hunger: MAX_STAT,
      productionMs: 0,
      productionActive: false,
      productReady: false
    };
  } else {
    animal = {
      id: next.nextAnimalId,
      kind: "pet",
      species,
      hunger: MAX_STAT,
      happiness: MAX_STAT
    };
  }

  next.animals.push(animal);
  next.nextAnimalId += 1;
  return ok(next, isLivestockSpecies(species) ? `Bought a ${name}.` : `Adopted a ${name}.`);
}

export function feedAnimal(state: GameState, animalId: number): ActionResult {
  const animal = state.animals.find((candidate) => candidate.id === animalId);

  if (!animal) {
    return fail(state, "That animal does not exist.");
  }

  const name = getAnimalName(animal.species);
  const cost = getAnimalFeedCost(animal.species);

  if (state.coins < cost) {
    return fail(state, `You need ${cost} coins to feed the ${name}.`);
  }

  if (animal.kind === "livestock") {
    if (animal.productReady) {
      return fail(state, `Collect the ${name}'s milk before feeding again.`);
    }
    if (animal.productionActive) {
      return fail(state, `The ${name} is already working on milk.`);
    }
  }

  const next = cloneState(state);
  next.coins -= cost;
  const target = next.animals.find((candidate) => candidate.id === animalId);
  if (!target) {
    return fail(state, "That animal does not exist.");
  }

  target.hunger = MAX_STAT;
  if (target.kind === "livestock") {
    target.productionActive = true;
  }

  return ok(next, `Fed the ${name}.`);
}

export function collectAnimal(state: GameState, animalId: number): ActionResult {
  const animal = state.animals.find((candidate) => candidate.id === animalId);

  if (!animal) {
    return fail(state, "That animal does not exist.");
  }

  if (animal.kind !== "livestock") {
    return fail(state, "Pets do not produce anything to collect.");
  }

  if (!animal.productReady) {
    return fail(state, "There is nothing to collect yet.");
  }

  const config = LIVESTOCK[animal.species];
  const next = cloneState(state);
  addItem(next, config.outputItem, config.outputAmount);
  const target = next.animals.find((candidate) => candidate.id === animalId);
  if (!target || target.kind !== "livestock") {
    return fail(state, "That animal does not exist.");
  }
  target.productReady = false;
  target.productionActive = false;
  target.productionMs = 0;

  return ok(next, `Collected ${config.outputAmount} ${ITEMS[config.outputItem].displayName}.`);
}

export function petAnimal(state: GameState, animalId: number): ActionResult {
  const animal = state.animals.find((candidate) => candidate.id === animalId);

  if (!animal) {
    return fail(state, "That animal does not exist.");
  }

  if (animal.kind !== "pet") {
    return fail(state, "Only pets enjoy being petted.");
  }

  const next = cloneState(state);
  const target = next.animals.find((candidate) => candidate.id === animalId);
  if (!target || target.kind !== "pet") {
    return fail(state, "That animal does not exist.");
  }
  target.happiness = MAX_STAT;

  return ok(next, `Petted the ${PETS[target.species].displayName}.`);
}
