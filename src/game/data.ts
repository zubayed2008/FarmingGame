import {
  LIVESTOCK_SPECIES,
  PET_SPECIES,
  type CropSpecies,
  type ItemId,
  type LivestockSpecies,
  type PetSpecies
} from "./types";

export interface CropConfig {
  displayName: string;
  emoji: string;
  seedItem: ItemId;
  produceItem: ItemId;
  seedCost: number;
  growthMs: number;
  yieldAmount: number;
  salePrice: number;
}

export interface LivestockConfig {
  displayName: string;
  emoji: string;
  purchaseCost: number;
  feedCost: number;
  productionMs: number;
  outputItem: ItemId;
  outputAmount: number;
  salePrice: number;
}

export interface PetConfig {
  displayName: string;
  emoji: string;
  purchaseCost: number;
  feedCost: number;
}

export interface ItemConfig {
  displayName: string;
  emoji: string;
  category: "seed" | "produce";
  salePrice: number;
}

export const STARTING_COINS = 100;
export const STARTING_INVENTORY: Partial<Record<ItemId, number>> = { wheatSeed: 1 };
export const PLOT_COUNT = 6;
export const PLOT_COLUMNS = 3;
export const ANIMAL_CAPACITY = 4;
export const MAX_STAT = 100;
export const STAT_DECAY_PER_MINUTE = 1;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

export const CROPS: Record<CropSpecies, CropConfig> = {
  wheat: {
    displayName: "Wheat",
    emoji: "🌾",
    seedItem: "wheatSeed",
    produceItem: "wheat",
    seedCost: 5,
    growthMs: 20_000,
    yieldAmount: 2,
    salePrice: 5
  },
  carrot: {
    displayName: "Carrot",
    emoji: "🥕",
    seedItem: "carrotSeed",
    produceItem: "carrot",
    seedCost: 8,
    growthMs: 30_000,
    yieldAmount: 2,
    salePrice: 8
  },
  rice: {
    displayName: "Rice",
    emoji: "🌾",
    seedItem: "riceSeed",
    produceItem: "rice",
    seedCost: 12,
    growthMs: 45_000,
    yieldAmount: 2,
    salePrice: 12
  },
  tomato: {
    displayName: "Tomato",
    emoji: "🍅",
    seedItem: "tomatoSeed",
    produceItem: "tomato",
    seedCost: 18,
    growthMs: 60_000,
    yieldAmount: 3,
    salePrice: 12
  }
};

export const CROP_SPECIES_LIST = Object.keys(CROPS) as CropSpecies[];

export const LIVESTOCK: Record<LivestockSpecies, LivestockConfig> = {
  cow: {
    displayName: "Cow",
    emoji: "🐄",
    purchaseCost: 80,
    feedCost: 5,
    productionMs: 90_000,
    outputItem: "cowMilk",
    outputAmount: 1,
    salePrice: 25
  },
  goat: {
    displayName: "Goat",
    emoji: "🐐",
    purchaseCost: 60,
    feedCost: 4,
    productionMs: 60_000,
    outputItem: "goatMilk",
    outputAmount: 1,
    salePrice: 20
  }
};

export const PETS: Record<PetSpecies, PetConfig> = {
  dog: {
    displayName: "Dog",
    emoji: "🐕",
    purchaseCost: 40,
    feedCost: 3
  },
  cat: {
    displayName: "Cat",
    emoji: "🐈",
    purchaseCost: 40,
    feedCost: 3
  }
};

export const LIVESTOCK_SPECIES_LIST = Object.keys(LIVESTOCK) as LivestockSpecies[];
export const PET_SPECIES_LIST = Object.keys(PETS) as PetSpecies[];

export const ITEMS: Record<ItemId, ItemConfig> = {
  wheatSeed: { displayName: "Wheat seed", emoji: "🌱", category: "seed", salePrice: 0 },
  carrotSeed: { displayName: "Carrot seed", emoji: "🌱", category: "seed", salePrice: 0 },
  riceSeed: { displayName: "Rice seed", emoji: "🌱", category: "seed", salePrice: 0 },
  tomatoSeed: { displayName: "Tomato seed", emoji: "🌱", category: "seed", salePrice: 0 },
  wheat: { displayName: "Wheat", emoji: "🌾", category: "produce", salePrice: CROPS.wheat.salePrice },
  carrot: { displayName: "Carrot", emoji: "🥕", category: "produce", salePrice: CROPS.carrot.salePrice },
  rice: { displayName: "Rice", emoji: "🌾", category: "produce", salePrice: CROPS.rice.salePrice },
  tomato: { displayName: "Tomato", emoji: "🍅", category: "produce", salePrice: CROPS.tomato.salePrice },
  cowMilk: { displayName: "Cow milk", emoji: "🥛", category: "produce", salePrice: LIVESTOCK.cow.salePrice },
  goatMilk: { displayName: "Goat milk", emoji: "🥛", category: "produce", salePrice: LIVESTOCK.goat.salePrice }
};

export const ITEM_IDS_LIST = Object.keys(ITEMS) as ItemId[];

export function isLivestockSpecies(species: string): species is LivestockSpecies {
  return (LIVESTOCK_SPECIES as readonly string[]).includes(species);
}

export function isPetSpecies(species: string): species is PetSpecies {
  return (PET_SPECIES as readonly string[]).includes(species);
}

export function getAnimalCost(species: LivestockSpecies | PetSpecies): number {
  return isLivestockSpecies(species) ? LIVESTOCK[species].purchaseCost : PETS[species].purchaseCost;
}

export function getAnimalFeedCost(species: LivestockSpecies | PetSpecies): number {
  return isLivestockSpecies(species) ? LIVESTOCK[species].feedCost : PETS[species].feedCost;
}

export function getAnimalName(species: LivestockSpecies | PetSpecies): string {
  return isLivestockSpecies(species) ? LIVESTOCK[species].displayName : PETS[species].displayName;
}

export function getAnimalEmoji(species: LivestockSpecies | PetSpecies): string {
  return isLivestockSpecies(species) ? LIVESTOCK[species].emoji : PETS[species].emoji;
}
