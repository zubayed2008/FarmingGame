import { CROPS, LIVESTOCK, MAX_STAT, PETS, getAnimalName } from "./data";
import { getItemCount } from "./state";
import type { Animal, CropSpecies, GameState, ItemId, Plot } from "./types";

export type CropStage = "empty" | "dry" | "growing" | "ripe";

export function getCropStage(plot: Plot): CropStage {
  if (!plot.crop) {
    return "empty";
  }
  if (!plot.crop.watered) {
    return "dry";
  }
  const config = CROPS[plot.crop.species];
  return plot.crop.growthMs >= config.growthMs ? "ripe" : "growing";
}

export function getCropProgress(plot: Plot): number {
  if (!plot.crop) {
    return 0;
  }
  const config = CROPS[plot.crop.species];
  return Math.min(1, plot.crop.growthMs / config.growthMs);
}

export function getCropRemainingMs(plot: Plot): number {
  if (!plot.crop) {
    return 0;
  }
  const config = CROPS[plot.crop.species];
  return Math.max(0, config.growthMs - plot.crop.growthMs);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function getAnimalStatus(animal: Animal): string {
  if (animal.kind === "pet") {
    return `${PETS[animal.species].displayName} · hunger ${Math.round(animal.hunger)} · happiness ${Math.round(animal.happiness)}`;
  }

  const config = LIVESTOCK[animal.species];
  if (animal.productReady) {
    return `${config.displayName} · milk ready`;
  }
  if (animal.productionActive) {
    const remaining = Math.max(0, config.productionMs - animal.productionMs);
    return `${config.displayName} · working (${formatDuration(remaining)})`;
  }
  return `${config.displayName} · needs feeding`;
}

export function getAnimalProgress(animal: Animal): number {
  if (animal.kind === "pet") {
    return animal.happiness / MAX_STAT;
  }
  const config = LIVESTOCK[animal.species];
  if (animal.productReady) {
    return 1;
  }
  return Math.min(1, animal.productionMs / config.productionMs);
}

export function getInventoryEntries(state: GameState): Array<{ itemId: ItemId; count: number }> {
  return (Object.keys(state.inventory) as ItemId[])
    .map((itemId) => ({ itemId, count: getItemCount(state, itemId) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function getPlotLabel(plot: Plot): string {
  if (!plot.crop) {
    return `Plot ${plot.id + 1}: empty`;
  }
  const config = CROPS[plot.crop.species];
  const stage = getCropStage(plot);
  if (stage === "dry") {
    return `Plot ${plot.id + 1}: dry ${config.displayName}`;
  }
  if (stage === "ripe") {
    return `Plot ${plot.id + 1}: ripe ${config.displayName}`;
  }
  return `Plot ${plot.id + 1}: ${config.displayName} growing, ${formatDuration(getCropRemainingMs(plot))} left`;
}

export function getSpeciesLabel(species: CropSpecies): string {
  return CROPS[species].displayName;
}

export function getAnimalLabel(animal: Animal): string {
  return getAnimalName(animal.species);
}
